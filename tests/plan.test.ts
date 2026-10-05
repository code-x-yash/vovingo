import { describe, expect, it } from "vitest";
import { buildPlan, todayKey, type PlanSeed } from "../lib/plan/generate";
import { applyActivity, shiftDay, XP_PER_ITEM, XP_PLAN_BONUS } from "../lib/plan/streak";

const baseSeed = (over: Partial<PlanSeed> = {}): PlanSeed => ({
  dailyMinutes: 30,
  dueVocabCount: 0,
  topMistake: null,
  nextLesson: null,
  podcast: null,
  ...over,
});

const sumMinutes = (items: { minutes: number }[]) => items.reduce((s, i) => s + i.minutes, 0);

describe("todayKey", () => {
  it("formats YYYY-MM-DD", () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(todayKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("buildPlan", () => {
  it("always includes a speak item", () => {
    for (const minutes of [5, 15, 30, 60, 180]) {
      const plan = buildPlan(baseSeed({ dailyMinutes: minutes }));
      expect(plan.items.some((i) => i.kind === "speak")).toBe(true);
    }
  });

  it("never exceeds the budget and respects min item size", () => {
    for (const minutes of [5, 10, 20, 30, 45, 120]) {
      const plan = buildPlan(
        baseSeed({
          dailyMinutes: minutes,
          dueVocabCount: 7,
          topMistake: { id: 3, title: "Subject-verb agreement", category: "grammar" },
          nextLesson: { id: 9, title: "Past tense", category: "grammar", durationMin: 8 },
          podcast: { id: 2, title: "Coffee talk", topic: "everyday" },
        })
      );
      expect(sumMinutes(plan.items)).toBeLessThanOrEqual(minutes);
      for (const item of plan.items) expect(item.minutes).toBeGreaterThanOrEqual(3);
      expect(plan.minutesTarget).toBe(minutes);
    }
  });

  it("includes learn/review/fix/listen when data and budget allow", () => {
    const plan = buildPlan(
      baseSeed({
        dailyMinutes: 45,
        dueVocabCount: 4,
        topMistake: { id: 1, title: "Filler overload", category: "fluency", prompt: "Speak for 2 minutes without fillers" },
        nextLesson: { id: 5, title: "Polite disagreement", category: "conversation", durationMin: 10 },
        podcast: { id: 7, title: "Morning tech", topic: "technology" },
      })
    );
    const kinds = plan.items.map((i) => i.kind);
    expect(kinds).toContain("learn");
    expect(kinds).toContain("review");
    expect(kinds).toContain("fix");
    expect(kinds).toContain("listen");
    expect(plan.focus).toBe("Filler overload");
    expect(plan.focusMistakeId).toBe(1);
  });

  it("degrades gracefully with an empty seed", () => {
    const plan = buildPlan(baseSeed());
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].kind).toBe("speak");
    expect(plan.focus).toBe("Build a daily habit");
    expect(plan.focusMistakeId).toBeNull();
  });

  it("uses lesson duration but caps it to the budget share", () => {
    const plan = buildPlan(
      baseSeed({ dailyMinutes: 20, nextLesson: { id: 1, title: "Long", category: "grammar", durationMin: 45 } })
    );
    const learn = plan.items.find((i) => i.kind === "learn");
    expect(learn).toBeDefined();
    expect(learn!.minutes).toBeLessThanOrEqual(Math.round(20 * 0.45));
  });

  it("only suggests a podcast at 20+ minutes", () => {
    const seed = baseSeed({ dailyMinutes: 15, podcast: { id: 1, title: "X", topic: "news" } });
    expect(buildPlan(seed).items.some((i) => i.kind === "listen")).toBe(false);
    expect(buildPlan({ ...seed, dailyMinutes: 25 }).items.some((i) => i.kind === "listen")).toBe(true);
  });

  it("clamps absurd budgets", () => {
    expect(buildPlan(baseSeed({ dailyMinutes: 9999 })).minutesTarget).toBe(180);
    expect(buildPlan(baseSeed({ dailyMinutes: 0 })).minutesTarget).toBe(5);
  });

  it("is deterministic", () => {
    const seed = baseSeed({
      dueVocabCount: 3,
      nextLesson: { id: 2, title: "A", category: "grammar", durationMin: 6 },
    });
    expect(buildPlan(seed)).toEqual(buildPlan(seed));
  });
});

describe("applyActivity", () => {
  const today = "2026-10-04";

  it("starts a streak from nothing", () => {
    const next = applyActivity(
      { current: 0, longest: 0, totalDays: 0, lastActiveDate: null, xp: 0 },
      today,
      XP_PER_ITEM
    );
    expect(next).toEqual({ current: 1, longest: 1, totalDays: 1, lastActiveDate: today, xp: 10 });
  });

  it("extends a streak on consecutive days", () => {
    const yesterday = shiftDay(today, -1);
    const next = applyActivity(
      { current: 3, longest: 5, totalDays: 9, lastActiveDate: yesterday, xp: 100 },
      today,
      10
    );
    expect(next.current).toBe(4);
    expect(next.longest).toBe(5);
    expect(next.totalDays).toBe(10);
    expect(next.lastActiveDate).toBe(today);
    expect(next.xp).toBe(110);
  });

  it("keeps the streak but not the day count on same-day repeats", () => {
    const next = applyActivity(
      { current: 4, longest: 4, totalDays: 4, lastActiveDate: today, xp: 40 },
      today,
      XP_PLAN_BONUS
    );
    expect(next).toEqual({ current: 4, longest: 4, totalDays: 4, lastActiveDate: today, xp: 90 });
  });

  it("resets after a gap but tracks longest", () => {
    const threeDaysAgo = shiftDay(today, -3);
    const next = applyActivity(
      { current: 9, longest: 9, totalDays: 30, lastActiveDate: threeDaysAgo, xp: 500 },
      today,
      10
    );
    expect(next.current).toBe(1);
    expect(next.longest).toBe(9);
    expect(next.totalDays).toBe(31);
    expect(next.xp).toBe(510);
  });
});

describe("shiftDay", () => {
  it("crosses month and year boundaries", () => {
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
  });
});
