import { format, parseISO } from "date-fns";
import { Flag } from "lucide-react";

import type { Phase } from "@/api/types";
import { PhaseBadge } from "@/components/WorkoutTypeBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface RaceCountdownProps {
  raceDate: string;
  daysToRace: number;
  /** 1-based current week, clamped to the plan. */
  currentWeek: number | null;
  totalWeeks: number | null;
  phase: Phase | null;
  className?: string;
}

export function RaceCountdown({
  raceDate,
  daysToRace,
  currentWeek,
  totalWeeks,
  phase,
  className,
}: RaceCountdownProps) {
  const days = Math.max(0, daysToRace);
  const raceDay = daysToRace <= 0;
  return (
    <Card className={className}>
      <CardContent className="flex h-full flex-col justify-between gap-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Race countdown
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              {raceDay ? (
                <span className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
                  Race day
                </span>
              ) : (
                <>
                  <span className="text-5xl font-bold tracking-tight text-primary tabular-nums sm:text-6xl">
                    {days}
                  </span>
                  <span className="text-lg font-medium text-muted-foreground">
                    {days === 1 ? "day" : "days"} to go
                  </span>
                </>
              )}
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {format(parseISO(raceDate), "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Flag className="size-5" aria-hidden="true" />
          </span>
        </div>

        {currentWeek !== null && totalWeeks !== null && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium tabular-nums">
                Week {currentWeek} of {totalWeeks}
              </span>
              {phase && <PhaseBadge phase={phase} />}
            </div>
            <Progress
              value={Math.min(100, (currentWeek / totalWeeks) * 100)}
              aria-label={`Training plan progress: week ${currentWeek} of ${totalWeeks}`}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
