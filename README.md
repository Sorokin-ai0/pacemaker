# Pacemaker 🏃‍♂️

A production-quality **half-marathon training and run-logging** web app. Answer four
questions during onboarding and Pacemaker generates a periodized, week-by-week training
plan; log your runs against it; and watch a dashboard track your mileage, pace trend,
plan adherence, and projected finish time as race day approaches.

It's an installable **PWA** with a dark-first, mobile-first design — built to feel like a
real running product, not an admin template.

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
| Backend    | Node.js 20+, Express 4, Prisma ORM, SQLite, zod, JWT (httpOnly cookie), bcrypt |
| Frontend   | React 18, Vite, Tailwind CSS, shadcn/ui, Recharts, React Router, PWA           |
| Testing    | Vitest + Supertest                                                            |
| Tooling    | TypeScript (ESM), ESLint, Prettier, npm workspaces                            |
| Deployment | Docker, Railway (single Node service serving API + built SPA)                 |

## Quickstart

Prerequisites: **Node.js ≥ 20** and npm.

```bash
# 1. Install all workspace dependencies (root, server, client)
npm install

# 2. Create the server env file
cp .env.example server/.env

# 3. Create the SQLite database and apply migrations
npm run db:migrate -w server

# 4. Seed a demo account with a mid-plan training block and logged runs
npm run db:seed

# 5. Start the API (:3001) and the Vite dev server (:5173) together
npm run dev
```

Open **http://localhost:5173** and sign in with the demo account:

- **Email:** `demo@pacemaker.run`
- **Password:** `Demo1234!`

The demo user is mid-plan with several weeks of logged runs, so the dashboard shows data
immediately. Or register a fresh account and complete onboarding to generate your own plan.

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
| `npm run db:migrate -w server` | Create/apply migrations (dev)                         |
| `npm run db:seed`            | Seed the demo user and plan                             |

## Environment variables

Copy `.env.example` to `server/.env`. Variables:

| Variable       | Default                | Purpose                                                        |
| -------------- | ---------------------- | -------------------------------------------------------------- |
| `DATABASE_URL` | `file:./dev.db`        | SQLite location (resolved relative to `server/prisma/`)        |
| `JWT_SECRET`   | `dev-secret-change-me` | Secret for signing auth tokens — **set a strong value in prod** |
| `PORT`         | `3001`                 | Port the API (and, in production, the whole app) listens on    |
| `NODE_ENV`     | `development`          | `production` enables SPA static serving                        |
| `SEED_DEMO`    | `false`                | If `true`, seed demo data on startup when the DB is empty      |

## Testing

```bash
npm test
```

The suite (66 tests) covers **auth flows** (register/login/logout, cookie handling, error
cases, protected-route guards), a **full API happy path** (onboarding → plan → workout edit
→ run logging → stats), and the **plan-generator algorithm** (length clamping, phase
distribution, weekly structure, long-run caps, overreach placement, race week, determinism).
Tests run against an isolated `test.db` that is created and destroyed around each run — your
`dev.db` is never touched.

## Production build (local)

```bash
npm run build
NODE_ENV=production JWT_SECRET=change-me PORT=3001 npm start
```

In production the single Node service serves the compiled API **and** the built React app
(from `client/dist`) with SPA fallback — open http://localhost:3001.

## Deployment — Railway

Pacemaker deploys as a **single service** built from the `Dockerfile` (multi-stage
`node:20-slim`). Steps:

1. Create a new Railway project **from this repo**. Railway auto-detects the `Dockerfile`
   (`railway.json` pins the builder and sets the healthcheck to `/api/health`).
2. Add a **Volume mounted at `/data`** — SQLite persists to `file:/data/pacemaker.db`
   (the Dockerfile's default `DATABASE_URL`). Without a volume, data resets on redeploy.
3. Set environment variables:
   - `JWT_SECRET` — **required**, a long random string.
   - `SEED_DEMO=true` — optional, to seed the demo account on first boot.
   - `PORT` is provided by Railway automatically; the app honors it.
4. Deploy. The container runs `prisma migrate deploy` (creating the DB on first boot) and
   then starts the server. The healthcheck hits `/api/health`.

### Generic Docker

```bash
docker build -t pacemaker .
docker run -p 3001:3001 \
  -e JWT_SECRET=change-me \
  -e SEED_DEMO=true \
  -v pacemaker-data:/data \
  pacemaker
```

Then open http://localhost:3001.

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
