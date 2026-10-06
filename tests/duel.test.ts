import { afterEach, describe, expect, it } from "vitest";
import {
  DUEL_TOPICS,
  deriveWinner,
  judgeDuel,
  mockVerdict,
  parseVerdict,
  pickRivalBar,
  pickTopic,
  topicById,
} from "@/lib/duel/engine";

describe("topics", () => {
  it("has six topics with unique ids and a rival bar each", () => {
    expect(DUEL_TOPICS).toHaveLength(6);
    const ids = new Set(DUEL_TOPICS.map((t) => t.id));
    expect(ids.size).toBe(6);
    for (const t of DUEL_TOPICS) {
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.prompt.length).toBeGreaterThan(0);
      expect(t.rivalBars.length).toBeGreaterThan(0);
      for (const bar of t.rivalBars) expect(bar.length).toBeGreaterThan(16);
    }
  });

  it("pickTopic walks every topic deterministically", () => {
    expect(pickTopic(0).id).toBe(DUEL_TOPICS[0].id);
    expect(pickTopic(6).id).toBe(DUEL_TOPICS[0].id);
    expect(pickTopic(-1).id).toBe(DUEL_TOPICS[1].id);
    const seen = new Set(DUEL_TOPICS.map((_, i) => pickTopic(i).id));
    expect(seen.size).toBe(6);
  });

  it("topicById round-trips and rejects unknown ids", () => {
    for (const t of DUEL_TOPICS) expect(topicById(t.id)?.id).toBe(t.id);
    expect(topicById("nope")).toBeNull();
    expect(topicById("")).toBeNull();
  });

  it("pickRivalBar stays inside the topic's bars and is deterministic", () => {
    const topic = DUEL_TOPICS[0];
    const bar = pickRivalBar(topic, 17);
    expect(topic.rivalBars).toContain(bar);
    expect(pickRivalBar(topic, 17)).toBe(bar);
    expect(pickRivalBar(topic, -3)).toBe(topic.rivalBars[3 % topic.rivalBars.length]);
  });
});

describe("mockVerdict", () => {
  const topic = DUEL_TOPICS[1];

  it("keeps both scores in range and derives the winner", () => {
    const v = mockVerdict(
      topic,
      "I ship the build before the clock strikes nine.",
      topic.rivalBars[0]
    );
    expect(v.you).toBeGreaterThanOrEqual(5);
    expect(v.you).toBeLessThanOrEqual(98);
    expect(v.rivalScore).toBeGreaterThanOrEqual(5);
    expect(v.rivalScore).toBeLessThanOrEqual(98);
    expect(v.winner).toBe(deriveWinner(v.you, v.rivalScore));
    expect(v.note.length).toBeGreaterThan(0);
    expect(v.rival).toBe(topic.rivalBars[0]);
  });

  it("scores a fuller bar above a stub", () => {
    const strong = mockVerdict(
      topic,
      "Clock ticks loud, the build is green, I ship it clean before the scene.",
      topic.rivalBars[0]
    );
    const stub = mockVerdict(topic, "okay fine go", topic.rivalBars[0]);
    expect(strong.you).toBeGreaterThan(stub.you);
  });

  it("is deterministic for identical inputs", () => {
    const bar = "Two lines of bars, two lines of fire.";
    expect(mockVerdict(topic, bar, topic.rivalBars[1])).toEqual(
      mockVerdict(topic, bar, topic.rivalBars[1])
    );
  });
});

describe("deriveWinner", () => {
  it("requires a two-point margin", () => {
    expect(deriveWinner(80, 75)).toBe("you");
    expect(deriveWinner(75, 80)).toBe("rival");
    expect(deriveWinner(78, 76)).toBe("you");
    expect(deriveWinner(77, 77)).toBe("tie");
    expect(deriveWinner(77, 78)).toBe("tie");
  });
});

describe("parseVerdict", () => {
  it("parses clean JSON and clamps scores", () => {
    const parsed = parseVerdict(
      JSON.stringify({
        rival: "Line one, line two.",
        you: 250,
        rivalScore: -40,
        note: "Solid try.",
      })
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.you).toBe(98);
    expect(parsed?.rivalScore).toBe(5);
    expect(parsed?.rival).toBe("Line one, line two.");
    expect(parsed?.note).toBe("Solid try.");
  });

  it("accepts fenced JSON", () => {
    const fenced =
      "```json\n" +
      JSON.stringify({ rival: "Bars here.", you: 71, rivalScore: 66, note: "Nice." }) +
      "\n```";
    const parsed = parseVerdict(fenced);
    expect(parsed?.you).toBe(71);
    expect(parsed?.rival).toBe("Bars here.");
  });

  it("rejects garbage, wrong types and missing fields", () => {
    expect(parseVerdict("the judge shrugs")).toBeNull();
    expect(parseVerdict("")).toBeNull();
    expect(
      parseVerdict(JSON.stringify({ rival: "x", you: "high", rivalScore: 70, note: "ok" }))
    ).toBeNull();
    expect(parseVerdict(JSON.stringify({ you: 70, rivalScore: 70, note: "ok" }))).toBeNull();
  });
});

describe("judgeDuel", () => {
  afterEach(() => {
    delete process.env.AI_PROVIDER;
  });

  it("resolves with the deterministic verdict in mock mode", async () => {
    const topic = DUEL_TOPICS[2];
    const bar = "Queue keeps crawling, wallet keeps falling, but I keep talking.";
    const { verdict, usedModel } = await judgeDuel(topic, bar);
    const rivalBar = pickRivalBar(topic, bar.length + topic.title.length);
    expect(usedModel).toBe(false);
    expect(verdict).toEqual(mockVerdict(topic, bar, rivalBar));
  });

  it("always returns a verdict inside range", async () => {
    const topic = DUEL_TOPICS[4];
    const { verdict } = await judgeDuel(topic, "Short but earnest, two lines of honest verse.");
    expect(verdict.you).toBeGreaterThanOrEqual(5);
    expect(verdict.you).toBeLessThanOrEqual(98);
    expect(["you", "rival", "tie"]).toContain(verdict.winner);
    expect(verdict.rival.length).toBeGreaterThan(0);
  });
});
