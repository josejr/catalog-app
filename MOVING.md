# Moving to another device

Steps for relocating a running instance (e.g. old Pi → new Pi), as opposed to a
fresh install — see the README's "Getting started" for that.

## 1. Get the code onto the new device

Commit and push any pending changes on the old device, then on the new one:

```bash
git clone git@github.com:josejr/catalog-app.git
```

`.env.local` is git-ignored and won't come along — copy it separately (step 3).

## 2. Migrate Postgres

On the old device:

```bash
pg_dump -Fc catalog_app_db_name > catalog.dump
```

Copy `catalog.dump` to the new device, create an empty database there, then:

```bash
pg_restore -d catalog_app_db_name catalog.dump
```

If the new device doesn't have Postgres installed, either install it there or
point `DATABASE_URL` at a Postgres instance running elsewhere on your network.

## 3. Copy `.env.local`

Copy the file directly — it has `DATABASE_URL`, `AUTH_SECRET`, and optionally
`OMDB_API_KEY` / `PLEX_*`. Reuse the same `AUTH_SECRET` so existing
sessions/cookies stay valid, or generate a new one if that doesn't matter to
you.

## 4. Install and build

```bash
npm install
npm run db:migrate      # only needed if you skipped pg_restore, or to catch up pending migrations
npm run build            # capped at 768MB old-space for Pi RAM
npm run start
```

## 5. Re-point anything device-specific

- Plex sync cron job: re-add it on the new device (see README's "Plex sync"
  section for the crontab line) and `mkdir -p logs`.
- If `PLEX_SERVER_URL` was a LAN IP tied to the old device's network, confirm
  it's still reachable from the new one.
- Don't run both devices against the same Postgres database with write access
  at the same time — pick one as canonical during the transition.
