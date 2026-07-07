import { Router } from "express";
import { prisma } from "../db.js";
import { buildStats } from "../lib/stats.js";
import { findActivePlan } from "../lib/planService.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../middleware/validate.js";

export const statsRouter = Router();

statsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [plan, runs] = await Promise.all([
      findActivePlan(req.userId),
      prisma.loggedRun.findMany({
        where: { userId: req.userId },
        orderBy: [{ date: "asc" }, { id: "asc" }],
      }),
    ]);
    res.json(buildStats({ plan, runs, today: new Date() }));
  }),
);
