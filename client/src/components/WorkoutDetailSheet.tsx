import { format, parseISO } from "date-fns";
import { CheckCircle2, Loader2, NotebookPen, PencilLine, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { toApiError, workoutsApi } from "@/api";
import type { LoggedRunDTO, PlannedWorkoutDTO, Unit, WorkoutType } from "@/api/types";
import { CoachText } from "@/components/CoachText";
import { PaceText } from "@/components/PaceText";
import { PhaseBadge, WorkoutTypeBadge } from "@/components/WorkoutTypeBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { coachExplainWorkout } from "@/lib/aiCoach";
import { formatDistance, formatDuration, kmToUnit, unitLabel, unitToKm } from "@/lib/units";
import { WORKOUT_META } from "@/lib/workouts";

const EDITABLE_TYPES: WorkoutType[] = ["long", "easy", "tempo", "speed", "rest", "race"];

interface WorkoutDetailSheetProps {
  workout: PlannedWorkoutDTO | null;
  linkedRun: LoggedRunDTO | null;
  unit: Unit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the server-updated workout after a successful PATCH. */
  onSaved: (workout: PlannedWorkoutDTO) => void;
}

export function WorkoutDetailSheet({
  workout,
  linkedRun,
  unit,
  open,
  onOpenChange,
  onSaved,
}: WorkoutDetailSheetProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState("");
  const [type, setType] = useState<WorkoutType>("easy");
  const [distance, setDistance] = useState("");
  const [notes, setNotes] = useState("");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);

  useEffect(() => {
    setEditing(false);
    setExplanation(null);
    setExplaining(false);
  }, [workout?.id, open]);

  const explainWorkout = async () => {
    if (!workout || explaining) return;
    setExplaining(true);
    const res = await coachExplainWorkout({ workout, unit });
    setExplanation(
      res.configured === false
        ? "The AI coach isn't configured — add an ANTHROPIC_API_KEY on the server."
        : (res.text ?? "Couldn't load an explanation right now."),
    );
    setExplaining(false);
  };

  if (!workout) return null;

  const startEditing = () => {
    setDate(workout.date);
    setType(workout.type);
    setDistance(
      workout.targetDistanceKm !== null
        ? String(Math.round(kmToUnit(workout.targetDistanceKm, unit) * 10) / 10)
        : "",
    );
    setNotes(workout.notes ?? "");
    setEditing(true);
  };

  const handleSave = async () => {
    const distanceValue = distance.trim() === "" ? null : Number(distance);
    if (distanceValue !== null && (!Number.isFinite(distanceValue) || distanceValue <= 0)) {
      toast({
        variant: "destructive",
        title: "Invalid distance",
        description: "Distance must be a positive number.",
      });
      return;
    }
    setSaving(true);
    try {
      const updated = await workoutsApi.update(workout.id, {
        date,
        type,
        targetDistanceKm:
          type === "rest" || distanceValue === null ? null : unitToKm(distanceValue, unit),
        notes: notes.trim() === "" ? null : notes.trim(),
      });
      onSaved(updated);
      setEditing(false);
      toast({ title: "Workout updated", description: "Your plan has been adjusted." });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not update workout",
        description: toApiError(err).message,
      });
    } finally {
      setSaving(false);
    }
  };

  const meta = WORKOUT_META[workout.type];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="responsive">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <WorkoutTypeBadge type={workout.type} />
            <PhaseBadge phase={workout.phase} />
          </div>
          <SheetTitle>{format(parseISO(workout.date), "EEEE, MMMM d")}</SheetTitle>
          <SheetDescription>{meta.blurb}</SheetDescription>
        </SheetHeader>

        {!editing ? (
          <div className="mt-6 space-y-6">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Target distance</dt>
                <dd className="font-medium tabular-nums">
                  {workout.targetDistanceKm !== null
                    ? formatDistance(workout.targetDistanceKm, unit)
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Pace zone</dt>
                <dd className="max-w-[60%] text-right font-medium">
                  {workout.targetPaceZone ?? "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Week</dt>
                <dd className="font-medium tabular-nums">Week {workout.weekIndex + 1}</dd>
              </div>
            </dl>

            {workout.notes && (
              <div className="rounded-md border bg-muted/40 px-3 py-2.5 text-sm">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <NotebookPen className="size-3.5" aria-hidden="true" /> Notes
                </p>
                {workout.notes}
              </div>
            )}

            {linkedRun && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" /> Completed
                </p>
                <p className="tabular-nums">
                  {formatDistance(linkedRun.distanceKm, unit)} in{" "}
                  {formatDuration(linkedRun.durationSeconds)} ·{" "}
                  <PaceText secPerKm={linkedRun.paceSecPerKm} unit={unit} />
                </p>
              </div>
            )}

            <Separator />

            <div className="flex flex-col gap-2">
              {workout.type !== "rest" && !linkedRun && (
                <Button onClick={() => navigate(`/log?workout=${workout.id}`)}>
                  Log run for this workout
                </Button>
              )}
              <Button variant="outline" onClick={startEditing}>
                <PencilLine aria-hidden="true" /> Edit workout
              </Button>
              {!explanation && (
                <Button
                  variant="ghost"
                  className="text-primary"
                  onClick={() => void explainWorkout()}
                  disabled={explaining}
                >
                  {explaining ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles aria-hidden="true" />
                  )}
                  Why this workout?
                </Button>
              )}
            </div>

            {explanation && (
              <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary/80">
                  <Sparkles className="size-3.5" aria-hidden="true" /> Coach
                </p>
                <CoachText text={explanation} className="leading-relaxed" />
              </div>
            )}
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="workout-date">Date</Label>
              <Input
                id="workout-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workout-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as WorkoutType)}>
                <SelectTrigger id="workout-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDITABLE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {WORKOUT_META[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {type !== "rest" && (
              <div className="space-y-2">
                <Label htmlFor="workout-distance">Distance ({unitLabel(unit)})</Label>
                <Input
                  id="workout-distance"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="workout-notes">Notes</Label>
              <Textarea
                id="workout-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything to remember about this session…"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
