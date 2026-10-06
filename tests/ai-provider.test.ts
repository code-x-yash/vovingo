import { afterEach, describe, expect, it } from "vitest";
import {
  MockAIProvider,
  WorkersAIProvider,
  estimateTokens,
  getAIProvider,
  scoreEmotion,
  type SpeakingInput,
} from "@/lib/ai/provider";
import { computeMetrics } from "@/lib/ai/metrics";
import type { DetectRule } from "@/lib/mistakes/detect";

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
];

const INPUT: SpeakingInput = {
  transcript:
    "I am working here since five years. Yesterday I go to the market and I buy many fruit for my family because we are plan a small party tonight.",
  durationSec: 12,
  prompt: "Describe your day",
  rules: RULES,
};

afterEach(() => {
  delete process.env.AI_PROVIDER;
  delete process.env.AI_MODEL;
});

describe("estimateTokens", () => {
  it("approximates ~4 chars per token and never returns 0", () => {
    expect(estimateTokens("")).toBe(1);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(40))).toBe(10);
  });
});

describe("MockAIProvider.complete", () => {
  it("returns the provided mock stand-in verbatim", async () => {
    const provider = new MockAIProvider();
    const call = await provider.complete({
      prompt: "Anything",
      system: "Be brief",
      mock: "Canned output for tests",
    });
    expect(call.text).toBe("Canned output for tests");
    expect(call.latencyMs).toBeGreaterThanOrEqual(0);
    expect(call.tokensIn).toBeGreaterThan(0);
    expect(call.tokensOut).toBeGreaterThan(0);
  });

  it("falls back to a deterministic non-empty reply without a mock", async () => {
    const provider = new MockAIProvider();
    const a = await provider.complete({ prompt: "Hello coach, how am I doing today?" });
    const b = await provider.complete({ prompt: "Hello coach, how am I doing today?" });
    expect(a.text.length).toBeGreaterThan(0);
    expect(a.text).toBe(b.text);
    expect(a.text).toContain("Hello coach");
  });
});

describe("WorkersAIProvider.complete", () => {
  it("sends chat messages to the binding and parses { response }", async () => {
    const calls: { model: string; input: Record<string, unknown> }[] = [];
    const provider = new WorkersAIProvider(async (model, input) => {
      calls.push({ model, input });
      return { response: "Nice pace — trim the fillers." };
    });

    const call = await provider.complete({
      system: "You are a coach.",
      prompt: "Analyse this take.",
      maxTokens: 64,
      temperature: 0.2,
    });

    expect(call.text).toBe("Nice pace — trim the fillers.");
    expect(calls).toHaveLength(1);
    expect(calls[0].model).toContain("@cf/");
    const messages = calls[0].input.messages as { role: string; content: string }[];
    expect(messages[0]).toEqual({ role: "system", content: "You are a coach." });
    expect(messages[1]).toEqual({ role: "user", content: "Analyse this take." });
    expect(calls[0].input.max_tokens).toBe(64);
    expect(calls[0].input.temperature).toBe(0.2);
  });

  it("ignores the mock stand-in and surfaces binding errors", async () => {
    const provider = new WorkersAIProvider(async () => {
      throw new Error("no AI binding");
    });
    await expect(provider.complete({ prompt: "x", mock: "ignored" })).rejects.toThrow(
      /no AI binding/
    );
  });

  it("rejects empty completions", async () => {
    const provider = new WorkersAIProvider(async () => ({ response: "   " }));
    await expect(provider.complete({ prompt: "x" })).rejects.toThrow(/empty/);
  });

  it("accepts plain-string model output", async () => {
    const provider = new WorkersAIProvider(async () => "straight string reply");
    const call = await provider.complete({ prompt: "x" });
    expect(call.text).toBe("straight string reply");
  });
});

