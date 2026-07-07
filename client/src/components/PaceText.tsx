import type { Unit } from "@/api/types";
import { formatPace } from "@/lib/units";
import { cn } from "@/lib/utils";

interface PaceTextProps {
  /** API pace — seconds per km. */
  secPerKm: number;
  unit: Unit;
  className?: string;
}

/** Formats an API pace (sec/km) as m:ss per the user's display unit. */
export function PaceText({ secPerKm, unit, className }: PaceTextProps) {
  return <span className={cn("tabular-nums", className)}>{formatPace(secPerKm, unit)}</span>;
}
