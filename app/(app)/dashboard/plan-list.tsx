"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BookOpen,
  Check,
  Eye,
  Headphones,
  Languages,
  Mic,
  Pencil,
  Play,
  Repeat,
  Target,
  Wrench,
  ArrowRight,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanItem } from "@/lib/db/schema";

type Item = PlanItem;

type StreakView = {
  current: number;
  longest: number;
  totalDays: number;
  xp: number;
};

type Props = {
  plan: {
    items: Item[];
    completedCount: number;
    minutesTarget: number;
  };
  streak: StreakView;
  nextHref?: string | null;
};

const KIND_ICON: Record<PlanItem["kind"], typeof Mic> = {
  learn: BookOpen,
  review: Repeat,
  vocab: Languages,
  fix: Wrench,
  speak: Mic,
  listen: Headphones,
  write: Pencil,
  read: Eye,
  watch: Play,
  challenge: Target,
};

const KIND_LABEL: Record<PlanItem["kind"], string> = {
  learn: "Learn",
  review: "Review",
  vocab: "Vocab",
  fix: "Fix",
  speak: "Speak",
  listen: "Listen",
  write: "Write",
  read: "Read",
  watch: "Watch",
  challenge: "Challenge",
};

export function PlanList({ plan, streak, nextHref }: Props) {
  const [items, setItems] = useState<Item[]>(plan.items);
  const [completedCount, setCompletedCount] = useState(plan.completedCount);
  const [streakState, setStreakState] = useState<StreakView>(streak);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastXp, setLastXp] = useState(0);

  async function complete(index: number) {
    if (busy !== null || items[index]?.done) return;
    setBusy(index);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", index }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        plan?: { items: Item[]; completedCount: number };
        streak?: StreakView;
        xpGained?: number;
      };
      if (!res.ok || !data.plan) {
        setError(data.error ?? "Could not save that. Try again.");
        return;
      }
      setItems(data.plan.items);
      setCompletedCount(data.plan.completedCount);
      if (data.streak) setStreakState(data.streak);
      setLastXp(data.xpGained ?? 0);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(null);
    }
  }

  const total = items.length;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const remainingMin = items.filter((i) => !i.done).reduce((sum, i) => sum + i.minutes, 0);
  const allDone = total > 0 && completedCount >= total;

  if (total === 0) {
    return (
      <div className="py-2">
        <p className="text-sm text-muted-foreground">
          Your daily plan generates every morning. Until then, start with a free speaking session.
        </p>
        <Button render={<Link href="/speaking" />} className="mt-4" size="lg">
          Start speaking
          <ArrowRight className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {completedCount}/{total}
          </span>{" "}
          done
          {remainingMin > 0 && !allDone && <> · ~{remainingMin} min left</>}
        </p>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">{pct}%</span>
      </div>

      <Progress value={pct} className="mt-2.5 h-1.5" />

      <ol className="mt-1 divide-y divide-border/70">
        {items.map((item, index) => {
          const Icon = KIND_ICON[item.kind] ?? Target;
          return (
            <li key={`${item.kind}-${index}`}>
              <button
                type="button"
                onClick={() => void complete(index)}
                disabled={item.done || busy !== null}
                aria-pressed={item.done ?? false}
                className="group flex w-full items-center gap-3 py-3 text-left outline-none disabled:cursor-default focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring/40 sm:gap-4"
              >
                <span
                  className={cn(
                    "w-5 shrink-0 font-mono text-xs tabular-nums",
                    item.done ? "text-muted-foreground/50" : "text-muted-foreground"
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg transition-colors",
                    item.done
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary group-hover:bg-primary/15"
                  )}
                >
                  <Icon className="size-4" />
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-sm font-medium",
                      item.done && "text-muted-foreground line-through"
                    )}
                  >
                    {item.title}
                  </span>
                  {item.subtitle && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.subtitle}
                    </span>
                  )}
                </span>

                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                  {KIND_LABEL[item.kind]} · {item.minutes} min
                </span>
                <span className="shrink-0 text-xs text-muted-foreground sm:hidden">
                  {item.minutes}m
                </span>

                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border transition-all",
                    item.done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border group-hover:border-primary/50 group-hover:bg-primary/5"
                  )}
                  aria-hidden
                >
                  {item.done && <Check className="size-3.5" />}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {allDone ? (
            <span className="font-medium text-foreground">
              Plan complete · streak {streakState.current}d · {streakState.xp} XP. See you
              tomorrow.
            </span>
          ) : lastXp > 0 ? (
            <>
              +{lastXp} XP · streak {streakState.current}d · {streakState.xp} XP total
            </>
          ) : (
            <>Each item earns XP and keeps your streak alive.</>
          )}
        </p>

        {!allDone && nextHref && (
          <Button render={<Link href={nextHref} />} size="sm">
            Start today&apos;s session
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
