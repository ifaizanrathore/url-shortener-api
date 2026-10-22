# 🔗 URL Shortener API

[![CI](https://github.com/ifaizanrathore/url-shortener-api/actions/workflows/ci.yml/badge.svg)](https://github.com/ifaizanrathore/url-shortener-api/actions/workflows/ci.yml)

A small, well-tested URL shortener service built with **Express 5**, **TypeScript** and **Zod**.

Create short links with random or custom slugs, set an optional expiry, and track clicks. Storage sits behind a `LinkStore` interface, so the in-memory default can be swapped for Redis or a SQL database without changing the routes.

## Features

- Random 7-character slugs that skip look-alike characters (`0/O`, `1/l/I`)
- Custom slugs with format rules and reserved words
- Optional expiry: expired links return `410 Gone`
- Click counting and last-clicked timestamp
- Strict input validation with Zod; only `http` and `https` targets are allowed (no `javascript:` URLs)
- Clear JSON errors: `400` malformed JSON, `404` not found, `409` slug taken, `422` validation failed
- 13 integration tests with Vitest and Supertest

## Tech stack

- Node.js 20+ and TypeScript (strict mode, ES modules)
- Express 5
- Zod for request validation
- Vitest + Supertest for tests
- tsx for the dev server with live reload

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000, reloads on change
npm test           # run the test suite
npm run build      # compile to dist/
npm start          # run the compiled server
```

Set `PORT` to change the port.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/links` | Create a short link |
| `GET` | `/api/links` | List all links, newest first |
| `GET` | `/api/links/:slug` | Stats for one link |
| `DELETE` | `/api/links/:slug` | Delete a link |
| `GET` | `/:slug` | Redirect to the target URL (302) |
| `GET` | `/health` | Health check |

### Create a link

```bash
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/ifaizanrathore", "slug": "github", "expiresAt": "2027-01-01T00:00:00Z"}'
```

```json
{
  "slug": "github",
  "url": "https://github.com/ifaizanrathore",
  "clicks": 0,
  "createdAt": "2026-10-22T08:30:00.000Z",
  "expiresAt": "2027-01-01T00:00:00Z",
  "lastClickedAt": null,
  "shortUrl": "http://localhost:3000/github"
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `url` | yes | Must be an `http` or `https` URL |
| `slug` | no | 3–32 characters: letters, numbers, `-`, `_` |
| `expiresAt` | no | ISO 8601 date-time in the future |

## Project structure

```
src/
├── app.ts      # routes, validation, error handling (createApp factory)
├── server.ts   # starts the HTTP server
├── slug.ts     # slug generation and reserved words
└── store.ts    # LinkStore interface + in-memory implementation
tests/
└── app.test.ts
```

`createApp(store)` takes the store as a parameter, so tests get a fresh, isolated store each time and production can pass a persistent one.

## License

[MIT](LICENSE)
