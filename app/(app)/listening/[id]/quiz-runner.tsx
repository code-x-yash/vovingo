"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, X } from "lucide-react";

export type RunnerQuestion = {
  id: number;
  type: string;
  prompt: string;
  options: string[];
};

export type RunnerSegment = { text: string };

type ResultRow = {
  questionId: number;
  correct: boolean;
  correctIndex: number;
  explanation: string;
};

type SubmitResult = {
  score: number;
  correctCount: number;
  total: number;
  results: ResultRow[];
  planXp: number;
  skill: number;
  wordsAdded: number;
};

const TYPE_LABEL: Record<string, string> = {
  main_idea: "Main idea",
  detail: "Detail",
  inference: "Inference",
  vocabulary: "Vocabulary",
  speaker: "Speaker",
};

export function QuizRunner({
  podcastId,
  questions,
  transcript,
}: {
  podcastId: number;
  questions: RunnerQuestion[];
  transcript: RunnerSegment[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    questions.map(() => null)
  );
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answered = answers.filter((a) => a !== null).length;
  const ready = answered === questions.length && questions.length > 0;
  const progressPct =
    questions.length > 0 ? Math.round((answered / questions.length) * 100) : 0;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/listening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ podcastId, answers }),
      });
      const data = (await res.json().catch(() => ({}))) as SubmitResult & { error?: string };
      if (!res.ok || typeof data.score !== "number") {
        setError(data.error ?? "Could not submit — try again.");
        return;
      }
      setResult({
        score: data.score,
        correctCount: data.correctCount,
        total: data.total,
        results: data.results,
        planXp: data.planXp,
        skill: data.skill,
        wordsAdded: data.wordsAdded,
      });
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const byId = new Map(questions.map((q) => [q.id, q]));
    return (
      <div className="space-y-6">
        <section className="animate-scale-in overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-b from-primary/10 to-transparent p-5 shadow-xs sm:p-6">
          <p className="text-eyebrow">Your result</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-gradient text-4xl font-semibold tabular-nums">
              {result.score}%
            </span>
            <span className="text-sm text-muted-foreground">
              {result.correctCount}/{result.total} correct · listening skill{" "}
              {Math.round(result.skill)}
            </span>
          </div>
          {(result.planXp > 0 || result.wordsAdded > 0) && (
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
              {result.planXp > 0 && (
                <span className="rounded-full border border-primary/40 px-2.5 py-0.5 text-primary">
                  +{result.planXp} XP from today&apos;s plan
                </span>
              )}
              {result.wordsAdded > 0 && (
                <span className="rounded-full border border-border px-2.5 py-0.5">
                  +{result.wordsAdded} word{result.wordsAdded === 1 ? "" : "s"} added to your
                  deck
                </span>
              )}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-eyebrow">Question review</h2>
          <div className="mt-3 space-y-3">
            {questions.map((q, i) => {
              const r = result.results[i];
              const q2 = r ? byId.get(r.questionId) : undefined;
              if (!r || !q2) return null;
              return (
                <div
                  key={q.id}
                  className={`animate-fade-in rounded-2xl border bg-card p-4 shadow-xs sm:p-5 ${
                    r.correct ? "border-success/30" : "border-destructive/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${
                        r.correct ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {r.correct ? (
                        <Check className="size-3.5" />
                      ) : (
                        <X className="size-3.5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-eyebrow">{TYPE_LABEL[q2.type] ?? q2.type}</p>
                      <p className="mt-2 text-[15px] leading-snug font-medium">{q2.prompt}</p>
                      <p className="mt-2 text-sm">
                        <span className={r.correct ? "text-success" : "text-destructive"}>
                          Your answer:{" "}
                          {answers[i] !== null ? q2.options[answers[i]!] : "—"}
                        </span>
                      </p>
                      {!r.correct && (
                        <p className="text-sm text-muted-foreground">
                          Correct: {q2.options[r.correctIndex] ?? "—"}
                        </p>
                      )}
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {r.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {transcript.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
            <h2 className="text-eyebrow">Transcript</h2>
            <div className="divider-fade mt-3" />
            <div className="mt-4 space-y-3 text-[15px] leading-relaxed">
              {transcript.map((s, i) => (
                <p
                  key={i}
                  className={`rounded-lg px-3 -mx-3 py-1.5 transition-colors hover:bg-muted/50 ${
                    i === 0 ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.text}
                </p>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/listening" />}>More episodes</Button>
          <Button variant="outline" render={<Link href="/vocab/review" />}>
            Review added words
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-up space-y-3">
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Listen to the episode in your player, then answer — the transcript unlocks after
          you submit. {answered}/{questions.length} answered.
        </p>
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-eyebrow">Progress</span>
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {answered}/{questions.length}
            </span>
          </div>
          <Progress
            value={progressPct}
            className="mt-2.5 h-1.5 [&_[data-slot=progress-track]]:h-1.5"
          />
        </div>
      </div>

      <div className="animate-fade-in space-y-4">
        {questions.map((q, qi) => {
          const done = answers[qi] !== null;
          return (
            <section
              key={q.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-eyebrow">
                  Question {qi + 1} / {questions.length} · {TYPE_LABEL[q.type] ?? q.type}
                </p>
                {done && <Check className="size-4 shrink-0 text-success" aria-hidden />}
              </div>

              <p className="mt-3 text-[17px] leading-snug font-medium">{q.prompt}</p>

              <div className="mt-4 grid gap-2">
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  return (
                    <button
                      key={oi}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))
                      }
                      className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                        selected
                          ? "border-primary bg-primary/5 font-medium ring-1 ring-primary/40"
                          : "border-border hover:border-primary/40 hover:bg-muted/70"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!ready || busy} onClick={() => void submit()}>
          {busy ? "Checking…" : "Submit answers"}
        </Button>
        {questions.length > 0 && !ready && (
          <span className="text-sm text-muted-foreground">
            Answer every question to submit.
          </span>
        )}
      </div>
    </div>
  );
}
