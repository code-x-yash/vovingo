"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, ChevronRight, X } from "lucide-react";

export type RunnerQuestion = {
  id: number;
  kind: "choose_correct" | "spot_wrong" | "why";
  prompt: string;
  options: string[];
};

type ServerResult = { correct: boolean; correctIndex: number; explanation: string };

type Outcome = {
  ok: true;
  results: ServerResult[];
  correctCount: number;
  total: number;
  score: number;
  practiceCount: number;
  trend: "new" | "stable" | "improving" | "worsening";
  status: "active" | "needs_practice" | "improving" | "resolved";
  planXp: number;
};

type Props = {
  mistakeId: number;
  questions: RunnerQuestion[];
};

const TREND_LABEL: Record<string, string> = {
  new: "New",
  stable: "Stable",
  improving: "Improving",
  worsening: "Worsening",
};

export function PracticeRunner({ mistakeId, questions }: Props) {
  const total = questions.length;
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<(number | null)[]>(() => questions.map(() => null));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Not enough catalog examples for a quiz — use the speaking prompts below instead.
      </p>
    );
  }

  if (outcome) {
    return (
      <div className="space-y-5">
        <div className="animate-scale-in rounded-2xl border border-primary/40 bg-gradient-to-b from-primary/10 to-transparent p-4 shadow-xs sm:p-5">
          <p className="text-eyebrow">Your result</p>
          <p className="mt-2.5 flex items-center gap-2 text-h3">
            <Check className="size-5 text-success" />
            {outcome.correctCount} / {outcome.total} correct · {outcome.score}%
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Pattern practised {outcome.practiceCount}× · trend:{" "}
            {TREND_LABEL[outcome.trend] ?? outcome.trend}.
            {outcome.planXp > 0 && <> +{outcome.planXp} XP from your daily plan.</>}
          </p>
        </div>

        <ol className="space-y-3">
          {questions.map((q, i) => {
            const r = outcome.results[i];
            if (!r) return null;
            const yourChoice = picks[i];
            const correctChoice = r.correctIndex;
            return (
              <li
                key={q.id}
                className={`animate-fade-in rounded-2xl border bg-card p-4 shadow-xs ${
                  r.correct ? "border-success/30" : "border-destructive/30"
                }`}
              >
                <p className="flex items-center gap-2 text-sm font-medium">
                  {r.correct ? (
                    <>
                      <Check className="size-4 shrink-0 text-success" /> Correct
                    </>
                  ) : (
                    <>
                      <X className="size-4 shrink-0 text-destructive" /> Not quite
                    </>
                  )}
                  <span className="text-eyebrow ml-auto">Q{i + 1}</span>
                </p>
                {!r.correct && typeof yourChoice === "number" && (
                  <p className="mt-1.5 text-sm text-destructive">
                    You chose: {q.options[yourChoice] ?? "—"}
                  </p>
                )}
                <p className="mt-1.5 text-sm text-success">
                  Correct: {q.options[correctChoice] ?? "—"}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {r.explanation}
                </p>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/mistakes" />}>All patterns</Button>
          <Button variant="outline" render={<Link href="/speaking" />}>
            Practise speaking
          </Button>
          <Button variant="ghost" render={<Link href="/dashboard" />}>
            Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const q = questions[step];
  if (!q) return null;
  const pick = picks[step];
  const pct = Math.round((step / total) * 100);

  async function finish() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mistakeId,
          answers: picks.map((p) => p ?? null),
          durationSec:
            startedAt.current === null
              ? 0
              : Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string } & Partial<Outcome>;
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not save your practice.");
        return;
      }
      setOutcome(data as Outcome);
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    setError(null);
    if (step + 1 >= total) {
      void finish();
      return;
    }
    setStep((s) => s + 1);
  }

  const isLast = step + 1 >= total;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-eyebrow">
            Question {step + 1} / {total}
          </span>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">{pct}%</span>
        </div>
        <Progress value={pct} className="mt-2.5 h-1.5 [&_[data-slot=progress-track]]:h-1.5" />
      </div>

      <div key={step} className="animate-fade-in space-y-4">
        <p className="text-[17px] leading-snug font-medium">{q.prompt}</p>
        <div className="grid gap-2">
          {q.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={pick === i}
              onClick={() =>
                setPicks((prev) => {
                  const nextPicks = [...prev];
                  nextPicks[step] = i;
                  return nextPicks;
                })
              }
              className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                pick === i
                  ? "border-primary bg-primary/5 font-medium ring-1 ring-primary/40"
                  : "border-border hover:border-primary/40 hover:bg-muted/70"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          {isLast ? "You'll see feedback on the next screen." : "Pick an answer to continue."}
        </p>
        <Button disabled={pick === null || submitting} onClick={next}>
          {submitting ? "Saving…" : isLast ? "See results" : "Next"}
          {!submitting && <ChevronRight className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
