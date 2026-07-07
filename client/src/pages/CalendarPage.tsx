import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { planApi, runsApi } from "@/api";
import type { PlannedWorkoutDTO } from "@/api/types";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { WorkoutDetailSheet } from "@/components/WorkoutDetailSheet";
import { PhaseBadge, WorkoutTypeBadge } from "@/components/WorkoutTypeBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/auth";
import { useApi } from "@/hooks/use-api";
import { formatDistance, kmToUnit } from "@/lib/units";
import { WORKOUT_META } from "@/lib/workouts";
import { cn } from "@/lib/utils";

const WEEK_STARTS_ON = 1; // Monday

export function CalendarPage() {
  const { user } = useAuth();
  const unit = user?.unitPreference ?? "mi";

  const plan = useApi(() => planApi.get());
  const runs = useApi(() => runsApi.list());

  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [weekCursor, setWeekCursor] = useState(() => new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const workoutsByDate = useMemo(() => {
    const map = new Map<string, PlannedWorkoutDTO>();
    plan.data?.workouts.forEach((w) => map.set(w.date, w));
    return map;
  }, [plan.data]);

  const selectedWorkout = useMemo(
    () => plan.data?.workouts.find((w) => w.id === selectedId) ?? null,
    [plan.data, selectedId],
  );

  const linkedRun = useMemo(() => {
    if (!selectedWorkout?.loggedRunId) return null;
    return runs.data?.find((r) => r.id === selectedWorkout.loggedRunId) ?? null;
  }, [selectedWorkout, runs.data]);

  const openWorkout = (workout: PlannedWorkoutDTO) => {
    setSelectedId(workout.id);
    setSheetOpen(true);
  };

  const handleSaved = (updated: PlannedWorkoutDTO) => {
    plan.setData((current) =>
      current
        ? {
            ...current,
            workouts: current.workouts.map((w) => (w.id === updated.id ? updated : w)),
          }
        : current,
    );
  };

  if (plan.loading) {
    return (
      <>
        <PageHeader title="Calendar" description="Every session between you and the start line." />
        <Skeleton className="h-[32rem]" />
      </>
    );
  }

  if (plan.error) {
    return (
      <>
        <PageHeader title="Calendar" description="Every session between you and the start line." />
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load your plan"
          description={plan.error.message}
          action={
            <Button variant="outline" onClick={plan.reload}>
              Try again
            </Button>
          }
        />
      </>
    );
  }

  if (!plan.data) {
    return (
      <>
        <PageHeader title="Calendar" description="Every session between you and the start line." />
        <EmptyState
          title="No training plan yet"
          description="Answer a few questions and we'll map every week to race day."
          action={
            <Button asChild>
              <Link to="/onboarding">Build my plan</Link>
            </Button>
          }
        />
      </>
    );
  }

  const activePlan = plan.data;
  const planStart = parseISO(activePlan.startDate);
  const planEnd = parseISO(activePlan.raceDate);
  const today = new Date();

  // ---- Month view ----
  const monthGridStart = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: WEEK_STARTS_ON });
  const monthGridEnd = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: WEEK_STARTS_ON });
  const monthDays: Date[] = [];
  for (let d = monthGridStart; d <= monthGridEnd; d = addDays(d, 1)) {
    monthDays.push(d);
  }

  // ---- Week view ----
  const weekStart = startOfWeek(weekCursor, { weekStartsOn: WEEK_STARTS_ON });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekWorkouts = weekDays
    .map((d) => workoutsByDate.get(format(d, "yyyy-MM-dd")))
    .filter((w): w is PlannedWorkoutDTO => Boolean(w));
  const weekPhase = weekWorkouts[0]?.phase ?? null;
  const weekIndex = weekWorkouts[0]?.weekIndex ?? null;

  return (
    <>
      <PageHeader title="Calendar" description="Every session between you and the start line." />

      <Tabs defaultValue="month">
        <TabsList aria-label="Calendar view">
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
        </TabsList>

        {/* ------------------------------ MONTH ------------------------------ */}
        <TabsContent value="month">
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold tracking-tight">{format(monthCursor, "MMMM yyyy")}</h2>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Previous month"
                  onClick={() => setMonthCursor((d) => subMonths(d, 1))}
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setMonthCursor(new Date())}>
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Next month"
                  onClick={() => setMonthCursor((d) => addMonths(d, 1))}
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b text-center text-xs font-medium text-muted-foreground">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {monthDays.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const workout = workoutsByDate.get(dateStr);
                const inMonth = isSameMonth(day, monthCursor);
                const inPlan = isWithinInterval(day, { start: planStart, end: planEnd });
                const isToday = isSameDay(day, today);
                const isRace = workout?.type === "race";

                const cell = (
                  <>
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                        isToday && "bg-primary font-semibold text-primary-foreground",
                        !isToday && !inMonth && "text-muted-foreground/50",
                        !isToday && inMonth && !inPlan && "text-muted-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {workout && (
                      <span
                        className={cn(
                          "mt-1 flex min-w-0 items-center gap-1 text-[11px] leading-tight",
                          !inMonth && "opacity-50",
                        )}
                      >
                        {isRace ? (
                          <Flag className="size-3 shrink-0 text-violet-500" aria-hidden="true" />
                        ) : (
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              WORKOUT_META[workout.type].dotClass,
                            )}
                            aria-hidden="true"
                          />
                        )}
                        <span className="truncate text-muted-foreground">
                          {workout.type === "rest"
                            ? "Rest"
                            : workout.targetDistanceKm !== null
                              ? `${(Math.round(kmToUnit(workout.targetDistanceKm, unit) * 10) / 10).toFixed(1)}`
                              : WORKOUT_META[workout.type].label}
                        </span>
                        {workout.loggedRunId && (
                          <CheckCircle2
                            className="size-3 shrink-0 text-emerald-500"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                    )}
                  </>
                );

                return workout ? (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => openWorkout(workout)}
                    aria-label={`${format(day, "EEEE, MMMM d")}: ${WORKOUT_META[workout.type].label}${
                      workout.targetDistanceKm !== null
                        ? `, ${formatDistance(workout.targetDistanceKm, unit)}`
                        : ""
                    }`}
                    className={cn(
                      "flex min-h-16 flex-col items-start border-b border-r p-1.5 text-left transition-colors hover:bg-accent focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-20 sm:p-2 [&:nth-child(7n)]:border-r-0",
                      !inMonth && "bg-muted/30",
                    )}
                  >
                    {cell}
                  </button>
                ) : (
                  <div
                    key={dateStr}
                    className={cn(
                      "flex min-h-16 flex-col items-start border-b border-r p-1.5 sm:min-h-20 sm:p-2 [&:nth-child(7n)]:border-r-0",
                      !inMonth && "bg-muted/30",
                    )}
                  >
                    {cell}
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ------------------------------ WEEK ------------------------------ */}
        <TabsContent value="week">
          <div className="rounded-lg border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div className="flex items-center gap-2.5">
                <h2 className="font-semibold tracking-tight">
                  Week of {format(weekStart, "MMM d")}
                </h2>
                {weekIndex !== null && (
                  <span className="text-sm text-muted-foreground tabular-nums">
                    Week {weekIndex + 1} of {activePlan.totalWeeks}
                  </span>
                )}
                {weekPhase && <PhaseBadge phase={weekPhase} />}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Previous week"
                  onClick={() => setWeekCursor((d) => subWeeks(d, 1))}
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setWeekCursor(new Date())}>
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Next week"
                  onClick={() => setWeekCursor((d) => addWeeks(d, 1))}
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </div>

            <ul className="divide-y">
              {weekDays.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const workout = workoutsByDate.get(dateStr);
                const isToday = isSameDay(day, today);
                const daysAway = differenceInCalendarDays(day, today);

                return (
                  <li key={dateStr}>
                    {workout ? (
                      <button
                        type="button"
                        onClick={() => openWorkout(workout)}
                        className={cn(
                          "flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                          isToday && "bg-primary/5",
                        )}
                      >
                        <div className="w-14 shrink-0">
                          <p
                            className={cn(
                              "text-xs font-medium uppercase",
                              isToday ? "text-primary" : "text-muted-foreground",
                            )}
                          >
                            {format(day, "EEE")}
                          </p>
                          <p className="text-lg font-semibold tabular-nums">{format(day, "d")}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <WorkoutTypeBadge type={workout.type} />
                            {workout.targetDistanceKm !== null && (
                              <span className="text-sm font-semibold tabular-nums">
                                {formatDistance(workout.targetDistanceKm, unit)}
                              </span>
                            )}
                            {workout.loggedRunId && (
                              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="size-3.5" aria-hidden="true" /> Logged
                              </span>
                            )}
                          </div>
                          {workout.targetPaceZone && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {workout.targetPaceZone}
                            </p>
                          )}
                          {workout.notes && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {workout.notes}
                            </p>
                          )}
                        </div>
                        <ChevronRight
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </button>
                    ) : (
                      <div
                        className={cn(
                          "flex items-center gap-4 px-4 py-3",
                          isToday && "bg-primary/5",
                        )}
                      >
                        <div className="w-14 shrink-0">
                          <p
                            className={cn(
                              "text-xs font-medium uppercase",
                              isToday ? "text-primary" : "text-muted-foreground",
                            )}
                          >
                            {format(day, "EEE")}
                          </p>
                          <p className="text-lg font-semibold tabular-nums">{format(day, "d")}</p>
                        </div>
                        <p className="text-sm text-muted-foreground/70">
                          {daysAway === 0 ? "Nothing planned today" : "Outside the plan"}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </TabsContent>
      </Tabs>

      <WorkoutDetailSheet
        workout={selectedWorkout}
        linkedRun={linkedRun}
        unit={unit}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={handleSaved}
      />
    </>
  );
}
