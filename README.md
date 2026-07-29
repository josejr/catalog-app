# catalog-app

A self-hosted household media catalog (movies, music, books) built to run comfortably on a memory-constrained Raspberry Pi.

Next.js App Router + Auth.js (next-auth v5 beta) + Drizzle ORM over Postgres. Add items by scanning a barcode with the device camera (`@zxing/browser`), or add one from scratch with no barcode at all. Every item belongs to a category (Movie, Music, Book, Other) and can carry one or more format tags scoped to that category (e.g. a movie can be checked DVD *and* Digital at once). A separate hourly cron job syncs a Plex server's movie library in as digital movie items, including per-event watch history. Every catalog entry can also be fetched/edited by hand, favorited and tagged per person, merged with a duplicate, or deleted.

## Features

- **Add items** — scan a barcode (`/scan`) with camera decoding, metadata lookup, and a review/edit step before saving; or skip scanning entirely with "Add item without scanning" (also reachable from the desktop nav as "Add Item") for a blank form where you pick the category yourself
- **Categories & formats** — each item has one category (Movie / Music / Book / Other) and a multi-select set of formats scoped to that category (Movie: DVD, Blu-ray, Digital · Music: CD, Vinyl · Book: Hardcover, Paperback, Digital)
- **Metadata sources**, each with a manual "Search" + pick-a-result step on the edit page (never auto-overwrites your data without you picking a match):
  - Books: Open Library (free) and Hardcover (optional, your own personal API token)
  - Music: MusicBrainz + Cover Art Archive (free)
  - Movies: OMDb and TMDB (both optional, free API keys)
  - Cover art only, any category: iTunes Search API (free, no key)
- **ISBN field** for books, auto-filled when a book's barcode is an ISBN
- Duplicate detection — scanning a barcode already in the catalog warns you before adding a second copy
- **Merge** two items added by the same person into one (unions their formats, fills in blanks from either side)
- **Delete** an item, with a confirmation step and a heads-up if it's Plex-synced (it'll come back on the next sync if still in your library)
- **Favorites** and **custom tags**, both private per household member — star an item and/or tag it your own way without affecting anyone else's view
- Plex library sync (`lib/plex/sync.ts`, run via cron) — imports your Plex "Movies" library as catalog items (category `movie`, format `digital`), plus every individual watch event (not just an aggregate count), shown on each item's detail page
- Item detail page (`/items/[id]`) with a desktop layout (expanded Plex metadata) and a mobile layout, alongside catalog list/grid views and an edit form
- Catalog browsing: filter by category + format, added-by, favorites-only, and your own tags; free-text search; sortable; list or grid view with adjustable grid size — filters/view/sort persist via cookies where sensible, and editing/deleting an item returns you to the exact filtered view you came from
- **Stats page** (`/stats`) — item counts by category and format, broken out as "yours" vs. the whole household's catalog
- Email/password auth (Auth.js Credentials provider, JWT sessions) with `admin` / `member` roles
- Admin pages: household member management (`/admin/users`, including renaming members) and settings (`/admin/settings`) for API keys and catalog grid pill colors

## Requirements

