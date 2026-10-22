import express, { type ErrorRequestHandler, type Request } from 'express'
import { z } from 'zod'
import { InMemoryLinkStore, type Link, type LinkStore } from './store.js'
import { generateSlug, RESERVED_SLUGS } from './slug.js'

const createLinkSchema = z.object({
  url: z
    .string()
    .url()
    .refine((value) => /^https?:\/\//i.test(value), 'Only http and https URLs are allowed'),
  slug: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{3,32}$/, 'Slug must be 3-32 letters, numbers, dashes or underscores')
    .refine((value) => !RESERVED_SLUGS.has(value.toLowerCase()), 'This slug is reserved')
    .optional(),
  expiresAt: z
    .string()
    .datetime()
    .refine((value) => new Date(value) > new Date(), 'Expiry must be in the future')
    .optional(),
})

function isExpired(link: Link, now = new Date()): boolean {
  return link.expiresAt !== null && new Date(link.expiresAt) <= now
}

function present(link: Link, req: Request) {
  return { ...link, shortUrl: `${req.protocol}://${req.get('host')}/${link.slug}` }
}

export function createApp(store: LinkStore = new InMemoryLinkStore()) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '10kb' }))

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.post('/api/links', async (req, res) => {
    const parsed = createLinkSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(422).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors })
      return
    }

    const { url, slug: customSlug, expiresAt } = parsed.data

    if (customSlug && (await store.has(customSlug))) {
      res.status(409).json({ error: 'That slug is already taken' })
      return
    }

    let slug = customSlug ?? generateSlug()
    while (!customSlug && (await store.has(slug))) {
      slug = generateSlug()
    }

    const link: Link = {
      slug,
      url,
      clicks: 0,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt ?? null,
      lastClickedAt: null,
    }
    await store.save(link)

    res.status(201).location(`/api/links/${slug}`).json(present(link, req))
  })

  app.get('/api/links', async (req, res) => {
    const links = await store.list()
    res.json({ data: links.map((link) => present(link, req)) })
  })

  app.get('/api/links/:slug', async (req, res) => {
    const link = await store.get(req.params.slug)
    if (!link) {
      res.status(404).json({ error: 'Link not found' })
      return
    }
    res.json({ ...present(link, req), expired: isExpired(link) })
  })

  app.delete('/api/links/:slug', async (req, res) => {
    const deleted = await store.delete(req.params.slug)
    res.status(deleted ? 204 : 404).end()
  })

  app.get('/:slug', async (req, res) => {
    const link = await store.get(req.params.slug)
    if (!link) {
      res.status(404).json({ error: 'Link not found' })
      return
    }
    if (isExpired(link)) {
      res.status(410).json({ error: 'This link has expired' })
      return
    }

    await store.save({ ...link, clicks: link.clicks + 1, lastClickedAt: new Date().toISOString() })
    res.redirect(302, link.url)
  })

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Request body must be valid JSON' })
      return
    }
    console.error(err)
    res.status(500).json({ error: 'Something went wrong' })
  }
  app.use(errorHandler)

  return app
}
