import { format, parseISO } from "date-fns";
import { AlertTriangle, CheckCircle2, Footprints, Heart, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { planApi, runsApi, toApiError } from "@/api";
import type { LoggedRunDTO, PlannedWorkoutDTO } from "@/api/types";
import { CoachRunRecap } from "@/components/CoachRunRecap";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { PaceText } from "@/components/PaceText";
import { PageHeader } from "@/components/PageHeader";
import { RunDialog } from "@/components/RunDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/auth";
import { useDisplaySettings } from "@/context/settings";
import { useApi } from "@/hooks/use-api";
import { formatDistance, formatDuration } from "@/lib/units";
import { WORKOUT_META, WEEKDAY_SHORT } from "@/lib/workouts";

export function RunLogPage() {
  const { user } = useAuth();
  const { showHeartRate } = useDisplaySettings();
  const unit = user?.unitPreference ?? "mi";
  const { toast } = useToast();

  const runs = useApi(() => runsApi.list());
  const plan = useApi(() => planApi.get());

  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRun, setEditingRun] = useState<LoggedRunDTO | null>(null);
  const [presetWorkout, setPresetWorkout] = useState<PlannedWorkoutDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LoggedRunDTO | null>(null);
  // The most recently logged (not edited) run — drives the AI coach recap.
  const [recapRun, setRecapRun] = useState<LoggedRunDTO | null>(null);

  // Deep link from calendar / dashboard: /log?workout=<id>
  const workoutParam = searchParams.get("workout");
  useEffect(() => {
    if (!workoutParam || !plan.data) return;
    const workout = plan.data.workouts.find((w) => w.id === workoutParam) ?? null;
    setSearchParams({}, { replace: true });
    if (workout) {
      setPresetWorkout(workout);
      setEditingRun(null);
      setDialogOpen(true);
    }
  }, [workoutParam, plan.data, setSearchParams]);

  const workoutsById = useMemo(() => {
    const map = new Map<string, PlannedWorkoutDTO>();
    plan.data?.workouts.forEach((w) => map.set(w.id, w));
    return map;
  }, [plan.data]);

  const sortedRuns = useMemo(() => {
    if (!runs.data) return [];
    return [...runs.data].sort((a, b) => b.date.localeCompare(a.date));
  }, [runs.data]);

  const openCreate = () => {
    setEditingRun(null);
    setPresetWorkout(null);
    setDialogOpen(true);
  };

  const openEdit = (run: LoggedRunDTO) => {
    setEditingRun(run);
    setPresetWorkout(null);
    setDialogOpen(true);
  };

  const handleSaved = (saved: LoggedRunDTO, previous: LoggedRunDTO | null) => {
    runs.setData((current) => {
      const list = current ?? [];
      return previous ? list.map((r) => (r.id === previous.id ? saved : r)) : [saved, ...list];
    });
    // Workout ↔ run links may have changed server-side; refresh the plan copy.
    if (saved.plannedWorkoutId !== null || previous?.plannedWorkoutId) {
      plan.reload();
    }
    // Only a brand-new run (not an edit) gets a coach recap.
    if (!previous) setRecapRun(saved);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await runsApi.remove(deleteTarget.id);
      runs.setData((current) => (current ?? []).filter((r) => r.id !== deleteTarget.id));
      if (deleteTarget.plannedWorkoutId) plan.reload();
      toast({ title: "Run deleted", description: "The run has been removed from your log." });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not delete run",
        description: toApiError(err).message,
      });
      throw err;
    }
  };

  return (
    <>
      <PageHeader
        title="Run log"
        description="Every mile you've put in the bank."
        actions={
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" /> Log run
          </Button>
        }
      />

      {recapRun && (
        <CoachRunRecap
          run={recapRun}
          plan={plan.data}
          runs={runs.data ?? []}
          user={user}
          onDismiss={() => setRecapRun(null)}
        />
      )}

      {runs.loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : runs.error ? (
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load your runs"
          description={runs.error.message}
          action={
            <Button variant="outline" onClick={runs.reload}>
              Try again
            </Button>
          }
        />
      ) : sortedRuns.length === 0 ? (
        <EmptyState
          icon={Footprints}
          title="No runs yet"
          description="Log your first run and start building the streak."
          action={
            <Button onClick={openCreate}>
              <Plus aria-hidden="true" /> Log run
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {sortedRuns.map((run) => {
            const workout = run.plannedWorkoutId
              ? workoutsById.get(run.plannedWorkoutId)
              : undefined;
            return (
              <li key={run.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {format(parseISO(run.date), "EEEE, MMM d, yyyy")}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <span className="text-xl font-bold tracking-tight tabular-nums">
                          {formatDistance(run.distanceKm, unit)}
                        </span>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {formatDuration(run.durationSeconds)}
                        </span>
                        <PaceText
                          secPerKm={run.paceSecPerKm}
                          unit={unit}
                          className="text-sm font-medium"
                        />
                        {showHeartRate && run.avgHeartRate !== null && (
                          <span className="flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
                            <Heart className="size-3.5 text-rose-500" aria-hidden="true" />
                            {run.avgHeartRate} bpm
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {run.rpe !== null && (
                          <Badge variant="secondary" className="tabular-nums">
                            RPE {run.rpe}
                          </Badge>
                        )}
                        {workout && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${WORKOUT_META[workout.type].badgeClass}`}
                          >
                            <CheckCircle2 className="size-3" aria-hidden="true" />
                            {WORKOUT_META[workout.type].label} —{" "}
                            {WEEKDAY_SHORT[parseISO(workout.date).getDay()]}
                          </span>
                        )}
                      </div>
                      {run.notes && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {run.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit run on ${format(parseISO(run.date), "MMMM d")}`}
                        onClick={() => openEdit(run)}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete run on ${format(parseISO(run.date), "MMMM d")}`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(run)}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <RunDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setPresetWorkout(null);
            setEditingRun(null);
          }
        }}
        run={editingRun}
        presetWorkout={presetWorkout}
        plan={plan.data}
        unit={unit}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this run?"
        description={
          deleteTarget
            ? `${formatDistance(deleteTarget.distanceKm, unit)} on ${format(
                parseISO(deleteTarget.date),
                "MMMM d",
              )} will be permanently removed. This can't be undone.`
            : ""
        }
        confirmLabel="Delete run"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
