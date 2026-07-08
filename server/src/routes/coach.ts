import { Router } from "express";
import { z } from "zod";
import { isCoachConfigured, runCoach, streamChat } from "../lib/coach.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler, validate } from "../middleware/validate.js";

const oneShotSchema = z.object({
  feature: z.enum([
    "daily_brief",
    "post_run_recap",
    "weekly_checkin",
    "plan_reasoning",
    "workout_explainer",
    "race_strategy",
    "plan_adjustment",
    "insights",
    "parse_run",
  ]),
  context: z.record(z.unknown()).default({}),
});

const chatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});

const chatSchema = z.object({
  context: z.record(z.unknown()).default({}),
  messages: z.array(chatMessage).min(1).max(20),
});

export const coachRouter = Router();

/** Lightweight config probe so the UI can show a "not configured" state without a call. */
coachRouter.get(
  "/status",
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json({ configured: isCoachConfigured() });
  }),
);

/**
 * POST /api/coach — one-shot coach features (brief, recap, check-in, plan
 * reasoning, workout explainer, race strategy, plan adjustment, insights, and
 * natural-language run parsing). Returns `{ configured: false }` (HTTP 200) when
 * no ANTHROPIC_API_KEY is set so the UI degrades gracefully.
 */
coachRouter.post(
  "/",
  requireAuth,
  validate(oneShotSchema),
  asyncHandler(async (req, res) => {
    if (!isCoachConfigured()) {
      res.json({ configured: false });
      return;
    }
    const { feature, context } = req.body as z.infer<typeof oneShotSchema>;
    const text = await runCoach({ feature, context });
    res.json({ configured: true, text });
  }),
);

/**
 * POST /api/coach/chat — streaming conversational coach. Streams the reply as
 * plain-text chunks (read on the client with a ReadableStream reader). When the
 * key is missing it returns 503 JSON; the client checks /status first, so this
 * is just a safety net.
 */
coachRouter.post(
  "/chat",
  requireAuth,
  validate(chatSchema),
  asyncHandler(async (req, res) => {
    if (!isCoachConfigured()) {
      res.status(503).json({ error: { code: "COACH_UNCONFIGURED", message: "AI coach not configured" } });
      return;
    }
    const { context, messages } = req.body as z.infer<typeof chatSchema>;

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");

    try {
      const stream = streamChat({ context, messages });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          res.write(event.delta.text);
        }
      }
    } catch {
      // Headers are already sent, so we can't switch to a JSON error — leave a
      // gentle inline note and close the stream.
      if (!res.writableEnded) res.write("\n\n(Sorry — the coach was interrupted. Please try again.)");
    } finally {
      res.end();
    }
  }),
);
