"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { isQuotaWall, Paywall } from "@/components/billing/paywall";
import { Check, ChevronRight, RotateCcw, X } from "lucide-react";

export type RunnerExercise = {
  id: number;
  type: "mcq" | "fill_blank" | "reorder" | "match" | "speak" | "write" | "choose_natural";
  skill: string;
  prompt: Record<string, unknown>;
  options: string[] | null;
  blankCount: number;
  hasAnswer: boolean;
};

type Checked = {
  correct: boolean | null;
  feedback: string;
  expected: string[] | null;
};

type ProgressView = {
  answered: number;
  total: number;
  completed: boolean;
  score: number | null;
};

type Props = {
  lesson: { slug: string; title: string; nextSlug: string | null };
  exercises: RunnerExercise[];
  initial: ProgressView;
  priorBest: Record<number, boolean>;
};

function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = (seed >>> 0) || 1;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (a.length > 1 && a.every((v, i) => v === arr[i])) {
    a.push(a.shift() as T);
  }
  return a;
}

function sentenceParts(ex: RunnerExercise): string[] {
  const s = typeof ex.prompt.sentence === "string" ? ex.prompt.sentence : "";
  const parts = s.split(/_{3,}/);
  const holes = Math.max(parts.length - 1, ex.blankCount, 1);
  while (parts.length < holes + 1) parts.splice(parts.length - 1, 0, "");
  return parts;
}

function wordsOf(ex: RunnerExercise): string[] {
  const w = ex.prompt.words;
  return Array.isArray(w) ? (w as string[]) : [];
}

