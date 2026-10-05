"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Logo, LogoMark } from "@/components/logo";

type Question = {
  index: number;
  prompt: string;
  options: string[];
  skill: string;
  difficulty: number;
};

type Result = { level: string; correct: number; total: number };

const LEVEL_NAMES: Record<string, string> = {
  complete_beginner: "Complete beginner",
  beginner: "Beginner",
  elementary: "Elementary",
  intermediate: "Intermediate",
  upper_intermediate: "Upper-intermediate",
  advanced: "Advanced",
};

export function PlacementQuiz() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/placement")
      .then(async (res) => {
        if (!res.ok) throw new Error("failed");
        const data = (await res.json()) as { questions: Question[] };
        if (!cancelled) setQuestions(data.questions);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load the test. Please refresh.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function choose(optionIndex: number) {
    if (picked !== null) return;
    setPicked(optionIndex);
    const nextAnswers = [...answers];
    nextAnswers[current] = optionIndex;
    setAnswers(nextAnswers);

    const delay = current + 1 < (questions?.length ?? 0) ? 350 : 500;
    window.setTimeout(() => {
      if (current + 1 < (questions?.length ?? 0)) {
        setCurrent(current + 1);
        setPicked(null);
      } else {
        void submit(nextAnswers);
      }
    }, delay);
  }

  async function submit(finalAnswers: number[]) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: finalAnswers }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        level?: string;
        correct?: number;
        total?: number;
      };
      if (!res.ok) {
        setSubmitError(data.error ?? "Could not submit the test.");
        return;
      }
      setResult({ level: data.level ?? "intermediate", correct: data.correct ?? 0, total: data.total ?? 0 });
    } catch {
      setSubmitError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center px-6 text-sm text-destructive">
        {loadError}
      </div>
    );
  }

  if (!questions) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-3 px-6">
        <LogoMark className="size-9 rounded-lg" />
        <p className="text-sm text-muted-foreground">Loading test…</p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <TestHeader />
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10 sm:px-6">
          <div className="animate-scale-in rounded-2xl border border-border bg-card p-6 text-center shadow-xs">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-gradient-to-br from-[var(--brand-1)] via-[var(--brand-2)] to-[var(--brand-3)] text-white shadow-sm">
              <Target className="size-5" />
            </span>
            <p className="mt-4 text-eyebrow">Your level</p>
            <h1 className="text-h1 mt-2">{LEVEL_NAMES[result.level] ?? result.level}</h1>
            <p className="mx-auto mt-3 max-w-sm text-[15px]/[17px] text-muted-foreground">
              You answered {result.correct} of {result.total} correctly. Your plan starts here and
              adapts as you go.
            </p>
            <div className="mt-6">
              <Button size="lg" className="w-full" onClick={() => { router.push("/dashboard"); router.refresh(); }}>
                Go to my dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const progress = Math.round((current / questions.length) * 100);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TestHeader />
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-8 sm:px-6">
        <div className="mb-6 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-eyebrow">English assessment</span>
            <span className="font-mono text-eyebrow tabular-nums">
              Question {current + 1} of {questions.length}
            </span>
          </div>
          <Progress
            value={progress}
            className="[&_[data-slot=progress-track]]:h-1.5"
          />
        </div>

        <div className="animate-fade-in rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <p className="text-eyebrow">{q.skill}</p>
          <h1 className="text-h2 mt-2 text-balance">{q.prompt}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Pick the best answer — no time limit.</p>

          <div className="mt-5 space-y-2" role="group" aria-label="Answer options">
            {q.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => choose(i)}
                disabled={picked !== null || submitting}
                aria-pressed={picked === i}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm transition-colors ${
                  picked === i
                    ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/25"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                <span
                  className={`grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-semibold ${
                    picked === i
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {picked === i ? <Check className="size-3" /> : String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0">{opt}</span>
              </button>
            ))}
            {submitError && <p className="pt-1 text-sm text-destructive">{submitError}</p>}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
            <p className="text-xs text-muted-foreground">
              {submitting ? "Scoring your test…" : "Questions get harder as you answer."}
            </p>
            <span className="font-mono text-eyebrow tabular-nums">
              {current + 1} / {questions.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TestHeader() {
  return (
    <header className="border-b border-border/50 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
        <Logo href="/dashboard" />
        <span className="text-eyebrow">Placement</span>
      </div>
    </header>
  );
}
