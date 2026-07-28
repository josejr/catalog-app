# catalog-app

A self-hosted household media catalog (books, CDs, DVDs) built to run comfortably on a memory-constrained Raspberry Pi.

Next.js App Router + Auth.js (next-auth v5 beta) + Drizzle ORM over Postgres. Add items by scanning a barcode with the device camera (`@zxing/browser`) — books are looked up on Open Library by ISBN, CDs/DVDs via a UPC lookup, with DVDs further enriched from OMDb (title, year, director, cover art). Every catalog entry can also be fetched/edited by hand.

## Features

- Barcode scan-to-catalog flow (`/scan`) with camera decoding, metadata lookup, and a review/edit step before saving
- Manual item entry and editing, including a "Fetch from OMDb" button on DVDs to pull metadata and cover art by title/year
- Duplicate detection — scanning a barcode already in the catalog warns you before adding a second copy
- Email/password auth (Auth.js Credentials provider, JWT sessions) with `admin` / `member` roles
- Admin user management (`/admin/users`)
- Catalog browsing with filtering by media type

## Requirements

- Node.js compatible with Next 16
- Postgres
- An [OMDb API key](https://www.omdbapi.com/apikey.aspx) (free tier) for DVD metadata lookups — optional, the scan flow degrades gracefully without it

## Getting started

Install dependencies:

```bash
npm install
```

Create `.env.local` (not committed) with:

```
DATABASE_URL=postgresql://user:password@localhost:5432/catalog_app
AUTH_SECRET=<generate with `npx auth secret` or `openssl rand -base64 32`>
OMDB_API_KEY=<optional, enables DVD metadata/cover lookup>
```

Apply the database schema:

```bash
npm run db:migrate
```

Seed an admin user:

```bash
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=changeme npm run db:seed
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

```bash
npm run dev              # start dev server
npm run build            # NODE_OPTIONS=--max-old-space-size=768 next build — capped for the Pi's limited RAM
npm run start
npm run lint              # eslint (flat config, eslint-config-next core-web-vitals + typescript)
npx tsc --noEmit          # typecheck

npm run db:generate       # drizzle-kit generate — create a migration from schema.ts changes
npm run db:migrate        # drizzle-kit migrate — apply pending migrations
npm run db:studio         # drizzle-kit studio
npm run db:seed           # seed an admin user; requires SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (SEED_ADMIN_NAME optional)
```

There is no test suite configured in this repo.

## Architecture

- **Auth**: `lib/auth.ts` configures Auth.js with a Credentials provider (bcrypt-hashed passwords) and JWT sessions; `role` is threaded through the `jwt`/`session` callbacks. `proxy.ts` (Next 16 renamed `middleware.ts` to `proxy.ts`) is the perimeter guard for redirecting unauthenticated requests to `/login`.
- **Data layer**: `lib/db/schema.ts` defines `users` and `items` (the catalog entries — `mediaType` is one of `book | cd | dvd | other`, with a `raw_metadata` jsonb column holding whatever the metadata source returned). Migrations live in `drizzle/`, generated from `schema.ts` via `db:generate`.
- **Metadata lookups**: `lib/metadata-lookup.ts` — ISBN lookups via Open Library, UPC lookups via upcitemdb, DVD enrichment via OMDb.
- **Mutations are server actions**, not API routes — see `app/scan/actions.ts`, `app/items/[id]/edit/actions.ts`, `app/admin/users/actions.ts`, `app/login/actions.ts`. The only route handler is the Auth.js catch-all at `app/api/auth/[...nextauth]/route.ts`.

See `CLAUDE.md` / `AGENTS.md` for more detail, including notes on Next 16 breaking changes from what most tooling still assumes.

## Deployment

Designed to run on a Raspberry Pi behind a reverse proxy (e.g. Caddy) terminating TLS and forwarding to the Next server, kept alive with a process manager (e.g. pm2). If serving dev traffic through a proxied hostname other than `localhost`, add it to `allowedDevOrigins` in `next.config.ts`, or run `npm run build && npm run start` for production instead of `next dev`.
