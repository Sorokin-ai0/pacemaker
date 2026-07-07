# DECISIONS.md — assumptions made instead of asking

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Build in `/Users/iaroslavsorokin/half marathon` (empty dir created today), not the `twitter product` dir. | Prompt says "this repository"; the half-marathon-named workspace dir is clearly the intended home, while `twitter product` holds unrelated demo apps. Will `git init` here. |
| 2 | TypeScript on both server and client. | Spec doesn't name a language; shadcn/ui is TS-first and "production-quality" + zod pair naturally with TS. ESM throughout as required. |
| 3 | `longRunDay` stored as Int 0–6, 0 = Sunday (JS `Date.getDay()` convention). | Avoids locale ambiguity; UI shows weekday names. |
| 4 | Regenerating a plan deletes the old plan and its workouts; `LoggedRun.plannedWorkoutId` is set null (`onDelete: SetNull`). | Keeps "one active plan" simple in v1; run history is never lost. |
| 5 | 14-mi overreach week applies to Intermediate/Advanced only; Beginners hold their 12-mi cap. | A 14-mi run two weeks out is an injury risk for someone capped at 12 mi; spec sentence is ambiguous, safety wins. |
| 6 | Weekly template fixed at 1 long + 1 quality + 3 easy + 2 rest (= 7 days). | Only combination satisfying "2–3 easy, 1–2 rest" with every day assigned. Quality alternates tempo/speed week to week. |
| 7 | "Ambiguous plan length → 14 weeks" triggered when race date is missing, unparseable, or in the past; race date then set to today + 14 weeks. | Spec defines the default but not the trigger conditions. |
| 8 | Riegel basis run = fastest-pace logged run with distance ≥ 8 km in the last 60 days. | "Best recent long run" needs an operational definition; ≥ 8 km filters out short runs that inflate projections. |
| 9 | Dark-mode preference stored client-side (localStorage), unit preference server-side on User. | Unit affects API-adjacent display everywhere and is part of the given data model; theme is device-level cosmetic. |
| 10 | devops-agent authors Dockerfile/railway.json during wave 3 (files only); actual deployment steps happen after the pause-2 go-ahead. | Prompt both schedules devops-agent early and places "deployment" after pause 2 — resolved as: artifacts early, deploy actions late. |
| 11 | `bcrypt` (native) rather than `bcryptjs`; Docker base image `node:20-slim` (glibc) so prebuilt binaries work. | Spec names bcrypt explicitly; slim avoids alpine/musl native-module friction. |
| 12 | Demo credentials: `demo@pacemaker.run` / `Demo1234!`. | Needed something; documented in README. |
| 13 | Accent color: electric blue (sky-400/500 family). | Spec offered deep teal or electric blue; blue reads better on the dark card UI and is unmistakably not Strava orange. |
