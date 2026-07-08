/** Mappers from Prisma rows to the DTO shapes defined in API_CONTRACT.md. */

import type { LoggedRun, PlannedWorkout, Profile, TrainingPlan, User } from "@prisma/client";
import { toDateString } from "./dates.js";

export interface UserDTO {
  id: string;
  email: string;
  unitPreference: string;
  createdAt: string;
  hasProfile: boolean;
}

export interface ProfileDTO {
  experienceLevel: string;
  currentWeeklyMileageKm: number;
  raceDate: string;
  longRunDay: number;
  restDaysPerWeek: number;
}

export interface PlannedWorkoutDTO {
  id: string;
  date: string;
  type: string;
  targetDistanceKm: number | null;
  targetPaceZone: string | null;
  notes: string | null;
  weekIndex: number;
  phase: string;
  loggedRunId: string | null;
}

export interface PlanDTO {
  id: string;
  startDate: string;
  raceDate: string;
  totalWeeks: number;
  generatedAt: string;
  workouts: PlannedWorkoutDTO[];
}

export interface LoggedRunDTO {
  id: string;
  date: string;
  distanceKm: number;
  durationSeconds: number;
  paceSecPerKm: number;
  avgHeartRate: number | null;
  rpe: number | null;
  notes: string | null;
  plannedWorkoutId: string | null;
}

export type WorkoutWithRunIds = PlannedWorkout & { loggedRuns: Array<Pick<LoggedRun, "id">> };

export function toUserDTO(user: User, hasProfile: boolean): UserDTO {
  return {
    id: user.id,
    email: user.email,
    unitPreference: user.unitPreference,
    createdAt: user.createdAt.toISOString(),
    hasProfile,
  };
}

export function toProfileDTO(profile: Profile): ProfileDTO {
  return {
    experienceLevel: profile.experienceLevel,
    currentWeeklyMileageKm: profile.currentWeeklyMileageKm,
    raceDate: toDateString(profile.raceDate),
    longRunDay: profile.longRunDay,
    restDaysPerWeek: profile.restDaysPerWeek,
  };
}

export function toWorkoutDTO(workout: WorkoutWithRunIds): PlannedWorkoutDTO {
  return {
    id: workout.id,
    date: toDateString(workout.date),
    type: workout.type,
    targetDistanceKm: workout.targetDistanceKm,
    targetPaceZone: workout.targetPaceZone,
    notes: workout.notes,
    weekIndex: workout.weekIndex,
    phase: workout.phase,
    loggedRunId: workout.loggedRuns.length > 0 ? workout.loggedRuns[0].id : null,
  };
}

export function toPlanDTO(plan: TrainingPlan & { workouts: WorkoutWithRunIds[] }): PlanDTO {
  return {
    id: plan.id,
    startDate: toDateString(plan.startDate),
    raceDate: toDateString(plan.raceDate),
    totalWeeks: plan.totalWeeks,
    generatedAt: plan.generatedAt.toISOString(),
    workouts: plan.workouts.map(toWorkoutDTO),
  };
}

export function toRunDTO(run: LoggedRun): LoggedRunDTO {
  return {
    id: run.id,
    date: toDateString(run.date),
    distanceKm: run.distanceKm,
    durationSeconds: run.durationSeconds,
    paceSecPerKm: Math.round(run.durationSeconds / run.distanceKm),
    avgHeartRate: run.avgHeartRate,
    rpe: run.rpe,
    notes: run.notes,
    plannedWorkoutId: run.plannedWorkoutId,
  };
}
