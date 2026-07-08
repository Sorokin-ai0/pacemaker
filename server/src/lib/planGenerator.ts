/**
 * Pacemaker training-plan generator.
 *
 * PURE: no I/O, no randomness, no Date.now() — `today` is injected. Given the
 * same input it always produces the same plan, which is the unit-test surface.
 *
 * All dates in and out are UTC-midnight calendar dates. All distances in km,
 * rounded to 0.1 km.
 */

import { addDays, round1, utcMidnight } from "./dates.js";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type WorkoutType = "long" | "easy" | "tempo" | "speed" | "rest" | "race";
export type Phase = "base" | "build" | "peak" | "taper";

export interface GeneratePlanInput {
  /** Reference "now" — injected for determinism. */
  today: Date;
  /** Target race date, or null/invalid/past to get the 14-week default. */
  raceDate: Date | null;
  experienceLevel: ExperienceLevel;
  currentWeeklyMileageKm: number;
  /** Day of week for the long run: 0 = Sunday … 6 = Saturday. */
  longRunDay: number;
  /** Rest days per non-race week: 2 (default) or 1 (the extra day becomes easy). */
  restDaysPerWeek?: 1 | 2;
}

export interface GeneratedWorkout {
  /** UTC-midnight calendar date. */
  date: Date;
  type: WorkoutType;
  targetDistanceKm: number | null;
  targetPaceZone: string | null;
  notes: string | null;
  /** 0-based week within the plan. */
  weekIndex: number;
  phase: Phase;
}

export interface GeneratedPlan {
  startDate: Date;
  raceDate: Date;
  totalWeeks: number;
  workouts: GeneratedWorkout[];
}

export interface PhaseWeeks {
  base: number;
  build: number;
  peak: number;
  taper: number;
}

export const HALF_MARATHON_RACE_KM = 21.1;

const MIN_WEEKS = 8;
const MAX_WEEKS = 20;
const DEFAULT_WEEKS = 14;

/** Minimum starting weekly volume per experience level (km). */
const LEVEL_FLOOR_KM: Record<ExperienceLevel, number> = {
  beginner: 15,
  intermediate: 25,
  advanced: 35,
};

/** Absolute weekly-volume ceiling per level (km) — keeps 20-week ramps sane. */
const LEVEL_VOLUME_CAP_KM: Record<ExperienceLevel, number> = {
  beginner: 50,
  intermediate: 70,
  advanced: 90,
};

/** Long-run cap per level (km): 12 mi for beginners, 13.1 mi otherwise. */
const LONG_RUN_CAP_KM: Record<ExperienceLevel, number> = {
  beginner: 19.3,
  intermediate: 21.1,
  advanced: 21.1,
};

const OVERREACH_LONG_KM = 22.5; // 14 mi — intermediate/advanced only

export const PACE_ZONES: Record<Exclude<WorkoutType, "rest">, string> = {
  easy: "Zone 2 — conversational",
  long: "Zone 2 — finish steady",
  tempo: "Comfortably hard — tempo",
  speed: "5K–10K effort",
  race: "Race effort",
};

const TEMPO_NOTES: Record<Phase, string> = {
  base: "20 min at threshold pace after a 10 min easy warm-up",
  build: "2×12 min at threshold pace, 3 min jog between",
  peak: "30 min at threshold pace — settle in and hold",
  taper: "15 min at threshold pace, smooth and controlled",
};

const SPEED_NOTES: Record<Phase, string> = {
  base: "8×400 m at 5K effort, 200 m jog recoveries",
  build: "6×800 m at 5K effort, 400 m jog recoveries",
  peak: "5×1000 m at 10K effort, 400 m jog recoveries",
  taper: "4×400 m at 5K effort, full recoveries — stay sharp",
};

/**
 * Phase distribution for a plan of `totalWeeks`:
 * taper = max(2, round(10%)), peak = max(1, round(15%)), build = round(35%),
 * base = remainder (stealing from build if it would drop below 1 week).
 */
export function computePhaseWeeks(totalWeeks: number): PhaseWeeks {
  const taper = Math.max(2, Math.round(0.1 * totalWeeks));
  const peak = Math.max(1, Math.round(0.15 * totalWeeks));
  let build = Math.round(0.35 * totalWeeks);
  let base = totalWeeks - taper - peak - build;
  if (base < 1) {
    build -= 1 - base;
    base = 1;
  }
  if (build < 0) build = 0;
  return { base, build, peak, taper };
}

