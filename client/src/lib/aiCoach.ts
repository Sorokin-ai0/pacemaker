/**
 * AI Coach — client service.
 *
 * This module is the single seam between the app and the coach backend. It
 * gathers the user's REAL data (plan phase, race countdown, recent runs,
 * adherence, RPE trends), packs it into a tight, structured JSON context, and
 * POSTs it to `/api/coach`. The server owns the Anthropic API key and the
 * prompt; nothing here ever touches the model directly.
 *
 * Everything is grounded in data the app already has, so the model can't invent
 * stats. Small results (daily brief, weekly check-in, plan reasoning) are cached
 * in localStorage via the storage adapter to control token usage, and the coach
 * chat history is persisted the same way.
 */

import { differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";

import { apiFetch, toApiError } from "@/api/http";
import type {
  LoggedRunDTO,
  Phase,
  PlanDTO,
  PlannedWorkoutDTO,
  ProfileDTO,
  StatsDTO,
  Unit,
  UserDTO,
} from "@/api/types";
import { storage, storageKeys } from "@/local/storageAdapter";
import {
  formatDistance,
  formatDuration,
  formatPace,
  kmToUnit,
  unitLabel,
  unitToKm,
} from "@/lib/units";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type CoachFeature =
  | "daily_brief"
  | "post_run_recap"
  | "weekly_checkin"
  | "plan_reasoning"
  | "workout_explainer"
  | "race_strategy"
  | "plan_adjustment"
  | "insights"
  | "parse_run";

export interface CoachResult {
  /** false → no ANTHROPIC_API_KEY on the server; UI shows a "not configured" state. */
  configured: boolean;
  text: string | null;
  /** Present when the request reached the server but failed (network / model error). */
  error?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

/** Everything the coach can be grounded in — components already hold all of it. */
export interface CoachData {
  plan: PlanDTO | null;
  stats: StatsDTO;
  runs: LoggedRunDTO[];
  user: UserDTO | null;
  profile: ProfileDTO | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Transport
// ────────────────────────────────────────────────────────────────────────────

async function callCoach(
  feature: CoachFeature,
  context: Record<string, unknown>,
  messages?: { role: "user" | "assistant"; content: string }[],
): Promise<CoachResult> {
  try {
    const res = await apiFetch<{ configured: boolean; text?: string }>("/api/coach", {
      method: "POST",
      body: { feature, context, messages },
      // A coach hiccup should never yank the user to /login — the dashboard's
      // own data calls handle a genuinely expired session.
      on401: "ignore",
    });
    if (!res.configured) return { configured: false, text: null };
    return { configured: true, text: res.text ?? null };
  } catch (err) {
    return { configured: true, text: null, error: toApiError(err).message };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Data shaping (all values pre-formatted in the user's units, so the model
// never does unit math and can't fabricate numbers)
// ────────────────────────────────────────────────────────────────────────────

const todayISO = (): string => format(new Date(), "yyyy-MM-dd");

export function deriveCurrent(plan: PlanDTO): {
  phase: Phase;
  week: number | null;
  todayWorkout: PlannedWorkoutDTO | null;
} {
  const today = new Date();
  let nearest: PlannedWorkoutDTO | null = null;
  let bestDiff = Infinity;
  for (const w of plan.workouts) {
    const diff = Math.abs(differenceInCalendarDays(parseISO(w.date), today));
    if (diff < bestDiff) {
      bestDiff = diff;
      nearest = w;
    }
  }
  const todayStr = todayISO();
  return {
    phase: nearest?.phase ?? "base",
    week: nearest ? Math.min(nearest.weekIndex + 1, plan.totalWeeks) : null,
    todayWorkout: plan.workouts.find((w) => w.date === todayStr) ?? null,
  };
}

function summarizeWorkout(w: PlannedWorkoutDTO, unit: Unit): Record<string, unknown> {
  return {
    type: w.type,
    phase: w.phase,
    targetDistance: w.targetDistanceKm !== null ? formatDistance(w.targetDistanceKm, unit) : null,
    targetPace: w.targetPaceZone,
    notes: w.notes,
  };
}

function summarizeRun(
  run: LoggedRunDTO,
  plan: PlanDTO | null,
  unit: Unit,
): Record<string, unknown> {
  const planned = run.plannedWorkoutId
    ? (plan?.workouts.find((w) => w.id === run.plannedWorkoutId) ?? null)
    : null;
  return {
    date: run.date,
    distance: formatDistance(run.distanceKm, unit),
    duration: formatDuration(run.durationSeconds),
    pace: formatPace(run.paceSecPerKm, unit),
    rpe: run.rpe,
    plannedWorkout: planned ? summarizeWorkout(planned, unit) : null,
  };
}

function sortedByDate(runs: LoggedRunDTO[]): LoggedRunDTO[] {
  return [...runs].sort((a, b) => a.date.localeCompare(b.date));
}

function weekStart(dateStr: string): string {
  return format(startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function consecutiveRunDayStreak(runs: LoggedRunDTO[]): number {
  const days = Array.from(new Set(runs.map((r) => r.date))).sort();
  if (days.length === 0) return 0;
  let streak = 1;
  for (let i = days.length - 1; i > 0; i--) {
    if (differenceInCalendarDays(parseISO(days[i]), parseISO(days[i - 1])) === 1) streak++;
    else break;
  }
  return streak;
}

// ── Fatigue / overreach signal (feature 7) — soft "consider" flags only ──────
function detectFatigue(
  runs: LoggedRunDTO[],
  plan: PlanDTO | null,
): Record<string, unknown> | null {
  const sorted = sortedByDate(runs);
  const withRpe = sorted.filter((r) => r.rpe !== null).slice(-3);
  let recentRpeAvg: number | null = null;
  let highEffort = false;
  if (withRpe.length >= 2) {
    const avg = withRpe.reduce((sum, r) => sum + (r.rpe ?? 0), 0) / withRpe.length;
    recentRpeAvg = Math.round(avg * 10) / 10;
    highEffort = recentRpeAvg >= 7.5;
  }

  // Rest days (from the plan) in the last 10 days on which a run was logged.
  const todayStr = todayISO();
  const cutoff = format(
    new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    "yyyy-MM-dd",
  );
  const runDates = new Set(sorted.map((r) => r.date));
  let restDaysSkipped = 0;
  if (plan) {
    for (const w of plan.workouts) {
      if (w.type === "rest" && w.date >= cutoff && w.date <= todayStr && runDates.has(w.date)) {
        restDaysSkipped++;
      }
    }
  }

  const streak = consecutiveRunDayStreak(sorted);
  const flag = highEffort || restDaysSkipped >= 2 || streak >= 6;
  if (!flag) return null;

  return {
    recentRpeAvg,
    highEffort,
    restDaysSkipped,
    consecutiveRunDays: streak,
  };
}

// ── Milestone detection (feature 8) — at most one, most impressive first ─────
function detectMilestone(
  runs: LoggedRunDTO[],
  unit: Unit,
): { type: string; detail: string } | null {
  if (runs.length === 0) return null;
  const sorted = sortedByDate(runs);
  const latest = sorted[sorted.length - 1];
  // Only celebrate around a fresh run.
  if (differenceInCalendarDays(new Date(), parseISO(latest.date)) > 2) return null;

  const prevMax = Math.max(0, ...sorted.slice(0, -1).map((r) => r.distanceKm));
  if (sorted.length >= 2 && latest.distanceKm > prevMax + 1e-9) {
    return { type: "longest_run", detail: `new longest run of ${formatDistance(latest.distanceKm, unit)}` };
  }

  const weekTotals = new Map<string, number>();
  for (const r of sorted) {
    const k = weekStart(r.date);
    weekTotals.set(k, (weekTotals.get(k) ?? 0) + r.distanceKm);
  }
  const latestWeek = weekStart(latest.date);
  const orderedWeeks = [...weekTotals.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const firstDoubleDigit = orderedWeeks.find(([, km]) => kmToUnit(km, unit) >= 10);
  if (firstDoubleDigit && firstDoubleDigit[0] === latestWeek) {
    return {
      type: "double_digit_week",
      detail: `first double-digit ${unitLabel(unit)} week — ${formatDistance(weekTotals.get(latestWeek) ?? 0, unit)} so far`,
    };
  }

  const streak = consecutiveRunDayStreak(sorted);
  if (streak >= 3) return { type: "streak", detail: `${streak}-day running streak` };

  if (sorted.length >= 5 && sorted.length % 5 === 0) {
    return { type: "consistency", detail: `${sorted.length} runs logged` };
  }
  return null;
}

// ── Base grounding context shared by most features ───────────────────────────
function baseContext(data: CoachData): Record<string, unknown> {
  const unit: Unit = data.user?.unitPreference ?? "mi";
  const current = data.plan ? deriveCurrent(data.plan) : null;
  const hasAdherence = data.stats.adherence.plannedToDate > 0;
  return {
    today: todayISO(),
    unitSystem: unit === "mi" ? "miles" : "kilometers",
    experienceLevel: data.profile?.experienceLevel ?? null,
    phase: current?.phase ?? "base",
    currentWeek: current?.week ?? null,
    totalWeeks: data.plan?.totalWeeks ?? null,
    daysToRace: data.stats.countdown.daysToRace,
    raceDate: data.stats.countdown.raceDate,
    taper: data.stats.taper.active,
    adherencePercent: hasAdherence ? Math.round(data.stats.adherence.percent) : null,
    adherenceDetail: hasAdherence
      ? `${data.stats.adherence.completed} of ${data.stats.adherence.plannedToDate} workouts completed`
      : "no workouts due yet",
  };
}

function recentRunSummaries(
  runs: LoggedRunDTO[],
  plan: PlanDTO | null,
  unit: Unit,
  count: number,
): Record<string, unknown>[] {
  return sortedByDate(runs)
    .slice(-count)
    .reverse()
    .map((r) => summarizeRun(r, plan, unit));
}

// ────────────────────────────────────────────────────────────────────────────
// Feature 1 — Daily brief (weaves in taper tone, fatigue caution, milestone)
// ────────────────────────────────────────────────────────────────────────────

export async function coachDailyBrief(data: CoachData): Promise<CoachResult> {
  const unit: Unit = data.user?.unitPreference ?? "mi";
  const current = data.plan ? deriveCurrent(data.plan) : null;
  const upcoming =
    current?.todayWorkout ??
    data.plan?.workouts.find((w) => w.date >= todayISO() && w.type !== "rest") ??
    null;

  const fatigue = detectFatigue(data.runs, data.plan);
  const milestone = detectMilestone(data.runs, unit);

  const context: Record<string, unknown> = {
    ...baseContext(data),
    todayWorkout: current?.todayWorkout ? summarizeWorkout(current.todayWorkout, unit) : null,
    nextWorkout: !current?.todayWorkout && upcoming ? summarizeWorkout(upcoming, unit) : null,
    recentRuns: recentRunSummaries(data.runs, data.plan, unit, 2),
    ...(fatigue ? { fatigue } : {}),
    ...(milestone ? { milestone } : {}),
  };

  const signature = JSON.stringify({
    d: context.today,
    p: context.phase,
    a: context.adherencePercent,
    w: current?.todayWorkout?.id ?? (upcoming ? `next:${upcoming.id}` : null),
    f: fatigue ? 1 : 0,
    m: milestone?.type ?? null,
  });

  const cached = storage.getJSON<{ signature: string; text: string }>(storageKeys.coachDailyBrief);
  if (cached && cached.signature === signature && cached.text) {
    return { configured: true, text: cached.text };
  }

  const result = await callCoach("daily_brief", context);
  if (result.configured && result.text) {
    storage.setJSON(storageKeys.coachDailyBrief, { signature, text: result.text });
  }
  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Feature 2 — Post-run recap
// ────────────────────────────────────────────────────────────────────────────

export async function coachPostRunRecap(input: {
  run: LoggedRunDTO;
  plan: PlanDTO | null;
  runs: LoggedRunDTO[];
  user: UserDTO | null;
}): Promise<CoachResult> {
  const unit: Unit = input.user?.unitPreference ?? "mi";
  const current = input.plan ? deriveCurrent(input.plan) : null;
  // Make sure the just-logged run is part of the milestone check.
  const allRuns = input.runs.some((r) => r.id === input.run.id)
    ? input.runs
    : [...input.runs, input.run];
  const milestone = detectMilestone(allRuns, unit);

  const context: Record<string, unknown> = {
    unitSystem: unit === "mi" ? "miles" : "kilometers",
    phase: current?.phase ?? "base",
    daysToRace: null,
    loggedRun: summarizeRun(input.run, input.plan, unit),
    ...(milestone ? { milestone } : {}),
  };

  return callCoach("post_run_recap", context);
}

// ────────────────────────────────────────────────────────────────────────────
// Feature 3 — Weekly check-in
// ────────────────────────────────────────────────────────────────────────────

export async function coachWeeklyCheckIn(data: CoachData): Promise<CoachResult> {
  const unit: Unit = data.user?.unitPreference ?? "mi";
  const recentWeeks = data.stats.weeklyMileage.slice(-3).map((w) => ({
    weekStart: w.weekStart,
    planned: formatDistance(w.plannedKm, unit),
    logged: formatDistance(w.loggedKm, unit),
  }));
  const fatigue = detectFatigue(data.runs, data.plan);

  const context: Record<string, unknown> = {
    ...baseContext(data),
    recentWeeks,
    recentRuns: recentRunSummaries(data.runs, data.plan, unit, 3),
    ...(fatigue ? { fatigue } : {}),
  };

  const isoWeek = weekStart(todayISO());
  const signature = JSON.stringify({
    w: isoWeek,
    a: context.adherencePercent,
    weeks: recentWeeks,
    f: fatigue ? 1 : 0,
  });

  const cached = storage.getJSON<{ signature: string; text: string }>(storageKeys.coachWeekly);
  if (cached && cached.signature === signature && cached.text) {
    return { configured: true, text: cached.text };
  }

  const result = await callCoach("weekly_checkin", context);
  if (result.configured && result.text) {
    storage.setJSON(storageKeys.coachWeekly, { signature, text: result.text });
  }
  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Feature 4 — Adaptive plan reasoning (detected via a plan snapshot diff, since
// the regenerate action itself lives in Settings and isn't ours to touch)
// ────────────────────────────────────────────────────────────────────────────

interface PlanSnapshot {
  signature: string;
  summary: Record<string, unknown>;
  reasoning?: string;
  dismissed?: boolean;
}

function planSignature(plan: PlanDTO): string {
  return `${plan.id}::${plan.generatedAt}`;
}

function summarizePlan(
  plan: PlanDTO,
  profile: ProfileDTO | null,
  unit: Unit,
): Record<string, unknown> {
  const perWeekKm = new Map<number, number>();
  const phaseWeeks: Record<string, Set<number>> = {};
  for (const w of plan.workouts) {
    if (w.targetDistanceKm !== null) {
      perWeekKm.set(w.weekIndex, (perWeekKm.get(w.weekIndex) ?? 0) + w.targetDistanceKm);
    }
    (phaseWeeks[w.phase] ??= new Set()).add(w.weekIndex);
  }
  const peakKm = Math.max(0, ...perWeekKm.values());
  return {
    totalWeeks: plan.totalWeeks,
    raceDate: plan.raceDate,
    experienceLevel: profile?.experienceLevel ?? null,
    startingWeeklyVolume:
      profile?.currentWeeklyMileageKm != null
        ? formatDistance(profile.currentWeeklyMileageKm, unit)
        : null,
    restDaysPerWeek: profile?.restDaysPerWeek ?? 2,
    peakWeeklyDistance: formatDistance(peakKm, unit),
    weeksPerPhase: Object.fromEntries(
      Object.entries(phaseWeeks).map(([phase, weeks]) => [phase, weeks.size]),
    ),
  };
}

export async function coachPlanChange(input: {
  plan: PlanDTO;
  profile: ProfileDTO | null;
  user: UserDTO | null;
}): Promise<CoachResult & { show: boolean }> {
  const unit: Unit = input.user?.unitPreference ?? "mi";
  const signature = planSignature(input.plan);
  const summary = summarizePlan(input.plan, input.profile, unit);
  const prev = storage.getJSON<PlanSnapshot>(storageKeys.coachPlanSnapshot);

  // First time we've seen any plan → record a baseline, nothing to explain yet.
  if (!prev) {
    storage.setJSON(storageKeys.coachPlanSnapshot, { signature, summary });
    return { configured: true, text: null, show: false };
  }

  // Same plan as last time → surface the cached reasoning unless dismissed.
  if (prev.signature === signature) {
    if (prev.reasoning && !prev.dismissed) {
      return { configured: true, text: prev.reasoning, show: true };
    }
    return { configured: true, text: null, show: false };
  }

  // The plan changed — explain it from the real before/after data.
  const result = await callCoach("plan_reasoning", { before: prev.summary, after: summary });
  if (result.configured && result.text) {
    storage.setJSON(storageKeys.coachPlanSnapshot, {
      signature,
      summary,
      reasoning: result.text,
      dismissed: false,
    });
    return { configured: true, text: result.text, show: true };
  }
  if (!result.configured) {
    // No key: rebaseline quietly so we don't keep trying.
    storage.setJSON(storageKeys.coachPlanSnapshot, { signature, summary });
    return { configured: false, text: null, show: false };
  }
  // Configured but errored — leave the old snapshot so the next load can retry.
  return { configured: true, text: null, error: result.error, show: false };
}

export function dismissPlanReasoning(): void {
  const prev = storage.getJSON<PlanSnapshot>(storageKeys.coachPlanSnapshot);
  if (prev) storage.setJSON(storageKeys.coachPlanSnapshot, { ...prev, dismissed: true });
}

// ────────────────────────────────────────────────────────────────────────────
// Feature 5 — Conversational coach chat (history in localStorage)
// ────────────────────────────────────────────────────────────────────────────

export function loadChatHistory(): ChatMessage[] {
  return storage.getJSON<ChatMessage[]>(storageKeys.coachChat) ?? [];
}

export function saveChatHistory(messages: ChatMessage[]): void {
  storage.setJSON(storageKeys.coachChat, messages.slice(-50));
}

export function clearChatHistory(): void {
  storage.remove(storageKeys.coachChat);
}

function buildChatContext(data: CoachData): Record<string, unknown> {
  const unit: Unit = data.user?.unitPreference ?? "mi";
  const current = data.plan ? deriveCurrent(data.plan) : null;
  const fatigue = detectFatigue(data.runs, data.plan);
  return {
    ...baseContext(data),
    todayWorkout: current?.todayWorkout ? summarizeWorkout(current.todayWorkout, unit) : null,
    projectedFinish:
      data.stats.projection.projectedSeconds !== null
        ? formatDuration(data.stats.projection.projectedSeconds)
        : null,
    recentRuns: recentRunSummaries(data.runs, data.plan, unit, 3),
    ...(fatigue ? { fatigue } : {}),
  };
}

/**
 * Streaming coach chat. Streams token deltas to `onDelta` as they arrive and
 * resolves with the full reply. The full thread lives in localStorage; only the
 * last few turns are sent (the server trims again).
 */
export async function streamCoachChat(input: {
  history: ChatMessage[];
  data: CoachData;
  onDelta: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<CoachResult> {
  const context = buildChatContext(input.data);
  const messages = input.history.slice(-10).map((m) => ({ role: m.role, content: m.content }));

  let res: Response;
  try {
    res = await fetch("/api/coach/chat", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context, messages }),
      signal: input.signal,
    });
  } catch {
    return { configured: true, text: null, error: "Could not reach the coach." };
  }

  if (res.status === 503) return { configured: false, text: null };
  if (!res.ok || !res.body) {
    return { configured: true, text: null, error: `Coach request failed (${res.status}).` };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) {
        full += chunk;
        input.onDelta(chunk);
      }
    }
  } catch {
    if (full.length === 0) return { configured: true, text: null, error: "The coach was interrupted." };
  }
  return { configured: true, text: full.trim() || null };
}

// ────────────────────────────────────────────────────────────────────────────
// Contextual explainers + planning/strategy features
// ────────────────────────────────────────────────────────────────────────────

/** Config probe so the UI can show a "not configured" state without a full call. */
let statusCache: boolean | null = null;
export async function getCoachStatus(): Promise<boolean> {
  if (statusCache !== null) return statusCache;
  try {
    const res = await apiFetch<{ configured: boolean }>("/api/coach/status", { on401: "ignore" });
    statusCache = res.configured;
    return res.configured;
  } catch {
    return false;
  }
}

/** Contextual explainer — "Why this workout?" */
export function coachExplainWorkout(input: {
  workout: PlannedWorkoutDTO;
  unit: Unit;
  totalWeeks?: number | null;
}): Promise<CoachResult> {
  const context: Record<string, unknown> = {
    unitSystem: input.unit === "mi" ? "miles" : "kilometers",
    phase: input.workout.phase,
    week: input.workout.weekIndex + 1,
    totalWeeks: input.totalWeeks ?? null,
    workout: summarizeWorkout(input.workout, input.unit),
  };
  return callCoach("workout_explainer", context);
}

/** Race-day pacing strategy (grounded in the finish-time projection + countdown). */
export function coachRaceStrategy(data: CoachData): Promise<CoachResult> {
  const unit: Unit = data.user?.unitPreference ?? "mi";
  const context: Record<string, unknown> = {
    ...baseContext(data),
    raceDistance: "half marathon (21.1 km / 13.1 mi)",
    projectedFinish:
      data.stats.projection.projectedSeconds !== null
        ? formatDuration(data.stats.projection.projectedSeconds)
        : null,
    projectionBasis: data.stats.projection.basisRun
      ? {
          date: data.stats.projection.basisRun.date,
          distance: formatDistance(data.stats.projection.basisRun.distanceKm, unit),
          duration: formatDuration(data.stats.projection.basisRun.durationSeconds),
        }
      : null,
    recentRuns: recentRunSummaries(data.runs, data.plan, unit, 3),
  };
  return callCoach("race_strategy", context);
}

/** Plan-adjustment suggestions when the athlete has fallen behind (suggests only). */
export function coachPlanAdjustment(data: CoachData): Promise<CoachResult> {
  const unit: Unit = data.user?.unitPreference ?? "mi";
  const fatigue = detectFatigue(data.runs, data.plan);
  const context: Record<string, unknown> = {
    ...baseContext(data),
    recentWeeks: data.stats.weeklyMileage.slice(-3).map((w) => ({
      weekStart: w.weekStart,
      planned: formatDistance(w.plannedKm, unit),
      logged: formatDistance(w.loggedKm, unit),
    })),
    ...(fatigue ? { fatigue } : {}),
  };
  return callCoach("plan_adjustment", context);
}

/** Trend / fatigue insight callout. */
export function coachInsights(data: CoachData): Promise<CoachResult> {
  const unit: Unit = data.user?.unitPreference ?? "mi";
  const fatigue = detectFatigue(data.runs, data.plan);
  const paceTrend = data.stats.paceTrend.slice(-5).map((p) => ({
    date: p.date,
    pace: formatPace(p.paceSecPerKm, unit),
    distance: formatDistance(p.distanceKm, unit),
  }));
  const context: Record<string, unknown> = {
    ...baseContext(data),
    recentWeeks: data.stats.weeklyMileage.slice(-4).map((w) => ({
      weekStart: w.weekStart,
      planned: formatDistance(w.plannedKm, unit),
      logged: formatDistance(w.loggedKm, unit),
    })),
    paceTrend,
    ...(fatigue ? { fatigue } : {}),
  };
  return callCoach("insights", context);
}

// ────────────────────────────────────────────────────────────────────────────
// Smart logging — natural-language run parsing
// ────────────────────────────────────────────────────────────────────────────

export interface ParsedRunDraft {
  distanceKm: number | null;
  durationSeconds: number | null;
  date: string | null;
  rpe: number | null;
  notes: string | null;
}

/**
 * Parse a free-text sentence ("ran 8k in 45 min this morning, felt easy") into a
 * structured draft. Returns `null` on a not-configured/failed/unparseable
 * response. The model returns distance in the athlete's unit; we convert to km
 * here so the number math stays on our side.
 */
export async function parseRunText(input: {
  text: string;
  user: UserDTO | null;
}): Promise<{ configured: boolean; draft: ParsedRunDraft | null; error?: string }> {
  const unit: Unit = input.user?.unitPreference ?? "mi";
  const context = {
    today: todayISO(),
    unit: unit === "mi" ? "miles" : "kilometers",
    text: input.text.slice(0, 500),
  };
  const res = await callCoach("parse_run", context);
  if (!res.configured) return { configured: false, draft: null };
  if (!res.text) return { configured: true, draft: null, error: res.error ?? "No response." };

  try {
    const cleaned = res.text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const raw = JSON.parse(cleaned) as {
      distance?: number | null;
      durationSeconds?: number | null;
      date?: string | null;
      rpe?: number | null;
      notes?: string | null;
    };
    const distance = typeof raw.distance === "number" && raw.distance > 0 ? raw.distance : null;
    return {
      configured: true,
      draft: {
        distanceKm: distance !== null ? unitToKm(distance, unit) : null,
        durationSeconds:
          typeof raw.durationSeconds === "number" && raw.durationSeconds > 0
            ? Math.round(raw.durationSeconds)
            : null,
        date: typeof raw.date === "string" ? raw.date : null,
        rpe: typeof raw.rpe === "number" ? raw.rpe : null,
        notes: typeof raw.notes === "string" && raw.notes.trim() !== "" ? raw.notes.trim() : null,
      },
    };
  } catch {
    return { configured: true, draft: null, error: "Couldn't understand that — try rephrasing." };
  }
}
