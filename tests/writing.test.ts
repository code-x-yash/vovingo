import { describe, expect, it } from "vitest";
import type { DetectedMistake } from "../lib/db/schema";
import { getWritingPrompt, writingPrompts } from "../lib/content/writing-prompts";
import {
  analyzeWriting,
  applyMechanicalFixes,
  countWords,
} from "../lib/writing/analyze";

function det(overrides: Partial<DetectedMistake> = {}): DetectedMistake {
  return {
    key: "test-rule",
    title: "Wrong article",
    category: "grammar",
    wrong: "a apple",
    correct: "an apple",
    why: "Use 'an' before vowel sounds.",
    severity: "medium",
    confidence: 0.85,
    ...overrides,
  };
}

describe("countWords", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("one two three")).toBe(3);
    expect(countWords("  padded   words  ")).toBe(2);
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});

describe("applyMechanicalFixes", () => {
  it("capitalises i and the first letter", () => {
    expect(applyMechanicalFixes("i think this is fine.")).toBe("I think this is fine.");
  });

  it("capitalises sentence starts", () => {
    expect(applyMechanicalFixes("hello there. this is fine!")).toBe("Hello there. This is fine!");
  });

  it("fixes a/an before known words", () => {
    expect(applyMechanicalFixes("i bought a apple and an book")).toBe(
      "I bought an apple and a book"
    );
  });

  it("collapses extra whitespace", () => {
    expect(applyMechanicalFixes("too    many   spaces")).toBe("Too many spaces");
  });
});

describe("analyzeWriting", () => {
  const clean = "I finished the report yesterday and sent it to the manager.";

  it("flags a clean draft positively", () => {
    const a = analyzeWriting(clean, [], { minWords: 10 });
    expect(a.feedback[0]).toContain("No recurring patterns");
    expect(a.tone).toBe("neutral");
    expect(a.scores.grammar).toBe(95);
    expect(a.scores.overall).toBeGreaterThanOrEqual(70);
  });

  it("lowers the grammar score when grammar patterns are detected", () => {
    const cleanRun = analyzeWriting(clean, []);
    const dirtyRun = analyzeWriting(clean, [det(), det({ severity: "high" })]);
    expect(dirtyRun.scores.grammar).toBeLessThan(cleanRun.scores.grammar);
    expect(dirtyRun.scores.overall).toBeLessThan(cleanRun.scores.overall);
    expect(dirtyRun.feedback.some((f) => f.includes("an apple"))).toBe(true);
  });

  it("mentions the word-count gap when under the minimum", () => {
    const a = analyzeWriting("Too short.", [], { minWords: 60 });
    expect(a.feedback.some((f) => f.includes("aim for at least 60"))).toBe(true);
  });

  it("detects polite and formal tones", () => {
    expect(analyzeWriting("Could you please send the file?").tone).toBe("polite");
    expect(analyzeWriting("Therefore I would kindly regard your response. Sincerely, Asha.").tone).toBe(
      "formal"
    );
  });

  it("is deterministic and stays within score bounds", () => {
    const text = "I went to market and buy an book since 3 year. i love reading!";
    const a1 = analyzeWriting(text, [det({ key: "k1" })], { minWords: 20 });
    const a2 = analyzeWriting(text, [det({ key: "k1" })], { minWords: 20 });
    expect(a1).toEqual(a2);
    for (const v of Object.values(a1.scores)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("applies natural polish for repeated words", () => {
    const a = analyzeWriting("I really really enjoyed the trip yesterday evening.");
    expect(a.natural).not.toContain("really really");
  });
});

describe("writing prompts", () => {
  it("resolves known slugs and rejects unknown ones", () => {
    const p = getWritingPrompt("thank-you-email");
    expect(p).not.toBeNull();
    expect(p?.kind).toBe("email");
    expect(p?.minWords).toBeGreaterThanOrEqual(40);
    expect(getWritingPrompt("does-not-exist")).toBeNull();
  });

  it("keeps the catalogue consistent", () => {
    const slugs = writingPrompts.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const p of writingPrompts) {
      expect(p.hints.length).toBeGreaterThanOrEqual(2);
      expect(p.brief.length).toBeGreaterThan(20);
    }
  });
});
