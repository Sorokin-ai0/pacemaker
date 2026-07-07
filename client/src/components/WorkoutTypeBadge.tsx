import type { Phase, WorkoutType } from "@/api/types";
import { PHASE_META, WORKOUT_META } from "@/lib/workouts";
import { cn } from "@/lib/utils";

export function WorkoutTypeBadge({ type, className }: { type: WorkoutType; className?: string }) {
  const meta = WORKOUT_META[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        meta.badgeClass,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dotClass)} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function PhaseBadge({ phase, className }: { phase: Phase; className?: string }) {
  const meta = PHASE_META[phase];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        meta.badgeClass,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