describe("WorkersAIProvider.analyzeSpeaking", () => {
  it("keeps heuristic scores when the model fails and matches the mock pipeline", async () => {
    const failing = new WorkersAIProvider(async () => {
      throw new Error("model down");
    });
    const mock = new MockAIProvider();

    const a = await failing.analyzeSpeaking(INPUT);
    const b = await mock.analyzeSpeaking(INPUT);

    expect(a.result.scores).toEqual(b.result.scores);
    expect(a.result.summary).toBe(b.result.summary);
    expect(a.result.summary).toContain("words");
    expect(a.result.mistakes.length).toBeGreaterThanOrEqual(1);
  });

  it("replaces the summary with the model's and adds its tokens", async () => {
    const llm = new WorkersAIProvider(async () => ({
      response: "Solid pace and clean structure — watch the repeated tense slips.",
    }));
    const mock = new MockAIProvider();

    const a = await llm.analyzeSpeaking(INPUT);
    const b = await mock.analyzeSpeaking(INPUT);

    expect(a.result.summary).toBe(
      "Solid pace and clean structure — watch the repeated tense slips."
    );
    expect(a.result.scores).toEqual(b.result.scores);
    expect(a.tokensOut).toBeGreaterThan(b.tokensOut);
    expect(a.tokensIn).toBeGreaterThan(b.tokensIn);
  });

  it("sanitises quoted and over-long model summaries", async () => {
    const llm = new WorkersAIProvider(async () => ({
      response: `"${"wordy summary ".repeat(60)}"`,
    }));
    const a = await llm.analyzeSpeaking(INPUT);
    expect(a.result.summary.length).toBeLessThanOrEqual(420);
    expect(a.result.summary.startsWith('"')).toBe(false);
    expect(a.result.summary.endsWith('"')).toBe(false);
  });

  it("applies JSON summary + emotion enrichment and keeps heuristic energy", async () => {
    const llm = new WorkersAIProvider(async () => ({
      response: JSON.stringify({
        summary: "Clean structure — the tense slips are the one fix.",
        emotion: { label: "Confident", note: "Strong delivery throughout." },
      }),
    }));
    const mock = new MockAIProvider();

    const a = await llm.analyzeSpeaking(INPUT);
    const b = await mock.analyzeSpeaking(INPUT);

    expect(a.result.summary).toBe("Clean structure — the tense slips are the one fix.");
    expect(a.result.emotion.label).toBe("confident");
    expect(a.result.emotion.note).toBe("Strong delivery throughout.");
    expect(a.result.emotion.energy).toBe(b.result.emotion.energy);
  });
});

describe("scoreEmotion", () => {
  const words = (n: number) =>
    Array.from({ length: n }, (_, i) => `word${i + 1}`).join(" ");

  it("reports silence for empty transcripts", () => {
    const read = scoreEmotion(computeMetrics("", 5));
    expect(read.label).toBe("silent");
    expect(read.energy).toBe(0);
  });

  it("reads a fast, clean take as confident", () => {
    const text =
      "We will ship the update today because every test passed and the team reviewed " +
      "the plan together this morning carefully before the release window closed.";
    const read = scoreEmotion(computeMetrics(text, 10));
    expect(read.label).toBe("confident");
    expect(read.energy).toBeGreaterThan(50);
    expect(read.note.length).toBeGreaterThan(0);
  });

  it("reads a sprint as rushed", () => {
    const read = scoreEmotion(computeMetrics(words(60), 20));
    expect(read.label).toBe("rushed");
  });

  it("reads a crawl as hesitant", () => {
    const read = scoreEmotion(computeMetrics(words(18), 20));
    expect(read.label).toBe("hesitant");
  });

  it("reads contractions and connectors as warm", () => {
    const text =
      "I'm ready because we've tested everything, so I'll ship it now and I don't " +
      "expect issues, but we'll watch it closely.";
    const read = scoreEmotion(computeMetrics(text, 12));
    expect(read.label).toBe("warm");
    expect(read.energy).toBeGreaterThan(0);
  });
});

describe("getAIProvider", () => {
  it("constructs workers-ai without touching the binding", () => {
    process.env.AI_PROVIDER = "workers-ai";
    const provider = getAIProvider();
    expect(provider.name).toBe("workers-ai");
    expect(provider.model).toContain("@cf/");
  });

  it("honours AI_MODEL overrides", () => {
    process.env.AI_PROVIDER = "workers-ai";
    process.env.AI_MODEL = "@cf/custom/model";
    expect(getAIProvider().model).toBe("@cf/custom/model");
  });
});
