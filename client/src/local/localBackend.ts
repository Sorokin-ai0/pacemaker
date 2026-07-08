/**
 * TEMPORARY LOCAL-ONLY BACKEND — preview build.
 *
 * Implements the entire API surface of API_CONTRACT.md against localStorage
 * (via storageAdapter) so the app is fully clickable with no server, no
 * database, and no real authentication. "Signing up" just stores a profile
 * object and treats it as logged in — NO password hashing, NO JWT.
 *
 * TO RESTORE THE REAL BACKEND: point `src/api/endpoints.ts` back at
 * `apiFetch` (src/api/http.ts), wire register/login to the Express JWT auth
 * routes, and delete src/local/. DTO shapes here match the contract exactly,
 * so components need no changes.
 */

import { ApiError } from "@/api/http";
import type {
  LoggedRunDTO,
  OnboardingBody,
  PlanDTO,
  PlannedWorkoutDTO,
  ProfileDTO,
  RegenerateBody,
  RunCreateBody,
  RunPatchBody,
  StatsDTO,
  Unit,
  UserDTO,
  WorkoutPatchBody,
} from "@/api/types";
import {
  addDays,
  daysBetween,
  generatePlan,
  parseDateString,
  round1,
  toDateString,
  utcMidnight,
} from "@/local/planGenerator";
import { storage, storageKeys } from "@/local/storageAdapter";

// ---- stored shapes ----------------------------------------------------------

interface StoredUser {
  id: string;
  email: string;
  /** Display name — local preview only; the real backend has no name yet. */
  name: string;
  unitPreference: Unit;
  createdAt: string;
}

/** Profile + the preview-only restDaysPerWeek knob (see Settings). */
export type StoredProfile = ProfileDTO & { restDaysPerWeek: 1 | 2 };

type StoredWorkout = Omit<PlannedWorkoutDTO, "loggedRunId">;

interface StoredPlan {
  id: string;
  startDate: string;
  raceDate: string;
  totalWeeks: number;
  generatedAt: string;
  workouts: StoredWorkout[];
}

// ---- helpers ----------------------------------------------------------------

const uuid = (): string => crypto.randomUUID();

function readUser(): StoredUser | null {
  return storage.getJSON<StoredUser>(storageKeys.user);
}

function readProfile(): StoredProfile | null {
  return storage.getJSON<StoredProfile>(storageKeys.profile);
}

function readPlan(): StoredPlan | null {
  return storage.getJSON<StoredPlan>(storageKeys.plan);
}

function readRuns(): LoggedRunDTO[] {
  return storage.getJSON<LoggedRunDTO[]>(storageKeys.runs) ?? [];
}

function hasSession(): boolean {
  return storage.getJSON<boolean>(storageKeys.session) === true;
}

function requireSession(): StoredUser {
  const user = readUser();
  if (!hasSession() || user === null) {
    throw new ApiError(401, "UNAUTHORIZED", "Not signed in.");
  }
  return user;
}

function toUserDTO(user: StoredUser): UserDTO {
  return {
    id: user.id,
    email: user.email,
    unitPreference: user.unitPreference,
    createdAt: user.createdAt,
    hasProfile: readProfile() !== null,
  };
}

/** Plan DTO with each workout's loggedRunId resolved from the runs store. */
function toPlanDTO(plan: StoredPlan): PlanDTO {
  const runByWorkout = new Map<string, string>();
  for (const run of readRuns()) {
    if (run.plannedWorkoutId !== null && !runByWorkout.has(run.plannedWorkoutId)) {
      runByWorkout.set(run.plannedWorkoutId, run.id);
    }
  }
  return {
    ...plan,
    workouts: plan.workouts.map((w) => ({ ...w, loggedRunId: runByWorkout.get(w.id) ?? null })),
  };
}

function buildAndStorePlan(profile: StoredProfile): StoredPlan {
  const generated = generatePlan({
    today: new Date(),
    raceDate: parseDateString(profile.raceDate),
    experienceLevel: profile.experienceLevel,
    currentWeeklyMileageKm: profile.currentWeeklyMileageKm,
    longRunDay: profile.longRunDay,
    restDaysPerWeek: profile.restDaysPerWeek,
  });
  const plan: StoredPlan = {
    id: uuid(),
    startDate: toDateString(generated.startDate),
    raceDate: toDateString(generated.raceDate),
    totalWeeks: generated.totalWeeks,
    generatedAt: new Date().toISOString(),
    workouts: generated.workouts.map((w) => ({
      id: uuid(),
      date: toDateString(w.date),
      type: w.type,
      targetDistanceKm: w.targetDistanceKm,
      targetPaceZone: w.targetPaceZone,
      notes: w.notes,
      weekIndex: w.weekIndex,
      phase: w.phase,
    })),
  };
  storage.setJSON(storageKeys.plan, plan);
  return plan;
}

