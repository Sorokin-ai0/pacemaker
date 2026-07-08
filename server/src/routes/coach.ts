import { Router } from "express";
import { z } from "zod";
import { isCoachConfigured, runCoach } from "../lib/coach.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler, validate } from "../middleware/validate.js";

const coachSchema = z.object({
  feature: z.enum(["daily_brief", "post_run_recap", "weekly_checkin", "plan_reasoning", "chat"]),
  // Structured, already-grounded context built by the client.
  context: z.record(z.unknown()).default({}),
  // Chat feature only — prior turns, trimmed client-side and again server-side.
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .optional(),
});

export const coachRouter = Router();

/**
 * POST /api/coach — the single seam between the app and the Anthropic API.
 *
 * When no ANTHROPIC_API_KEY is configured this responds `{ configured: false }`
 * (HTTP 200) so the UI can show a friendly "AI coach not configured" state
 * instead of erroring. Requires auth so the API key can't be exercised
 * anonymously.
 */
coachRouter.post(
  "/",
  requireAuth,
  validate(coachSchema),
  asyncHandler(async (req, res) => {
    if (!isCoachConfigured()) {
      res.json({ configured: false });
      return;
    }
    const { feature, context, messages } = req.body as z.infer<typeof coachSchema>;
    const text = await runCoach({ feature, context, messages });
    res.json({ configured: true, text });
  }),
);
