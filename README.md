# catalog-app

A self-hosted household media catalog (books, CDs, DVDs) built to run comfortably on a memory-constrained Raspberry Pi.

Next.js App Router + Auth.js (next-auth v5 beta) + Drizzle ORM over Postgres. Add items by scanning a barcode with the device camera (`@zxing/browser`) — books are looked up on Open Library by ISBN, CDs/DVDs via a UPC lookup, with DVDs further enriched from OMDb (title, year, director, cover art). A separate hourly cron job syncs a Plex server's movie library in as `digital` items with watch counts. Every catalog entry can also be fetched/edited by hand.

## Features

- Barcode scan-to-catalog flow (`/scan`) with camera decoding, metadata lookup, and a review/edit step before saving
- Manual item entry and editing, including a "Fetch from OMDb" button on DVDs to pull metadata and cover art by title/year
- Duplicate detection — scanning a barcode already in the catalog warns you before adding a second copy
- Plex library sync (`lib/plex/sync.ts`, run via cron) — imports your Plex "Movies" library as `digital` catalog items, including watch count, shown on each item's detail page
- Item detail page (`/items/[id]`) alongside list and edit views
- Email/password auth (Auth.js Credentials provider, JWT sessions) with `admin` / `member` roles
- Admin user management (`/admin/users`)
- Catalog browsing with filtering by media type

## Requirements

- Node.js compatible with Next 16
- Postgres
- An [OMDb API key](https://www.omdbapi.com/apikey.aspx) (free tier) for DVD metadata lookups — optional, the scan flow degrades gracefully without it
- A Plex server and account token — optional, only needed for the Plex sync (see below)

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

PLEX_SERVER_URL=<optional, e.g. http://192.168.1.50:32400>
PLEX_TOKEN=<optional, see "Plex sync" below for how to get one>
PLEX_MOVIES_SECTION_KEY=<optional, the library section id for your Movies library, e.g. 1>
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
npm run plex:sync         # one-off Plex library sync; requires PLEX_SERVER_URL / PLEX_TOKEN / PLEX_MOVIES_SECTION_KEY
```

There is no test suite configured in this repo.

## Plex sync

`npm run plex:sync` fetches every movie in the configured Plex library section and upserts each as a catalog item with `mediaType: "digital"`, matched across runs by Plex's `ratingKey`. It's diff-aware — a row is only written if a tracked field (title, director, year, cover art, watch count) actually changed, so re-running it doesn't bump `updated_at` on unchanged rows. Fields you edit by hand (`notes`, `barcode`, `subtitle`) are never touched by the sync after the initial insert.

Getting a Plex token: sign in to the Plex Web App, open any movie's **⋯ → Get Info → View XML**, and copy the `X-Plex-Token` query parameter from the URL it opens. Treat it like a password.

Run it hourly via system cron (not in-process — this is a plain standalone script, same pattern as `db:seed`):

```
PATH=/usr/bin:/bin
0 * * * * cd /path/to/catalog-app && npm run plex:sync >> /path/to/catalog-app/logs/plex-sync.log 2>&1
```

Create the `logs/` directory once before the first run (`mkdir -p logs`) — it's git-ignored.

**Scope boundary**: if a movie is removed from Plex (or Plex is briefly unreachable), the sync does not delete or flag the corresponding catalog item — it's left as-is. A stale row is considered safer than silently hiding something you added to your catalog.

## Architecture

- **Auth**: `lib/auth.ts` configures Auth.js with a Credentials provider (bcrypt-hashed passwords) and JWT sessions; `role` is threaded through the `jwt`/`session` callbacks. `proxy.ts` (Next 16 renamed `middleware.ts` to `proxy.ts`) is the perimeter guard for redirecting unauthenticated requests to `/login`.
- **Data layer**: `lib/db/schema.ts` defines `users` and `items` (the catalog entries — `mediaType` is one of `book | cd | dvd | digital | other`, with a `raw_metadata` jsonb column holding whatever the metadata source returned, plus `plex_rating_key`/`plex_watch_count` for Plex-synced items). Migrations live in `drizzle/`, generated from `schema.ts` via `db:generate`.
- **Metadata lookups**: `lib/metadata-lookup.ts` — ISBN lookups via Open Library, UPC lookups via upcitemdb, DVD enrichment via OMDb. `lib/plex.ts` is the equivalent client for the Plex API, used by the standalone `lib/plex/sync.ts` cron script rather than by request-time code.
- **Mutations are server actions**, not API routes — see `app/scan/actions.ts`, `app/items/[id]/edit/actions.ts`, `app/admin/users/actions.ts`, `app/login/actions.ts`. The only route handler is the Auth.js catch-all at `app/api/auth/[...nextauth]/route.ts`. The Plex sync is the one exception to "no standalone scripts besides db:seed" — it runs outside the request lifecycle, via cron.
- **Item views**: `app/items/[id]/page.tsx` (detail), `app/items/[id]/edit/page.tsx` (edit form).

See `CLAUDE.md` / `AGENTS.md` for more detail, including notes on Next 16 breaking changes from what most tooling still assumes.

## Deployment

Designed to run on a Raspberry Pi behind a reverse proxy (e.g. Caddy) terminating TLS and forwarding to the Next server, kept alive with a process manager (e.g. pm2). If serving dev traffic through a proxied hostname other than `localhost`, add it to `allowedDevOrigins` in `next.config.ts`, or run `npm run build && npm run start` for production instead of `next dev`.
