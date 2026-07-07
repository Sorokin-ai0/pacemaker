# Pacemaker API Contract (v1)

Handoff artifact: **frontend-agent builds against this document**, backend-agent implements it.
Any deviation must be made here first, then in code.

## Conventions

- Base path: `/api`. JSON everywhere. Dates are ISO-8601 strings (`YYYY-MM-DD` for calendar
  dates, full ISO for timestamps).
- **All distances in km, all durations in seconds, all paces in seconds-per-km.** Unit
  conversion (mi/km) is purely a client display concern driven by `user.unitPreference`.
- Auth: JWT in an httpOnly cookie named `pm_token` (7-day expiry, `SameSite=Lax`,
  `Secure` in production). Client never reads the token; it just sends credentials
  (`credentials: "include"`).
- Every route except `/api/auth/register` and `/api/auth/login` requires auth → otherwise
  `401 { "error": { "code": "UNAUTHORIZED", "message": "…" } }`.
- Validation errors: `400 { "error": { "code": "VALIDATION", "message": "…", "details": ZodIssue[] } }`.
- Not found / not owned: `404 { "error": { "code": "NOT_FOUND", "message": "…" } }`.

## Shared types

```ts
type ExperienceLevel = "beginner" | "intermediate" | "advanced";
type WorkoutType = "long" | "easy" | "tempo" | "speed" | "rest" | "race";
type Phase = "base" | "build" | "peak" | "taper";
type Unit = "mi" | "km";

interface UserDTO { id: string; email: string; unitPreference: Unit; createdAt: string;
                    hasProfile: boolean; }
interface ProfileDTO { experienceLevel: ExperienceLevel; currentWeeklyMileageKm: number;
                       raceDate: string; longRunDay: number; /* 0=Sun … 6=Sat */ }
interface PlannedWorkoutDTO { id: string; date: string; type: WorkoutType;
                              targetDistanceKm: number | null; targetPaceZone: string | null;
                              notes: string | null; weekIndex: number; phase: Phase;
                              loggedRunId: string | null; }
interface PlanDTO { id: string; startDate: string; raceDate: string; totalWeeks: number;
                    generatedAt: string; workouts: PlannedWorkoutDTO[]; }
interface LoggedRunDTO { id: string; date: string; distanceKm: number; durationSeconds: number;
                         paceSecPerKm: number; avgHeartRate: number | null; rpe: number | null;
                         notes: string | null; plannedWorkoutId: string | null; }
```

## Auth

| Method & path | Body | Success | Errors |
|---|---|---|---|
| `POST /api/auth/register` | `{ email, password }` (password ≥ 8 chars) | `201 { user: UserDTO }` + sets cookie | `409 EMAIL_TAKEN`, `400 VALIDATION` |
| `POST /api/auth/login` | `{ email, password }` | `200 { user: UserDTO }` + sets cookie | `401 INVALID_CREDENTIALS` |
| `POST /api/auth/logout` | — | `204`, clears cookie | — |
| `GET /api/auth/me` | — | `200 { user: UserDTO, profile: ProfileDTO \| null }` | `401` |

## User settings

| `PATCH /api/me` | `{ unitPreference: Unit }` | `200 { user: UserDTO }` |

## Onboarding & plan

| Method & path | Body | Success |
|---|---|---|
| `POST /api/onboarding` | `{ experienceLevel, currentWeeklyMileageKm, raceDate, longRunDay }` | `201 { profile: ProfileDTO, plan: PlanDTO }` — upserts profile + (re)generates plan atomically |
| `GET /api/plan` | — | `200 { plan: PlanDTO \| null }` (null → client routes to onboarding) |
| `POST /api/plan/regenerate` | same body as onboarding (all fields optional; missing → current profile values) | `200 { profile, plan }` — old plan deleted, runs keep existing but `plannedWorkoutId` is nulled |
| `PATCH /api/workouts/:id` | `{ date?, type?, targetDistanceKm?, targetPaceZone?, notes? }` | `200 { workout: PlannedWorkoutDTO }` |

## Runs

| Method & path | Body / query | Success |
|---|---|---|
| `GET /api/runs` | `?from=YYYY-MM-DD&to=YYYY-MM-DD` (optional; default all, newest first) | `200 { runs: LoggedRunDTO[] }` |
| `POST /api/runs` | `{ date, distanceKm, durationSeconds, avgHeartRate?, rpe?, notes?, plannedWorkoutId? }` | `201 { run: LoggedRunDTO }` |
| `PATCH /api/runs/:id` | any subset of POST body | `200 { run: LoggedRunDTO }` |
| `DELETE /api/runs/:id` | — | `204` |

`paceSecPerKm` is always computed server-side (`durationSeconds / distanceKm`), never accepted
as input. `rpe` validated 1–10; `distanceKm > 0`; `durationSeconds > 0`.
`plannedWorkoutId` must belong to the user's active plan → else `400 VALIDATION`.

## Stats & dashboard

`GET /api/stats` → `200`:

```ts
{
  weeklyMileage: Array<{ weekStart: string; plannedKm: number; loggedKm: number }>, // whole plan
  paceTrend:     Array<{ date: string; paceSecPerKm: number; distanceKm: number }>, // all logged runs, chronological
  adherence:     { plannedToDate: number; completed: number; percent: number },     // non-rest workouts, plan start → today
  projection:    { basisRun: { date: string; distanceKm: number; durationSeconds: number } | null,
                   projectedSeconds: number | null },  // Riegel from fastest-pace run ≥ 8 km in last 60 days
  countdown:     { raceDate: string; daysToRace: number },
  taper:         { active: boolean; startDate: string }  // active during final taper phase
}
```

A planned workout counts as **completed** when any logged run links to it
(`plannedWorkoutId`). Adherence `percent = completed / plannedToDate * 100` (0 when nothing
is due yet).

## Health

`GET /api/health` → `200 { status: "ok" }` (unauthenticated; used by Railway healthcheck).
