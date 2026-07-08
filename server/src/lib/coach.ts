/**
 * AI Coach — server-side Anthropic integration.
 *
 * The frontend NEVER calls the Anthropic API directly. It POSTs a structured,
 * pre-grounded JSON context (plus a feature name) to `/api/coach`; this module
 * turns that into a tight prompt, calls Claude Haiku, and returns text. The chat
 * feature streams token-by-token via `streamChat`.
 *
 * The API key is read from `process.env.ANTHROPIC_API_KEY` and stays server-side.
 * When it is missing, `isCoachConfigured()` is false and the routes degrade
 * gracefully — the rest of the app runs fine without a key.
 */

import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env.js";
import { AppError } from "./errors.js";

/** Pinned per the product spec — every coach call uses this exact model. */
const COACH_MODEL = "claude-haiku-4-5-20251001";

/** One-shot (non-streaming) features. `chat` streams; `parse_run` extracts JSON. */
export type CoachFeature =
  | "daily_brief"
  | "post_run_recap"
  | "weekly_checkin"
  | "plan_reasoning"
  | "workout_explainer"
  | "race_strategy"
  | "plan_adjustment"
  | "insights"
  | "parse_run"
  | "chat";

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RunCoachInput {
  feature: Exclude<CoachFeature, "chat">;
  context: Record<string, unknown>;
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
- Concise. Unless you are answering a chat question, keep every reply to 2–4 short sentences.
- Plain second-person language ("you").

GROUNDING (strict)
- Use ONLY the facts in the JSON context of the message. Never invent workouts, paces, distances, dates, adherence numbers, or any statistic that is not present in the context.
- If a detail you'd like isn't in the context, speak generally instead of guessing.
- Distances, paces and durations in the context are already in the athlete's preferred units — repeat them as given; do not convert or recompute them.

SAFETY (strict)
- You are not a doctor. Never diagnose an injury or medical condition, and never give medical advice.
- If the athlete mentions pain, injury, or a possible health problem — or the context flags fatigue/overreaching — respond gently with "consider" language (e.g. "you might consider an easier day"), suggest rest, and for any real or persistent pain suggest seeing a doctor or physio. Never phrase it as a command or a diagnosis.`;

interface FeatureSpec {
  instruction: string;
  maxTokens: number;
  /** Allow light markdown (bold + "- " bullets) — for the longer, structured replies. */
  markdown: boolean;
}

const FEATURES: Record<Exclude<CoachFeature, "chat" | "parse_run">, FeatureSpec> = {
  daily_brief: {
    maxTokens: 350,
    markdown: false,
    instruction: `Write today's daily brief in 2–4 sentences. First describe today's prescribed workout in plain, motivating language. Then give ONE coaching tip that fits the current training phase (base/build/peak/taper).
If "taper" is true, bias the tip toward taper and race-week guidance (protecting sleep, simple carb-loading, race-day logistics, calming nerves).
If a "fatigue" object is present, gently work in a "consider easing off or taking a rest day" note, and suggest seeing a doctor for any real or persistent pain.
If a "milestone" object is present, open with a short, specific congratulations about it.`,
  },
  post_run_recap: {
    maxTokens: 350,
    markdown: false,
    instruction: `Write a post-run recap in 2–3 sentences. Compare the athlete's logged run to the planned workout — pace, distance, and effort (RPE) — then give ONE specific, actionable note for next time. Be encouraging and honest.`,
  },
  weekly_checkin: {
    maxTokens: 350,
    markdown: false,
    instruction: `Write an end-of-week check-in in 2–4 sentences. State the adherence percentage, give a one-line trend read — choose exactly one of: on track / plateauing / overreaching — justified by the data, and give ONE concrete suggestion for the coming week.
If a "fatigue" object is present, work in a gentle note about prioritising recovery.`,
  },
  plan_reasoning: {
    maxTokens: 300,
    markdown: false,
    instruction: `The athlete just regenerated their training plan. In 2–3 sentences, explain in plain language what changed between the "before" and "after" plans and why the new plan makes sense, using only the data provided. Be reassuring.`,
  },
  workout_explainer: {
    maxTokens: 300,
    markdown: false,
    instruction: `Explain the purpose of this one planned workout in 2–3 sentences: what fitness it develops, how it fits the current training phase, and how to approach it (effort/pacing feel). Use only the provided data.`,
  },
  race_strategy: {
    maxTokens: 600,
    markdown: true,
    instruction: `Write a race-day pacing strategy. Start with one short sentence, then give 3–5 "- " bullet points. Ground it in the projected finish time and goal pace if present; recommend even or slightly negative splits, a controlled opening mile/km, a simple fueling reminder, and a mindset cue. If no projection is available, give solid general half-marathon pacing guidance and note that logging a recent long run would sharpen it.`,
  },
  plan_adjustment: {
    maxTokens: 400,
    markdown: true,
    instruction: `The athlete is behind on their plan. Reassure them, then SUGGEST how to get back on track — never command, and never imply you have changed anything. In one short sentence plus 2–4 "- " bullets: prioritise long runs and quality sessions over making up missed easy miles, keep easy days easy, and consider a lighter cutback if fatigued. Use only the provided data.`,
  },
  insights: {
    maxTokens: 300,
    markdown: false,
    instruction: `In 2–3 short sentences, surface the single most useful pattern in the athlete's recent training from the data (weekly mileage trend, pace trend, consistency, or fatigue). Be specific and encouraging. If a "fatigue" object is present, gently flag it with "consider" language.`,
  },
};

