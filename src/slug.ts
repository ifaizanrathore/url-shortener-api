import { randomInt } from 'node:crypto'

const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Random slug without look-alike characters (0/O, 1/l/I). */
export function generateSlug(length = 7): string {
  let slug = ''
  for (let i = 0; i < length; i++) {
    slug += ALPHABET[randomInt(ALPHABET.length)]
  }
  return slug
}

export const RESERVED_SLUGS = new Set(['api', 'health'])
