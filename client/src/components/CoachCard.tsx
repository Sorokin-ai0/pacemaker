import { RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { planApi } from "@/api";
import type { Phase, StatsDTO } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCoachAdvice, type CoachAdvice } from "@/lib/aiCoach";

/**
 * Dashboard surface for the AI coach. Currently renders mock, phase-aware
 * advice from the aiCoach scaffold — see src/lib/aiCoach.ts for where the real
 * model call will be wired in.
 */
export function CoachCard({ stats }: { stats: StatsDTO }) {
  const [advice, setAdvice] = useState<CoachAdvice | null>(null);
  const [phase, setPhase] = useState<Phase>("base");
  const [tipIndex, setTipIndex] = useState(0);

  // Determine today's phase from the plan (local fetch — instant).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const plan = await planApi.get();
        if (cancelled || plan === null) return;
        const today = new Date().toISOString().slice(0, 10);
        const current =
          plan.workouts.find((w) => w.date >= today) ?? plan.workouts[plan.workouts.length - 1];
        if (current) setPhase(current.phase);
      } catch {
        // Non-fatal — the coach just falls back to base-phase advice.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await getCoachAdvice({
        phase,
        daysToRace: stats.countdown.daysToRace,
        adherencePercent: stats.adherence.percent,
        taperActive: stats.taper.active,
        lastRunPaceSecPerKm:
          stats.paceTrend.length > 0
            ? stats.paceTrend[stats.paceTrend.length - 1].paceSecPerKm
            : null,
        tipIndex,
      });
      if (!cancelled) setAdvice(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, stats, tipIndex]);

  if (!advice) return null;

  return (
    <Card className="border-primary/25 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium">
          <span className="flex items-center gap-2 text-primary">
            <Sparkles className="size-4" aria-hidden="true" />
            Coach
            <span className="rounded-full border border-primary/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary/80">
              Preview
            </span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
            onClick={() => setTipIndex((i) => i + 1)}
          >
            <RefreshCw className="size-3.5" aria-hidden="true" /> New tip
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="font-medium">{advice.headline}</p>
        <p className="text-sm text-muted-foreground">{advice.message}</p>
        {advice.tips.map((tip) => (
          <p
            key={tip}
            className="rounded-md border border-primary/20 bg-background/60 px-3 py-2 text-sm"
          >
            💡 {tip}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}