function phaseForWeek(weekIndex: number, p: PhaseWeeks): Phase {
  if (weekIndex < p.base) return "base";
  if (weekIndex < p.base + p.build) return "build";
  if (weekIndex < p.base + p.build + p.peak) return "peak";
  return "taper";
}

/**
 * Weekly volumes (km, unrounded) for every week of the plan.
 * Base+build: +8%/week from the starting volume, with every 4th week
 * (weekIndex 3, 7, …) a cutback at 80% of the previous week; growth resumes
 * from the pre-cutback trajectory. Weekly volume is capped so long ramps stay
 * sane. Peak weeks hold the max. Taper: 60% of peak, then 45% for any further
 * taper week (the race week's number is never used — its content is fixed).
 */
function computeWeeklyVolumes(
  totalWeeks: number,
  phases: PhaseWeeks,
  level: ExperienceLevel,
  currentWeeklyMileageKm: number,
): number[] {
  const startVolume = Math.max(currentWeeklyMileageKm, LEVEL_FLOOR_KM[level]);
  const volumeCap = Math.max(startVolume, Math.min(startVolume * 2, LEVEL_VOLUME_CAP_KM[level]));
  const growthWeeks = phases.base + phases.build;

  const volumes: number[] = [];
  let lastFullWeek = startVolume; // last non-cutback volume — growth resumes from here
  for (let w = 0; w < growthWeeks; w++) {
    let v: number;
    if (w === 0) {
      v = startVolume;
    } else if (w % 4 === 3) {
      v = volumes[w - 1] * 0.8; // cutback: 80% of the previous week
    } else {
      v = Math.min(lastFullWeek * 1.08, volumeCap);
      lastFullWeek = v;
    }
    volumes.push(v);
  }

  const peakVolume = volumes.length > 0 ? Math.max(...volumes) : startVolume;
  for (let w = growthWeeks; w < totalWeeks; w++) {
    const phase = phaseForWeek(w, phases);
    if (phase === "peak") {
      volumes.push(peakVolume);
    } else {
      const taperIndex = w - (phases.base + phases.build + phases.peak);
      volumes.push(taperIndex === 0 ? 0.6 * peakVolume : 0.45 * peakVolume);
    }
  }
  return volumes;
}

/**
 * Long-run distance per week (rounded to 0.1 km); race week has no long run.
 * long = min(cap, max(6, 32% of week volume), previousLong + 1.6), except the
 * overreach week (exactly 2 weeks before the first taper week) which is fixed
 * at 22.5 km (14 mi) for intermediate/advanced — beginners keep their cap.
 */
function computeLongRuns(
  totalWeeks: number,
  phases: PhaseWeeks,
  level: ExperienceLevel,
  volumes: number[],
): number[] {
  const cap = LONG_RUN_CAP_KM[level];
  const firstTaperWeek = totalWeeks - phases.taper;
  const overreachWeek = firstTaperWeek - 2;
  const longs: number[] = [];
  let previous: number | null = null;
  for (let w = 0; w < totalWeeks - 1; w++) {
    let long: number;
    if (w === overreachWeek && level !== "beginner") {
      long = OVERREACH_LONG_KM;
    } else {
      const growthLimit = previous === null ? Number.POSITIVE_INFINITY : previous + 1.6;
      long = Math.min(cap, Math.max(6, 0.32 * volumes[w]), growthLimit);
    }
    long = round1(long);
    longs.push(long);
    previous = long;
  }
  return longs;
}

/**
 * Generate a half-marathon training plan. See module docs — pure/deterministic.
 */
