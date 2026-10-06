import { describe, expect, it } from "vitest";
import {
  ROUND_SIZE,
  buildGrammarRound,
  buildOptions,
  buildToneRound,
  buildVocabRound,
  isPlausibleRun,
  xpForRun,
  type GrammarRow,
  type VocabRow,
} from "@/lib/speedrun/bank";

const vocabRows: VocabRow[] = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  word: `word${i + 1}`,
  definition: `meaning of word${i + 1}`,
}));

const grammarRows: GrammarRow[] = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  wrongExample: `Wrong sentence ${i + 1} since 3 years.`,
  correctExample: `Correct sentence ${i + 1} for 3 years.`,
}));

describe("buildOptions", () => {
  it("keeps the correct answer exactly once at the right index", () => {
    for (let run = 0; run < 30; run += 1) {
      const { options, correctIndex } = buildOptions("right", ["a", "b", "c"]);
      expect(options).toHaveLength(4);
      expect(options.filter((o) => o === "right")).toHaveLength(1);
      expect(options[correctIndex]).toBe("right");
    }
  });
});

describe("buildVocabRound", () => {
  it("builds a full round of 4-option meaning questions", () => {
    const round = buildVocabRound(vocabRows);
    expect(round).toHaveLength(ROUND_SIZE);
    for (const q of round) {
      expect(q.options).toHaveLength(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.options.length);
      expect(vocabRows.find((r) => r.word === q.prompt)).toBeTruthy();
      expect(q.options[q.correctIndex]).toBe(
        vocabRows.find((r) => r.word === q.prompt)!.definition
      );
    }
    // No duplicate prompts in one round
    expect(new Set(round.map((q) => q.prompt)).size).toBe(ROUND_SIZE);
  });
});

describe("buildGrammarRound", () => {
  it("pits the correct sentence against the wrong one", () => {
    const round = buildGrammarRound(grammarRows);
    expect(round).toHaveLength(ROUND_SIZE);
    for (const q of round) {
      expect(q.options).toHaveLength(2);
      const correct = grammarRows.find((g) => g.correctExample === q.options[q.correctIndex]);
      expect(correct).toBeTruthy();
      expect(q.options).toContain(correct!.wrongExample);
    }
  });
});

describe("buildToneRound", () => {
  it("shows the casual line and offers the formal rewrite as the answer", () => {
    const round = buildToneRound();
    expect(round.length).toBeGreaterThan(0);
    for (const q of round) {
      expect(q.options).toHaveLength(2);
      expect(q.why).toBeTruthy();
      expect(typeof q.prompt).toBe("string");
      expect(q.prompt.length).toBeGreaterThan(0);
    }
  });
});

describe("xpForRun", () => {
  it("pays 5 XP per correct with a 50 cap", () => {
    expect(xpForRun(0)).toBe(0);
    expect(xpForRun(5)).toBe(25);
    expect(xpForRun(10)).toBe(50);
    expect(xpForRun(99)).toBe(50);
  });
});

describe("isPlausibleRun", () => {
  it("accepts a human-paced full round", () => {
    expect(isPlausibleRun({ correct: 8, total: 10, scoreMs: 12_000 })).toBe(true);
    expect(isPlausibleRun({ correct: 0, total: 10, scoreMs: 60_000 })).toBe(true);
  });

  it("rejects wrong totals, impossible times and out-of-range scores", () => {
    expect(isPlausibleRun({ correct: 5, total: 9, scoreMs: 12_000 })).toBe(false);
    expect(isPlausibleRun({ correct: 5, total: 10, scoreMs: 4_999 })).toBe(false);
    expect(isPlausibleRun({ correct: 5, total: 10, scoreMs: 600_001 })).toBe(false);
    expect(isPlausibleRun({ correct: 11, total: 10, scoreMs: 12_000 })).toBe(false);
    expect(isPlausibleRun({ correct: -1, total: 10, scoreMs: 12_000 })).toBe(false);
  });
});
