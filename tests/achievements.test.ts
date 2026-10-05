import { describe, expect, it } from "vitest";
import {
  criterionMet,
  evaluateAchievements,
  type AchievementRow,
  type AchievementStats,
} from "../lib/progress/achievements";

const stats: AchievementStats = {
  lessons: 10,
  conversations: 0,
  speakingSessions: 3,
  streak: 7,
  words: 120,
  speakingMinutes: 105,
  resolvedMistakes: 2,
  mistakePractices: 1,
  assessments: 1,
  planDays: 7,
};

function ach(id: number, criteria: Record<string, unknown>): AchievementRow {
  return {
    id,
    key: `a-${id}`,
    title: `Achievement ${id}`,
    description: "desc",
    icon: "🏅",
    xp: 10,
    criteria,
  };
}

describe("criterionMet", () => {
  it("meets a threshold exactly", () => {
    expect(criterionMet(stats, { lessons: 10 })).toBe(true);
  });

  it("fails below the threshold", () => {
    expect(criterionMet(stats, { lessons: 11 })).toBe(false);
  });

  it("requires every criterion to pass", () => {
    expect(criterionMet(stats, { lessons: 10, conversations: 1 })).toBe(false);
    expect(criterionMet(stats, { lessons: 10, streak: 7 })).toBe(true);
  });

  it("never unlocks on empty or unrecognised criteria", () => {
    expect(criterionMet(stats, {})).toBe(false);
    expect(criterionMet(stats, { nope: 1 })).toBe(false);
    expect(criterionMet(stats, { lessons: "ten" })).toBe(false);
  });
});

describe("evaluateAchievements", () => {
  const catalog = [
    ach(1, { lessons: 1 }),
    ach(2, { streak: 7 }),
    ach(3, { conversations: 1 }),
    ach(4, { speakingMinutes: 100 }),
    ach(5, { planDays: 7 }),
  ];

  it("unlocks everything the stats satisfy", () => {
    const got = evaluateAchievements(catalog, stats, new Set());
    expect(got.map((a) => a.id)).toEqual([1, 2, 4, 5]);
  });

  it("skips already-earned achievements", () => {
    const got = evaluateAchievements(catalog, stats, new Set([1, 2, 4, 5]));
    expect(got).toEqual([]);
  });

  it("keeps unmet achievements locked", () => {
    const got = evaluateAchievements([ach(3, { conversations: 1 })], stats, new Set());
    expect(got).toEqual([]);
  });

  it("unlocks the full seeded-style catalog at rich stats", () => {
    const full: AchievementRow[] = [
      ach(1, { lessons: 1 }),
      ach(2, { conversations: 1 }),
      ach(3, { speakingSessions: 1 }),
      ach(4, { streak: 7 }),
      ach(5, { streak: 30 }),
      ach(6, { words: 100 }),
      ach(7, { speakingMinutes: 100 }),
      ach(8, { resolvedMistakes: 10 }),
      ach(9, { mistakePractices: 1 }),
      ach(10, { assessments: 1 }),
      ach(11, { lessons: 10 }),
      ach(12, { planDays: 7 }),
    ];
    const got = evaluateAchievements(full, stats, new Set());
    expect(got.map((a) => a.id)).toEqual([1, 3, 4, 6, 7, 9, 10, 11, 12]);
  });
});
