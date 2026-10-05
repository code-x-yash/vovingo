import { describe, expect, it } from "vitest";
import {
  coachReply,
  initialCoachMessage,
  initialScenarioMessage,
  scenarioReply,
  type ChatMessage,
  type CoachContext,
  type ScenarioContext,
} from "../lib/conversation/reply";

function ctx(overrides: Partial<CoachContext> = {}): CoachContext {
  return {
    name: "Maya Sharma",
    streak: 5,
    skills: [
      { skill: "grammar", score: 42 },
      { skill: "fluency", score: 71 },
      { skill: "vocabulary", score: 60 },
    ],
    patterns: [{ title: "Missing articles before consonant sounds", category: "grammar" }],
    dueWords: 7,
    lessonsDone: 12,
    ...overrides,
  };
}

const scenario: ScenarioContext = {
  title: "Job interview: Frontend developer",
  description: "You are being interviewed for a frontend role.",
  persona: { role: "Interviewer", name: "Ms. Patel", style: "formal" },
  openingPrompt: null,
};

describe("initialCoachMessage", () => {
  it("mentions first name, streak and top pattern", () => {
    const msg = initialCoachMessage(ctx());
    expect(msg).toContain("Maya");
    expect(msg).toContain("5-day streak");
    expect(msg).toContain("Missing articles");
  });

  it("falls back to lowest skill when no patterns", () => {
    const msg = initialCoachMessage(ctx({ patterns: [] }));
    expect(msg).toContain("grammar");
    expect(msg).toContain("42");
  });

  it("is deterministic", () => {
    expect(initialCoachMessage(ctx())).toBe(initialCoachMessage(ctx()));
  });
});

describe("coachReply", () => {
  const history: ChatMessage[] = [{ role: "ai", content: "hi" }];

  it("routes the practice question to the plan rule", () => {
    const reply = coachReply(history, ctx(), "What should I practise today?");
    expect(reply).toContain("practise the");
    expect(reply).toContain("due words");
  });

  it("routes grammar keywords to the grammar rule", () => {
    const reply = coachReply(history, ctx(), "Help me with grammar");
    expect(reply).toContain("Missing articles");
    expect(reply).toContain("quiz");
  });

  it("routes vocabulary keywords to the due-words rule", () => {
    const reply = coachReply(history, ctx(), "I need more vocabulary words");
    expect(reply).toContain("7 words");
    expect(reply).toContain("due for review");
  });

  it("says nothing is due when dueWords is zero", () => {
    const reply = coachReply(history, ctx({ dueWords: 0 }), "any words to review?");
    expect(reply).toContain("Nothing due");
  });

  it("routes streak keywords", () => {
    const reply = coachReply(history, ctx(), "how is my streak?");
    expect(reply).toContain("5 days");
    expect(reply).toContain("12 lessons");
  });

  it("routes greetings and thanks", () => {
    expect(coachReply(history, ctx(), "hello!")).toContain("work on today");
    expect(coachReply(history, ctx(), "thanks a lot")).toContain("Anytime");
  });

  it("uses a deterministic rotating fallback for unknown input", () => {
    const a = coachReply(history, ctx(), "something completely different");
    const b = coachReply(history, ctx(), "something completely different");
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(10);
  });

  it("fallback rotates with turn count", () => {
    const h2: ChatMessage[] = [
      ...history,
      { role: "user", content: "one" },
      { role: "ai", content: "…" },
      { role: "user", content: "two" },
      { role: "ai", content: "…" },
    ];
    const r1 = coachReply(history, ctx(), "zzz unknown");
    const r3 = coachReply(h2, ctx(), "zzz unknown");
    expect(r1).not.toBe(r3);
  });

  it("handles empty text", () => {
    expect(coachReply(history, ctx(), "   ")).toContain("again");
  });
});

describe("initialScenarioMessage", () => {
  it("prefers persona.opening", () => {
    const msg = initialScenarioMessage({
      ...scenario,
      openingPrompt: "prompt text",
      persona: { ...scenario.persona!, opening: "Please sit down." },
    });
    expect(msg).toBe("Please sit down.");
  });

  it("falls back to openingPrompt then default", () => {
    expect(initialScenarioMessage({ ...scenario, openingPrompt: "From the prompt." })).toBe(
      "From the prompt."
    );
    const def = initialScenarioMessage({ ...scenario, openingPrompt: null, persona: null });
    expect(def).toContain("job interview: frontend developer");
    expect(def.toLowerCase()).toContain("let's talk about");
  });

  it("uses persona name in the default line", () => {
    const msg = initialScenarioMessage({
      ...scenario,
      openingPrompt: null,
      persona: { role: "Interviewer", name: "Ms. Patel" },
    });
    expect(msg).toContain("Ms. Patel");
  });
});

describe("scenarioReply", () => {
  const history: ChatMessage[] = [{ role: "ai", content: "opening" }];

  it("acknowledges with persona name on longer answers", () => {
    const reply = scenarioReply(history, scenario, "I have three years of experience with React.");
    expect(reply).toContain("Ms. Patel");
    expect(reply).toMatch(/\?$/);
  });

  it("rotates follow-ups across turns deterministically", () => {
    const h3: ChatMessage[] = [
      ...history,
      { role: "user", content: "first long enough answer here" },
      { role: "ai", content: "…" },
      { role: "user", content: "second long enough answer" },
      { role: "ai", content: "…" },
    ];
    const t1 = scenarioReply(history, scenario, "this is the first long answer ok");
    const t2 = scenarioReply(h3, scenario, "and this is another long answer");
    expect(t1).not.toBe(t2);
    expect(scenarioReply(history, scenario, "this is the first long answer ok")).toBe(t1);
  });

  it("uses a fallback line for very short replies", () => {
    const reply = scenarioReply(history, scenario, "Yes");
    expect(reply.endsWith("?")).toBe(true);
    expect(reply).not.toContain("Ms. Patel");
  });

  it("handles empty text", () => {
    expect(scenarioReply(history, scenario, " ")).toContain("catch that");
  });

  it("works without a persona", () => {
    const reply = scenarioReply(history, { ...scenario, persona: null }, "Here is my longer answer text.");
    expect(reply.startsWith("Could you") || reply.endsWith("?")).toBe(true);
  });
});
