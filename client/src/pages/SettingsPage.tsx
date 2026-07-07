import { addDays, format, parseISO } from "date-fns";
import { Activity, HeartPulse, Loader2, LogOut, RefreshCw, Watch } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { meApi, planApi, toApiError } from "@/api";
import type { ExperienceLevel, Unit } from "@/api/types";
import { PageHeader } from "@/components/PageHeader";
import { WeekdayPicker } from "@/components/WeekdayPicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/auth";
import { useTheme } from "@/context/theme";
import { formatDistance, kmToUnit, unitLabel, unitToKm } from "@/lib/units";
import { WEEKDAY_LABELS } from "@/lib/workouts";
import { cn } from "@/lib/utils";

const LEVEL_LABELS: Record<ExperienceLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const INTEGRATIONS = [
  {
    name: "Strava",
    icon: Activity,
    blurb: "Auto-import your runs the moment you finish them.",
  },
  {
    name: "Garmin",
    icon: Watch,
    blurb: "Sync workouts to your watch and pull back the data.",
  },
  {
    name: "WHOOP",
    icon: HeartPulse,
    blurb: "Blend recovery and strain into your training load.",
  },
];

export function SettingsPage() {
  const { user, profile, patchUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();

  const unit = user?.unitPreference ?? "mi";
  const [savingUnit, setSavingUnit] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const changeUnit = async (next: Unit) => {
    if (!user || next === user.unitPreference || savingUnit) return;
    const previous = user.unitPreference;
    patchUser({ unitPreference: next }); // optimistic
    setSavingUnit(true);
    try {
      await meApi.update({ unitPreference: next });
      toast({
        title: "Units updated",
        description: `Distances now display in ${next === "mi" ? "miles" : "kilometres"}.`,
      });
    } catch (err) {
      patchUser({ unitPreference: previous }); // revert
      toast({
        variant: "destructive",
        title: "Could not update units",
        description: toApiError(err).message,
      });
    } finally {
      setSavingUnit(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" description="Preferences, plan controls, and account." />

      <div className="space-y-4">
        {/* Units */}
        <Card>
          <CardHeader>
            <CardTitle>Units</CardTitle>
            <CardDescription>How distances and paces are displayed everywhere.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              role="radiogroup"
              aria-label="Distance units"
              className="inline-flex rounded-lg border p-1"
            >
              {(["mi", "km"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  role="radio"
                  aria-checked={unit === u}
                  disabled={savingUnit}
                  onClick={() => changeUnit(u)}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70",
                    unit === u
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {u === "mi" ? "Miles" : "Kilometres"}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Dark mode is the Pacemaker default.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="dark-mode" className="font-normal">
                Dark mode
              </Label>
              <Switch
                id="dark-mode"
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Training plan */}
        <Card>
          <CardHeader>
            <CardTitle>Training plan</CardTitle>
            <CardDescription>The inputs your current plan was built from.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile ? (
              <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                <div className="flex items-center justify-between gap-4 sm:justify-start sm:gap-3">
                  <dt className="text-muted-foreground">Race date</dt>
                  <dd className="font-medium">
                    {format(parseISO(profile.raceDate), "MMM d, yyyy")}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-start sm:gap-3">
                  <dt className="text-muted-foreground">Experience</dt>
                  <dd className="font-medium">{LEVEL_LABELS[profile.experienceLevel]}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-start sm:gap-3">
                  <dt className="text-muted-foreground">Weekly volume</dt>
                  <dd className="font-medium tabular-nums">
                    {formatDistance(profile.currentWeeklyMileageKm, unit)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-start sm:gap-3">
                  <dt className="text-muted-foreground">Long-run day</dt>
                  <dd className="font-medium">{WEEKDAY_LABELS[profile.longRunDay]}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No training profile yet.</p>
            )}
            <Separator />
            <Button variant="outline" onClick={() => setRegenOpen(true)} disabled={!profile}>
              <RefreshCw aria-hidden="true" /> Regenerate plan
            </Button>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>Bring your runs in automatically.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {INTEGRATIONS.map(({ name, icon: Icon, blurb }) => (
                <div key={name} className="flex flex-col gap-2 rounded-lg border p-4">
                  <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <p className="font-medium">{name}</p>
                  <p className="text-xs leading-snug text-muted-foreground">{blurb}</p>
                  <Button variant="secondary" size="sm" disabled className="mt-auto w-fit">
                    Coming soon
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Signed in as {user?.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleLogout} disabled={loggingOut}>
              <LogOut aria-hidden="true" /> {loggingOut ? "Logging out…" : "Log out"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {profile && (
        <RegeneratePlanDialog
          open={regenOpen}
          onOpenChange={setRegenOpen}
          unit={unit}
          initial={{
            raceDate: profile.raceDate,
            weeklyMileage: String(
              Math.round(kmToUnit(profile.currentWeeklyMileageKm, unit) * 10) / 10,
            ),
            level: profile.experienceLevel,
            longRunDay: profile.longRunDay,
          }}
        />
      )}
    </>
  );
}

interface RegenerateInitial {
  raceDate: string;
  weeklyMileage: string;
  level: ExperienceLevel;
  longRunDay: number;
}

function RegeneratePlanDialog({
  open,
  onOpenChange,
  unit,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: Unit;
  initial: RegenerateInitial;
}) {
  const { applyProfile } = useAuth();
  const { toast } = useToast();

  const [raceDate, setRaceDate] = useState(initial.raceDate);
  const [weeklyMileage, setWeeklyMileage] = useState(initial.weeklyMileage);
  const [level, setLevel] = useState<ExperienceLevel>(initial.level);
  const [longRunDay, setLongRunDay] = useState(initial.longRunDay);
  const [submitting, setSubmitting] = useState(false);

  // Re-prefill from the current profile every time the dialog opens.
  const initialRef = useRef(initial);
  initialRef.current = initial;
  useEffect(() => {
    if (!open) return;
    const i = initialRef.current;
    setRaceDate(i.raceDate);
    setWeeklyMileage(i.weeklyMileage);
    setLevel(i.level);
    setLongRunDay(i.longRunDay);
  }, [open]);

  const minDate = format(addDays(new Date(), 1), "yyyy-MM-dd");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const mileage = Number(weeklyMileage);
    if (!raceDate || !Number.isFinite(mileage) || mileage < 0) {
      toast({
        variant: "destructive",
        title: "Check your inputs",
        description: "Race date and weekly volume are required.",
      });
      return;
    }
    setSubmitting(true);
    try {
      const result = await planApi.regenerate({
        experienceLevel: level,
        currentWeeklyMileageKm: unitToKm(mileage, unit),
        raceDate,
        longRunDay,
      });
      applyProfile(result.profile);
      onOpenChange(false);
      toast({
        title: "Plan regenerated",
        description: `A fresh ${result.plan.totalWeeks}-week plan is ready. Logged runs were kept.`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not regenerate plan",
        description: toApiError(err).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Regenerate training plan</DialogTitle>
          <DialogDescription>
            This replaces your current plan and every workout in it. Logged runs are kept, but
            they'll be unlinked from old workouts.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="regen-race-date">Race date</Label>
              <Input
                id="regen-race-date"
                type="date"
                min={minDate}
                value={raceDate}
                onChange={(e) => setRaceDate(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="regen-mileage">Weekly volume ({unitLabel(unit)})</Label>
              <Input
                id="regen-mileage"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={weeklyMileage}
                onChange={(e) => setWeeklyMileage(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="regen-level">Experience level</Label>
            <Select
              value={level}
              onValueChange={(v) => setLevel(v as ExperienceLevel)}
              disabled={submitting}
            >
              <SelectTrigger id="regen-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium leading-none">Preferred long-run day</span>
            <WeekdayPicker value={longRunDay} onChange={setLongRunDay} disabled={submitting} />
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" /> Rebuilding…
                </>
              ) : (
                "Replace my plan"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
