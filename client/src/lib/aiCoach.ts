/**
 * AI Coach — SCAFFOLD ONLY (not wired to a real model yet).
 *
 * `getCoachAdvice(context)` is the single seam where a real LLM call will be
 * dropped in later. Today it returns deterministic, phase-aware mock advice so
 * the UI surface (CoachCard on the dashboard) and interaction pattern exist.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TODO(ai-coach): replace the mock below with a real model call. Planned shape:
 *
 *   const res = await fetch("/api/coach", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify(context),          // server builds the prompt from
 *   });                                        // plan + recent runs + adherence
 *   return (await res.json()) as CoachAdvice;  // and calls the Claude API
 *                                              // (e.g. model "claude-sonnet-5")
 *
 * Keep the CoachContext → CoachAdvice interface stable so the UI needs no
 * changes when the real backend lands.
 * ────────────────────────────────────────────────────────────────────────────
 */

import type { Phase } from "@/api/types";

export interface CoachContext {
  phase: Phase;
  daysToRace: number;
  adherencePercent: number;
  taperActive: boolean;
  /** Pace of the most recent logged run, sec/km — null if nothing logged yet. */
  lastRunPaceSecPerKm: number | null;
  /** Which mock tip to show; the UI cycles this for a "new tip" interaction. */
  tipIndex?: number;
}

export interface CoachAdvice {
  headline: string;
  message: string;
  tips: string[];
}

const PHASE_ADVICE: Record<Phase, CoachAdvice> = {
  base: {
    headline: "Base phase — build the engine",
    message:
      "Right now the only goal is consistent, easy volume. Speed comes later; durability comes first.",
    tips: [
      "Keep easy runs truly easy — you should be able to hold a conversation.",
      "Don't chase pace this early; chase frequency and sleep.",
      "Add 4×20 s relaxed strides after one easy run a week to keep the legs snappy.",
    ],
  },
  build: {
    headline: "Build phase — sharpen gradually",
    message:
      "Volume and intensity are both climbing. The quality sessions matter most — protect them by keeping everything else gentle.",
    tips: [
      "Fuel before tempo days; they set your half-marathon rhythm.",
      "A cutback week is planned on purpose — don't 'make up' the missing miles.",
      "If your legs feel dead two days in a row, swap an easy run for full rest.",
    ],
  },
  peak: {
    headline: "Peak phase — biggest weeks, biggest payoffs",
    message:
      "You're at the top of the mountain of work. Hold steady, practice race-day fueling on the long runs, and trust the plan.",
    tips: [
      "Rehearse race-morning routine (breakfast, kit, warm-up) on your overreach long run.",
      "Lock in your goal pace now and practice its feel during tempo segments.",
      "Recovery is training: prioritize sleep during these two biggest weeks.",
    ],
  },
  taper: {
    headline: "Taper — trust the training",
    message:
      "Volume drops so you arrive fresh. Feeling twitchy and over-energized is normal — that's the fitness surfacing.",
    tips: [
      "Keep the shakeouts genuinely short and easy; save every match for race day.",
      "Plan your pacing: even or slightly negative splits beat a fast first mile.",
      "Nothing new on race day — shoes, gels, and kit should all be proven.",
    ],
  },
};

export async function getCoachAdvice(context: CoachContext): Promise<CoachAdvice> {
  // TODO(ai-coach): real LLM call goes here (see module docs above).
  const base = PHASE_ADVICE[context.phase];

  // Light context-awareness so the mock feels real enough to design against.
  let message = base.message;
  if (context.taperActive && context.daysToRace <= 7) {
    message = `${context.daysToRace} days out. ${message}`;
  } else if (context.adherencePercent >= 85) {
    message = `${message} Your ${context.adherencePercent}% adherence is excellent — keep it rolling.`;
  } else if (context.adherencePercent > 0 && context.adherencePercent < 60) {
    message = `${message} Adherence is at ${context.adherencePercent}% — consistency beats any single big week.`;
  }

  const tipIndex = (context.tipIndex ?? 0) % base.tips.length;
  return {
    headline: base.headline,
    message,
    tips: [base.tips[tipIndex]],
  };
}
