import type { Phase, WorkoutType } from "@/api/types";

interface WorkoutMeta {
  label: string;
  /** Chip / badge classes — subtle tinted background + colored text, both themes. */
  badgeClass: string;
  /** Solid dot used in calendar chips and legends. */
  dotClass: string;
  /** One-line description shown in detail views. */
  blurb: string;
}

export const WORKOUT_META: Record<WorkoutType, WorkoutMeta> = {
  long: {
    label: "Long run",
    badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
    dotClass: "bg-sky-500",
    blurb: "The weekly cornerstone — time on feet at a steady, controlled effort.",
  },
  tempo: {
    label: "Tempo",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dotClass: "bg-amber-500",
    blurb: "Comfortably hard — builds your lactate threshold.",
  },
  speed: {
    label: "Speed",
    badgeClass: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
    dotClass: "bg-rose-500",
    blurb: "Short, fast repeats — sharpens turnover and economy.",
  },
  easy: {
    label: "Easy",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
    blurb: "Conversational pace — where the aerobic base is built.",
  },
  rest: {
    label: "Rest",
    badgeClass: "border-border bg-muted text-muted-foreground",
    dotClass: "bg-slate-400 dark:bg-slate-500",
    blurb: "Recovery counts as training too.",
  },
  race: {
    label: "Race",
    badgeClass: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
    dotClass: "bg-violet-500",
    blurb: "Race day — 13.1 miles. Trust the training.",
  },
};

interface PhaseMeta {
  label: string;
  badgeClass: string;
}

export const PHASE_META: Record<Phase, PhaseMeta> = {
  base: {
    label: "Base",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  build: {
    label: "Build",
    badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  },
  peak: {
    label: "Peak",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  taper: {
    label: "Taper",
    badgeClass: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  },
};

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
