import { AlertTriangle, CalendarCheck2, Gauge, Lightbulb, RotateCcw, Send, Sparkles, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { planApi, runsApi, statsApi } from "@/api";
import { CoachText } from "@/components/CoachText";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth";
import { useApi } from "@/hooks/use-api";
import {
  clearChatHistory,
  coachInsights,
  coachPlanAdjustment,
  coachRaceStrategy,
  coachWeeklyCheckIn,
  getCoachStatus,
  loadChatHistory,
  saveChatHistory,
  streamCoachChat,
  type ChatMessage,
  type CoachData,
  type CoachResult,
} from "@/lib/aiCoach";

const SUGGESTIONS = [
  "Explain today's workout",
  "How should I pace my long run?",
  "Any tips for tapering?",
  "How's my consistency looking?",
];

interface QuickAction {
  label: string;
  icon: typeof CalendarCheck2;
  userMessage: string;
  run: (data: CoachData) => Promise<CoachResult>;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Weekly check-in",
    icon: CalendarCheck2,
    userMessage: "How's my week going?",
    run: coachWeeklyCheckIn,
  },
  {
    label: "Race-day pacing plan",
    icon: Timer,
    userMessage: "Give me a race-day pacing plan.",
    run: coachRaceStrategy,
  },
  {
    label: "Training insights",
    icon: Lightbulb,
    userMessage: "Any insights on my recent training?",
    run: coachInsights,
  },
  {
    label: "I'm behind — help",
    icon: Gauge,
    userMessage: "I've fallen behind on my plan. How do I get back on track?",
    run: coachPlanAdjustment,
  },
];

export function CoachPage() {
  const { user, profile } = useAuth();
  const plan = useApi(() => planApi.get());
  const runs = useApi(() => runsApi.list());
  const stats = useApi(() => statsApi.get());
  const location = useLocation();
  const navigate = useNavigate();

  const ready = !plan.loading && !runs.loading && !stats.loading && stats.data !== null;
  const data: CoachData | null =
    ready && stats.data
      ? { plan: plan.data, stats: stats.data, runs: runs.data ?? [], user, profile }
      : null;

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [history, setHistory] = useState<ChatMessage[]>(() => loadChatHistory());
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seedConsumed = useRef(false);

  useEffect(() => {
    getCoachStatus().then(setConfigured);
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [history, streamingText, busy]);

  const persist = (next: ChatMessage[]) => {
    setHistory(next);
    saveChatHistory(next);
  };

  const sendChat = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy || !data) return;
    const next = [...history, { role: "user" as const, content: trimmed, ts: Date.now() }];
    persist(next);
    setInput("");
    setBusy(true);
    setStreamingText("");
    abortRef.current = new AbortController();
    const res = await streamCoachChat({
      history: next,
      data,
      signal: abortRef.current.signal,
      onDelta: (chunk) => setStreamingText((prev) => (prev ?? "") + chunk),
    });
    if (res.configured === false) setConfigured(false);
    const reply = res.text ?? "Sorry — I couldn't answer that just now. Please try again.";
    persist([...next, { role: "assistant", content: reply, ts: Date.now() }]);
    setStreamingText(null);
    setBusy(false);
  };

  const runQuickAction = async (action: QuickAction) => {
    if (busy || !data) return;
    const next = [...history, { role: "user" as const, content: action.userMessage, ts: Date.now() }];
    persist(next);
    setBusy(true);
    const res = await action.run(data);
    if (res.configured === false) setConfigured(false);
    const reply = res.text ?? "Sorry — I couldn't put that together right now. Please try again.";
    persist([...next, { role: "assistant", content: reply, ts: Date.now() }]);
    setBusy(false);
  };

  // Auto-send a prompt seeded from another page (e.g. "Ask coach about this run").
  useEffect(() => {
    const seed = (location.state as { seedPrompt?: string } | null)?.seedPrompt;
    if (seed && !seedConsumed.current && configured && data && !busy) {
      seedConsumed.current = true;
      navigate(location.pathname, { replace: true, state: {} });
      void sendChat(seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, data, location.state]);

  const startNewChat = () => {
    clearChatHistory();
    setHistory([]);
    setStreamingText(null);
  };

  return (
    <>
      <PageHeader
        title="Coach"
        description="Your AI running coach — grounded in your plan, runs, and progress."
        actions={
          history.length > 0 ? (
            <Button variant="outline" size="sm" onClick={startNewChat} disabled={busy}>
              <RotateCcw aria-hidden="true" /> New chat
            </Button>
          ) : undefined
        }
      />

      {configured === false ? (
        <EmptyState
          icon={Sparkles}
          title="AI coach not configured"
          description="Set an ANTHROPIC_API_KEY on the server to chat with your coach and unlock briefs, recaps, and pacing plans. The rest of the app works normally without it."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={!ready || busy || configured === null}
                onClick={() => void runQuickAction(action)}
              >
                <action.icon className="size-3.5" aria-hidden="true" />
                {action.label}
              </Button>
            ))}
          </div>

          {/* Thread */}
          <div
            ref={threadRef}
            className="min-h-[45vh] flex-1 space-y-3 overflow-y-auto rounded-lg border bg-card/40 p-3 sm:p-4"
          >
            {stats.error ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="size-4" aria-hidden="true" /> Couldn't load your data — the
                coach may lack context.
              </div>
            ) : null}

            {history.length === 0 && streamingText === null && !busy ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 py-10 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="size-5" aria-hidden="true" />
                </span>
                <div className="space-y-1">
                  <p className="font-medium">Ask your coach anything</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Today's session, pacing, tapering, how your week is going — it knows your real
                    plan and runs.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={!ready}
                      onClick={() => void sendChat(s)}
                      className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {history.map((m, i) => (
                  <MessageBubble key={i} message={m} />
                ))}
                {busy && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm border bg-background px-3.5 py-2 text-sm">
                      {streamingText ? (
                        <CoachText text={streamingText} className="leading-relaxed" />
                      ) : (
                        <span className="inline-flex gap-1 py-1" aria-label="Coach is thinking">
                          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                          <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Composer */}
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendChat(input);
                }
              }}
              rows={1}
              placeholder={ready ? "Ask your coach…" : "Loading your data…"}
              className="max-h-40 min-h-11 flex-1 resize-none"
              disabled={busy || !ready}
            />
            <Button
              size="icon"
              className="size-11 shrink-0"
              onClick={() => void sendChat(input)}
              disabled={busy || !ready || input.trim() === ""}
              aria-label="Send message"
            >
              <Send className="size-4" aria-hidden="true" />
            </Button>
          </div>

          {!ready && (
            <div className="space-y-2">
              <Skeleton className="h-3 w-40" />
            </div>
          )}
        </div>
      )}
    </>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground"
            : "max-w-[85%] rounded-2xl rounded-tl-sm border bg-background px-3.5 py-2 text-sm"
        }
      >
        {isUser ? message.content : <CoachText text={message.content} className="leading-relaxed" />}
      </div>
    </div>
  );
}
