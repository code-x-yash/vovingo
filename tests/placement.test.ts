import { describe, expect, it } from "vitest";
import { LEVEL_BASELINE, PLACEMENT_QUESTIONS, scorePlacement } from "../lib/content/placement";

const allCorrect = PLACEMENT_QUESTIONS.map((q) => q.correctIndex);
const allWrong = PLACEMENT_QUESTIONS.map((q) => (q.correctIndex + 1) % q.options.length);
const unanswered = new Array<number>(0);

describe("scorePlacement", () => {
  it("has 12 questions with valid option indexes", () => {
    expect(PLACEMENT_QUESTIONS.length).toBe(12);
    for (const q of PLACEMENT_QUESTIONS) {
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.options.length);
      expect(q.options.length).toBe(4);
      expect([1, 2, 3]).toContain(q.difficulty);
    }
  });

  it("maps a perfect score to advanced", () => {
    const r = scorePlacement(allCorrect);
    expect(r.level).toBe("advanced");
    expect(r.ratio).toBe(1);
    expect(r.correctCount).toBe(12);
    expect(r.perSkill.grammar).toBe(100);
    expect(r.perSkill.writing).toBe(100);
  });

  it("maps an empty/zero score to complete_beginner", () => {
    const r = scorePlacement(unanswered);
    expect(r.level).toBe("complete_beginner");
    expect(r.ratio).toBe(0);
    expect(r.correctCount).toBe(0);
    expect(r.perSkill.grammar).toBe(0);
  });

  it("maps all-wrong answers to complete_beginner", () => {
    expect(scorePlacement(allWrong).level).toBe("complete_beginner");
  });

  it("hard questions weigh more than easy ones", () => {
    // Answer the three hard questions (p10, p11, p12) correctly, nothing else.
    const answers = PLACEMENT_QUESTIONS.map((q, i) => (i >= 9 ? q.correctIndex : -1));
    const hardOnly = scorePlacement(answers);
    // Same raw count (3) but only 9 of 25 total weight — still a low level.
    expect(hardOnly.correctCount).toBe(3);
    expect(hardOnly.ratio).toBeCloseTo(9 / 25, 2);
    expect(["complete_beginner", "beginner"]).toContain(hardOnly.level);
  });

  it("scores per-skill independently", () => {
    // Grammar correct only.
    const answers = PLACEMENT_QUESTIONS.map((q) => (q.skill === "grammar" ? q.correctIndex : -1));
    const r = scorePlacement(answers);
    expect(r.perSkill.grammar).toBe(100);
    expect(r.perSkill.vocabulary).toBe(0);
    expect(r.perSkill.writing).toBe(0);
  });

  it("tolerates oversized answer arrays", () => {
    const padded = [...allCorrect, 0, 0, 0];
    expect(scorePlacement(padded).ratio).toBe(1);
  });

  it("level baselines are increasing and within 0..1", () => {
    const order = [
      "complete_beginner",
      "beginner",
      "elementary",
      "intermediate",
      "upper_intermediate",
      "advanced",
    ] as const;
    let prev = -1;
    for (const key of order) {
      const v = LEVEL_BASELINE[key];
      expect(v).toBeGreaterThan(prev);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
      prev = v;
    }
  });
});
