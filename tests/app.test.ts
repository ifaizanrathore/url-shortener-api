import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { InMemoryLinkStore } from '../src/store.js'

let store: InMemoryLinkStore
let app: ReturnType<typeof createApp>

beforeEach(() => {
  store = new InMemoryLinkStore()
  app = createApp(store)
})

describe('POST /api/links', () => {
  it('creates a link with a generated slug', async () => {
    const res = await request(app).post('/api/links').send({ url: 'https://example.com/a/long/path' })

    expect(res.status).toBe(201)
    expect(res.body.slug).toMatch(/^[a-zA-Z0-9]{7}$/)
    expect(res.body.shortUrl).toContain(`/${res.body.slug}`)
    expect(res.headers.location).toBe(`/api/links/${res.body.slug}`)
  })

  it('accepts a custom slug and rejects duplicates', async () => {
    await request(app).post('/api/links').send({ url: 'https://example.com', slug: 'my-link' }).expect(201)

    const res = await request(app).post('/api/links').send({ url: 'https://other.com', slug: 'my-link' })
    expect(res.status).toBe(409)
  })

  it.each([
    [{ url: 'not a url' }, 'url'],
    [{ url: 'javascript:alert(1)' }, 'url'],
    [{ url: 'https://example.com', slug: 'a' }, 'slug'],
    [{ url: 'https://example.com', slug: 'api' }, 'slug'],
    [{ url: 'https://example.com', expiresAt: '2000-01-01T00:00:00Z' }, 'expiresAt'],
  ])('rejects invalid input %j', async (body, field) => {
    const res = await request(app).post('/api/links').send(body)

    expect(res.status).toBe(422)
    expect(res.body.details).toHaveProperty(field)
  })

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app).post('/api/links').set('Content-Type', 'application/json').send('{"url":')
    expect(res.status).toBe(400)
  })
})

describe('GET /:slug', () => {
  it('redirects and counts the click', async () => {
    await request(app).post('/api/links').send({ url: 'https://example.com', slug: 'docs' }).expect(201)

    const res = await request(app).get('/docs')
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe('https://example.com')

    const stats = await request(app).get('/api/links/docs')
    expect(stats.body.clicks).toBe(1)
    expect(stats.body.lastClickedAt).not.toBeNull()
  })

  it('returns 404 for unknown slugs', async () => {
    await request(app).get('/nope').expect(404)
  })

  it('returns 410 for expired links', async () => {
    await store.save({
      slug: 'old',
      url: 'https://example.com',
      clicks: 0,
      createdAt: '2020-01-01T00:00:00Z',
      expiresAt: '2020-02-01T00:00:00Z',
      lastClickedAt: null,
    })

    await request(app).get('/old').expect(410)
  })
})

describe('link management', () => {
  it('lists links newest first', async () => {
    await store.save({ slug: 'first', url: 'https://a.com', clicks: 0, createdAt: '2026-01-01T00:00:00Z', expiresAt: null, lastClickedAt: null })
    await store.save({ slug: 'second', url: 'https://b.com', clicks: 0, createdAt: '2026-02-01T00:00:00Z', expiresAt: null, lastClickedAt: null })

    const res = await request(app).get('/api/links')
    expect(res.body.data.map((link: { slug: string }) => link.slug)).toEqual(['second', 'first'])
  })

  it('deletes a link', async () => {
    await request(app).post('/api/links').send({ url: 'https://example.com', slug: 'temp' })

    await request(app).delete('/api/links/temp').expect(204)
    await request(app).get('/temp').expect(404)
    await request(app).delete('/api/links/temp').expect(404)
  })
})
