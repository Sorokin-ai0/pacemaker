/**
 * AI Coach — server-side Anthropic integration.
 *
 * The frontend NEVER calls the Anthropic API directly. It POSTs a structured,
 * pre-grounded JSON context (plus a feature name) to `/api/coach`; this module
 * turns that into a tight prompt, calls Claude Haiku, and returns plain text.
 *
 * The API key is read from `process.env.ANTHROPIC_API_KEY` and stays server-side.
 * When it is missing, `isCoachConfigured()` is false and the route degrades
 * gracefully instead of crashing — the rest of the app runs fine without a key.
 */

import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";
import { AppError } from "./errors.js";

/** Pinned per the product spec — every coach call uses this exact model. */
const COACH_MODEL = "claude-haiku-4-5-20251001";

export type CoachFeature =
  | "daily_brief"
  | "post_run_recap"
  | "weekly_checkin"
  | "plan_reasoning"
  | "chat";

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RunCoachInput {
  feature: CoachFeature;
  /** Structured, already-grounded context built by the client. */
  context: Record<string, unknown>;
  /** Prior turns, chat feature only. */
  messages?: CoachMessage[];
}

export function isCoachConfigured(): boolean {
  return env.ANTHROPIC_API_KEY.length > 0;
}

/**
 * One shared "Coach" persona for every feature: supportive but concise,
 * grounded strictly in the JSON passed in, and safe about health/injury.
 */
const COACH_SYSTEM_PROMPT = `You are "Coach", the AI running coach inside Pacemaker, a half-marathon training app.

VOICE
- Supportive, encouraging, and specific — like a good coach who knows this athlete.
- Concise. Unless you are answering a direct chat question, keep every reply to 2–4 short sentences.
- Plain second-person language ("you"). No markdown, no headings, no bullet lists.

GROUNDING (strict)
- Use ONLY the facts in the JSON context of the message. Never invent workouts, paces, distances, dates, adherence numbers, or any statistic that is not present in the context.
- If a detail you'd like isn't in the context, speak generally instead of guessing.
- Distances, paces and durations in the context are already in the athlete's preferred units — repeat them as given; do not convert or recompute them.

SAFETY (strict)
- You are not a doctor. Never diagnose an injury or medical condition, and never give medical advice.
- If the athlete mentions pain, injury, or a possible health problem — or the context flags fatigue/overreaching — respond gently with "consider" language (e.g. "you might consider an easier day"), suggest rest, and for any real or persistent pain suggest seeing a doctor or physio. Never phrase it as a command or a diagnosis.`;

const FEATURE_INSTRUCTIONS: Record<Exclude<CoachFeature, "chat">, string> = {
  daily_brief: `Write today's daily brief in 2–4 sentences. First describe today's prescribed workout in plain, motivating language. Then give ONE coaching tip that fits the current training phase (base/build/peak/taper).
If "taper" is true, bias the tip toward taper and race-week guidance (protecting sleep, simple carb-loading, race-day logistics, calming nerves).
If a "fatigue" object is present, gently work in a "consider easing off or taking a rest day" note, and suggest seeing a doctor for any real or persistent pain.
If a "milestone" object is present, open with a short, specific congratulations about it.`,
  post_run_recap: `Write a post-run recap in 2–3 sentences. Compare the athlete's logged run to the planned workout — pace, distance, and effort (RPE) — then give ONE specific, actionable note for next time. Be encouraging and honest.`,
  weekly_checkin: `Write an end-of-week check-in in 2–4 sentences. State the adherence percentage, give a one-line trend read — choose exactly one of: on track / plateauing / overreaching — justified by the data, and give ONE concrete suggestion for the coming week.
If a "fatigue" object is present, work in a gentle note about prioritising recovery.`,
  plan_reasoning: `The athlete just regenerated their training plan. In 2–3 sentences, explain in plain language what changed between the "before" and "after" plans and why the new plan makes sense, using only the data provided. Be reassuring.`,
};

/** Keep prompts tight and cheap — cap the JSON we serialise into a message. */
const MAX_CONTEXT_CHARS = 8000;

function contextJson(context: Record<string, unknown>): string {
  const json = JSON.stringify(context ?? {});
  return json.length > MAX_CONTEXT_CHARS ? `${json.slice(0, MAX_CONTEXT_CHARS)}…` : json;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client === null) {
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return client;
}

function extractText(message: Anthropic.Message): string {
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  if (text.length === 0) {
    throw new AppError(502, "COACH_EMPTY", "The coach didn't return a response. Please try again.");
  }
  return text;
}

export async function runCoach({ feature, context, messages }: RunCoachInput): Promise<string> {
  const anthropic = getClient();

  if (feature === "chat") {
    // Ground every chat turn by attaching the athlete's context to the system
    // prompt, then send only the last few turns to keep tokens low.
    const system = `${COACH_SYSTEM_PROMPT}

ATHLETE CONTEXT (JSON) — ground every answer in this and nothing else:
${contextJson(context)}`;

    const turns = (messages ?? [])
      .filter((m) => m.content.trim().length > 0)
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

    if (turns.length === 0 || turns[0].role !== "user") {
      throw new AppError(400, "COACH_BAD_CHAT", "A chat request needs at least one user message.");
    }

    const res = await anthropic.messages.create({
      model: COACH_MODEL,
      max_tokens: 600,
      system,
      messages: turns,
    });
    return extractText(res);
  }

  const content = `${FEATURE_INSTRUCTIONS[feature]}

Context:
${contextJson(context)}`;

  const res = await anthropic.messages.create({
    model: COACH_MODEL,
    max_tokens: 350,
    system: COACH_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });
  return extractText(res);
}
