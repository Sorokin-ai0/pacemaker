# Pacemaker — Implementation Plan

A half-marathon training and run-logging web app. Single repo, single deployed Node service
(Express API + built React SPA served as static files).

**Repo root:** `/Users/iaroslavsorokin/half marathon` (empty dir, will be `git init`-ed).

---

## 1. Repository layout

```
.
├── package.json              # npm workspaces root: dev/build/start/test/lint orchestration
├── server/                   # Express API (TypeScript, ESM)
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma     # SQLite datasource
│   │   ├── migrations/
│   │   └── seed.ts           # demo user + partially-completed plan + logged runs
│   └── src/
│       ├── index.ts          # bootstrap: listen(PORT), serve client/dist in production
│       ├── app.ts            # express app factory (importable by Supertest)
│       ├── middleware/       # requireAuth (JWT cookie), zod validate, error handler
│       ├── routes/           # auth, me, onboarding, plan, workouts, runs, stats
│       ├── lib/
│       │   ├── planGenerator.ts   # PURE function — no I/O, fully unit-testable
│       │   ├── riegel.ts          # T2 = T1 * (D2/D1)^1.06
│       │   └── stats.ts           # weekly mileage, pace trend, adherence
│       └── tests/            # Vitest: auth.test.ts (Supertest), planGenerator.test.ts
├── client/                   # React 18 + Vite + TS
│   ├── package.json
│   ├── vite.config.ts        # /api proxy → :3001 in dev; vite-plugin-pwa
│   ├── index.html
│   ├── public/               # PWA icons, manifest assets
│   └── src/
│       ├── main.tsx / App.tsx / router
│       ├── api/              # typed fetch client matching API_CONTRACT.md
│       ├── components/ui/    # shadcn/ui components
│       ├── components/       # RaceCountdown, TaperBanner, WorkoutCard, charts…
│       ├── pages/            # Login, Register, Onboarding, Dashboard, Calendar, RunLog, Settings
│       └── lib/              # units (km↔mi), pace formatting, date helpers
├── Dockerfile                # node:20, build both, run migrations, start server
├── railway.json              # Railway service config
├── .env.example
├── README.md
├── DECISIONS.md              # assumption log (already started)
└── API_CONTRACT.md           # backend↔frontend handoff (written alongside this plan)
```

## 2. Stack (as specified)

- **Server:** Node 20+ (host has v24), Express 4, Prisma ORM + SQLite (`file:` URL), zod,
  `jsonwebtoken` (JWT in httpOnly cookie), `bcrypt`, TypeScript ESM (`tsx` for dev, `tsc` for build).
- **Client:** React 18, Vite 5, Tailwind CSS, shadcn/ui, recharts, React Router 6,
  `vite-plugin-pwa` (manifest + service worker → installable).
- **Tests:** Vitest + Supertest (server workspace).
- **Tooling:** ESLint (flat config) + Prettier across both workspaces.
- **Deploy:** Railway, one service. Dockerfile builds client + server; Express serves
  `client/dist` with SPA fallback; `prisma migrate deploy` + seed-if-empty on container start.

## 3. Data model (Prisma, SQLite)

Entities as specified, with two pragmatic additions on `PlannedWorkout` (`weekIndex`, `phase`)
so the calendar/dashboard don't recompute phase boundaries client-side:

- **User** — id, email (unique), passwordHash, unitPreference (`"mi" | "km"`, default `"mi"`), createdAt
- **Profile** — userId (unique FK), experienceLevel (`beginner|intermediate|advanced`),
  currentWeeklyMileageKm (Float), raceDate (DateTime), longRunDay (Int 0–6, 0 = Sunday)
- **TrainingPlan** — id, userId, startDate, raceDate, totalWeeks, generatedAt
- **PlannedWorkout** — id, planId (FK, cascade delete), date, type (`long|easy|tempo|speed|rest|race`),
  targetDistanceKm (Float?, null for rest), targetPaceZone (String?), notes (String?),
  weekIndex (Int), phase (`base|build|peak|taper`)
- **LoggedRun** — id, userId, plannedWorkoutId (FK?, `onDelete: SetNull`), date, distanceKm,
  durationSeconds, avgHeartRate (Int?), rpe (Int? 1–10), notes (String?)

Regenerating a plan **replaces** the old one (delete + recreate); logged runs survive with
`plannedWorkoutId` nulled. All distances stored in km; conversion is a display concern.

## 4. Training-plan generator (pure function)

`generatePlan({ today, raceDate, experienceLevel, currentWeeklyMileageKm, longRunDay })`
→ `{ startDate, raceDate, totalWeeks, workouts: PlannedWorkoutInput[] }`

- **Length:** full weeks between today and race date, clamped 8–20; 14 if race date is
  missing/invalid/in the past (then race date = today + 14 weeks).
- **Phases:** taper = max(2, round(10%)) → peak = max(1, round(15%)) → build = round(35%) →
  base = remainder. Order: Base → Build → Peak → Taper.
- **Week template** anchored on `longRunDay` L (satisfies 1 long, 1 quality, 2–3 easy, 1–2 rest):
  L = long · L+1 = rest · L+2 = easy · L+3 = tempo/speed (alternating by week) ·
  L+4 = easy · L+5 = rest · L+6 = easy.
