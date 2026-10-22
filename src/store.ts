export interface Link {
  slug: string
  url: string
  clicks: number
  createdAt: string
  expiresAt: string | null
  lastClickedAt: string | null
}

/**
 * Storage contract for links. The in-memory version below is used by default;
 * swap in a Redis or SQL implementation without touching the routes.
 */
export interface LinkStore {
  get(slug: string): Promise<Link | undefined>
  has(slug: string): Promise<boolean>
  save(link: Link): Promise<void>
  delete(slug: string): Promise<boolean>
  list(): Promise<Link[]>
}

export class InMemoryLinkStore implements LinkStore {
  private links = new Map<string, Link>()

  async get(slug: string) {
    return this.links.get(slug)
  }

  async has(slug: string) {
    return this.links.has(slug)
  }

  async save(link: Link) {
    this.links.set(link.slug, link)
  }

  async delete(slug: string) {
    return this.links.delete(slug)
  }

  async list() {
    return [...this.links.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}
