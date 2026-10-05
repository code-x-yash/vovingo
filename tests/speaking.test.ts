import { describe, expect, it } from "vitest";
import { computeMetrics } from "../lib/ai/metrics";
import {
  MockAIProvider,
  getAIProvider,
  scoreFluency,
  scoreGrammar,
  scoreNaturalness,
  scoreVocabulary,
  wpmFit,
} from "../lib/ai/provider";
import { detectMistakes, type DetectRule } from "../lib/mistakes/detect";
import { nextTrendState } from "../lib/mistakes/store";

const RULES: DetectRule[] = [
  {
    key: "since-for",
    title: "since vs for",
    category: "grammar",
    why: "Use 'for' with a length of time and 'since' with a starting point.",
    wrongExample: "I am working here since five years.",
    correctExample: "I have been working here for five years.",
    severity: "high",
    patterns: [
      "\\bsince\\s+(\\d+|a|one|two|three|four|five|six|seven|eight|nine|ten|many|few|several)\\s+(year|month|week|day|hour|minute)s?\\b",
    ],
  },
  {
    key: "bad-regex",
    title: "broken rule",
    category: "grammar",
    why: "n/a",
    wrongExample: "n/a",
    correctExample: "n/a",
    severity: "low",
    patterns: ["([unclosed"],
  },
];

describe("computeMetrics", () => {
  it("computes wpm, words and unique words", () => {
    const m = computeMetrics("I went to the market and I bought some fresh fruit today.", 30);
    expect(m.wordCount).toBe(12);
    expect(m.uniqueWordCount).toBe(11); // only "I" repeats
    expect(m.wpm).toBe(24);
  });

  it("counts standalone and phrase fillers", () => {
    const m = computeMetrics("Um, I was, you know, thinking about it, I mean, maybe.", 20);
    expect(m.fillerCount).toBe(3); // um, you know, i mean
    expect(m.wordCount).toBe(11);
  });

  it("derives pauses from sentences and long pauses from ellipses", () => {
    const m = computeMetrics("First idea. Second idea! Third idea? Then... more.", 40);
    expect(m.sentenceCount).toBe(5); // . ! ? ... .
    expect(m.longPauseCount).toBe(1);
    expect(m.avgPauseMs).toBe(Math.round((40 * 1000) / 6));
  });

  it("treats unpunctuated speech as one sentence", () => {
    const m = computeMetrics("just flowing words without any stops at all", 15);
    expect(m.sentenceCount).toBe(1);
    expect(m.hasPunctuation).toBe(false);
  });

  it("handles empty input", () => {
    const m = computeMetrics("", 10);
    expect(m.wordCount).toBe(0);
    expect(m.wpm).toBe(0);
    expect(m.sentenceCount).toBe(0);
    expect(m.fillerCount).toBe(0);
  });

  it("is deterministic", () => {
    const a = computeMetrics("Hello there, my friend. How are you doing today?", 12);
    const b = computeMetrics("Hello there, my friend. How are you doing today?", 12);
    expect(a).toEqual(b);
  });
});

describe("detectMistakes", () => {
  it("finds a seeded pattern and extracts the sentence", () => {
    const out = detectMistakes(
      "I joined in 2019. I am working here since five years now.",
      RULES
    );
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe("since-for");
    expect(out[0].wrong).toContain("since five years");
    expect(out[0].correct).toBe("I have been working here for five years.");
    expect(out[0].confidence).toBe(0.9);
  });

  it("returns nothing when no patterns match", () => {
    expect(detectMistakes("Everything is fine and correct today.", RULES)).toEqual([]);
  });

  it("skips broken regexes without throwing", () => {
    const out = detectMistakes("some text here", RULES);
    expect(out).toEqual([]);
  });

  it("deduplicates rules and respects the limit", () => {
    const many: DetectRule[] = Array.from({ length: 10 }, (_, i) => ({
      ...RULES[0],
      key: `rule-${i}`,
      patterns: ["\\bmarket\\b"],
    }));
    const out = detectMistakes("the market and the market", many, 3);
    expect(out).toHaveLength(3);
    expect(new Set(out.map((o) => o.key)).size).toBe(3);
  });

  it("matches case-insensitively", () => {
    const out = detectMistakes("I AM WORKING HERE SINCE FIVE YEARS", RULES);
    expect(out).toHaveLength(1);
    expect(out[0].wrong).toContain("SINCE FIVE YEARS");
  });
});

