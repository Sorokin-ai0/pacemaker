import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { notFound, validationError } from "../lib/errors.js";
import { addDays, parseDateString } from "../lib/dates.js";
import { toRunDTO } from "../lib/dto.js";
import { createRunSchema, patchRunSchema, runsQuerySchema } from "../lib/schemas.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler, validate } from "../middleware/validate.js";

interface RunBody {
  date?: string;
  distanceKm?: number;
  durationSeconds?: number;
  avgHeartRate?: number | null;
  rpe?: number | null;
  notes?: string | null;
  plannedWorkoutId?: string | null;
}

/** plannedWorkoutId must reference a workout in the user's active plan. */
async function assertWorkoutInActivePlan(userId: string, workoutId: string): Promise<void> {
  const activePlan = await prisma.trainingPlan.findFirst({
    where: { userId },
    orderBy: [{ generatedAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  const workout = activePlan
    ? await prisma.plannedWorkout.findFirst({
        where: { id: workoutId, planId: activePlan.id },
        select: { id: true },
      })
    : null;
  if (!workout) {
    throw validationError("plannedWorkoutId must belong to your active plan");
  }
}

export const runsRouter = Router();

runsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = runsQuerySchema.safeParse(req.query);
    if (!parsed.success) throw parsed.error;
    const { from, to } = parsed.data;

    const where: Prisma.LoggedRunWhereInput = { userId: req.userId };
    if (from !== undefined || to !== undefined) {
      where.date = {
        ...(from !== undefined ? { gte: parseDateString(from) as Date } : {}),
        // `to` is inclusive: match anything before the next calendar day.
        ...(to !== undefined ? { lt: addDays(parseDateString(to) as Date, 1) } : {}),
      };
    }

    const runs = await prisma.loggedRun.findMany({
      where,
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });
    res.json({ runs: runs.map(toRunDTO) });
  }),
);

runsRouter.post(
  "/",
  requireAuth,
  validate(createRunSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as Required<Pick<RunBody, "date" | "distanceKm" | "durationSeconds">> &
      RunBody;

    if (typeof body.plannedWorkoutId === "string") {
      await assertWorkoutInActivePlan(req.userId, body.plannedWorkoutId);
    }

    const run = await prisma.loggedRun.create({
      data: {
        userId: req.userId,
        date: parseDateString(body.date) as Date,
        distanceKm: body.distanceKm,
        durationSeconds: body.durationSeconds,
        avgHeartRate: body.avgHeartRate ?? null,
        rpe: body.rpe ?? null,
        notes: body.notes ?? null,
        plannedWorkoutId: body.plannedWorkoutId ?? null,
      },
    });
    res.status(201).json({ run: toRunDTO(run) });
  }),
);

runsRouter.patch(
  "/:id",
  requireAuth,
  validate(patchRunSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as RunBody;
    const id = req.params.id;

    const existing = await prisma.loggedRun.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.userId) {
      throw notFound("Run not found");
    }

    if (typeof body.plannedWorkoutId === "string") {
      await assertWorkoutInActivePlan(req.userId, body.plannedWorkoutId);
    }

    const data: Prisma.LoggedRunUpdateInput = {};
    if (body.date !== undefined) data.date = parseDateString(body.date) as Date;
    if (body.distanceKm !== undefined) data.distanceKm = body.distanceKm;
    if (body.durationSeconds !== undefined) data.durationSeconds = body.durationSeconds;
    if (body.avgHeartRate !== undefined) data.avgHeartRate = body.avgHeartRate;
    if (body.rpe !== undefined) data.rpe = body.rpe;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.plannedWorkoutId !== undefined) {
      data.plannedWorkout =
        body.plannedWorkoutId === null
          ? { disconnect: true }
          : { connect: { id: body.plannedWorkoutId } };
    }

    const run = await prisma.loggedRun.update({ where: { id }, data });
    res.json({ run: toRunDTO(run) });
  }),
);

runsRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const existing = await prisma.loggedRun.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.userId) {
      throw notFound("Run not found");
    }
    await prisma.loggedRun.delete({ where: { id } });
    res.status(204).end();
  }),
);