- Node.js compatible with Next 16
- Postgres
- Optional free API keys for richer metadata (the app degrades gracefully without any of them): [OMDb](https://www.omdbapi.com/apikey.aspx), [TMDB](https://www.themoviedb.org/settings/api), [Hardcover](https://hardcover.app/account/api) (a personal access token from your own account, not an app key)
- A Plex server and account token — optional, only needed for the Plex sync (see below)

API keys can be set either as env vars (below) or from `/admin/settings` at runtime — the settings-page value takes precedence over the env var if both are set.

## Getting started

Install dependencies:

```bash
npm install
```

Create `.env.local` (not committed) with:

```
DATABASE_URL=postgresql://user:password@localhost:5432/catalog_app
AUTH_SECRET=<generate with `npx auth secret` or `openssl rand -base64 32`>

OMDB_API_KEY=<optional, movie metadata/cover lookup>
TMDB_API_KEY=<optional, alternative movie metadata/cover lookup>
HARDCOVER_API_KEY=<optional, personal access token from hardcover.app/account/api>

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
npm run plex:sync         # one-off Plex library + watch-history sync; requires PLEX_SERVER_URL / PLEX_TOKEN / PLEX_MOVIES_SECTION_KEY
```

There is no test suite configured in this repo.

## Plex sync

`npm run plex:sync` fetches every movie in the configured Plex library section and upserts each as a catalog item (`category: "movie"`, `formats: ["digital"]`), matched across runs by Plex's `ratingKey`, then imports every individual watch event from Plex's history endpoint (not just the aggregate view count) into a separate `plex_watch_events` table, shown on the item's detail page.

Getting a Plex token: sign in to the Plex Web App, open any movie's **⋯ → Get Info → View XML**, and copy the `X-Plex-Token` query parameter from the URL it opens. Treat it like a password.

Run it hourly via system cron (not in-process — this is a plain standalone script, same pattern as `db:seed`):

```
PATH=/usr/bin:/bin
0 * * * * cd /path/to/catalog-app && npm run plex:sync >> /path/to/catalog-app/logs/plex-sync.log 2>&1
```

Create the `logs/` directory once before the first run (`mkdir -p logs`) — it's git-ignored.

**Scope boundary**: if a movie is removed from Plex (or Plex is briefly unreachable), the sync does not delete or flag the corresponding catalog item — it's left as-is. A stale row is considered safer than silently hiding something you added to your catalog. Deleting a Plex-synced item from the catalog UI doesn't stop it from being re-added on the next sync if it's still in your Plex library.

## Architecture

- **Auth**: `lib/auth.ts` configures Auth.js with a Credentials provider (bcrypt-hashed passwords) and JWT sessions; `role` is threaded through the `jwt`/`session` callbacks — note that a role change (or a name change to your own account) only takes effect on your *next* login, since it's baked into the JWT at sign-in, not re-checked against the DB per request. `proxy.ts` (Next 16 renamed `middleware.ts` to `proxy.ts`) is the perimeter guard for redirecting unauthenticated requests to `/login`.
- **Data layer**: `lib/db/schema.ts` defines `users`, `items` (the catalog entries — `category` is one of `movie | music | book | other`, `formats` is a Postgres text array scoped per category, with a `raw_metadata` jsonb column holding whatever the metadata source returned, plus `isbn`, `plex_rating_key`/`plex_watch_count` for Plex-synced items), `favorites` and `item_tags` (both per-user, unique per item+user pair), `plex_watch_events`, and `settings` (key/value store for admin-configurable API keys and grid pill colors). Migrations live in `drizzle/`, generated from `schema.ts` via `db:generate`.
- **Metadata lookups**: `lib/metadata-lookup.ts` — ISBN lookups via Open Library, UPC lookups via upcitemdb, plus a uniform search-candidates-then-pick flow per source (Open Library/Hardcover for books, MusicBrainz for music, OMDb/TMDB for movies, iTunes for cover art) used by the edit page's "Search" buttons. `lib/plex.ts` is the equivalent client for the Plex API, used by the standalone `lib/plex/sync.ts` cron script rather than by request-time code.
- **Mutations are server actions**, not API routes — see `app/scan/actions.ts`, `app/items/[id]/edit/actions.ts`, `app/items/[id]/actions.ts` (favorites/tags), `app/items/[id]/merge/actions.ts`, `app/items/[id]/delete/actions.ts`, `app/admin/users/actions.ts`, `app/admin/settings/actions.ts`, `app/login/actions.ts`. The only route handler is the Auth.js catch-all at `app/api/auth/[...nextauth]/route.ts`. The Plex sync is the one exception to "no standalone scripts besides db:seed" — it runs outside the request lifecycle, via cron.
- **Item views**: `app/items/[id]/page.tsx` (detail, desktop/mobile layouts), `app/items/[id]/edit/page.tsx` (edit form), `app/items/[id]/merge/page.tsx`, `app/items/[id]/delete/page.tsx`.

See `CLAUDE.md` / `AGENTS.md` for more detail, including notes on Next 16 breaking changes from what most tooling still assumes.

## Deployment

Designed to run on a Raspberry Pi behind a reverse proxy (e.g. Caddy) terminating TLS and forwarding to the Next server, kept alive with a process manager (e.g. systemd). If serving dev traffic through a proxied hostname other than `localhost`, add it to `allowedDevOrigins` in `next.config.ts`, or run `npm run build && npm run start` for production instead of `next dev`.
