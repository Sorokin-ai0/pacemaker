/**
 * Demo seed shared by `prisma/seed.ts` (CLI) and `src/index.ts` (SEED_DEMO).
 *
 * Idempotent: deletes any existing demo user first (cascades wipe its profile,
 * plan and runs), then rebuilds a mid-plan training block with ~85% adherence
 * so the dashboard is fully populated on first demo login.
 *
 * Deterministic: all "randomness" is index-based jitter, so two consecutive
 * seed runs produce identical data (modulo the moving `today`).
 */

import bcrypt from "bcrypt";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { addDays, toDateString, utcMidnight } from "./dates.js";
import { generatePlan } from "./planGenerator.js";

export const DEMO_EMAIL = "demo@pacemaker.run";
export const DEMO_PASSWORD = "Demo1234!";

export interface DemoSeedSummary {
  email: string;
  raceDate: string;
  totalWeeks: number;
  workouts: number;
  runs: number;
}

/** Pace (sec/km) by workout type for the demo runner. */
const PACE_BY_TYPE: Record<string, number> = {
  easy: 370, // ~6:10/km
  long: 380, // ~6:20/km
  tempo: 315, // ~5:15/km
  speed: 295, // ~4:55/km
};

const HR_BY_TYPE: Record<string, number> = {
  easy: 140,
  long: 149,
  tempo: 164,
  speed: 170,
};

const RPE_BY_TYPE: Record<string, number> = {
  easy: 3,
  long: 5,
  tempo: 7,
  speed: 8,
};

const OCCASIONAL_NOTES = [
  "Felt smooth, kept it honest.",
  "Legs a bit heavy from yesterday.",
  "Great weather — negative split.",
  "Cut the warm-up short, otherwise solid.",
  "New shoes, felt springy.",
];

/** Deterministic pseudo-jitter in [-range, range]. */
function jitter(i: number, range: number): number {
  return ((i * 37 + 11) % (2 * range + 1)) - range;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export async function ensureDemoSeed(now: Date = new Date()): Promise<DemoSeedSummary> {
  const today = utcMidnight(now);

  // Wipe any previous demo data (cascade removes profile, plans, workouts, runs).
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  // Race day: the next Sunday at least 8 weeks (56 days) from today.
  let raceDate = addDays(today, 56);
  while (raceDate.getUTCDay() !== 0) raceDate = addDays(raceDate, 1);

  // Generate with `today` backdated to exactly 14 weeks before the race, so we
  // get a 14-week plan and are currently ~6 weeks in (~8 weeks to race).
  const generatorToday = addDays(raceDate, -14 * 7);

  const generated = generatePlan({
    today: generatorToday,
    raceDate,
    experienceLevel: "intermediate",
    currentWeeklyMileageKm: 32,
    longRunDay: 6, // Saturday
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash,
      unitPreference: "mi",
      profile: {
        create: {
          experienceLevel: "intermediate",
          currentWeeklyMileageKm: 32,
          raceDate,
          longRunDay: 6,
        },
      },
    },
  });

  const plan = await prisma.trainingPlan.create({
    data: {
      userId: user.id,
      startDate: generated.startDate,
      raceDate: generated.raceDate,
      totalWeeks: generated.totalWeeks,
      workouts: {
        create: generated.workouts.map((w) => ({
          date: w.date,
          type: w.type,
          targetDistanceKm: w.targetDistanceKm,
          targetPaceZone: w.targetPaceZone,
          notes: w.notes,
          weekIndex: w.weekIndex,
          phase: w.phase,
        })),
      },
    },
    include: { workouts: { orderBy: { date: "asc" } } },
  });

  // Log runs for ~85% of past non-rest workouts (skip every 7th, deterministically).
  const pastWorkouts = plan.workouts.filter(
    (w) => w.type !== "rest" && w.type !== "race" && w.date.getTime() < today.getTime(),
  );

  const runsData: Prisma.LoggedRunCreateManyInput[] = [];
  let longestLongIndex = -1; // index into runsData of the latest completed long run
  pastWorkouts.forEach((workout, i) => {
    if (i % 7 === 3) return; // the ~15% of workouts the demo runner skipped

    const target = workout.targetDistanceKm ?? 5;
    const distanceKm = Math.max(1, Math.round((target + jitter(i, 3) / 10) * 10) / 10);
    const pace = (PACE_BY_TYPE[workout.type] ?? 370) + jitter(i, 8);
    const durationSeconds = Math.round(distanceKm * pace);
    const avgHeartRate = clamp((HR_BY_TYPE[workout.type] ?? 145) + jitter(i, 4), 135, 172);
    const rpe = clamp((RPE_BY_TYPE[workout.type] ?? 4) + (i % 2 === 0 ? 0 : 1), 1, 10);

    if (workout.type === "long") longestLongIndex = runsData.length;

    runsData.push({
      userId: user.id,
      plannedWorkoutId: workout.id,
      date: workout.date,
      distanceKm,
      durationSeconds,
      avgHeartRate,
      rpe,
      notes: i % 5 === 0 ? OCCASIONAL_NOTES[(i / 5) % OCCASIONAL_NOTES.length] : null,
    });
  });

  // Guarantee a recent long run ≥ 14 km so the Riegel projection has a basis:
  // if no logged long reached 14 km, the demo runner "felt great and went long"
  // on their most recent long run.
  const hasLongBasis = runsData.some((r) => (r.distanceKm as number) >= 14);
  if (!hasLongBasis && longestLongIndex >= 0) {
    const run = runsData[longestLongIndex];
    run.distanceKm = 14.5;
    run.durationSeconds = Math.round(14.5 * PACE_BY_TYPE.long);
    run.notes = "Felt great — stretched the long run out.";
  }

  await prisma.loggedRun.createMany({ data: runsData });

  return {
    email: DEMO_EMAIL,
    raceDate: toDateString(raceDate),
    totalWeeks: generated.totalWeeks,
    workouts: generated.workouts.length,
    runs: runsData.length,
  };
}
