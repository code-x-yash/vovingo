import { describe, expect, it } from "vitest";
import {
  buildPracticeQuestions,
  gradePractice,
  toPublicQuestions,
  type PracticeMistake,
} from "../lib/mistakes/practice";
import { nextTrendState } from "../lib/mistakes/store";

const self: PracticeMistake = {
  id: 5,
  key: "article-the-missing",
  title: "Missing article",
  category: "grammar",
  wrongExample: "She is doctor.",
  correctExample: "She is a doctor.",
  why: "Singular count nouns need an article.",
};

const others: PracticeMistake[] = [
  {
    id: 1,
    key: "since-for",
    title: "Since vs for",
    category: "grammar",
    wrongExample: "I live here for 2019.",
    correctExample: "I have lived here since 2019.",
    why: "Use since for a starting point and for for a duration.",
  },
  {
    id: 2,
    key: "tense-shift",
    title: "Tense shift",
    category: "grammar",
    wrongExample: "Yesterday I go to the market and buy some fruit.",
    correctExample: "Yesterday I went to the market and bought some fruit.",
    why: "Keep a past narrative in the past tense throughout.",
  },
  {
    id: 3,
    key: "irregular-past",
    title: "Irregular past forms",
    category: "grammar",
    wrongExample: "I buyed a new phone.",
    correctExample: "I bought a new phone.",
    why: "Buy is irregular — its past form is bought.",
  },
  {
    id: 4,
    key: "filler-you-know",
    title: "Overusing fillers",
    category: "fluency",
    wrongExample: "The meeting was, you know, long.",
    correctExample: "The meeting was long.",
    why: "Fillers dilute your message — cut them when you can.",
  },
];

const richPool = [...others];

describe("buildPracticeQuestions", () => {
  it("builds the three question types from a rich pool", () => {
    const qs = buildPracticeQuestions(self, richPool, self.id);
    expect(qs).toHaveLength(3);
    expect(qs.map((q) => q.kind)).toEqual(["choose_correct", "spot_wrong", "why"]);
    for (const q of qs) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.options.length).toBeLessThanOrEqual(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.options.length);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.explanation.length).toBeGreaterThan(0);
    }
  });

  it("points each correctIndex at the right answer", () => {
    const qs = buildPracticeQuestions(self, richPool, self.id);
    expect(qs[0].options[qs[0].correctIndex]).toBe(self.correctExample);
    expect(qs[1].options[qs[1].correctIndex]).toBe(self.wrongExample);
    expect(qs[2].options[qs[2].correctIndex]).toBe(self.why);
  });

  it("never puts the answer among the distractors twice or leaks it", () => {
    const qs = buildPracticeQuestions(self, richPool, self.id);
    const q1 = qs[0];
    expect(q1.options.filter((o) => o === self.correctExample)).toHaveLength(1);
    for (const o of q1.options) {
      if (o === self.correctExample) continue;
      expect(o).not.toBe(self.correctExample);
      expect(o).not.toBe(self.wrongExample);
    }
  });

  it("is deterministic for the same inputs", () => {
    const a = buildPracticeQuestions(self, richPool, self.id);
    const b = buildPracticeQuestions(self, richPool, self.id);
    expect(a).toEqual(b);
  });

  it("stays valid with a different seed", () => {
    const qs = buildPracticeQuestions(self, richPool, 999);
    expect(qs).toHaveLength(3);
    for (const q of qs) {
      expect(q.options[q.correctIndex]).toBeDefined();
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });

  it("excludes the mistake itself from distractors", () => {
    const pool = [self, ...richPool];
    const qs = buildPracticeQuestions(self, pool, self.id);
    const q1 = qs[0];
    expect(q1.options.filter((o) => o === self.correctExample)).toHaveLength(1);
    expect(q1.options).not.toContain(self.wrongExample);
    expect(q1.options).not.toContain(self.why);
  });

  it("dedupes identical distractor strings", () => {
    const pool = [others[0], { ...others[1], id: 9 }, { ...others[2], id: 10 }];
    const qs = buildPracticeQuestions(self, pool, self.id);
    for (const q of qs) {
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });

  it("returns questions with fewer options when the pool is small", () => {
    const qs = buildPracticeQuestions(self, [others[0]], self.id);
    expect(qs.length).toBeGreaterThanOrEqual(1);
    for (const q of qs) {
      expect(q.options).toHaveLength(2);
    }
  });

  it("returns nothing when there is no distractor at all", () => {
    expect(buildPracticeQuestions(self, [], self.id)).toEqual([]);
    expect(buildPracticeQuestions(self, [self], self.id)).toEqual([]);
  });

  it("tolerates mistakes with blank examples without emitting empty options", () => {
    const blank: PracticeMistake = { ...self, correctExample: "   " };
    const qs = buildPracticeQuestions(blank, richPool, self.id);
    for (const q of qs) {
      for (const o of q.options) expect(o.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("gradePractice", () => {
  it("scores a perfect run at 100", () => {
    const qs = buildPracticeQuestions(self, richPool, self.id);
    const answers = qs.map((q) => q.correctIndex);
    const g = gradePractice(qs, answers);
    expect(g.correctCount).toBe(3);
    expect(g.total).toBe(3);
    expect(g.score).toBe(100);
    expect(g.results.every((r) => r.correct)).toBe(true);
    expect(g.results.every((r) => r.explanation.length > 0)).toBe(true);
  });

  it("counts null and out-of-range answers as wrong", () => {
    const qs = buildPracticeQuestions(self, richPool, self.id);
    const g = gradePractice(qs, [qs[0].correctIndex, null, 99]);
    expect(g.correctCount).toBe(1);
    expect(g.score).toBe(33);
    expect(g.results[1].correct).toBe(false);
    expect(g.results[2].correct).toBe(false);
  });

  it("handles an empty question set", () => {
    const g = gradePractice([], [0]);
    expect(g).toEqual({ results: [], correctCount: 0, total: 0, score: 0 });
  });
});

describe("toPublicQuestions", () => {
  it("strips answers and explanations from the client payload", () => {
    const qs = buildPracticeQuestions(self, richPool, self.id);
    const pub = toPublicQuestions(qs);
    expect(pub).toHaveLength(3);
    for (const p of pub) {
      expect(p).not.toHaveProperty("correctIndex");
      expect(p).not.toHaveProperty("explanation");
      expect(p.prompt.length).toBeGreaterThan(0);
      expect(p.options.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("nextTrendState after practice", () => {
  it("keeps a recurring pattern at needs_practice once practised", () => {
    expect(nextTrendState({ occurrences: 3, practiceCount: 1 })).toEqual({
      trend: "stable",
      status: "needs_practice",
    });
  });

  it("marks a fresh pattern improving after practice", () => {
    expect(nextTrendState({ occurrences: 2, practiceCount: 1 })).toEqual({
      trend: "improving",
      status: "active",
    });
  });
});
