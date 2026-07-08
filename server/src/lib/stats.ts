/** Assembly of the GET /api/stats payload (API_CONTRACT.md §Stats & dashboard). */

import type { LoggedRun, TrainingPlan } from "@prisma/client";
import { addDays, daysBetween, round1, toDateString, utcMidnight } from "./dates.js";
import { projectRaceTime } from "./riegel.js";
import type { WorkoutWithRunIds } from "./dto.js";

export interface StatsDTO {
  weeklyMileage: Array<{ weekStart: string; plannedKm: number; loggedKm: number }>;
  paceTrend: Array<{ date: string; paceSecPerKm: number; distanceKm: number }>;
  adherence: { plannedToDate: number; completed: number; percent: number };
  projection: {
    basisRun: { date: string; distanceKm: number; durationSeconds: number } | null;
    projectedSeconds: number | null;
  };
  countdown: { raceDate: string; daysToRace: number } | null;
  taper: { active: boolean; startDate: string } | null;
}

const PROJECTION_MIN_DISTANCE_KM = 8;
const PROJECTION_WINDOW_DAYS = 60;

export interface BuildStatsInput {
  plan: (TrainingPlan & { workouts: WorkoutWithRunIds[] }) | null;
  /** All of the user's logged runs, sorted by date ascending. */
  runs: LoggedRun[];
  /** Reference "now" (any time of day; truncated to UTC midnight internally). */
  today: Date;
}

export function buildStats({ plan, runs, today: now }: BuildStatsInput): StatsDTO {
  const today = utcMidnight(now);

  // --- Pace trend (chronological, all logged runs) -------------------------
  const paceTrend = runs.map((run) => ({
    date: toDateString(run.date),
    paceSecPerKm: Math.round(run.durationSeconds / run.distanceKm),
    distanceKm: run.distanceKm,
  }));

  // --- Riegel projection: fastest-pace run ≥ 8 km in the last 60 days ------
  const windowStart = addDays(today, -PROJECTION_WINDOW_DAYS);
  let basis: LoggedRun | null = null;
  for (const run of runs) {
    if (run.distanceKm < PROJECTION_MIN_DISTANCE_KM) continue;
    if (run.date.getTime() < windowStart.getTime()) continue;
    if (
      basis === null ||
      run.durationSeconds / run.distanceKm < basis.durationSeconds / basis.distanceKm
    ) {
      basis = run;
    }
  }
  const projection = basis
    ? {
        basisRun: {
          date: toDateString(basis.date),
          distanceKm: basis.distanceKm,
          durationSeconds: basis.durationSeconds,
        },
        projectedSeconds: Math.round(projectRaceTime(basis.durationSeconds, basis.distanceKm)),
      }
    : { basisRun: null, projectedSeconds: null };

  // --- Plan-independent shape when the user has no plan yet ----------------
  if (plan === null) {
    return {
      weeklyMileage: [],
      paceTrend,
      adherence: { plannedToDate: 0, completed: 0, percent: 0 },
      projection,
      countdown: null,
      taper: null,
    };
  }

  // --- Weekly mileage: planned vs logged, one entry per plan week ----------
  const weeklyMileage: StatsDTO["weeklyMileage"] = [];
  for (let w = 0; w < plan.totalWeeks; w++) {
    const weekStart = addDays(plan.startDate, w * 7);
    const weekEndExclusive = addDays(weekStart, 7);
    let plannedKm = 0;
    for (const workout of plan.workouts) {
      if (workout.weekIndex === w && workout.targetDistanceKm !== null) {
        plannedKm += workout.targetDistanceKm;
      }
    }
    let loggedKm = 0;
    for (const run of runs) {
      if (
        run.date.getTime() >= weekStart.getTime() &&
        run.date.getTime() < weekEndExclusive.getTime()
      ) {
        loggedKm += run.distanceKm;
      }
    }
    weeklyMileage.push({
      weekStart: toDateString(weekStart),
      plannedKm: round1(plannedKm),
      loggedKm: round1(loggedKm),
    });
  }

  // --- Adherence: non-rest workouts from plan start through today ----------
  let plannedToDate = 0;
  let completed = 0;
  for (const workout of plan.workouts) {
    if (workout.type === "rest") continue;
    if (workout.date.getTime() > today.getTime()) continue;
    plannedToDate += 1;
    if (workout.loggedRuns.length > 0) completed += 1;
  }
  const percent = plannedToDate === 0 ? 0 : Math.round((completed / plannedToDate) * 100);

  // --- Countdown & taper ----------------------------------------------------
  const countdown = {
    raceDate: toDateString(plan.raceDate),
    daysToRace: daysBetween(today, plan.raceDate),
  };

  let taperStart: Date | null = null;
  for (const workout of plan.workouts) {
    if (workout.phase === "taper" && (taperStart === null || workout.date < taperStart)) {
      taperStart = workout.date;
    }
  }
  // A generated plan always has taper workouts (taper ≥ 2 weeks); fall back
  // defensively to the race date if a plan somehow has none.
  const taperStartDate = taperStart ?? plan.raceDate;
  const taper = {
    active:
      today.getTime() >= taperStartDate.getTime() && today.getTime() <= plan.raceDate.getTime(),
    startDate: toDateString(taperStartDate),
  };

  return {
    weeklyMileage,
    paceTrend,
    adherence: { plannedToDate, completed, percent },
    projection,
    countdown,
    taper,
  };
}