describe("scoring", () => {
  it("wpm fit peaks in the 115–155 band", () => {
    expect(wpmFit(130)).toBe(100);
    expect(wpmFit(130)).toBeGreaterThan(wpmFit(60));
    expect(wpmFit(130)).toBeGreaterThan(wpmFit(220));
    expect(wpmFit(0)).toBe(0);
  });

  it("fluency rewards good pacing and punishes fillers", () => {
    const clean = computeMetrics(
      "Today I want to tell you about my morning routine and why it matters so much to me personally.",
      45
    );
    const messy = computeMetrics(
      "Um so like, I, you know, I mean, um, yeah, er, well, hmm, so basically, um, okay then.",
      45
    );
    const a = scoreFluency(clean);
    const b = scoreFluency(messy);
    expect(a).toBeGreaterThan(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(100);
  });

  it("grammar drops with detected mistakes and stays in bounds", () => {
    const mistakes = detectMistakes("I am working here since five years.", RULES);
    const clean = scoreGrammar([], 30);
    const dirty = scoreGrammar(mistakes, 30);
    expect(dirty).toBeLessThan(clean);
    expect(dirty).toBeGreaterThanOrEqual(0);
    expect(clean).toBeLessThanOrEqual(100);
  });

  it("vocabulary rises with lexical diversity", () => {
    const diverse = computeMetrics(
      "The architect sketched an ambitious blueprint while the committee negotiated funding.",
      25
    );
    const repetitive = computeMetrics("very good very good very good very good very good", 25);
    expect(scoreVocabulary(diverse)).toBeGreaterThan(scoreVocabulary(repetitive));
  });

  it("naturalness rewards contractions and connectors", () => {
    const natural = computeMetrics("It's fine, but I don't think it'll work because we're late.", 20);
    const stiff = computeMetrics("It is fine but I do not think it will work", 20);
    expect(scoreNaturalness(natural)).toBeGreaterThan(scoreNaturalness(stiff));
  });

  it("all scores are zero for empty speech", () => {
    const m = computeMetrics("", 10);
    expect(scoreFluency(m)).toBe(0);
    expect(scoreVocabulary(m)).toBe(0);
    expect(scoreNaturalness(m)).toBe(0);
    expect(scoreGrammar([], 0)).toBe(0);
  });
});

describe("MockAIProvider", () => {
  it("returns the full analysis shape deterministically", async () => {
    const provider = new MockAIProvider();
    const input = {
      transcript:
        "Yesterday I go to market and I buyed some fruits. I am working here since five years.",
      durationSec: 30,
      prompt: "Talk about your day",
      rules: RULES,
    };
    const a = await provider.analyzeSpeaking(input);
    const b = await provider.analyzeSpeaking(input);

    expect(a.result.scores.grammar).toBeLessThan(100);
    expect(a.result.mistakes.map((m) => m.key)).toContain("since-for");
    expect(a.result.recommendations.length).toBeGreaterThan(0);
    expect(a.result.summary).toContain("words");
    expect(a.latencyMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(a.result)).toBe(JSON.stringify(b.result));
  });

  it("grades every score inside 0..100", async () => {
    const provider = new MockAIProvider();
    const { result } = await provider.analyzeSpeaking({
      transcript: "short",
      durationSec: 5,
      rules: RULES,
    });
    for (const v of Object.values(result.scores)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe("getAIProvider", () => {
  it("returns the mock provider outside production", () => {
    expect(getAIProvider().name).toBe("mock");
  });

  it("refuses to run mock AI in production without opt-in", () => {
    const env = process.env as unknown as Record<string, string | undefined>;
    const prevEnv = env.NODE_ENV;
    const prevAllow = env.ALLOW_MOCK_AI;
    try {
      env.NODE_ENV = "production";
      delete env.ALLOW_MOCK_AI;
      expect(() => getAIProvider()).toThrow(/ALLOW_MOCK_AI/);
      env.ALLOW_MOCK_AI = "true";
      expect(getAIProvider().name).toBe("mock");
    } finally {
      if (prevEnv === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = prevEnv;
      if (prevAllow === undefined) delete env.ALLOW_MOCK_AI;
      else env.ALLOW_MOCK_AI = prevAllow;
    }
  });

  it("rejects unknown providers", () => {
    const prev = process.env.AI_PROVIDER;
    try {
      process.env.AI_PROVIDER = "openai";
      expect(() => getAIProvider()).toThrow(/Unknown AI_PROVIDER/);
    } finally {
      if (prev === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = prev;
    }
  });
});

describe("nextTrendState", () => {
  it("marks first detections as new", () => {
    expect(nextTrendState(null)).toEqual({ trend: "new", status: "active" });
    expect(nextTrendState({ occurrences: 1, practiceCount: 0 })).toEqual({
      trend: "new",
      status: "active",
    });
  });

  it("escalates unpractised repeats to needs_practice", () => {
    expect(nextTrendState({ occurrences: 2, practiceCount: 0 })).toEqual({
      trend: "stable",
      status: "active",
    });
    expect(nextTrendState({ occurrences: 3, practiceCount: 0 })).toEqual({
      trend: "worsening",
      status: "needs_practice",
    });
  });

  it("shows improvement once the pattern has been practised", () => {
    expect(nextTrendState({ occurrences: 2, practiceCount: 1 })).toEqual({
      trend: "improving",
      status: "active",
    });
    expect(nextTrendState({ occurrences: 5, practiceCount: 1 })).toEqual({
      trend: "stable",
      status: "needs_practice",
    });
  });
});
