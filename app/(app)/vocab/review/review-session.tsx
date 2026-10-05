"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { toast } from "sonner";
import type { DueCard } from "@/lib/vocab/store";
import { schedule, type Rating } from "@/lib/vocab/scheduler";
import { Button } from "@/components/ui/button";

type Stats = { uniqueReviewed: number; againCount: number; planXp: number };

const RATING_META: { rating: Rating; label: string; className: string }[] = [
  {
    rating: "again",
    label: "Again",
    className: "bg-destructive/10 text-destructive hover:bg-destructive/20",
  },
  { rating: "hard", label: "Hard", className: "bg-warning/10 text-warning hover:bg-warning/15" },
  { rating: "good", label: "Good", className: "bg-primary/10 text-primary hover:bg-primary/15" },
  { rating: "easy", label: "Easy", className: "bg-success/10 text-success hover:bg-success/15" },
];

function intervalLabel(days: number): string {
  if (days <= 0) return "now";
  if (days === 1) return "1d";
  if (days < 30) return `${days}d`;
  return `${Math.round(days / 30)}mo`;
}

export function ReviewSession({ cards }: { cards: DueCard[] }) {
  const byId = useMemo(() => new Map(cards.map((c) => [c.wordId, c])), [cards]);

  const [queue, setQueue] = useState<number[]>(() => cards.map((c) => c.wordId));
  const [index, setIndex] = useState(0);
  const [requeued, setRequeued] = useState<Set<number>>(() => new Set());
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState<Stats>({ uniqueReviewed: 0, againCount: 0, planXp: 0 });
  const [seen, setSeen] = useState<Set<number>>(() => new Set());

  const current = index < queue.length ? byId.get(queue[index]) : undefined;

  function advance(nextQueue: number[], nextIndex: number) {
    if (nextIndex >= nextQueue.length) {
      setDone(true);
      return;
    }
    setQueue(nextQueue);
    setIndex(nextIndex);
    setRevealed(false);
  }

  async function grade(rating: Rating) {
    if (!current || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review", wordId: current.wordId, rating }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        remaining?: number;
        planXp?: number;
      };

      if (res.status === 404) {
        toast.info("That card was already reviewed elsewhere.");
        advance(queue, index + 1);
        return;
      }
      if (!res.ok) {
        toast.error(data.error ?? "Something went wrong.");
        return;
      }

      const wasSeen = seen.has(current.wordId);
      const nextSeen = new Set(seen);
      nextSeen.add(current.wordId);
      setSeen(nextSeen);
      setStats((s) => ({
        uniqueReviewed: wasSeen ? s.uniqueReviewed : s.uniqueReviewed + 1,
        againCount: s.againCount + (rating === "again" ? 1 : 0),
        planXp: s.planXp + (data.planXp ?? 0),
      }));
      if (data.planXp) toast.success(`Daily plan complete — +${data.planXp} XP`);

      let nextQueue = queue;
      const nextIndex = index + 1;
      if (rating === "again" && !requeued.has(current.wordId)) {
        nextQueue = [...queue, current.wordId];
        setRequeued(new Set(requeued).add(current.wordId));
      }
      advance(nextQueue, nextIndex);
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="animate-scale-in mt-8 flex flex-col items-center rounded-2xl border border-border bg-card px-5 py-10 text-center shadow-xs sm:px-8">
        <span className="grid size-10 place-items-center rounded-full bg-success/10 text-success">
          <Check className="size-4" strokeWidth={2.5} />
        </span>
        <h2 className="text-h2 mt-4">Session complete</h2>
        <p className="mt-2 text-[15px] text-muted-foreground">
          {stats.uniqueReviewed} word{stats.uniqueReviewed === 1 ? "" : "s"} reviewed
          {stats.againCount > 0 && ` · ${stats.againCount} marked again`}
        </p>
        {stats.planXp > 0 && (
          <p className="mt-2 text-sm font-semibold text-primary">+{stats.planXp} XP</p>
        )}
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <Button render={<Link href="/vocab" />}>Browse library</Button>
          <Button variant="outline" render={<Link href="/dashboard" />}>
            Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!current) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-7 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-eyebrow tabular-nums">
            {stats.uniqueReviewed} / {cards.length} reviewed
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {queue.length - index} in queue
          </p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-2)] transition-all duration-500 ease-ui"
            style={{ width: `${Math.min(100, (stats.uniqueReviewed / cards.length) * 100)}%` }}
          />
        </div>
      </div>

      <div className="mx-auto mt-6 flex w-full max-w-xl flex-col rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-7">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-h2">{current.word}</h2>
          {current.pronunciation && (
            <span className="font-mono text-sm text-muted-foreground">
              {current.pronunciation}
            </span>
          )}
          <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
            {current.category}
          </span>
        </div>

        {!revealed ? (
          <div className="flex flex-col items-center gap-4 pt-10 pb-4">
            <p className="text-sm text-muted-foreground">Recall the meaning, then reveal.</p>
            <Button size="lg" className="w-full sm:w-auto" onClick={() => setRevealed(true)}>
              Show meaning
            </Button>
          </div>
        ) : (
          <div className="animate-scale-in mt-6 flex flex-col gap-5">
            <div>
              <p className="text-[17px] leading-relaxed">{current.definition}</p>
              {current.example && (
                <p className="mt-2.5 text-sm text-muted-foreground italic">
                  &ldquo;{current.example}&rdquo;
                </p>
              )}
            </div>

            {current.nativeGloss && Object.keys(current.nativeGloss).length > 0 && (
              <p className="text-sm text-muted-foreground">
                {Object.entries(current.nativeGloss)
                  .map(([lang, gloss]) => `${lang}: ${gloss}`)
                  .join(" · ")}
              </p>
            )}

            {([["Synonyms", current.synonyms], ["Antonyms", current.antonyms], ["Collocations", current.collocations]] as const)
              .filter(([, values]) => values.length > 0)
              .map(([label, values]) => (
                <div key={label}>
                  <p className="text-eyebrow mb-2">{label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {values.map((v) => (
                      <span
                        key={v}
                        className="rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

            <div className="divider-fade" />

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {RATING_META.map(({ rating, label, className }) => (
                <Button
                  key={rating}
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void grade(rating)}
                  className={`h-auto flex-col gap-0.5 px-2 py-2.5 ${className}`}
                >
                  <span className="font-medium">{label}</span>
                  <span className="text-[11px] tabular-nums opacity-70">
                    {intervalLabel(schedule(current.srs, rating).intervalDays)}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="mx-auto mt-5 max-w-xl text-center text-xs text-muted-foreground">
        &ldquo;Again&rdquo; brings the card back later in this session.
      </p>
    </div>
  );
}
