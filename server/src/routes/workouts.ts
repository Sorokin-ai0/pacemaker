import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { notFound } from "../lib/errors.js";
import { parseDateString } from "../lib/dates.js";
import { toWorkoutDTO } from "../lib/dto.js";
import { patchWorkoutSchema } from "../lib/schemas.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler, validate } from "../middleware/validate.js";

interface PatchWorkoutBody {
  date?: string;
  type?: string;
  targetDistanceKm?: number | null;
  targetPaceZone?: string | null;
  notes?: string | null;
}

export const workoutsRouter = Router();

workoutsRouter.patch(
  "/:id",
  requireAuth,
  validate(patchWorkoutSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as PatchWorkoutBody;
    const id = req.params.id;

    // Ownership: workout → plan → userId. Not found and not-owned are both 404.
    const existing = await prisma.plannedWorkout.findUnique({
      where: { id },
      include: { plan: { select: { userId: true } } },
    });
    if (!existing || existing.plan.userId !== req.userId) {
      throw notFound("Workout not found");
    }

    const data: Prisma.PlannedWorkoutUpdateInput = {};
    if (body.date !== undefined) data.date = parseDateString(body.date) as Date;
    if (body.type !== undefined) data.type = body.type;
    if (body.targetDistanceKm !== undefined) data.targetDistanceKm = body.targetDistanceKm;
    if (body.targetPaceZone !== undefined) data.targetPaceZone = body.targetPaceZone;
    if (body.notes !== undefined) data.notes = body.notes;

    const workout = await prisma.plannedWorkout.update({
      where: { id },
      data,
      include: { loggedRuns: { select: { id: true }, orderBy: { date: "asc" } } },
    });

    res.json({ workout: toWorkoutDTO(workout) });
  }),
);