/** Keep prompts tight and cheap — cap the JSON we serialise into a message. */
const MAX_CONTEXT_CHARS = 8000;

function contextJson(context: Record<string, unknown>): string {
  const json = JSON.stringify(context ?? {});
  return json.length > MAX_CONTEXT_CHARS ? `${json.slice(0, MAX_CONTEXT_CHARS)}…` : json;
}

function formatNote(markdown: boolean): string {
  return markdown
    ? `\n\nFORMAT: You may use light markdown — **bold** for emphasis and "- " bullet lines. No headings or tables.`
    : `\n\nFORMAT: Plain prose only. No markdown, headings, or bullet lists.`;
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

// ── Natural-language run parsing (Smart logging) — returns strict JSON ───────
const PARSE_RUN_SYSTEM = `You extract a single running-log entry from the athlete's free-text message. Respond with ONLY a JSON object — no prose, no code fences.

Fields (all required, use null when unknown):
- "distance": number in the athlete's preferred unit given in the context (e.g. if unit is "miles" and they say "8k", convert to miles), or null.
- "durationSeconds": integer total seconds, or null.
- "date": "YYYY-MM-DD". Resolve relative words ("today", "yesterday", "this morning") against context.today. Default to context.today if unspecified.
- "rpe": integer 1–10 or null. Only infer from clear effort words ("easy" ≈ 3, "steady" ≈ 5, "hard" ≈ 8), otherwise null.
- "notes": a short cleaned-up note string, or null.

If the message clearly isn't about a run, set distance and durationSeconds to null.`;

export async function runCoach({ feature, context }: RunCoachInput): Promise<string> {
  const anthropic = getClient();

  if (feature === "parse_run") {
    const res = await anthropic.messages.create({
      model: COACH_MODEL,
      max_tokens: 400,
      system: PARSE_RUN_SYSTEM,
      messages: [{ role: "user", content: `Context:\n${contextJson(context)}` }],
    });
    return extractText(res);
  }

  const spec = FEATURES[feature];
  const content = `${spec.instruction}${formatNote(spec.markdown)}

Context:
${contextJson(context)}`;

  const res = await anthropic.messages.create({
    model: COACH_MODEL,
    max_tokens: spec.maxTokens,
    system: COACH_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });
  return extractText(res);
}

/**
 * Conversational chat — returns a streaming message so the route can forward
 * token deltas to the browser. Grounds every turn in the athlete's context and
 * sends only the last few turns to keep tokens low.
 */
export function streamChat(input: {
  context: Record<string, unknown>;
  messages: CoachMessage[];
}): ReturnType<Anthropic["messages"]["stream"]> {
  const system = `${COACH_SYSTEM_PROMPT}${formatNote(true)}

You are in a live chat. Answer the athlete's question directly and conversationally; a few sentences is usually plenty. It's fine to ask a brief clarifying question when you genuinely need one.

ATHLETE CONTEXT (JSON) — ground every answer in this and nothing else:
${contextJson(input.context)}`;

  const turns = input.messages
    .filter((m) => m.content.trim().length > 0)
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (turns.length === 0 || turns[0].role !== "user") {
    throw new AppError(400, "COACH_BAD_CHAT", "A chat request needs at least one user message.");
  }

  return getClient().messages.stream({
    model: COACH_MODEL,
    max_tokens: 700,
    system,
    messages: turns,
  });
}
