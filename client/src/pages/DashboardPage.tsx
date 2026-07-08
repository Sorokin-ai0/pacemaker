import { differenceInCalendarDays, format, parseISO } from "date-fns";
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  Gauge,
  Timer,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { planApi, statsApi } from "@/api";
import type { Phase, PlanDTO, PlannedWorkoutDTO } from "@/api/types";
import { EmptyState } from "@/components/EmptyState";
import { PaceTrendChart } from "@/components/charts/PaceTrendChart";
import { WeeklyMileageChart } from "@/components/charts/WeeklyMileageChart";
import { PageHeader } from "@/components/PageHeader";
import { CoachCard } from "@/components/CoachCard";
import { RaceCountdown } from "@/components/RaceCountdown";
import { StatCard } from "@/components/StatCard";
import { TaperBanner } from "@/components/TaperBanner";
import { WorkoutTypeBadge } from "@/components/WorkoutTypeBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth";
import { useApi } from "@/hooks/use-api";
import { formatDistance, formatFinishTime } from "@/lib/units";

function deriveCurrentWeek(plan: PlanDTO): { week: number | null; phase: Phase | null } {
  const today = new Date();
  let best: PlannedWorkoutDTO | null = null;
  let bestDiff = Infinity;
  for (const w of plan.workouts) {
    const diff = Math.abs(differenceInCalendarDays(parseISO(w.date), today));
    if (diff < bestDiff) {
      best = w;
      bestDiff = diff;
    }
  }
  if (!best) return { week: null, phase: null };
  return { week: Math.min(best.weekIndex + 1, plan.totalWeeks), phase: best.phase };
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Skeleton className="h-48 lg:col-span-2" />
      <Skeleton className="h-48" />
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
      <Skeleton className="h-80 lg:col-span-2" />
      <Skeleton className="h-80" />
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const stats = useApi(() => statsApi.get());
  const plan = useApi(() => planApi.get());

  const unit = user?.unitPreference ?? "mi";

  const current = useMemo(
    () => (plan.data ? deriveCurrentWeek(plan.data) : { week: null, phase: null }),
    [plan.data],
  );

  const todayWorkout = useMemo(() => {
    if (!plan.data) return null;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return plan.data.workouts.find((w) => w.date === todayStr) ?? null;
  }, [plan.data]);

  const thisWeek = useMemo(() => {
    if (!stats.data) return null;
    const now = new Date();
    return (
      stats.data.weeklyMileage.find((w) => {
        const start = parseISO(w.weekStart);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        return now >= start && now < end;
      }) ?? null
    );
  }, [stats.data]);

  if (stats.loading || plan.loading) {
    return (
      <>
        <PageHeader title="Dashboard" description="Your training at a glance." />
        <DashboardSkeleton />
      </>
    );
  }

  if (stats.error || !stats.data) {
    return (
      <>
        <PageHeader title="Dashboard" description="Your training at a glance." />
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load your stats"
          description={stats.error?.message ?? "Something went wrong."}
          action={
            <Button variant="outline" onClick={stats.reload}>
              Try again
            </Button>
          }
        />
      </>
    );
  }

  const s = stats.data;
  const adherencePercent = Math.round(s.adherence.percent);

  return (
    <>
      <PageHeader title="Dashboard" description="Your training at a glance." />

      <div className="space-y-4">
        {s.taper.active && <TaperBanner />}

        <CoachCard stats={s} />

        <div className="grid gap-4 lg:grid-cols-3">
          <RaceCountdown
            className="lg:col-span-2"
            raceDate={s.countdown.raceDate}
            daysToRace={s.countdown.daysToRace}
            currentWeek={current.week}
            totalWeeks={plan.data?.totalWeeks ?? null}
            phase={current.phase}
          />

          {/* Today's workout */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today's workout
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayWorkout ? (
                <div className="flex h-full flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <WorkoutTypeBadge type={todayWorkout.type} />
                    {todayWorkout.loggedRunId && (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" /> Done
                      </span>
                    )}
                  </div>
                  {todayWorkout.type === "rest" ? (
                    <p className="text-sm text-muted-foreground">
                      Rest day — recovery is where the fitness happens.
                    </p>
                  ) : (
                    <>
                      <div>
                        {todayWorkout.targetDistanceKm !== null && (
                          <p className="text-2xl font-bold tracking-tight tabular-nums">
                            {formatDistance(todayWorkout.targetDistanceKm, unit)}
                          </p>
                        )}
                        {todayWorkout.targetPaceZone && (
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {todayWorkout.targetPaceZone}
                          </p>
                        )}
                      </div>
                      {todayWorkout.notes && (
                        <p className="text-xs text-muted-foreground">{todayWorkout.notes}</p>
                      )}
                      {!todayWorkout.loggedRunId && (
                        <Button asChild size="sm" className="mt-auto w-fit">
                          <Link to={`/log?workout=${todayWorkout.id}`}>Log this run</Link>
                        </Button>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nothing on the plan today.{" "}
                  <Link to="/calendar" className="text-primary underline-offset-4 hover:underline">
                    View calendar
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Adherence"
            icon={CalendarCheck2}
            value={s.adherence.plannedToDate > 0 ? `${adherencePercent}%` : "—"}
            sub={
              s.adherence.plannedToDate > 0
                ? `${s.adherence.completed} of ${s.adherence.plannedToDate} workouts completed`
                : "No workouts due yet"
            }
          >
            <Progress
              className="mt-3"
              value={s.adherence.plannedToDate > 0 ? adherencePercent : 0}
              aria-label={`Adherence ${adherencePercent} percent`}
            />
          </StatCard>

          <StatCard
            title="Projected finish"
            icon={Timer}
            value={
              s.projection.projectedSeconds !== null
                ? formatFinishTime(s.projection.projectedSeconds)
                : "—"
            }
            sub={
              s.projection.basisRun
                ? `Based on your ${formatDistance(s.projection.basisRun.distanceKm, unit)} on ${format(
                    parseISO(s.projection.basisRun.date),
                    "MMM d",
                  )}`
                : "Log a long run (8 km / 5 mi or more) to unlock a projection"
            }
          />

          <StatCard
            title="This week"
            icon={Gauge}
            value={
              thisWeek
                ? `${formatDistance(thisWeek.loggedKm, unit, { withUnit: false })} / ${formatDistance(
                    thisWeek.plannedKm,
                    unit,
                  )}`
                : "—"
            }
            sub={thisWeek ? "Logged vs planned volume" : "Outside the plan window"}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TrendingUp className="size-4" aria-hidden="true" />
                Weekly mileage ({unit})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {s.weeklyMileage.length > 0 ? (
                <WeeklyMileageChart weeks={s.weeklyMileage} unit={unit} />
              ) : (
                <EmptyState
                  title="No weeks planned yet"
                  description="Your weekly volume will appear once a plan is generated."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Timer className="size-4" aria-hidden="true" />
                Pace trend (min/{unit})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {s.paceTrend.length > 0 ? (
                <PaceTrendChart points={s.paceTrend} unit={unit} />
              ) : (
                <EmptyState
                  title="No runs logged yet"
                  description="Log your first run and your pace trend will show up here."
                  action={
                    <Button asChild size="sm" variant="outline">
                      <Link to="/log">Log a run</Link>
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
