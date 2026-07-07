import { Router } from "express";
import { prisma } from "../db.js";
import { notFound } from "../lib/errors.js";
import { parseDateString } from "../lib/dates.js";
import { toPlanDTO, toProfileDTO } from "../lib/dto.js";
import { regenerateSchema } from "../lib/schemas.js";
import { findActivePlan, replacePlan } from "../lib/planService.js";
import type { ExperienceLevel } from "../lib/planGenerator.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler, validate } from "../middleware/validate.js";

interface RegenerateBody {
  experienceLevel?: ExperienceLevel;
  currentWeeklyMileageKm?: number;
  raceDate?: string; // normalized "YYYY-MM-DD"
  longRunDay?: number;
}

export const planRouter = Router();

planRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const plan = await findActivePlan(req.userId);
    res.json({ plan: plan ? toPlanDTO(plan) : null });
  }),
);

planRouter.post(
  "/regenerate",
  requireAuth,
  validate(regenerateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as RegenerateBody;

    const current = await prisma.profile.findUnique({ where: { userId: req.userId } });
    if (!current) {
      throw notFound("No profile found — complete onboarding first");
    }

    const merged = {
      experienceLevel: (body.experienceLevel ?? current.experienceLevel) as ExperienceLevel,
      currentWeeklyMileageKm: body.currentWeeklyMileageKm ?? current.currentWeeklyMileageKm,
      raceDate:
        body.raceDate !== undefined ? (parseDateString(body.raceDate) as Date) : current.raceDate,
      longRunDay: body.longRunDay ?? current.longRunDay,
    };
    const today = new Date();

    const { profile, plan } = await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.update({
        where: { userId: req.userId },
        data: merged,
      });
      const plan = await replacePlan(tx, req.userId, merged, today);
      return { profile, plan };
    });

    res.json({ profile: toProfileDTO(profile), plan: toPlanDTO(plan) });
  }),
);
