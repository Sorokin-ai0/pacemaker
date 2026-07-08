-- ============================================================================
-- Pacemaker — Supabase (PostgreSQL) schema
--
-- Run this ONCE in your Supabase project: Dashboard → SQL Editor → New query →
-- paste → Run. It creates the five app tables, their indexes, and the foreign
-- keys with the correct cascade behaviour.
--
-- This DDL matches the Prisma schema (server/prisma/schema.prisma) exactly —
-- same table names, column names, types, nullability, unique constraints,
-- indexes, and referential actions — so Prisma Client queries against it with
-- no changes. Auth (password hashing, JWT) is handled by our own Express API;
-- this schema deliberately does NOT use Supabase Auth, auth.users, or RLS.
--
-- Safe to re-run: wrapped in a transaction; uses IF NOT EXISTS guards.
-- ============================================================================

BEGIN;

-- ---- User -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "User" (
    "id"             TEXT NOT NULL,
    "email"          TEXT NOT NULL,
    "passwordHash"   TEXT NOT NULL,
    "unitPreference" TEXT NOT NULL DEFAULT 'mi',          -- "mi" | "km"
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User" ("email");

-- ---- Profile (1:1 with User) ------------------------------------------------
CREATE TABLE IF NOT EXISTS "Profile" (
    "id"                     TEXT NOT NULL,
    "userId"                 TEXT NOT NULL,
    "experienceLevel"        TEXT NOT NULL,               -- beginner | intermediate | advanced
    "currentWeeklyMileageKm" DOUBLE PRECISION NOT NULL,
    "raceDate"               TIMESTAMP(3) NOT NULL,
    "longRunDay"             INTEGER NOT NULL,            -- 0=Sun … 6=Sat
    "restDaysPerWeek"        INTEGER NOT NULL DEFAULT 2,  -- 1 or 2
    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Profile_userId_key" ON "Profile" ("userId");

-- ---- TrainingPlan -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TrainingPlan" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "startDate"   TIMESTAMP(3) NOT NULL,
    "raceDate"    TIMESTAMP(3) NOT NULL,
    "totalWeeks"  INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id")
);

-- ---- PlannedWorkout ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "PlannedWorkout" (
    "id"               TEXT NOT NULL,
    "planId"           TEXT NOT NULL,
    "date"             TIMESTAMP(3) NOT NULL,
    "type"             TEXT NOT NULL,                     -- long|easy|tempo|speed|rest|race
    "targetDistanceKm" DOUBLE PRECISION,
    "targetPaceZone"   TEXT,
    "notes"            TEXT,
    "weekIndex"        INTEGER NOT NULL,
    "phase"            TEXT NOT NULL,                     -- base|build|peak|taper
    CONSTRAINT "PlannedWorkout_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PlannedWorkout_planId_date_idx"
    ON "PlannedWorkout" ("planId", "date");

-- ---- LoggedRun --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "LoggedRun" (
    "id"               TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "plannedWorkoutId" TEXT,
    "date"             TIMESTAMP(3) NOT NULL,
    "distanceKm"       DOUBLE PRECISION NOT NULL,
    "durationSeconds"  INTEGER NOT NULL,
    "avgHeartRate"     INTEGER,
    "rpe"              INTEGER,                            -- 1–10
    "notes"            TEXT,
    CONSTRAINT "LoggedRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LoggedRun_userId_date_idx"
    ON "LoggedRun" ("userId", "date");

-- ---- Foreign keys (cascade on owner delete; SetNull for run→workout) --------
ALTER TABLE "Profile"
    DROP CONSTRAINT IF EXISTS "Profile_userId_fkey",
    ADD  CONSTRAINT "Profile_userId_fkey"
         FOREIGN KEY ("userId") REFERENCES "User" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrainingPlan"
    DROP CONSTRAINT IF EXISTS "TrainingPlan_userId_fkey",
    ADD  CONSTRAINT "TrainingPlan_userId_fkey"
         FOREIGN KEY ("userId") REFERENCES "User" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlannedWorkout"
    DROP CONSTRAINT IF EXISTS "PlannedWorkout_planId_fkey",
    ADD  CONSTRAINT "PlannedWorkout_planId_fkey"
         FOREIGN KEY ("planId") REFERENCES "TrainingPlan" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LoggedRun"
    DROP CONSTRAINT IF EXISTS "LoggedRun_userId_fkey",
    ADD  CONSTRAINT "LoggedRun_userId_fkey"
         FOREIGN KEY ("userId") REFERENCES "User" ("id")
         ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LoggedRun"
    DROP CONSTRAINT IF EXISTS "LoggedRun_plannedWorkoutId_fkey",
    ADD  CONSTRAINT "LoggedRun_plannedWorkoutId_fkey"
         FOREIGN KEY ("plannedWorkoutId") REFERENCES "PlannedWorkout" ("id")
         ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
