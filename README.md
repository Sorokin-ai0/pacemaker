# Pacemaker 🏃‍♂️

A production-quality **half-marathon training and run-logging** web app. Answer four
questions during onboarding and Pacemaker generates a periodized, week-by-week training
plan; log your runs against it; and watch a dashboard track your mileage, pace trend,
plan adherence, and projected finish time as race day approaches.

It's an installable **PWA** with a dark-first, mobile-first design — built to feel like a
real running product, not an admin template.

**Persistence:** email/password accounts (bcrypt-hashed) and all training data live in a
**Supabase (PostgreSQL)** database, accessed through the Express + Prisma API. Auth is
JWT-in-httpOnly-cookie — the app does not use Supabase Auth, the anon key, or RLS. See
[supabase/schema.sql](supabase/schema.sql) for the database schema.

## Features

- **Onboarding → instant plan.** Race date, current weekly mileage, experience level, and
  preferred long-run day produce a full plan immediately — no chat, no follow-up questions.
- **Periodized plan generator.** Base → Build → Peak → Taper phases, weekly long run +
  quality session + easy runs + rest days, experience-based long-run caps, a single
  overreach week before taper, and a proper race week with shakeouts and race day.
- **Calendar.** Month and week views; tap any day for the prescribed workout (type,
  distance, target pace zone, notes); reschedule or edit workouts.
- **Run logging.** Distance, duration, auto-calculated pace, optional heart rate, RPE
  (1–10), notes, and which planned workout the run fulfills.
- **Dashboard.** Weekly mileage (planned vs. logged) bar chart, pace-trend line chart,
  plan-adherence percentage, and a projected half-marathon finish time using the Riegel
  formula (`T2 = T1 · (D2/D1)^1.06`) from your best recent long run.
- **Race countdown & taper mode.** A live countdown and calm taper-mode messaging during
  the final phase of the plan.
- **Settings.** mi/km toggle, dark-mode toggle, regenerate plan, and coming-soon
  integration stubs for Strava, Garmin, and WHOOP.
- **Auth.** Register / login / logout with JWT stored in an httpOnly cookie; protected API
  and app routes.

## Tech stack

| Layer      | Choices                                                                       |
| ---------- | ----------------------------------------------------------------------------- |
| Backend    | Node.js 20+, Express 4, Prisma ORM, PostgreSQL (Supabase), zod, JWT (httpOnly cookie), bcrypt |
| Frontend   | React 18, Vite, Tailwind CSS, shadcn/ui, Recharts, React Router, PWA           |
| Testing    | Vitest + Supertest                                                            |
| Tooling    | TypeScript (ESM), ESLint, Prettier, npm workspaces                            |
| Deployment | Docker, Railway (single Node service serving API + built SPA)                 |

## Quickstart

Prerequisites: **Node.js ≥ 20**, npm, and a **Supabase** project (free tier is fine).

**1. Set up the database (one time).** In your Supabase project, open **SQL Editor** and run
[`supabase/schema.sql`](supabase/schema.sql) (or run `npm run db:deploy -w server` after
step 3 to let Prisma create the tables via its migration).

**2. Get your connection string.** Supabase dashboard → **Connect** → use the **Session
pooler** URI (`…pooler.supabase.com:5432`). Avoid the "Direct connection" (IPv6-only).

```bash
# 3. Install dependencies, create the env file, and add your connection string
npm install
cp .env.example server/.env
#   → edit server/.env: set DATABASE_URL to your Supabase session-pooler string
#   → set JWT_SECRET to a long random value (openssl rand -base64 48)

# 4. Generate the Prisma client (and, optionally, create the tables via Prisma)
npm run db:generate -w server
npm run db:deploy   -w server   # optional if you already ran supabase/schema.sql

# 5. Start the API (:3001) and the Vite dev server (:5173) together
npm run dev
```

Open **http://localhost:5173**, click **Create an account**, and register with email +
password. Complete onboarding to generate your plan.

> Optional demo data: `SEED_DEMO=true npm run db:seed -w server` seeds a
> `demo@pacemaker.run` / `Demo1234!` account with a mid-plan block of logged runs.

## Scripts

Run from the repo root:

| Command                      | What it does                                             |
| ---------------------------- | ------------------------------------------------------- |
| `npm run dev`                | API + Vite dev server concurrently (hot reload)         |
| `npm run build`              | Build the client SPA, then compile the server           |
| `npm start`                  | Run the compiled production server (serves API + SPA)   |
| `npm test`                   | Run the Vitest + Supertest suite                        |
| `npm run lint`               | ESLint across both workspaces                           |
| `npm run format`             | Prettier write                                          |
| `npm run db:deploy -w server`  | Apply Prisma migrations to the database               |
| `npm run db:generate -w server`| Regenerate the Prisma client                          |

## Environment variables

Copy `.env.example` to `server/.env`. Variables:

| Variable       | Example / default      | Purpose                                                        |
| -------------- | ---------------------- | -------------------------------------------------------------- |
| `DATABASE_URL` | `postgresql://…pooler.supabase.com:5432/postgres` | Supabase Postgres connection (session pooler) |
| `JWT_SECRET`   | `dev-secret-change-me` | Secret for signing auth tokens — **set a strong value in prod** |
| `PORT`         | `3001`                 | Port the API (and, in production, the whole app) listens on    |
| `NODE_ENV`     | `development`          | `production` enables SPA static serving                        |
| `SEED_DEMO`    | `false`                | If `true`, seed demo data on startup when the DB is empty      |
| `ANTHROPIC_API_KEY` | _(unset)_         | **Optional** — only for the AI coach. Read server-side, never sent to the browser. Unset ⇒ coach shows an "AI coach not configured" state and the rest of the app is unaffected. |

