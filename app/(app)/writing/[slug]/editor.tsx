"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { countWords } from "@/lib/writing/analyze";
import type { DetectedMistake } from "@/lib/db/schema";

type Outcome = {
  scores: { grammar: number; vocabulary: number; writing: number; overall: number };
  feedback: string[];
  corrected: string;
  natural: string;
  tone: string;
  mistakes: DetectedMistake[];
  words: number;
  xpGained: number;
  skill: { writing: number; grammar: number };
  patternsLogged: number;
};

function CoachHeader() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="ai-sparkle grid size-7 place-items-center rounded-lg text-white shadow-xs">
        <Sparkles className="size-4" />
      </span>
      <p className="text-eyebrow">AI Coach</p>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-2)] transition-all duration-700 ease-ui"
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

export function Editor({ slug, minWords }: { slug: string; minWords: number }) {
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const words = countWords(text);
  const ready = words >= minWords && text.trim().length > 0;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, text: text.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as Outcome & {
        error?: string;
        minWords?: number;
        current?: number;
      };
      if (!res.ok || !data.scores) {
        setError(data.error ?? "Could not analyse that — try again.");
        return;
      }
      setOutcome({
        scores: data.scores,
        feedback: data.feedback,
        corrected: data.corrected,
        natural: data.natural,
        tone: data.tone,
        mistakes: data.mistakes,
        words: data.words,
        xpGained: data.xpGained,
        skill: data.skill,
        patternsLogged: data.patternsLogged,
      });
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setText("");
    setOutcome(null);
    setError(null);
  }

  if (outcome) {
    const scoreRows = [
      { label: "Grammar", value: outcome.scores.grammar },
      { label: "Vocabulary", value: outcome.scores.vocabulary },
      { label: "Writing", value: outcome.scores.writing },
    ];

    return (
      <div className="animate-fade-in mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="flex flex-col gap-4 lg:col-span-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-eyebrow">Your draft</p>
              <span className="text-xs text-muted-foreground tabular-nums">
                {outcome.words} words
              </span>
            </div>
            <p className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {text}
            </p>
            <div className="divider-fade my-4" />
            <div className="flex flex-wrap gap-2">
              <Button onClick={reset}>Write another</Button>
              <Button variant="outline" render={<Link href="/writing" />}>
                Back to prompts
              </Button>
              {outcome.patternsLogged > 0 && (
                <Button variant="ghost" render={<Link href="/mistakes" />}>
                  Practise patterns
                </Button>
              )}
            </div>
          </div>

          {outcome.mistakes.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
              <h2 className="text-h3">Patterns spotted</h2>
              <ul className="mt-4 flex flex-col gap-3">
                {outcome.mistakes.map((m, i) => (
                  <li
                    key={`${m.key}-${i}`}
                    className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm"
                  >
                    <p className="font-semibold">{m.title}</p>
                    <p className="mt-2 text-destructive">You wrote: {m.wrong}</p>
                    <p className="text-success">Better: {m.correct}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">{m.why}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
            <CoachHeader />

            <div className="mt-4 flex items-end gap-3">
              <p className="text-display text-gradient leading-none">
                {outcome.scores.overall}
              </p>
              <p className="pb-1.5 text-[13px] text-muted-foreground">
                overall · {outcome.words} words · tone: {outcome.tone}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                +{outcome.xpGained} XP
              </span>
              <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                writing {Math.round(outcome.skill.writing)} · grammar{" "}
                {Math.round(outcome.skill.grammar)}
              </span>
              {outcome.patternsLogged > 0 && (
                <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">
                  {outcome.patternsLogged} pattern
                  {outcome.patternsLogged === 1 ? "" : "s"} logged for practice
                </span>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-4">
              {scoreRows.map((row) => (
                <ScoreRow key={row.label} label={row.label} value={row.value} />
              ))}
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Tone</span>
                <span className="font-medium">{outcome.tone}</span>
              </div>
            </div>

            <div className="divider-fade my-5" />

            <p className="text-eyebrow">Suggestions</p>
            <ul className="mt-3 flex flex-col gap-2.5">
              {outcome.feedback.map((f, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
                  <span
                    aria-hidden
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60"
                  />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 rounded-xl border border-success/25 bg-success/5 p-4">
              <p className="text-eyebrow">Corrected version</p>
              <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed">
                {outcome.corrected}
              </p>
            </div>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
      <section className="lg:col-span-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-eyebrow">Your draft</p>
            <span
              className={`text-xs tabular-nums ${
                words >= minWords ? "text-muted-foreground" : "text-destructive"
              }`}
            >
              {words}/{minWords} words
            </span>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Start writing here…"
            rows={12}
            maxLength={4000}
            className="mt-4 w-full resize-y rounded-xl border border-input bg-background/60 px-3.5 py-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {words >= minWords
                ? "Ready when you are — feedback takes seconds."
                : `Write at least ${minWords} words to submit.`}
            </p>
            <div className="flex gap-2">
              {text.length > 0 && (
                <Button variant="ghost" onClick={reset} disabled={busy}>
                  Clear
                </Button>
              )}
              <Button size="lg" disabled={!ready || busy} onClick={() => void submit()}>
                {busy ? "Analysing…" : "Submit for feedback"}
              </Button>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </section>

      <aside className="lg:col-span-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <CoachHeader />
          <p className="mt-4 text-h3">What comes back.</p>

          {busy ? (
            <div className="mt-4 flex flex-col gap-3" aria-hidden>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">
              <li className="flex gap-2.5">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
                <span>Scores for grammar, vocabulary and writing.</span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
                <span>Concrete suggestions you can apply today.</span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
                <span>A corrected version of your draft.</span>
              </li>
            </ul>
          )}

          <div className="divider-fade my-4" />
          <p className="text-xs text-muted-foreground">
            Clarity, grammar and tone — with a corrected version, in seconds.
          </p>
        </div>
      </aside>
    </div>
  );
}
