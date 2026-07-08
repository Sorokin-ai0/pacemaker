/** Shared zod schemas for request validation. */

import { z } from "zod";
import { parseDateString } from "./dates.js";

/**
 * Calendar date input: "YYYY-MM-DD" (a full ISO timestamp is tolerated and
 * truncated to its date part). Output is always a normalized "YYYY-MM-DD".
 */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}($|T)/, "Expected an ISO date (YYYY-MM-DD)")
  .transform((s) => s.slice(0, 10))
  .refine((s) => parseDateString(s) !== null, "Invalid calendar date");

export const experienceLevelSchema = z.enum(["beginner", "intermediate", "advanced"]);

export const workoutTypeSchema = z.enum(["long", "easy", "tempo", "speed", "rest", "race"]);

export const unitSchema = z.enum(["mi", "km"]);

export const onboardingSchema = z.object({
  experienceLevel: experienceLevelSchema,
  currentWeeklyMileageKm: z.number().positive(),
  raceDate: dateStringSchema,
  longRunDay: z.number().int().min(0).max(6),
  restDaysPerWeek: z.union([z.literal(1), z.literal(2)]).optional(),
});

export const regenerateSchema = onboardingSchema.partial();

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const patchMeSchema = z.object({
  unitPreference: unitSchema,
});

export const patchWorkoutSchema = z.object({
  date: dateStringSchema.optional(),
  type: workoutTypeSchema.optional(),
  targetDistanceKm: z.number().positive().nullable().optional(),
  targetPaceZone: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const createRunSchema = z.object({
  date: dateStringSchema,
  distanceKm: z.number().positive(),
  durationSeconds: z.number().int().positive(),
  avgHeartRate: z.number().int().min(30).max(250).nullable().optional(),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  // "" is treated as "no link" — some select components emit empty strings.
  plannedWorkoutId: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().min(1).nullable().optional(),
  ),
});

export const patchRunSchema = createRunSchema.partial();

export const runsQuerySchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});
