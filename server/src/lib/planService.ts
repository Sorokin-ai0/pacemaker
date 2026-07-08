/** Shared plan persistence helpers used by onboarding, regenerate and plan routes. */

import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { generatePlan, type ExperienceLevel } from "./planGenerator.js";

/** Include tree that lets DTO mappers resolve each workout's loggedRunId. */
export const planWorkoutsInclude = {
  workouts: {
    orderBy: { date: "asc" },
    include: { loggedRuns: { select: { id: true }, orderBy: { date: "asc" } } },
  },
} satisfies Prisma.TrainingPlanInclude;

export type PlanWithWorkouts = Prisma.TrainingPlanGetPayload<{
  include: typeof planWorkoutsInclude;
}>;

/** The user's active plan = the most recently generated one (or null). */
export function findActivePlan(userId: string): Promise<PlanWithWorkouts | null> {
  return prisma.trainingPlan.findFirst({
    where: { userId },
    orderBy: [{ generatedAt: "desc" }, { id: "desc" }],
    include: planWorkoutsInclude,
  });
}

export interface PlanProfileInput {
  experienceLevel: ExperienceLevel;
  currentWeeklyMileageKm: number;
  raceDate: Date;
  longRunDay: number;
  restDaysPerWeek?: 1 | 2;
}

/**
 * Inside an open transaction: delete any existing plans (cascade removes
 * workouts; logged runs keep their history with plannedWorkoutId nulled by
 * the DB) and create a fresh plan from the generator.
 */
export async function replacePlan(
  tx: Prisma.TransactionClient,
  userId: string,
  profile: PlanProfileInput,
  today: Date,
): Promise<PlanWithWorkouts> {
  const generated = generatePlan({
    today,
    raceDate: profile.raceDate,
    experienceLevel: profile.experienceLevel,
    currentWeeklyMileageKm: profile.currentWeeklyMileageKm,
    longRunDay: profile.longRunDay,
    restDaysPerWeek: profile.restDaysPerWeek,
  });

  await tx.trainingPlan.deleteMany({ where: { userId } });

  return tx.trainingPlan.create({
    data: {
      userId,
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
    include: planWorkoutsInclude,
  });
}
