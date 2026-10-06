"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Timer, Trophy, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MODE_META, ROUND_SIZE, type SpeedrunMode } from "@/lib/speedrun/bank";

type Question = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  why?: string;
};

type Phase = "pick" | "running" | "done";

type Best = { correct: number; total: number; scoreMs: number } | null;

const MODES: SpeedrunMode[] = ["vocab", "grammar", "tone"];

export function SpeedrunGame() {
  const [phase, setPhase] = useState<Phase>("pick");
  const [mode, setMode] = useState<SpeedrunMode | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [seconds, setSeconds] = useState(6);
  const [best, setBest] = useState<Best>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [remaining, setRemaining] = useState(seconds * 1000);
  const [result, setResult] = useState<{ correct: number; xp: number } | null>(null);
  const elapsedRef = useRef(0);
  const questionStartRef = useRef(0);
  const lockedRef = useRef(false);

  async function start(chosen: SpeedrunMode) {
    setMode(chosen);
    setPhase("running");
    setIndex(0);
    setPicked(null);
    setCorrectCount(0);
    setResult(null);
    elapsedRef.current = 0;
    lockedRef.current = false;
    try {
      const res = await fetch(`/api/speedrun?mode=${chosen}`);
      const data = (await res.json().catch(() => null)) as {
        questions?: Question[];
        seconds?: number;
        best?: Best;
        error?: string;
      } | null;
      if (!res.ok || !data?.questions?.length) {
        toast.error(data?.error ?? "Could not load a round.");
        setPhase("pick");
        return;
      }
      setQuestions(data.questions);
      setSeconds(data.seconds ?? 6);
      setRemaining((data.seconds ?? 6) * 1000);
      setBest(data.best ?? null);
    } catch {
      toast.error("Network error — try again.");
      setPhase("pick");
    }
  }

  // Countdown for the current question.
  useEffect(() => {
    if (phase !== "running" || questions.length === 0) return;
    const tickMs = 100;
    const id = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - tickMs));
    }, tickMs);
    return () => clearInterval(id);
  }, [phase, questions.length, index]);

  // Anchor the clock when a round's questions arrive or the question advances.
  useEffect(() => {
    if (phase !== "running" || questions.length === 0) return;
    questionStartRef.current = Date.now();
  }, [phase, index, questions.length]);

  async function finish(finalCorrect: number, totalMs: number) {
    setPhase("done");
    if (!mode) return;
    const scoreMs = Math.max(5_000, Math.min(600_000, Math.round(totalMs)));
    try {
      const res = await fetch("/api/speedrun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, correct: finalCorrect, total: ROUND_SIZE, scoreMs }),
      });
      const data = (await res.json().catch(() => ({}))) as { xp?: number; error?: string };
      if (res.ok) {
        setResult({ correct: finalCorrect, xp: data.xp ?? 0 });
        if (data.xp) toast.success(`+${data.xp} XP banked`);
      } else {
        setResult({ correct: finalCorrect, xp: 0 });
        toast.error(data.error ?? "Run couldn't be scored.");
      }
    } catch {
      setResult({ correct: finalCorrect, xp: 0 });
      toast.error("Network error — run not saved.");
    }
  }

  function advance(choice: number | null, timedOut = false) {
    if (lockedRef.current || questions.length === 0) return;
    lockedRef.current = true;
    const q = questions[index];
    const isCorrect = choice !== null && choice === q.correctIndex && !timedOut;
    const used = Math.min(seconds * 1000, Date.now() - questionStartRef.current);
    const total = elapsedRef.current + used;
    const nextCorrect = correctCount + (isCorrect ? 1 : 0);
    setCorrectCount(nextCorrect);
    setPicked(choice);
    elapsedRef.current = total;

    setTimeout(() => {
      const next = index + 1;
      if (next >= questions.length) {
        void finish(nextCorrect, total);
        return;
      }
      setIndex(next);
      setPicked(null);
      setRemaining(seconds * 1000);
      questionStartRef.current = Date.now();
      lockedRef.current = false;
    }, 900);
  }

  // Timeout → count as wrong.
  useEffect(() => {
    if (phase === "running" && remaining <= 0 && !lockedRef.current) {
      advance(null, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, phase]);

  if (phase === "pick") {
    return (
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {MODES.map((m) => {
          const meta = MODE_META[m];
          return (
            <button
              key={m}
              type="button"
              onClick={() => void start(m)}
              className="interactive-card rounded-2xl border border-border bg-card p-5 text-left shadow-xs"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Zap className="size-[18px]" />
              </span>
              <p className="mt-3 text-[15px] font-semibold">{meta.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{meta.blurb}</p>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Timer className="size-3.5" /> {secondsFor(m)}s per question · {ROUND_SIZE} questions
              </p>
            </button>
          );
        })}
        {best && (
          <p className="text-xs text-muted-foreground sm:col-span-3">
            Your best: {best.correct}/{best.total} in {(best.scoreMs / 1000).toFixed(1)}s
          </p>
        )}
      </div>
    );
  }

  if (phase === "done") {
    const score = result?.correct ?? correctCount;
    return (
      <div className="animate-fade-in mt-6 rounded-2xl border border-border bg-card p-6 text-center shadow-xs">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-gradient-to-br from-[var(--brand-1)] to-[var(--brand-2)] text-white">
          <Trophy className="size-5" />
        </span>
        <p className="text-display text-gradient mt-4 tabular-nums">
          {score}/{ROUND_SIZE}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {score === ROUND_SIZE
            ? "Perfect run — the clock never stood a chance."
            : score >= 7
              ? "Sharp round. One more to clean up."
              : "Warming up — the bank reshuffles every run."}
        </p>
        {result && result.xp > 0 && (
          <p className="mt-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            +{result.xp} XP
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => mode && void start(mode)}
            disabled={result === null}
          >
            Run it back
          </Button>
          <Button variant="outline" onClick={() => setPhase("pick")}>
            Change mode
          </Button>
        </div>
      </div>
    );
  }

  const q = questions[index];
  if (!q) return null;
  const pct = (remaining / (seconds * 1000)) * 100;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-eyebrow">
          {MODE_META[mode ?? "vocab"].label} · {index + 1}/{ROUND_SIZE}
        </span>
        <span className="font-medium tabular-nums text-muted-foreground">
          {correctCount} correct
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
            pct > 30
              ? "bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-2)]"
              : "bg-destructive"
          }`}
          style={{ width: `${Math.max(0, pct)}%` }}
        />
      </div>

      <p className="mt-5 text-h3">
        {mode === "grammar" ? q.prompt : `“${q.prompt}”`}
      </p>

      <div className="mt-4 grid gap-2.5">
        {q.options.map((option, i) => {
          const revealed = picked !== null;
          const isCorrect = i === q.correctIndex;
          const isPicked = i === picked;
          return (
            <button
              key={`${q.id}-${i}`}
              type="button"
              disabled={revealed}
              onClick={() => advance(i)}
              className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                revealed && isCorrect
                  ? "border-success/50 bg-success/10"
                  : revealed && isPicked
                    ? "border-destructive/50 bg-destructive/10"
                    : "border-border/70 bg-background/60 hover:bg-muted/70"
              }`}
            >
              <span className="mt-0.5 shrink-0">
                {revealed && isCorrect ? (
                  <Check className="size-4 text-success" />
                ) : revealed && isPicked ? (
                  <X className="size-4 text-destructive" />
                ) : null}
              </span>
              <span className="min-w-0">{option}</span>
            </button>
          );
        })}
      </div>

      {picked !== null && q.why && (
        <p className="mt-4 rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-2.5 text-xs text-muted-foreground">
          {q.why}
        </p>
      )}
    </div>
  );
}

function secondsFor(mode: SpeedrunMode): number {
  return MODE_META[mode].seconds;
}
