import type { Unit } from "@/api/types";
import { useDisplaySettings } from "@/context/settings";
import { formatPaceOrSpeed } from "@/lib/units";
import { cn } from "@/lib/utils";

interface PaceTextProps {
  /** API pace — seconds per km. */
  secPerKm: number;
  unit: Unit;
  className?: string;
}

/**
 * Formats an API pace (sec/km) per the user's display unit — as m:ss pace by
 * default, or as speed (mph / km/h) when the Settings → Display toggle is on.
 */
export function PaceText({ secPerKm, unit, className }: PaceTextProps) {
  const { showSpeed } = useDisplaySettings();
  return (
    <span className={cn("tabular-nums", className)}>
      {formatPaceOrSpeed(secPerKm, unit, showSpeed)}
    </span>
  );
}
