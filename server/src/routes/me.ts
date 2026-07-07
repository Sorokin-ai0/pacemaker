import { Router } from "express";
import { prisma } from "../db.js";
import { unauthorized } from "../lib/errors.js";
import { toUserDTO } from "../lib/dto.js";
import { patchMeSchema } from "../lib/schemas.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler, validate } from "../middleware/validate.js";

export const meRouter = Router();

meRouter.patch(
  "/",
  requireAuth,
  validate(patchMeSchema),
  asyncHandler(async (req, res) => {
    const { unitPreference } = req.body as { unitPreference: "mi" | "km" };

    const existing = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { profile: true },
    });
    if (!existing) throw unauthorized();

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { unitPreference },
    });
    res.json({ user: toUserDTO(user, existing.profile !== null) });
  }),
);