- **Volume:** weekly volume starts from `currentWeeklyMileageKm` (floored at a per-level minimum),
  ramps ~8%/week through Base/Build with every 4th week a cutback (−20%), holds at Peak,
  tapers to ~60% then ~40%.
- **Long run:** starts near 30% of weekly volume, grows steadily; capped at 12 mi (19.3 km)
  Beginner, 13.1 mi (21.1 km) Int/Adv. One 14-mi (22.5 km) overreach long run exactly two
  weeks before taper starts — Intermediate/Advanced only (Beginners hold their cap; see DECISIONS.md).
- **Race week:** two short shakeouts (3 km easy), rest otherwise, race-day entry (21.1 km, type `race`).
- **Pace zones:** descriptive strings per type (easy = "Zone 2, conversational",
  tempo = "comfortably hard", speed = "5K–10K effort", long = "Zone 2, finish steady").

Deterministic given inputs — the unit-test surface. Tests cover: clamping (8/20/14-default),
phase distribution & taper minimum, long-run caps per level, overreach placement, race-week
contents, long-run day alignment, weekly structure counts, cutback weeks.

## 5. API (full detail in API_CONTRACT.md)

Cookie-JWT auth; all non-auth routes behind `requireAuth`. Zod-validated bodies; uniform
error shape `{ error: { code, message, details? } }`.

- `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`
- `PATCH /api/me` — unitPreference
- `POST /api/onboarding` — upsert profile **and** generate plan in one transaction
- `GET /api/plan` — active plan + all workouts · `POST /api/plan/regenerate`
- `PATCH /api/workouts/:id` — edit/reschedule (date, type, distance, notes)
- `GET/POST /api/runs` · `PATCH/DELETE /api/runs/:id`
- `GET /api/stats` — weekly mileage series, pace trend, adherence %, Riegel projection, race countdown, taper flag

## 6. Frontend

Routes: `/login`, `/register` (public) · `/onboarding`, `/dashboard`, `/calendar`, `/log`,
`/settings` (protected; redirect to onboarding when no profile exists).

- **Onboarding:** single form (race date, weekly mileage in user's unit, experience level,
  long-run day) → submit → plan generated → straight to dashboard.
- **Calendar:** month + week views, tap a day → workout detail sheet (type, distance, pace zone,
  notes, linked logged run), edit/reschedule via the sheet.
- **Run log:** list + create/edit form; pace auto-calculated; optional HR, RPE 1–10, notes,
  "fulfills planned workout" selector (defaults to same-day planned run).
- **Dashboard:** race countdown, taper-mode banner during final 10% of plan, weekly mileage
  bar chart, pace trend line chart, adherence stat, projected finish time (Riegel, from the
  best recent long run ≥ 8 km in the last 60 days).
- **Settings:** mi/km toggle, dark-mode toggle (dark default), regenerate plan (edits inputs,
  re-runs generator), integrations page with Strava / Garmin / WHOOP "coming soon" cards.
- **Design:** dark-first, card-based, electric-blue accent (`#38bdf8`-family — clearly not
  Strava orange), Inter-style sans type scale, mobile-first breakpoints, PWA installable.

## 7. Agent orchestration (Execute phase)

Root scaffold (workspaces, lint/format config, `.env.example`, git init + first commit) is done
by the orchestrator before spawning, so agents never fight over shared files. Each agent owns a
disjoint file set.

| Wave | Agents (parallel) | Scope | Gate |
|------|-------------------|-------|------|
| 0 | orchestrator | git init, root scaffold, commit docs | — |
| 1 | **database-agent** ∥ **frontend-agent** | Prisma schema + migration + seed ∥ full client against API_CONTRACT.md | schema done → wave 2 |
| 2 | **backend-agent** (frontend still running) | Express app, auth, routes, planGenerator, stats | backend + frontend compile |
| 3 | **qa-agent** ∥ **devops-agent** | test suite (auth + generator) ∥ Dockerfile, railway.json, README | tests green |
| 4 | orchestrator | integration: `npm run dev`, browser-verify all flows end-to-end | **PAUSE 2** |
| 5 | orchestrator | deployment walkthrough / final deploy steps | — |

- Commit after each wave completes, with clear messages.
- Assumptions logged to DECISIONS.md, never asked.
- Backend spawns only after database-agent finishes (needs the generated Prisma client);
  frontend never waits — it codes against API_CONTRACT.md from minute one.

## 8. Deliverables checklist

- [ ] `npm run dev` — API (:3001) + Vite (:5173, proxied) concurrently
- [ ] `npm run build && npm start` — production single-service mode
- [ ] `npm test` — green suite: auth flows + plan-generator algorithm
- [ ] Seed: demo user (`demo@pacemaker.run` / `Demo1234!`) with a mid-plan, partially-logged
      training block so the dashboard is populated on first login
- [ ] `.env.example`, README (setup, env vars, dev workflow, tests, deployment)
- [ ] Dockerfile + railway.json
- [ ] PWA: manifest + service worker, installable
- [ ] DECISIONS.md, API_CONTRACT.md kept current

---

**Awaiting your "approved" before any code is written.**
