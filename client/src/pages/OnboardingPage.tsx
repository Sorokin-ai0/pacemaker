import { addDays, format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { onboardingApi, toApiError } from "@/api";
import type { ExperienceLevel } from "@/api/types";
import { Logo } from "@/components/Logo";
import { WeekdayPicker } from "@/components/WeekdayPicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/auth";
import { kmToUnit, unitLabel, unitToKm } from "@/lib/units";
import { cn } from "@/lib/utils";

const LEVELS: Array<{ value: ExperienceLevel; title: string; description: string }> = [
  {
    value: "beginner",
    title: "Beginner",
    description: "New to structured training or your first half marathon.",
  },
  {
    value: "intermediate",
    title: "Intermediate",
    description: "You run regularly and have raced before.",
  },
  {
    value: "advanced",
    title: "Advanced",
    description: "High weekly volume and chasing a time goal.",
  },
];

export function OnboardingPage() {
  const { user, profile, applyProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const unit = user?.unitPreference ?? "mi";
  const minDate = format(addDays(new Date(), 1), "yyyy-MM-dd");

  const [raceDate, setRaceDate] = useState(profile?.raceDate ?? "");
  const [weeklyMileage, setWeeklyMileage] = useState(
    profile ? String(Math.round(kmToUnit(profile.currentWeeklyMileageKm, unit) * 10) / 10) : "",
  );
  const [level, setLevel] = useState<ExperienceLevel>(profile?.experienceLevel ?? "beginner");
  const [longRunDay, setLongRunDay] = useState(profile?.longRunDay ?? 6); // Saturday
  const [errors, setErrors] = useState<{ raceDate?: string; weeklyMileage?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    if (!raceDate) {
      nextErrors.raceDate = "Pick your race date.";
    } else if (raceDate < minDate) {
      nextErrors.raceDate = "Race date must be in the future.";
    }
    const mileage = Number(weeklyMileage);
    if (weeklyMileage.trim() === "" || !Number.isFinite(mileage) || mileage < 0) {
      nextErrors.weeklyMileage = "Enter your current weekly volume (0 is fine).";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const result = await onboardingApi.submit({
        experienceLevel: level,
        currentWeeklyMileageKm: unitToKm(mileage, unit),
        raceDate,
        longRunDay,
      });
      applyProfile(result.profile);
      toast({
        title: "Your plan is ready",
        description: `${result.plan.totalWeeks} weeks to race day. Let's get to work.`,
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not build your plan",
        description: toApiError(err).message,
      });
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Set up your training</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Four quick questions, and we'll build a week-by-week plan to race day.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your half marathon</CardTitle>
          <CardDescription>You can regenerate the plan later from Settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="race-date">Race date</Label>
              <Input
                id="race-date"
                type="date"
                min={minDate}
                value={raceDate}
                onChange={(e) => setRaceDate(e.target.value)}
                aria-invalid={errors.raceDate ? true : undefined}
                disabled={submitting}
              />
              {errors.raceDate && <p className="text-xs text-destructive">{errors.raceDate}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="weekly-mileage">Current weekly mileage ({unitLabel(unit)})</Label>
              <Input
                id="weekly-mileage"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                placeholder={unit === "mi" ? "e.g. 15" : "e.g. 25"}
                value={weeklyMileage}
                onChange={(e) => setWeeklyMileage(e.target.value)}
                aria-invalid={errors.weeklyMileage ? true : undefined}
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground">
                Roughly how far you run in a typical week right now.
              </p>
              {errors.weeklyMileage && (
                <p className="text-xs text-destructive">{errors.weeklyMileage}</p>
              )}
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium leading-none">Experience level</legend>
              <div
                className="grid gap-2 sm:grid-cols-3"
                role="radiogroup"
                aria-label="Experience level"
              >
                {LEVELS.map((option) => {
                  const selected = level === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={submitting}
                      onClick={() => setLevel(option.value)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
                        selected ? "border-primary bg-primary/10" : "border-input hover:bg-accent",
                      )}
                    >
                      <span
                        className={cn(
                          "block text-sm font-semibold",
                          selected ? "text-primary" : "text-foreground",
                        )}
                      >
                        {option.title}
                      </span>
                      <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-2">
              <span className="text-sm font-medium leading-none">Preferred long-run day</span>
              <WeekdayPicker value={longRunDay} onChange={setLongRunDay} disabled={submitting} />
              <p className="text-xs text-muted-foreground">
                Your biggest run of the week lands here. Most runners pick Saturday or Sunday.
              </p>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" /> Building your plan…
                </>
              ) : (
                "Build my plan"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
