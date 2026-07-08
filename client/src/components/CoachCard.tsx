import { ArrowRight, CalendarCheck2, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { planApi, runsApi } from "@/api";
import type { PlanDTO, ProfileDTO, StatsDTO, UserDTO } from "@/api/types";
import { CoachText } from "@/components/CoachText";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth";
import { useApi } from "@/hooks/use-api";
import {
  coachDailyBrief,
  coachPlanChange,
  coachWeeklyCheckIn,
  dismissPlanReasoning,
  type CoachData,
  type CoachResult,
} from "@/lib/aiCoach";

/**
 * Dashboard surface for the AI coach: a grounded daily brief (with any fatigue
 * caution / milestone / taper tone woven in server-side), an explanation when
 * the plan was just regenerated, a one-tap weekly check-in, and a link into the
 * full Coach chat. All calls route through `src/lib/aiCoach.ts` → `/api/coach`.
 */
export function CoachCard({ stats }: { stats: StatsDTO }) {
  const { user, profile } = useAuth();
  const plan = useApi(() => planApi.get());
  const runs = useApi(() => runsApi.list());

  const ready = !plan.loading && !runs.loading;
  const data: CoachData | null = ready
    ? { plan: plan.data, stats, runs: runs.data ?? [], user, profile }
    : null;

  const [brief, setBrief] = useState<CoachResult | null>(null);
  const [briefLoading, setBriefLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    setBriefLoading(true);
    coachDailyBrief(data).then((res) => {
      if (!cancelled) {
        setBrief(res);
        setBriefLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, plan.data, runs.data, stats, reloadTick]);

  const configured = brief === null ? null : brief.configured;

  if (configured === false) {
    return (
      <Card className="border-primary/25 bg-primary/5">
        <CoachHeader />
        <CardContent>
          <p className="text-sm text-muted-foreground">
            AI coach isn't configured. Add an{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">ANTHROPIC_API_KEY</code> on the
            server to unlock your daily brief, run recaps, weekly check-ins, and coach chat. The rest
            of the app works normally without it.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/25 bg-primary/5">
      <CoachHeader
        onRefresh={() => setReloadTick((t) => t + 1)}
        refreshing={briefLoading}
        showRefresh={configured === true}
      />
      <CardContent className="space-y-3">
        {briefLoading && brief === null ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ) : brief?.text ? (
          <CoachText text={brief.text} className="text-sm leading-relaxed" />
        ) : brief?.error ? (
          <p className="text-sm text-muted-foreground">
            Couldn't reach the coach right now.{" "}
            <button
              type="button"
              onClick={() => setReloadTick((t) => t + 1)}
              className="text-primary underline-offset-4 hover:underline"
            >
              Try again
            </button>
          </p>
        ) : null}

        {plan.data && <PlanChangeNote plan={plan.data} profile={profile} user={user} />}

        {data && configured === true && <CoachActions data={data} />}
      </CardContent>
    </Card>
  );
}

function CoachHeader({
  onRefresh,
  refreshing,
  showRefresh,
}: {
  onRefresh?: () => void;
  refreshing?: boolean;
  showRefresh?: boolean;
}) {
  return (
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium">
        <span className="flex items-center gap-2 text-primary">
          <Sparkles className="size-4" aria-hidden="true" />
          Coach
          <span className="rounded-full border border-primary/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary/80">
            AI
          </span>
        </span>
        {showRefresh && onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />{" "}
            Refresh
          </Button>
        )}
      </CardTitle>
    </CardHeader>
  );
}

/** Feature 4 — explains why the plan changed after a regeneration. */
function PlanChangeNote({
  plan,
  profile,
  user,
}: {
  plan: PlanDTO;
  profile: ProfileDTO | null;
  user: UserDTO | null;
}) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    coachPlanChange({ plan, profile, user }).then((res) => {
      if (!cancelled && res.show && res.text) setText(res.text);
    });
    return () => {
      cancelled = true;
    };
  }, [plan, profile, user]);

  if (!text) return null;

  return (
    <div className="relative rounded-md border border-primary/20 bg-background/60 px-3 py-2 pr-8 text-sm">
      <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-primary/80">
        Your plan changed
      </p>
      <CoachText text={text} className="leading-relaxed" />
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          dismissPlanReasoning();
          setText(null);
        }}
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function CoachActions({ data }: { data: CoachData }) {
  const [weekly, setWeekly] = useState<CoachResult | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  const loadWeekly = () => {
    if (weekly?.text || weeklyLoading) return;
    setWeeklyLoading(true);
    coachWeeklyCheckIn(data).then((res) => {
      setWeekly(res);
      setWeeklyLoading(false);
    });
  };

  return (
    <div className="space-y-3 border-t border-primary/15 pt-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={loadWeekly}
          disabled={weeklyLoading}
        >
          {weeklyLoading ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <CalendarCheck2 className="size-3.5" aria-hidden="true" />
          )}
          Weekly check-in
        </Button>
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Link to="/coach">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Ask the coach
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      {weekly?.text && (
        <div className="rounded-md border border-primary/20 bg-background/60 px-3 py-2 text-sm">
          <CoachText text={weekly.text} className="leading-relaxed" />
        </div>
      )}
      {weekly && !weekly.text && (
        <p className="text-sm text-muted-foreground">Couldn't load your check-in right now.</p>
      )}
    </div>
  );
}
