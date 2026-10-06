import { afterEach, describe, expect, it } from "vitest";
import {
  STAGE_PROMPTS,
  judgeStage,
  mockAudience,
  parseAudience,
  pickStagePrompt,
  promptById,
  verdictBand,
} from "@/lib/stage/engine";

describe("stage prompts", () => {
  it("has six prompts with unique ids", () => {
    expect(STAGE_PROMPTS).toHaveLength(6);
    const ids = new Set(STAGE_PROMPTS.map((p) => p.id));
    expect(ids.size).toBe(6);
    for (const p of STAGE_PROMPTS) {
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.prompt.length).toBeGreaterThan(20);
    }
  });

  it("pickStagePrompt walks every prompt deterministically", () => {
    expect(pickStagePrompt(0).id).toBe(STAGE_PROMPTS[0].id);
    expect(pickStagePrompt(6).id).toBe(STAGE_PROMPTS[0].id);
    expect(pickStagePrompt(-2).id).toBe(STAGE_PROMPTS[2].id);
    const seen = new Set(STAGE_PROMPTS.map((_, i) => pickStagePrompt(i).id));
    expect(seen.size).toBe(6);
  });

  it("promptById round-trips and rejects unknown ids", () => {
    for (const p of STAGE_PROMPTS) expect(promptById(p.id)?.id).toBe(p.id);
    expect(promptById("nope")).toBeNull();
  });
});

describe("verdictBand", () => {
  it("maps scores onto audience bands", () => {
    expect(verdictBand(90)).toBe("Standing ovation");
    expect(verdictBand(85)).toBe("Standing ovation");
    expect(verdictBand(70)).toBe("The crowd is with you");
    expect(verdictBand(50)).toBe("Polite applause");
    expect(verdictBand(20)).toBe("Crickets");
  });
});

describe("mockAudience", () => {
  it("keeps cheers in range and derives the band", () => {
    const v = mockAudience(
      "Ladies and gentlemen, I accepted this award for every all-nighter nobody saw!"
    );
    expect(v.cheers).toBeGreaterThanOrEqual(5);
    expect(v.cheers).toBeLessThanOrEqual(98);
    expect(v.verdict).toBe(verdictBand(v.cheers));
    expect(v.note.length).toBeGreaterThan(0);
  });

  it("scores a fuller take above a stub", () => {
    const strong = mockAudience(
      "Tonight we celebrate the ones who kept going when nobody clapped, and tomorrow we go again!"
    );
    const stub = mockAudience("ok fine thanks");
    expect(strong.cheers).toBeGreaterThan(stub.cheers);
  });

  it("is deterministic for identical inputs", () => {
    const take = "One memory, one apology, one look forward.";
    expect(mockAudience(take)).toEqual(mockAudience(take));
  });
});

describe("parseAudience", () => {
  it("parses clean JSON and clamps the score", () => {
    const parsed = parseAudience(JSON.stringify({ cheers: 250, note: "Sharp close." }));
    expect(parsed?.cheers).toBe(98);
    expect(parsed?.note).toBe("Sharp close.");
  });

  it("accepts fenced JSON", () => {
    const fenced =
      "```json\n" + JSON.stringify({ cheers: 72, note: "Strong middle." }) + "\n```";
    expect(parseAudience(fenced)?.cheers).toBe(72);
  });

  it("rejects garbage and wrong shapes", () => {
    expect(parseAudience("the crowd shrugs")).toBeNull();
    expect(parseAudience("")).toBeNull();
    expect(parseAudience(JSON.stringify({ cheers: "loud", note: "ok" }))).toBeNull();
    expect(parseAudience(JSON.stringify({ note: "missing the score" }))).toBeNull();
  });
});

describe("judgeStage", () => {
  afterEach(() => {
    delete process.env.AI_PROVIDER;
  });

  it("resolves with the deterministic audience in mock mode", async () => {
    const prompt = STAGE_PROMPTS[0];
    const take = "I want to thank the person who believed in me before I did!";
    const { verdict, usedModel } = await judgeStage(prompt, take);
    expect(usedModel).toBe(false);
    const fallback = mockAudience(take);
    expect(verdict.cheers).toBe(fallback.cheers);
    expect(verdict.note).toBe(fallback.note);
    expect(verdict.verdict).toBe(verdictBand(fallback.cheers));
  });

  it("always returns a verdict inside range", async () => {
    const { verdict } = await judgeStage(
      STAGE_PROMPTS[2],
      "You call it a crime, I call it a reasonable response to a boring world!"
    );
    expect(verdict.cheers).toBeGreaterThanOrEqual(5);
    expect(verdict.cheers).toBeLessThanOrEqual(98);
    expect(typeof verdict.verdict).toBe("string");
  });
});
