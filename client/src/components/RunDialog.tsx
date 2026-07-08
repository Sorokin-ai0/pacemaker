import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { useEffect, useMemo, useState } from "react";

import { runsApi, toApiError } from "@/api";
import type { LoggedRunDTO, PlanDTO, PlannedWorkoutDTO, Unit } from "@/api/types";
import { DurationInput } from "@/components/DurationInput";
import { durationPartsToSeconds, secondsToDurationParts, type DurationParts } from "@/lib/duration";
import { RpePicker } from "@/components/RpePicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useDisplaySettings } from "@/context/settings";
import { formatPaceOrSpeed, kmToUnit, unitLabel, unitToKm } from "@/lib/units";
import { WORKOUT_META, WEEKDAY_SHORT } from "@/lib/workouts";

const NONE_VALUE = "none";
/** "Nearby" planned workouts = within this many days of the run date. */
const NEARBY_DAYS = 3;

interface RunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Run being edited, or null to create. */
  run: LoggedRunDTO | null;
  /** Workout preselected via ?workout=<id> deep link (create mode only). */
  presetWorkout: PlannedWorkoutDTO | null;
  plan: PlanDTO | null;
  unit: Unit;
  onSaved: (run: LoggedRunDTO, previous: LoggedRunDTO | null) => void;
}