## Testing

```bash
npm test
```

The **plan-generator** unit tests (length clamping, phase distribution, weekly structure,
long-run caps, overreach placement, race week, determinism) always run — they're pure and
need no database.

The **DB-backed suites** (auth flows + full API happy path) run only when `TEST_DATABASE_URL`
points at a **separate, throwaway** Postgres database (its tables are truncated on every run —
never point it at your real database):

```bash
TEST_DATABASE_URL="postgresql://…pooler.supabase.com:5432/postgres" npm test
```

## Production build (local)

```bash
npm run build
NODE_ENV=production JWT_SECRET=change-me PORT=3001 npm start
```

In production the single Node service serves the compiled API **and** the built React app
(from `client/dist`) with SPA fallback — open http://localhost:3001.

## Deployment — Railway + Supabase

The database is **Supabase** (managed Postgres); the app deploys as a **single service**
built from the `Dockerfile` (multi-stage `node:20-slim`). Steps:

1. Provision the schema in Supabase once (run [`supabase/schema.sql`](supabase/schema.sql),
   or let the container's `prisma migrate deploy` create the tables on first boot).
2. Create a new Railway project **from this repo**. Railway auto-detects the `Dockerfile`
   (`railway.json` pins the builder and sets the healthcheck to `/api/health`).
3. Set environment variables:
   - `DATABASE_URL` — **required**, your Supabase **session pooler** connection string.
   - `JWT_SECRET` — **required**, a long random string (`openssl rand -base64 48`).
   - `SEED_DEMO=true` — optional, to seed the demo account on first boot.
   - `PORT` is provided by Railway automatically; the app honors it.
4. Deploy. The container runs `prisma migrate deploy` (a no-op if the schema already exists)
   then starts the server. No volume is needed — data lives in Supabase.

### Generic Docker

```bash
docker build -t pacemaker .
docker run -p 3001:3001 \
  -e DATABASE_URL="postgresql://…pooler.supabase.com:5432/postgres" \
  -e JWT_SECRET=change-me \
  pacemaker
```

Then open http://localhost:3001.

## Deployment — Vercel + Supabase

Vercel doesn't run long-lived servers, so on Vercel the React app is served **statically**
and the Express API runs as a **serverless function** (`api/index.ts`, built by
`vercel.json`'s `functions.includeFiles` so Prisma's native query-engine binaries ship with
the function — without that, every DB call fails with a 500).

1. Provision the schema in Supabase once (run [`supabase/schema.sql`](supabase/schema.sql)).
2. Vercel → **Add New Project** → import this repo. **Settings → General → Root Directory**
   must be **empty** (repo root) — a wrong value here causes an immediate build failure.
   Framework Preset: **Other**. Leave Build Command / Output Directory **not overridden** so
   `vercel.json` controls them.
3. Set environment variables (Settings → Environment Variables, Production):
   - `DATABASE_URL` — **required**, your Supabase **Transaction pooler** string (port
     **6543**, not 5432), with `?pgbouncer=true&connection_limit=1` appended. Each function
     invocation opens its own DB connection, so the pooler (not the direct connection) and a
     capped `connection_limit` are required — without them you'll exhaust Postgres's
     connection limit under any real traffic. Example:
     ```
     postgresql://postgres.<ref>:<url-encoded-password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
     ```
   - `JWT_SECRET` — **required**, a long random string (`openssl rand -base64 48`).
   - `ANTHROPIC_API_KEY` — **optional**, enables the AI coach. Paste a key from
     [console.anthropic.com](https://console.anthropic.com/); it's read only in the
     `api/index` serverless function and never reaches the browser. Leave it unset and the
     coach simply shows an "AI coach not configured" state.
4. Deploy. If login/register return a 500, check **Deployments → (your deployment) →
   Functions → api/index** for the real error — almost always a missing/misconfigured
   `DATABASE_URL` or (if you changed `vercel.json`) missing Prisma engine files.

## Project structure

```
.
├── server/            # Express API, Prisma schema/migrations/seed, plan generator, tests
│   ├── prisma/        # schema.prisma, migrations/, seed.ts
│   └── src/
│       ├── lib/       # planGenerator (pure), riegel, stats, demoSeed
│       ├── routes/    # auth, me, onboarding, plan, workouts, runs, stats, health
│       ├── middleware/# requireAuth, validate, errorHandler
│       └── tests/     # Vitest + Supertest
├── client/            # React 18 + Vite SPA (Tailwind, shadcn/ui, Recharts, PWA)
│   └── src/           # pages, components, api client, contexts, lib
├── Dockerfile         # multi-stage build → single runtime service
├── railway.json       # Railway builder + healthcheck config
├── PLAN.md            # architecture & implementation plan
├── API_CONTRACT.md    # REST API contract (DTOs, routes, errors)
└── DECISIONS.md       # log of decisions/assumptions made during the build
```

See **[PLAN.md](PLAN.md)**, **[API_CONTRACT.md](API_CONTRACT.md)**, and
**[DECISIONS.md](DECISIONS.md)** for architecture, the full API contract, and the rationale
behind key choices.