/** Replacing a plan invalidates old workout links on kept runs (server parity). */
function unlinkRunsFromOldPlan(): void {
  const runs = readRuns();
  if (runs.length === 0) return;
  storage.setJSON(
    storageKeys.runs,
    runs.map((r) => ({ ...r, plannedWorkoutId: null })),
  );
}

// ---- auth (LOCAL PREVIEW ONLY — no passwords, no JWT) ------------------------

export const localAuth = {
  /** Sign-up = store a user object and mark the session active. Fresh start. */
  async register(email: string, name: string): Promise<UserDTO> {
    const user: StoredUser = {
      id: uuid(),
      email: email.trim().toLowerCase(),
      name: name.trim(),
      unitPreference: "mi",
      createdAt: new Date().toISOString(),
    };
    // A new sign-up starts from a clean slate.
    storage.remove(storageKeys.profile);
    storage.remove(storageKeys.plan);
    storage.remove(storageKeys.runs);
    storage.setJSON(storageKeys.user, user);
    storage.setJSON(storageKeys.session, true);
    return toUserDTO(user);
  },

  /** "Login" = re-activate the stored local profile (email must match). */
  async login(email: string): Promise<UserDTO> {
    const user = readUser();
    if (user === null) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "No local profile yet — create one first.");
    }
    if (user.email !== email.trim().toLowerCase()) {
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        `No local profile for that email (this browser has ${user.email}).`,
      );
    }
    storage.setJSON(storageKeys.session, true);
    return toUserDTO(user);
  },

  async logout(): Promise<void> {
    // Keeps the data; only ends the "session" so login can resume it.
    storage.remove(storageKeys.session);
  },

  async me(): Promise<{ user: UserDTO; profile: ProfileDTO | null }> {
    const user = requireSession();
    return { user: toUserDTO(user), profile: readProfile() };
  },

  /** Read-only peek for the login screen (no 401). */
  peekUser(): { email: string; name: string } | null {
    const user = readUser();
    return user ? { email: user.email, name: user.name } : null;
  },
};

export const localMe = {
  async update(body: { unitPreference: Unit }): Promise<UserDTO> {
    const user = requireSession();
    const next: StoredUser = { ...user, unitPreference: body.unitPreference };
    storage.setJSON(storageKeys.user, next);
    return toUserDTO(next);
  },
};

// ---- onboarding & plan --------------------------------------------------------

export const localOnboarding = {
  async submit(body: OnboardingBody): Promise<{ profile: ProfileDTO; plan: PlanDTO }> {
    requireSession();
    const profile: StoredProfile = {
      experienceLevel: body.experienceLevel,
      currentWeeklyMileageKm: body.currentWeeklyMileageKm,
      raceDate: body.raceDate,
      longRunDay: body.longRunDay,
      restDaysPerWeek: body.restDaysPerWeek === 1 ? 1 : 2,
    };
    storage.setJSON(storageKeys.profile, profile);
    unlinkRunsFromOldPlan();
    const plan = buildAndStorePlan(profile);
    return { profile, plan: toPlanDTO(plan) };
  },
};

export const localPlan = {
  async get(): Promise<PlanDTO | null> {
    requireSession();
    const plan = readPlan();
    return plan === null ? null : toPlanDTO(plan);
  },

  async regenerate(body: RegenerateBody): Promise<{ profile: ProfileDTO; plan: PlanDTO }> {
    requireSession();
    const current = readProfile();
    if (current === null) {
      throw new ApiError(404, "NOT_FOUND", "No training profile yet — complete onboarding first.");
    }
    const profile: StoredProfile = {
      experienceLevel: body.experienceLevel ?? current.experienceLevel,
      currentWeeklyMileageKm: body.currentWeeklyMileageKm ?? current.currentWeeklyMileageKm,
      raceDate: body.raceDate ?? current.raceDate,
      longRunDay: body.longRunDay ?? current.longRunDay,
      restDaysPerWeek:
        body.restDaysPerWeek === 1 || body.restDaysPerWeek === 2
          ? body.restDaysPerWeek
          : current.restDaysPerWeek,
    };
    storage.setJSON(storageKeys.profile, profile);
    unlinkRunsFromOldPlan();
    const plan = buildAndStorePlan(profile);
    return { profile, plan: toPlanDTO(plan) };
  },
};