export function LessonRunner({ lesson, exercises, initial, priorBest }: Props) {
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState<Record<number, Checked>>({});
  const [mcqPick, setMcqPick] = useState<Record<number, string>>({});
  const [fills, setFills] = useState<Record<number, string[]>>({});
  const [reorder, setReorder] = useState<Record<number, { bank: string[]; seq: string[] }>>({});
  const [openText, setOpenText] = useState<Record<number, string>>({});
  const [progress, setProgress] = useState<ProgressView>(initial);
  const [planXp, setPlanXp] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const total = exercises.length;
  const sessionGraded = exercises.filter((ex) => hasAnswer(ex) && checked[ex.id]);
  const sessionCorrect = sessionGraded.filter((ex) => checked[ex.id].correct === true).length;
  const finished = step >= total;

  function hasAnswer(ex: RunnerExercise): boolean {
    return ex.hasAnswer;
  }

  function fillState(ex: RunnerExercise): string[] {
    const existing = fills[ex.id];
    if (existing) return existing;
    return new Array(Math.max(ex.blankCount, sentenceParts(ex).length - 1)).fill("");
  }

  function reorderState(ex: RunnerExercise) {
    const existing = reorder[ex.id];
    if (existing) return existing;
    const bank = shuffleWithSeed(wordsOf(ex), ex.id);
    return { bank, seq: [] as string[] };
  }

  async function submit(ex: RunnerExercise, response: string | string[]) {
    if (busy || checked[ex.id]) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/lessons/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId: ex.id, response }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        correct?: boolean | null;
        feedback?: string;
        expected?: string[] | null;
        progress?: ProgressView;
        planXp?: number;
      };
      if (!res.ok) {
        if (isQuotaWall(res.status, data)) {
          setPaywallOpen(true);
          return;
        }
        setError(data.error ?? "Could not save your answer.");
        return;
      }
      setChecked((prev) => ({
        ...prev,
        [ex.id]: {
          correct: data.correct ?? null,
          feedback: data.feedback ?? "",
          expected: data.expected ?? null,
        },
      }));
      if (data.progress) setProgress(data.progress);
      const xp = data.planXp ?? 0;
      if (xp > 0) setPlanXp((p) => p + xp);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  function reset(ex: RunnerExercise) {
    setChecked((prev) => {
      const next = { ...prev };
      delete next[ex.id];
      return next;
    });
    if (ex.type === "reorder" || ex.type === "match") {
      setReorder((prev) => {
        const next = { ...prev };
        delete next[ex.id];
        return next;
      });
    }
    setError(null);
  }

  if (total === 0) {
    return (
      <section className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        This lesson has no exercises yet — read the theory above and continue.
      </section>
    );
  }

  if (finished) {
    const completed = progress.completed;
    return (
      <section className="animate-scale-in overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-b from-primary/8 to-transparent p-6 text-center shadow-xs">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-md">
          <Check className="size-7" strokeWidth={2.5} />
        </span>
        <h2 className="text-h2 mt-4">
          {completed ? "Lesson complete" : "Session saved"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          You answered {sessionCorrect} of {sessionGraded.length} graded questions correctly this
          round.
          {progress.score != null && <> Lesson score: {progress.score}%.</>}
          {planXp > 0 && <> +{planXp} XP from your daily plan.</>}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {lesson.nextSlug && (
            <Button render={<Link href={`/lessons/${lesson.nextSlug}`} />} size="lg">
              Next lesson
              <ChevronRight className="size-4" />
            </Button>
          )}
          <Button variant="outline" size="lg" render={<Link href="/lessons" />}>
            All lessons
          </Button>
          <Button variant="ghost" size="lg" render={<Link href="/dashboard" />}>
            Dashboard
          </Button>
        </div>
      </section>
    );
  }

  const ex = exercises[step];
  if (!ex) return null;
  const result = checked[ex.id];
  const pct = Math.round((step / total) * 100);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
      <div className="mb-5 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-eyebrow">
            Exercise {step + 1} / {total} · {ex.skill}
          </span>
          <span className="font-medium text-muted-foreground tabular-nums">{pct}%</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>

      <div className="space-y-5">
        <div className="animate-fade-in">
          <ExerciseBody
            ex={ex}
            result={result}
            mcqPick={mcqPick[ex.id]}
            onMcqPick={(v) => setMcqPick((p) => ({ ...p, [ex.id]: v }))}
            fills={fillState(ex)}
            onFill={(i, v) =>
              setFills((p) => {
                const arr = fillState(ex).map((f, j) => (j === i ? v : f));
                return { ...p, [ex.id]: arr };
              })
            }
            reorder={reorderState(ex)}
            onReorder={(next) => setReorder((p) => ({ ...p, [ex.id]: next }))}
            openText={openText[ex.id] ?? ""}
            onOpenText={(v) => setOpenText((p) => ({ ...p, [ex.id]: v }))}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {result && (
          <div
            className={`animate-fade-in rounded-xl border p-3.5 text-sm ${
              result.correct === true
                ? "border-primary/50 bg-primary/10"
                : result.correct === false
                  ? "border-destructive/50 bg-destructive/10"
                  : "border-border bg-muted/60"
            }`}
          >
            <p className="flex items-center gap-2 font-medium">
              {result.correct === true && (
                <>
                  <Check className="size-4 text-primary" /> Correct
                </>
              )}
              {result.correct === false && (
                <>
                  <X className="size-4 text-destructive" /> Not quite
                </>
              )}
              {result.correct === null && <>Submitted</>}
            </p>
            {result.expected && result.expected.length > 0 && (
              <p className="mt-1.5">
                <span className="text-muted-foreground">Answer: </span>
                {result.expected.join(" → ")}
              </p>
            )}
            <p className="mt-1 text-muted-foreground">{result.feedback}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          {result ? (
            <>
              <button
                type="button"
                onClick={() => reset(ex)}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw className="size-3.5" /> Try again
              </button>
              <Button onClick={() => { setError(null); setStep((s) => s + 1); }}>
                {step + 1 === total ? "Finish" : "Next"} <ChevronRight className="size-4" />
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              {priorBest[ex.id] ? "Answered correctly before — practice again if you like." : ""}
            </span>
          )}
          {!result && (
            <SubmitButton ex={ex} busy={busy} onSubmit={submit} mcqPick={mcqPick[ex.id]} fills={fillState(ex)} reorder={reorderState(ex)} openText={openText[ex.id] ?? ""} />
          )}
        </div>
      </div>
      <Paywall open={paywallOpen} onOpenChange={setPaywallOpen} metric="lessons" />
    </section>
  );
}

function SubmitButton({
  ex,
  busy,
  onSubmit,
  mcqPick,
  fills,
  reorder,
  openText,
}: {
  ex: RunnerExercise;
  busy: boolean;
  onSubmit: (ex: RunnerExercise, response: string | string[]) => void;
  mcqPick?: string;
  fills: string[];
  reorder: { bank: string[]; seq: string[] };
  openText: string;
}) {
  let disabled = busy;
  let response: string | string[] | null = null;

  switch (ex.type) {
    case "mcq":
    case "choose_natural":
      response = mcqPick ?? null;
      disabled = disabled || !response;
      break;
    case "fill_blank":
      response = fills;
      disabled = disabled || fills.every((f) => f.trim() === "");
      break;
    case "reorder":
    case "match":
      response = reorder.seq;
      disabled = disabled || reorder.seq.length === 0;
      break;
    case "write":
    case "speak":
      response = openText.trim() || (typeof ex.prompt.target === "string" ? ex.prompt.target : "");
      if (ex.type === "speak") response = (openText.trim() || ex.prompt.target || "practised") as string;
      disabled = disabled || String(response ?? "").trim() === "";
      break;
  }

  return (
    <Button
      disabled={disabled}
      onClick={() => response !== null && onSubmit(ex, response)}
    >
      {busy ? "Checking…" : "Check answer"}
    </Button>
  );
}

function ExerciseBody({
  ex,
  result,
  mcqPick,
  onMcqPick,
  fills,
  onFill,
  reorder,
  onReorder,
  openText,
  onOpenText,
}: {
  ex: RunnerExercise;
  result?: Checked;
  mcqPick?: string;
  onMcqPick: (v: string) => void;
  fills: string[];
  onFill: (i: number, v: string) => void;
  reorder: { bank: string[]; seq: string[] };
  onReorder: (next: { bank: string[]; seq: string[] }) => void;
  openText: string;
  onOpenText: (v: string) => void;
}) {
  const question = typeof ex.prompt.question === "string" ? ex.prompt.question : null;
  const instruction = typeof ex.prompt.instruction === "string" ? ex.prompt.instruction : null;
  const target = typeof ex.prompt.target === "string" ? ex.prompt.target : null;
  const hint = typeof ex.prompt.hint === "string" ? ex.prompt.hint : null;
  const topic = typeof ex.prompt.topic === "string" ? ex.prompt.topic : null;
  const minWords = typeof ex.prompt.minWords === "number" ? ex.prompt.minWords : null;
  const checked = Boolean(result);

  if (ex.type === "mcq" || ex.type === "choose_natural") {
    const options = ex.options ?? [];
    const expectedFirst = result?.expected?.[0];
    return (
      <div className="space-y-3">
        <p className="text-[17px] leading-snug font-medium">
          {question ?? "Choose the correct option."}
        </p>
        <div className="grid gap-2">
          {options.map((opt, i) => {
            const picked = mcqPick === opt;
            const isExpected = checked && expectedFirst === opt;
            const isPickedWrong = checked && picked && !isExpected && result?.correct === false;
            return (
              <button
                key={i}
                type="button"
                disabled={checked}
                onClick={() => onMcqPick(opt)}
                className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                  isExpected
                    ? "border-primary bg-primary/10"
                    : isPickedWrong
                      ? "border-destructive bg-destructive/10"
                      : picked
                        ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                        : "border-border hover:border-primary/40 hover:bg-muted/70"
                }`}
              >
                <span className="mr-2 font-mono text-xs text-muted-foreground">
                  {String.fromCharCode(97 + i)}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (ex.type === "fill_blank") {
    const parts = sentenceParts(ex);
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Fill in the blank{parts.length > 2 ? "s" : ""}.</p>
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm leading-relaxed">
          {parts.map((part, i) => (
            <span key={i} className="contents">
              <span>{part}</span>
              {i < parts.length - 1 && (
                <Input
                  value={fills[i] ?? ""}
                  onChange={(e) => onFill(i, e.target.value)}
                  disabled={checked}
                  aria-label={`Blank ${i + 1}`}
                  className="inline-block h-8 w-32 px-2 text-center"
                  placeholder="…"
                />
              )}
            </span>
          ))}
        </p>
      </div>
    );
  }

  if (ex.type === "reorder" || ex.type === "match") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">{instruction ?? "Put the parts in order."}</p>
        <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 min-h-16">
          <div className="flex flex-wrap gap-2">
            {reorder.seq.length === 0 && (
              <span className="text-xs text-muted-foreground">Tap the parts below in order…</span>
            )}
            {reorder.seq.map((word, i) => (
              <button
                key={`${word}-${i}`}
                type="button"
                disabled={checked}
                onClick={() =>
                  onReorder({
                    bank: [...reorder.bank, word],
                    seq: reorder.seq.filter((_, j) => j !== i),
                  })
                }
                className="rounded-full border border-primary bg-card px-3 py-1.5 text-sm"
              >
                {word}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {reorder.bank.map((word, i) => (
            <button
              key={`${word}-${i}`}
              type="button"
              disabled={checked}
              onClick={() =>
                onReorder({
                  bank: reorder.bank.filter((_, j) => j !== i),
                  seq: [...reorder.seq, word],
                })
              }
              className="rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
            >
              {word}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (ex.type === "write") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">{topic ?? "Write your answer."}</p>
        <Textarea
          value={openText}
          onChange={(e) => onOpenText(e.target.value)}
          disabled={checked}
          rows={5}
          placeholder="Write here…"
        />
        {minWords && (
          <p className="text-xs text-muted-foreground">
            {openText.split(/\s+/).filter(Boolean).length} / {minWords} words
          </p>
        )}
      </div>
    );
  }

  // speak
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
        <p className="text-xs font-medium text-primary">Say this out loud</p>
        <p className="mt-1 text-sm">{target}</p>
        {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Textarea
        value={openText}
        onChange={(e) => onOpenText(e.target.value)}
        disabled={checked}
        rows={2}
        placeholder="Optional: type what you said (or leave empty to mark as practised)"
      />
      {!checked && (
        <p className="text-xs text-muted-foreground">
          Speaking with a microphone arrives with your practice sessions — for now, say it out loud
          and mark it done.
        </p>
      )}
    </div>
  );
}