export function RunDialog({
  open,
  onOpenChange,
  run,
  presetWorkout,
  plan,
  unit,
  onSaved,
}: RunDialogProps) {
  const { toast } = useToast();
  const { showSpeed, showHeartRate } = useDisplaySettings();

  const [date, setDate] = useState("");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState<DurationParts>({ h: "", m: "", s: "" });
  const [heartRate, setHeartRate] = useState("");
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [workoutId, setWorkoutId] = useState<string>(NONE_VALUE);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    distance?: string;
    duration?: string;
    heartRate?: string;
  }>({});

  // Re-initialise the form whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    if (run) {
      setDate(run.date);
      setDistance(String(Math.round(kmToUnit(run.distanceKm, unit) * 100) / 100));
      setDuration(secondsToDurationParts(run.durationSeconds));
      setHeartRate(run.avgHeartRate !== null ? String(run.avgHeartRate) : "");
      setRpe(run.rpe);
      setNotes(run.notes ?? "");
      setWorkoutId(run.plannedWorkoutId ?? NONE_VALUE);
    } else {
      const today = format(new Date(), "yyyy-MM-dd");
      const startDate = presetWorkout ? presetWorkout.date : today;
      setDate(startDate);
      setDistance(
        presetWorkout?.targetDistanceKm
          ? String(Math.round(kmToUnit(presetWorkout.targetDistanceKm, unit) * 10) / 10)
          : "",
      );
      setDuration({ h: "", m: "", s: "" });
      setHeartRate("");
      setRpe(null);
      setNotes("");
      if (presetWorkout) {
        setWorkoutId(presetWorkout.id);
      } else {
        const sameDay = plan?.workouts.find(
          (w) => w.date === startDate && w.type !== "rest" && w.loggedRunId === null,
        );
        setWorkoutId(sameDay ? sameDay.id : NONE_VALUE);
      }
    }
    setFieldErrors({});
  }, [open, run, presetWorkout, plan, unit]);

  const workoutOptions = useMemo(() => {
    if (!plan || !date) return [];
    const target = parseISO(date);
    const options = plan.workouts.filter((w) => {
      if (w.type === "rest") return false;
      if (Math.abs(differenceInCalendarDays(parseISO(w.date), target)) > NEARBY_DAYS) {
        // Always keep the currently-selected / preset workout in the list.
        return w.id === workoutId;
      }
      // Hide workouts already fulfilled by a different run.
      if (w.loggedRunId !== null && w.loggedRunId !== run?.id) return false;
      return true;
    });
    return options.sort((a, b) => a.date.localeCompare(b.date));
  }, [plan, date, workoutId, run]);

  const distanceValue = Number(distance);
  const durationSeconds = durationPartsToSeconds(duration);
  const pacePreview =
    Number.isFinite(distanceValue) && distanceValue > 0 && durationSeconds > 0
      ? formatPaceOrSpeed(durationSeconds / unitToKm(distanceValue, unit), unit, showSpeed)
      : null;
  const paceLabel = showSpeed ? "Speed" : "Pace";

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};
    if (!Number.isFinite(distanceValue) || distanceValue <= 0) {
      errors.distance = "Enter a distance greater than 0.";
    }
    if (durationSeconds <= 0) {
      errors.duration = "Enter a duration greater than 0.";
    }
    if (heartRate.trim() !== "") {
      const hr = Number(heartRate);
      if (!Number.isInteger(hr) || hr < 30 || hr > 250) {
        errors.heartRate = "Heart rate should be between 30 and 250.";
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    const body = {
      date,
      distanceKm: unitToKm(distanceValue, unit),
      durationSeconds,
      // HR hidden by the display toggle → keep whatever the run already had.
      avgHeartRate: showHeartRate
        ? heartRate.trim() === ""
          ? null
          : Number(heartRate)
        : (run?.avgHeartRate ?? null),
      rpe,
      notes: notes.trim() === "" ? null : notes.trim(),
      // Guard against Radix Select resetting to "" when options re-render.
      plannedWorkoutId: workoutId && workoutId !== NONE_VALUE ? workoutId : null,
    };
    try {
      const saved = run ? await runsApi.update(run.id, body) : await runsApi.create(body);
      onSaved(saved, run);
      onOpenChange(false);
      toast({
        title: run ? "Run updated" : "Run logged",
        description: run ? "Your changes have been saved." : "Nice work — keep stacking miles.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: run ? "Could not update run" : "Could not log run",
        description: toApiError(err).message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{run ? "Edit run" : "Log run"}</DialogTitle>
          <DialogDescription>
            {run
              ? "Adjust the details of this run."
              : "Record a run — distance and time are all you need."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="run-date">Date</Label>
              <Input
                id="run-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={format(new Date(), "yyyy-MM-dd")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="run-distance">Distance ({unitLabel(unit)})</Label>
              <Input
                id="run-distance"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.0"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                aria-invalid={fieldErrors.distance ? true : undefined}
              />
              {fieldErrors.distance && (
                <p className="text-xs text-destructive">{fieldErrors.distance}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium leading-none">Duration</span>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <DurationInput value={duration} onChange={setDuration} idPrefix="run-duration" />
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {pacePreview ? (
                  <>
                    {paceLabel}{" "}
                    <span className="font-medium text-foreground tabular-nums">{pacePreview}</span>
                  </>
                ) : (
                  `${paceLabel} appears here`
                )}
              </p>
            </div>
            {fieldErrors.duration && (
              <p className="text-xs text-destructive">{fieldErrors.duration}</p>
            )}
          </div>

          <div className={showHeartRate ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>
            {showHeartRate && (
              <div className="space-y-2">
                <Label htmlFor="run-hr">Avg heart rate</Label>
                <Input
                  id="run-hr"
                  type="number"
                  inputMode="numeric"
                  min="30"
                  max="250"
                  placeholder="Optional"
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)}
                  aria-invalid={fieldErrors.heartRate ? true : undefined}
                />
                {fieldErrors.heartRate && (
                  <p className="text-xs text-destructive">{fieldErrors.heartRate}</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="run-workout">Fulfills planned workout</Label>
              <Select value={workoutId || NONE_VALUE} onValueChange={setWorkoutId}>
                <SelectTrigger id="run-workout">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  {workoutOptions.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {WORKOUT_META[w.type].label} — {WEEKDAY_SHORT[parseISO(w.date).getDay()]}{" "}
                      {format(parseISO(w.date), "MMM d")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium leading-none">Effort (RPE)</span>
            <RpePicker value={rpe} onChange={setRpe} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="run-notes">Notes</Label>
            <Textarea
              id="run-notes"
              rows={2}
              placeholder="How did it feel?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : run ? "Save changes" : "Log run"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