export const localWorkouts = {
  async update(id: string, body: WorkoutPatchBody): Promise<PlannedWorkoutDTO> {
    requireSession();
    const plan = readPlan();
    const index = plan?.workouts.findIndex((w) => w.id === id) ?? -1;
    if (plan === null || index === -1) {
      throw new ApiError(404, "NOT_FOUND", "Workout not found.");
    }
    const current = plan.workouts[index];
    const next: StoredWorkout = {
      ...current,
      ...(body.date !== undefined ? { date: body.date } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.targetDistanceKm !== undefined ? { targetDistanceKm: body.targetDistanceKm } : {}),
      ...(body.targetPaceZone !== undefined ? { targetPaceZone: body.targetPaceZone } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    };
    if (next.type === "rest") {
      next.targetDistanceKm = null;
      next.targetPaceZone = null;
    }
    plan.workouts[index] = next;
    plan.workouts.sort((a, b) => a.date.localeCompare(b.date));
    storage.setJSON(storageKeys.plan, plan);
    return toPlanDTO(plan).workouts.find((w) => w.id === id)!;
  },
};

// ---- runs ---------------------------------------------------------------------

function validateRunBody(body: RunCreateBody | RunPatchBody): void {
  if (body.distanceKm !== undefined && !(body.distanceKm > 0)) {
    throw new ApiError(400, "VALIDATION", "Distance must be greater than zero.");
  }
  if (
    body.durationSeconds !== undefined &&
    (!Number.isInteger(body.durationSeconds) || body.durationSeconds <= 0)
  ) {
    throw new ApiError(400, "VALIDATION", "Duration must be greater than zero.");
  }
  if (
    body.rpe !== undefined &&
    body.rpe !== null &&
    (!Number.isInteger(body.rpe) || body.rpe < 1 || body.rpe > 10)
  ) {
    throw new ApiError(400, "VALIDATION", "RPE must be between 1 and 10.");
  }
}

/** Normalizes ""/undefined → null and verifies the workout exists in the plan. */
function resolveWorkoutLink(id: string | null | undefined): string | null {
  if (id === undefined || id === null || id === "") return null;
  const plan = readPlan();
  if (plan === null || !plan.workouts.some((w) => w.id === id)) {
    throw new ApiError(400, "VALIDATION", "That planned workout does not exist in your plan.");
  }
  return id;
}

export const localRuns = {
  async list(params?: { from?: string; to?: string }): Promise<LoggedRunDTO[]> {
    requireSession();
    let runs = readRuns();
    if (params?.from) runs = runs.filter((r) => r.date >= params.from!);
    if (params?.to) runs = runs.filter((r) => r.date <= params.to!);
    return [...runs].sort((a, b) => b.date.localeCompare(a.date));
  },

  async create(body: RunCreateBody): Promise<LoggedRunDTO> {
    requireSession();
    validateRunBody(body);
    if (!(body.distanceKm > 0) || !(body.durationSeconds > 0)) {
      throw new ApiError(400, "VALIDATION", "Distance and duration are required.");
    }
    const run: LoggedRunDTO = {
      id: uuid(),
      date: body.date,
      distanceKm: body.distanceKm,
      durationSeconds: body.durationSeconds,
      paceSecPerKm: Math.round(body.durationSeconds / body.distanceKm),
      avgHeartRate: body.avgHeartRate ?? null,
      rpe: body.rpe ?? null,
      notes: body.notes ?? null,
      plannedWorkoutId: resolveWorkoutLink(body.plannedWorkoutId),
    };
    storage.setJSON(storageKeys.runs, [...readRuns(), run]);
    return run;
  },

  async update(id: string, body: RunPatchBody): Promise<LoggedRunDTO> {
    requireSession();
    validateRunBody(body);
    const runs = readRuns();
    const index = runs.findIndex((r) => r.id === id);
    if (index === -1) throw new ApiError(404, "NOT_FOUND", "Run not found.");
    const current = runs[index];
    const next: LoggedRunDTO = {
      ...current,
      ...(body.date !== undefined ? { date: body.date } : {}),
      ...(body.distanceKm !== undefined ? { distanceKm: body.distanceKm } : {}),
      ...(body.durationSeconds !== undefined ? { durationSeconds: body.durationSeconds } : {}),
      ...(body.avgHeartRate !== undefined ? { avgHeartRate: body.avgHeartRate } : {}),
      ...(body.rpe !== undefined ? { rpe: body.rpe } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.plannedWorkoutId !== undefined
        ? { plannedWorkoutId: resolveWorkoutLink(body.plannedWorkoutId) }
        : {}),
    };
    next.paceSecPerKm = Math.round(next.durationSeconds / next.distanceKm);
    runs[index] = next;
    storage.setJSON(storageKeys.runs, runs);
    return next;
  },

  async remove(id: string): Promise<void> {
    requireSession();
    storage.setJSON(
      storageKeys.runs,
      readRuns().filter((r) => r.id !== id),
    );
  },
};

// ---- stats (port of server/src/lib/stats.ts + riegel.ts) -----------------------

const RIEGEL_EXPONENT = 1.06;
const HALF_MARATHON_KM = 21.0975;
const PROJECTION_MIN_DISTANCE_KM = 8;
const PROJECTION_WINDOW_DAYS = 60;

function projectRaceTime(t1Seconds: number, d1Km: number): number {
  return t1Seconds * Math.pow(HALF_MARATHON_KM / d1Km, RIEGEL_EXPONENT);
}

export const localStats = {
  async get(): Promise<StatsDTO> {
    requireSession();
    const plan = readPlan();
    const profile = readProfile();
    const runs = [...readRuns()].sort((a, b) => a.date.localeCompare(b.date));
    const today = utcMidnight(new Date());
    const todayStr = toDateString(today);

    const paceTrend = runs.map((r) => ({
      date: r.date,
      paceSecPerKm: r.paceSecPerKm,
      distanceKm: r.distanceKm,
    }));

    const windowStartStr = toDateString(addDays(today, -PROJECTION_WINDOW_DAYS));
    let basis: LoggedRunDTO | null = null;
    for (const run of runs) {
      if (run.distanceKm < PROJECTION_MIN_DISTANCE_KM) continue;
      if (run.date < windowStartStr) continue;
      if (basis === null || run.paceSecPerKm < basis.paceSecPerKm) basis = run;
    }
    const projection = basis
      ? {
          basisRun: {
            date: basis.date,
            distanceKm: basis.distanceKm,
            durationSeconds: basis.durationSeconds,
          },
          projectedSeconds: Math.round(projectRaceTime(basis.durationSeconds, basis.distanceKm)),
        }
      : { basisRun: null, projectedSeconds: null };

    if (plan === null) {
      // No plan yet: countdown/taper fall back to the profile's race date (or today).
      const raceDate = profile?.raceDate ?? todayStr;
      return {
        weeklyMileage: [],
        paceTrend,
        adherence: { plannedToDate: 0, completed: 0, percent: 0 },
        projection,
        countdown: { raceDate, daysToRace: daysBetween(today, parseDateString(raceDate)) },
        taper: { active: false, startDate: raceDate },
      };
    }

    const planStart = parseDateString(plan.startDate);
    const weeklyMileage: StatsDTO["weeklyMileage"] = [];
    for (let w = 0; w < plan.totalWeeks; w++) {
      const weekStartStr = toDateString(addDays(planStart, w * 7));
      const weekEndStr = toDateString(addDays(planStart, w * 7 + 7));
      let plannedKm = 0;
      for (const workout of plan.workouts) {
        if (workout.weekIndex === w && workout.targetDistanceKm !== null) {
          plannedKm += workout.targetDistanceKm;
        }
      }
      let loggedKm = 0;
      for (const run of runs) {
        if (run.date >= weekStartStr && run.date < weekEndStr) loggedKm += run.distanceKm;
      }
      weeklyMileage.push({
        weekStart: weekStartStr,
        plannedKm: round1(plannedKm),
        loggedKm: round1(loggedKm),
      });
    }

    const linkedWorkouts = new Set(
      runs.filter((r) => r.plannedWorkoutId !== null).map((r) => r.plannedWorkoutId as string),
    );
    let plannedToDate = 0;
    let completed = 0;
    for (const workout of plan.workouts) {
      if (workout.type === "rest") continue;
      if (workout.date > todayStr) continue;
      plannedToDate += 1;
      if (linkedWorkouts.has(workout.id)) completed += 1;
    }
    const percent = plannedToDate === 0 ? 0 : Math.round((completed / plannedToDate) * 100);

    let taperStart: string | null = null;
    for (const workout of plan.workouts) {
      if (workout.phase === "taper" && (taperStart === null || workout.date < taperStart)) {
        taperStart = workout.date;
      }
    }
    const taperStartDate = taperStart ?? plan.raceDate;

    return {
      weeklyMileage,
      paceTrend,
      adherence: { plannedToDate, completed, percent },
      projection,
      countdown: {
        raceDate: plan.raceDate,
        daysToRace: daysBetween(today, parseDateString(plan.raceDate)),
      },
      taper: {
        active: todayStr >= taperStartDate && todayStr <= plan.raceDate,
        startDate: taperStartDate,
      },
    };
  },
};
