import {
  CalendarCheck2,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { planApi, runsApi } from "@/api";
import type { PlanDTO, ProfileDTO, StatsDTO, UserDTO } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth";
import { useApi } from "@/hooks/use-api";
import {
  coachChat,
  coachDailyBrief,
  coachPlanChange,
  coachWeeklyCheckIn,
  dismissPlanReasoning,
  loadChatHistory,
  saveChatHistory,
  type ChatMessage,
  type CoachData,
  type CoachResult,
} from "@/lib/aiCoach";

/**
 * Dashboard surface for the AI coach. On load it fetches a grounded daily brief
 * (with any fatigue caution / milestone / taper tone woven in server-side),
 * detects a freshly regenerated plan and explains the change, and offers a
 * weekly check-in plus a conversational chat. All calls go through
 * `src/lib/aiCoach.ts` → the `/api/coach` backend; nothing here touches the model.
 */
export function CoachCard({ stats }: { stats: StatsDTO }) {
  const { user, profile } = useAuth();
  const plan = useApi(() => planApi.get());
  const runs = useApi(() => runsApi.list());

  const ready = !plan.loading && !runs.loading;
  const data: CoachData | null = ready
    ? { plan: plan.data, stats, runs: runs.data ?? [], user, profile }
    : null;

  // Daily brief -------------------------------------------------------------
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
    // Re-run when the underlying data changes or the user asks for a fresh brief.
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
        {/* Daily brief */}
        {briefLoading && brief === null ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ) : brief?.text ? (
          <p className="text-sm leading-relaxed">{brief.text}</p>
        ) : brief?.error ? (
          <CoachError message="Couldn't reach the coach right now." onRetry={() => setReloadTick((t) => t + 1)} />
        ) : null}

        {plan.data && (
          <PlanChangeNote plan={plan.data} profile={profile} user={user} />
        )}

        {data && configured === true && (
          <CoachActions data={data} />
        )}
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

function CoachError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <p className="text-sm text-muted-foreground">
      {message}{" "}
      <button
        type="button"
        onClick={onRetry}
        className="text-primary underline-offset-4 hover:underline"
      >
        Try again
      </button>
    </p>
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
      <p className="leading-relaxed">{text}</p>
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

/** Weekly check-in (feature 3) + coach chat (feature 5). */
function CoachActions({ data }: { data: CoachData }) {
  const [weekly, setWeekly] = useState<CoachResult | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

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
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setChatOpen((v) => !v)}
        >
          <MessageCircle className="size-3.5" aria-hidden="true" />
          {chatOpen ? "Hide chat" : "Ask the coach"}
        </Button>
      </div>

      {weekly?.text && (
        <p className="rounded-md border border-primary/20 bg-background/60 px-3 py-2 text-sm leading-relaxed">
          {weekly.text}
        </p>
      )}
      {weekly && !weekly.text && (
        <p className="text-sm text-muted-foreground">Couldn't load your check-in right now.</p>
      )}

      {chatOpen && <CoachChat data={data} />}
    </div>
  );
}

function CoachChat({ data }: { data: CoachData }) {
  const [history, setHistory] = useState<ChatMessage[]>(() => loadChatHistory());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [history, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const userMsg: ChatMessage = { role: "user", content: text, ts: Date.now() };
    const next = [...history, userMsg];
    setHistory(next);
    saveChatHistory(next);
    setInput("");
    setSending(true);
    const res = await coachChat({ history: next, data });
    const reply: ChatMessage = {
      role: "assistant",
      content: res.text ?? "Sorry — I couldn't answer that just now. Please try again.",
      ts: Date.now(),
    };
    const withReply = [...next, reply];
    setHistory(withReply);
    saveChatHistory(withReply);
    setSending(false);
  };

  return (
    <div className="space-y-2">
      <div
        ref={threadRef}
        className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-primary/15 bg-background/40 p-2"
      >
        {history.length === 0 && !sending ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            Ask about today's session, your pacing, tapering, or how your week is going.
          </p>
        ) : (
          history.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <span
                className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-1.5 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background"
                }`}
              >
                {m.content}
              </span>
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Coach is thinking…
            </span>
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder="Ask your coach…"
          className="min-h-9 flex-1 resize-none"
          disabled={sending}
        />
        <Button
          size="icon"
          className="size-9 shrink-0"
          onClick={() => void send()}
          disabled={sending || input.trim() === ""}
          aria-label="Send message"
        >
          <Send className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
