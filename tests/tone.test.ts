import { describe, expect, it } from "vitest";
import {
  REGISTERS,
  heuristicRegister,
  heuristicTone,
  parseToneReport,
} from "@/lib/ai/tone";

describe("heuristicTone", () => {
  it("reads casual language", () => {
    const report = heuristicTone("Hey, I'm not gonna make it today — can't move the meeting.");
    expect(report.tones[0].label).toBe("casual");
    expect(report.tones[0].confidence).toBeGreaterThan(0.5);
    expect(report.summary.toLowerCase()).toContain("casual");
  });

  it("reads formal language", () => {
    const report = heuristicTone(
      "Therefore we shall proceed accordingly, and I will kindly request your approval."
    );
    expect(report.tones.map((t) => t.label)).toContain("formal");
  });

  it("flags hedged writing", () => {
    const report = heuristicTone("Maybe we could perhaps sort of delay it, I think, possibly.");
    expect(report.tones.map((t) => t.label)).toContain("hedged");
  });

  it("flags technical vocabulary", () => {
    const report = heuristicTone(
      "The latency spike came from the database pipeline, so we measured throughput per API."
    );
    expect(report.tones.map((t) => t.label)).toContain("technical");
  });

  it("returns a neutral report when no signal fires", () => {
    const report = heuristicTone("The report is on the desk.");
    expect(report.tones).toHaveLength(1);
    expect(report.tones[0].label).toBe("neutral");
    expect(report.tones[0].confidence).toBeGreaterThan(0);
  });

  it("caps at three tones", () => {
    const report = heuristicTone(
      "Hey, therefore I definitely think the API framework is awesome, maybe, you know."
    );
    expect(report.tones.length).toBeLessThanOrEqual(3);
    for (const tone of report.tones) {
      expect(tone.confidence).toBeGreaterThan(0);
      expect(tone.confidence).toBeLessThanOrEqual(1);
      expect(tone.note.length).toBeGreaterThan(0);
    }
  });
});

describe("heuristicRegister", () => {
  const original = "Hey, I'm not gonna make it. We can't start — I don't have the files!";

  it("expands contractions for formal", () => {
    const out = heuristicRegister(original, "formal");
    expect(out).toContain("I am");
    expect(out).toContain("cannot");
    expect(out).toContain("do not");
    expect(out).not.toContain("gonna");
    expect(out).not.toContain("!");
  });

  it("contracts full forms for casual", () => {
    const out = heuristicRegister("Hello, do not worry — it is fine, I will check.", "casual");
    expect(out).toContain("don't");
    expect(out).toContain("it's");
    expect(out).toContain("I'll");
  });

  it("warms up friendly rewrites", () => {
    const out = heuristicRegister("Hello, this is a very good proposal.", "friendly");
    expect(out.toLowerCase()).toContain("hey");
    expect(out).toContain("really");
  });

  it("upgrades everyday words for technical", () => {
    const out = heuristicRegister(
      "We should use this idea to fix the problem and show the result.",
      "technical"
    );
    expect(out).toContain("utilize");
    expect(out).toContain("resolve");
    expect(out).toContain("demonstrate");
  });

  it("supports every advertised register", () => {
    for (const register of REGISTERS) {
      const out = heuristicRegister("Hello, we will fix the stuff for the client.", register);
      expect(out.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("parseToneReport", () => {
  it("parses a well-formed model report", () => {
    const raw = JSON.stringify({
      tones: [{ label: "Friendly", confidence: 0.8, note: "warm opener" }],
      summary: "Friendly with a clear ask.",
    });
    const parsed = parseToneReport(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.tones[0].label).toBe("friendly");
    expect(parsed!.summary).toContain("Friendly");
  });

  it("survives code fences around the JSON", () => {
    const raw = '```json\n{"tones":[{"label":"formal","confidence":0.7,"note":"structured"}],"summary":"Formal tone."}\n```';
    expect(parseToneReport(raw)?.tones[0].label).toBe("formal");
  });

  it("rejects free prose and malformed JSON", () => {
    expect(parseToneReport("This text sounds quite casual to me.")).toBeNull();
    expect(parseToneReport("{not json")).toBeNull();
    expect(parseToneReport(JSON.stringify({ tones: [], summary: "" }))).toBeNull();
  });

  it("rejects out-of-range confidence", () => {
    const raw = JSON.stringify({
      tones: [{ label: "casual", confidence: 3.2, note: "note" }],
      summary: "s",
    });
    expect(parseToneReport(raw)).toBeNull();
  });
});
