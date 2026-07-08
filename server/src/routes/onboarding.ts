import { Router } from "express";
import { prisma } from "../db.js";
import { parseDateString } from "../lib/dates.js";
import { toPlanDTO, toProfileDTO } from "../lib/dto.js";
import { onboardingSchema } from "../lib/schemas.js";
import { replacePlan } from "../lib/planService.js";
import type { ExperienceLevel } from "../lib/planGenerator.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler, validate } from "../middleware/validate.js";

interface OnboardingBody {
  experienceLevel: ExperienceLevel;
  currentWeeklyMileageKm: number;
  raceDate: string; // normalized "YYYY-MM-DD"
  longRunDay: number;
  restDaysPerWeek?: 1 | 2;
}

export const onboardingRouter = Router();

onboardingRouter.post(
  "/",
  requireAuth,
  validate(onboardingSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as OnboardingBody;
    // dateStringSchema guarantees parseability.
    const raceDate = parseDateString(body.raceDate) as Date;
    const today = new Date();

    const { profile, plan } = await prisma.$transaction(async (tx) => {
      const restDaysPerWeek = body.restDaysPerWeek === 1 ? 1 : 2;
      const profileData = {
        experienceLevel: body.experienceLevel,
        currentWeeklyMileageKm: body.currentWeeklyMileageKm,
        raceDate,
        longRunDay: body.longRunDay,
        restDaysPerWeek,
      };
      const profile = await tx.profile.upsert({
        where: { userId: req.userId },
        update: profileData,
        create: { userId: req.userId, ...profileData },
      });
      const plan = await replacePlan(
        tx,
        req.userId,
        {
          experienceLevel: body.experienceLevel,
          currentWeeklyMileageKm: body.currentWeeklyMileageKm,
          raceDate,
          longRunDay: body.longRunDay,
          restDaysPerWeek,
        },
        today,
      );
      return { profile, plan };
    });

    res.status(201).json({ profile: toProfileDTO(profile), plan: toPlanDTO(plan) });
  }),
);
