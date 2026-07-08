import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { LoggedRunDTO, PlanDTO, UserDTO } from "@/api/types";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { coachPostRunRecap } from "@/lib/aiCoach";

/**
 * Post-run recap (feature 2). Shown right after a run is logged: the coach
 * compares it to the planned workout and drops one actionable note. If the AI
 * coach isn't configured (no API key) or the call fails, it renders nothing so
 * the run log stays clean.
 */
export function CoachRunRecap({
  run,
  plan,
  runs,
  user,
  onDismiss,
}: {
  run: LoggedRunDTO;
  plan: PlanDTO | null;
  runs: LoggedRunDTO[];
  user: UserDTO | null;
  onDismiss: () => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    coachPostRunRecap({ run, plan, runs, user }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.configured && res.text) setText(res.text);
      else setHidden(true); // not configured or errored — don't clutter the log
    });
    return () => {
      cancelled = true;
    };
  }, [run, plan, runs, user]);

  if (hidden) return null;

  return (
    <Card className="mb-4 border-primary/25 bg-primary/5">
      <CardContent className="relative flex gap-3 py-4 pr-9">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-primary/80">
            Coach recap
          </p>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{text}</p>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss recap"
          onClick={onDismiss}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </CardContent>
    </Card>
  );
}