export function generatePlan(input: GeneratePlanInput): GeneratedPlan {
  const today = utcMidnight(input.today);
  const longRunDay = ((Math.trunc(input.longRunDay) % 7) + 7) % 7;
  const restDays = input.restDaysPerWeek === 1 ? 1 : 2;

  // --- 1. Plan length & anchoring -----------------------------------------
  const rawRace =
    input.raceDate !== null && !Number.isNaN(input.raceDate.getTime())
      ? utcMidnight(input.raceDate)
      : null;

  let totalWeeks: number;
  let raceDate: Date;
  if (rawRace === null || rawRace.getTime() <= today.getTime()) {
    totalWeeks = DEFAULT_WEEKS;
    raceDate = addDays(today, DEFAULT_WEEKS * 7);
  } else {
    const computed = Math.floor((rawRace.getTime() - today.getTime()) / (7 * 86_400_000));
    totalWeeks = Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, computed));
    raceDate = rawRace;
  }
  // Plan spans totalWeeks*7 days ENDING on raceDate (see DECISIONS.md #15).
  const startDate = addDays(raceDate, -(totalWeeks * 7 - 1));

  // --- 2–5. Phases, volumes, long runs ------------------------------------
  const phases = computePhaseWeeks(totalWeeks);
  const volumes = computeWeeklyVolumes(
    totalWeeks,
    phases,
    input.experienceLevel,
    input.currentWeeklyMileageKm,
  );
  const longs = computeLongRuns(totalWeeks, phases, input.experienceLevel, volumes);
  const firstTaperWeek = totalWeeks - phases.taper;
  const overreachWeek = firstTaperWeek - 2;

  // --- 6–7. Emit one workout row per day ----------------------------------
  const workouts: GeneratedWorkout[] = [];
  const raceWeek = totalWeeks - 1;

  for (let w = 0; w < totalWeeks; w++) {
    const phase = phaseForWeek(w, phases);
    const weekStart = addDays(startDate, w * 7);

    if (w === raceWeek) {
      // Race week: race day + exactly two 3 km shakeouts + rest otherwise.
      const shakeoutDates = new Set([
        addDays(raceDate, -4).getTime(),
        addDays(raceDate, -2).getTime(),
      ]);
      let shakeoutNo = 0;
      for (let d = 0; d < 7; d++) {
        const date = addDays(weekStart, d);
        if (date.getTime() === raceDate.getTime()) {
          workouts.push({
            date,
            type: "race",
            targetDistanceKm: HALF_MARATHON_RACE_KM,
            targetPaceZone: PACE_ZONES.race,
            notes: "Half marathon — race day!",
            weekIndex: w,
            phase,
          });
        } else if (shakeoutDates.has(date.getTime())) {
          shakeoutNo += 1;
          workouts.push({
            date,
            type: "easy",
            targetDistanceKm: 3,
            targetPaceZone: PACE_ZONES.easy,
            notes:
              shakeoutNo === 1
                ? "3 km shakeout — very easy, finish with 4×20 s strides"
                : "3 km shakeout — legs loose, nothing hard",
            weekIndex: w,
            phase,
          });
        } else {
          workouts.push({
            date,
            type: "rest",
            targetDistanceKm: null,
            targetPaceZone: null,
            notes: null,
            weekIndex: w,
            phase,
          });
        }
      }
      continue;
    }

    // Regular week: template anchored on the long-run day L. Offsets from L:
    // 0=long · 1=rest · 2=easy · 3=quality · 4=easy · 6=easy
    // 5=rest when restDaysPerWeek=2 (default), otherwise a 4th easy run.
    const volume = volumes[w];
    const long = longs[w];
    const quality = round1(Math.max(5, 0.15 * volume));
    const easyCount = restDays === 1 ? 4 : 3;
    const easyEach = round1(Math.max(0, volume - long - quality) / easyCount);
    const qualityType: WorkoutType = w % 2 === 0 ? "tempo" : "speed";
    const qualityNotes = qualityType === "tempo" ? TEMPO_NOTES[phase] : SPEED_NOTES[phase];

    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      const offset = (date.getUTCDay() - longRunDay + 7) % 7;
      const isEasy =
        offset === 2 || offset === 4 || offset === 6 || (offset === 5 && restDays === 1);
      let workout: GeneratedWorkout;
      if (offset === 0) {
        workout = {
          date,
          type: "long",
          targetDistanceKm: long,
          targetPaceZone: PACE_ZONES.long,
          notes:
            w === overreachWeek && input.experienceLevel !== "beginner"
              ? "Overreach long run — 14 miles, the confidence builder"
              : null,
          weekIndex: w,
          phase,
        };
      } else if (offset === 3) {
        workout = {
          date,
          type: qualityType,
          targetDistanceKm: quality,
          targetPaceZone: PACE_ZONES[qualityType],
          notes: qualityNotes,
          weekIndex: w,
          phase,
        };
      } else if (isEasy) {
        workout = {
          date,
          type: "easy",
          targetDistanceKm: easyEach,
          targetPaceZone: PACE_ZONES.easy,
          notes: null,
          weekIndex: w,
          phase,
        };
      } else {
        workout = {
          date,
          type: "rest",
          targetDistanceKm: null,
          targetPaceZone: null,
          notes: null,
          weekIndex: w,
          phase,
        };
      }
      workouts.push(workout);
    }
  }

  workouts.sort((a, b) => a.date.getTime() - b.date.getTime());

  return { startDate, raceDate, totalWeeks, workouts };
}
