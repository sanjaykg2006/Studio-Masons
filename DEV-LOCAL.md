# Local dev database

Run Postgres on your machine so dev queries are ~1ms instead of round-tripping to
Supabase. Production is unaffected — it keeps using the Supabase URLs in `.env`.

## One-time prerequisite

Install **Docker Desktop** (https://www.docker.com/products/docker-desktop/) and
start it. (Or install PostgreSQL 16 natively and skip `docker compose` below —
just create a `studio_masons` database.)

## Setup (run from `studio-masons-erp/`)

```powershell
# 1. Start local Postgres
docker compose up -d

# 2. Create the schema in it. Prisma CLI reads .env (Supabase), so point it at
#    local for this command only:
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/studio_masons"
$env:DIRECT_URL="postgresql://postgres:postgres@localhost:5432/studio_masons"
npx prisma db push

# 3. Seed the demo data (idempotent — safe to re-run)
node prisma/seed-demo.cjs
```

## Daily use

```powershell
docker compose up -d   # if not already running
npm run dev            # next dev auto-loads .env.development.local -> local DB
```

`npm run build` / production deploys ignore `.env.development.local` and use the
Supabase URLs in `.env`, so nothing about prod changes.

To stop the DB: `docker compose down` (data persists in the `studio-masons-pgdata`
volume; add `-v` to wipe it).
