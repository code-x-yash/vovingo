import { describe, expect, it, afterEach } from "vitest";
import {
  buildRoleplayPrompt,
  generateChatReply,
  type RoleplayRequest,
} from "@/lib/ai/roleplay";
import type { CoachContext, ScenarioContext } from "@/lib/conversation/reply";

const scenario: ScenarioContext = {
  title: "Job interview",
  description: "You are interviewing for a front-end role.",
  persona: { role: "Hiring manager", name: "Dana", style: "friendly but sharp" },
  openingPrompt: "Tell me about yourself.",
};

const coach: CoachContext = {
  name: "Priya Sharma",
  streak: 4,
  skills: [{ skill: "grammar", score: 54 }],
  patterns: [{ title: "Article before a vowel sound", category: "grammar" }],
  dueWords: 3,
  lessonsDone: 6,
};

const history = [
  { role: "ai" as const, content: "Tell me about yourself." },
  { role: "user" as const, content: "I have three years of React experience." },
];

function scenarioReq(mockReply = "What made you proud of that project?"): RoleplayRequest {
  return { kind: "scenario", scenario, history, userText: "I shipped our design system.", mockReply };
}

function coachReq(mockReply = "Nice — want a quick drill?"): RoleplayRequest {
  return { kind: "coach", coach, history, userText: "I keep messing up articles.", mockReply };
}

describe("buildRoleplayPrompt", () => {
  it("includes scenario, persona, transcript and latest message", () => {
    const p = buildRoleplayPrompt(scenarioReq());
    expect(p).toContain("Scenario: Job interview");
    expect(p).toContain("Hiring manager, Dana, style: friendly but sharp");
    expect(p).toContain("Learner: I have three years of React experience.");
    expect(p).toContain("Coach: Tell me about yourself.");
    expect(p).toContain("Learner's latest message: I shipped our design system.");
    expect(p).toContain("Reply as your character.");
  });

  it("includes coach learner context", () => {
    const p = buildRoleplayPrompt(coachReq());
    expect(p).toContain("Learner: Priya Sharma (4-day streak)");
    expect(p).toContain("Article before a vowel sound");
    expect(p).toContain("Vocabulary due for review: 3");
    expect(p).toContain("Reply as the coach.");
  });

  it("caps the transcript window at the last 12 messages", () => {
    const long = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "ai") as "user" | "ai",
      content: `msg${i}`,
    }));
    const p = buildRoleplayPrompt({ ...scenarioReq(), history: long });
    expect(p).not.toContain("msg0\n");
    expect(p).not.toContain("msg15");
    expect(p).toContain("msg29");
    expect((p.match(/Learner: msg\d+|Coach: msg\d+/g) ?? []).length).toBe(12);
  });

  it("handles empty history", () => {
    const p = buildRoleplayPrompt({ ...scenarioReq(), history: [] });
    expect(p).toContain("(no messages yet)");
  });
});

describe("generateChatReply", () => {
  afterEach(() => {
    delete process.env.AI_PROVIDER;
  });

  it("returns the deterministic mock reply in mock mode", async () => {
    const { reply, usedModel } = await generateChatReply(scenarioReq());
    expect(reply).toBe("What made you proud of that project?");
    expect(usedModel).toBe(false);
  });

  it("uses the coach mock path too", async () => {
    const { reply, usedModel } = await generateChatReply(coachReq());
    expect(reply).toBe("Nice — want a quick drill?");
    expect(usedModel).toBe(false);
  });

  it("never returns an empty reply", async () => {
    const blank = await generateChatReply(scenarioReq("   "));
    expect(blank.reply).toBe("Tell me more about that.");
    const none = await generateChatReply(scenarioReq(""));
    expect(none.reply).toBe("Tell me more about that.");
  });
});
