import type { PlanItem } from "@/lib/db/schema";

export type PlanSeed = {
  dailyMinutes: number;
  dueVocabCount: number;
  topMistake: { id: number; title: string; category: string; prompt?: string } | null;
  nextLesson: { id: number; title: string; category: string; durationMin: number } | null;
  podcast: { id: number; title: string; topic: string } | null;
};

export type BuiltPlan = {
  items: PlanItem[];
  focus: string;
  focusReason: string;
  focusMistakeId: number | null;
  minutesTarget: number;
};

const MIN_BUDGET = 5;
const MAX_BUDGET = 180;

/** Local YYYY-MM-DD (never UTC — a user's "today" is their own day). */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/** Lower fits into the remaining budget first — speak is always reserved room. */
const FIT_PRIORITY: PlanItem["kind"][] = ["speak", "learn", "review", "fix", "listen"];

function fitToBudget(desired: PlanItem[], budget: number): PlanItem[] {
  const taken = new Map<number, PlanItem>();
  let remaining = budget;

  const byPriority = desired
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        FIT_PRIORITY.indexOf(a.item.kind) - FIT_PRIORITY.indexOf(b.item.kind) ||
        a.index - b.index
    );

  for (const { item, index } of byPriority) {
    const minutes = Math.min(item.minutes, remaining);
    if (minutes < 3) continue; // anything shorter isn't a meaningful unit of practice
    taken.set(index, { ...item, minutes });
    remaining -= minutes;
  }

  return desired.flatMap((_, i) => {
    const kept = taken.get(i);
    return kept ? [kept] : [];
  });
}

/**
 * Rule-based daily plan builder. Deterministic for a given seed —
 * no AI call, cheap enough to run on every dashboard load.
 */
export function buildPlan(seed: PlanSeed): BuiltPlan {
  const raw = Number.isFinite(seed.dailyMinutes) && seed.dailyMinutes > 0 ? seed.dailyMinutes : MIN_BUDGET;
  const budget = clamp(Math.round(raw), MIN_BUDGET, MAX_BUDGET);

  const focus = seed.topMistake
    ? seed.topMistake.title
    : seed.nextLesson
      ? `${capitalize(seed.nextLesson.category)} fundamentals`
      : "Build a daily habit";
  const focusReason = seed.topMistake
    ? `Your ${seed.topMistake.category} pattern keeps showing up — today we chip away at it.`
    : seed.nextLesson
      ? "Next lesson in your course, matched to your level."
      : "A short session every day beats one long session a week.";

  const desired: PlanItem[] = [];

  if (seed.nextLesson) {
    const learnMin = clamp(
      Math.max(seed.nextLesson.durationMin, 5),
      5,
      Math.max(5, Math.round(budget * 0.45))
    );
    desired.push({
      kind: "learn",
      title: `Learn: ${seed.nextLesson.title}`,
      subtitle: `${capitalize(seed.nextLesson.category)} lesson · ${seed.nextLesson.durationMin} min`,
      minutes: learnMin,
      ref: { type: "lesson", id: seed.nextLesson.id },
    });
  }

  if (seed.dueVocabCount > 0) {
    desired.push({
      kind: "review",
      title: `Review ${seed.dueVocabCount} due word${seed.dueVocabCount === 1 ? "" : "s"}`,
      subtitle: "Spaced repetition keeps them from slipping away",
      minutes: 5,
      ref: { type: "vocabulary", id: 0 },
    });
  }

  if (seed.topMistake) {
    desired.push({
      kind: "fix",
      title: `Fix: ${seed.topMistake.title}`,
      subtitle: seed.topMistake.prompt ?? `Practice the ${seed.topMistake.category} pattern`,
      minutes: 5,
      ref: { type: "mistake", id: seed.topMistake.id },
    });
  }

  desired.push({
    kind: "speak",
    title: seed.topMistake?.prompt
      ? `Speak: ${seed.topMistake.prompt}`
      : "Speak: 2 minutes about your day",
    subtitle: "Record yourself — fluency grows from reps",
    minutes: 4,
    ref: { type: "speaking", id: 0 },
  });

  if (seed.podcast && budget >= 20) {
    desired.push({
      kind: "listen",
      title: `Listen: ${seed.podcast.title}`,
      subtitle: `${capitalize(seed.podcast.topic)} · listening practice`,
      minutes: 5,
      ref: { type: "podcast", id: seed.podcast.id },
    });
  }

  return {
    items: fitToBudget(desired, budget),
    focus,
    focusReason,
    focusMistakeId: seed.topMistake?.id ?? null,
    minutesTarget: budget,
  };
}
