import { afterEach, describe, expect, it } from "vitest";
import {
  buildStoryPrompt,
  continueStory,
  mockContinuation,
  storyTail,
} from "@/lib/story/ai";

const entries = Array.from({ length: 12 }, (_, i) => ({
  chapter: i + 1,
  text: `Chapter ${i + 1} text.`,
}));

describe("mockContinuation", () => {
  it("is deterministic and non-empty for any chapter", () => {
    expect(mockContinuation(3)).toBe(mockContinuation(3));
    expect(mockContinuation(3).length).toBeGreaterThan(16);
    expect(mockContinuation(1)).not.toBe(mockContinuation(2));
  });

  it("handles negative seeds without throwing", () => {
    expect(mockContinuation(-1).length).toBeGreaterThan(0);
  });
});

describe("storyTail", () => {
  it("caps at the last 8 entries", () => {
    const tail = storyTail(entries);
    expect(tail.length).toBe(8);
    expect(tail[0].chapter).toBe(5);
    expect(tail[7].chapter).toBe(12);
  });

  it("respects the character budget", () => {
    const long = Array.from({ length: 8 }, (_, i) => ({
      chapter: i + 1,
      text: "x".repeat(400),
    }));
    const tail = storyTail(long);
    expect(tail.length).toBe(2);
    expect(tail[0].chapter).toBe(7);
  });

  it("passes short lists through untouched", () => {
    const short = entries.slice(0, 3);
    expect(storyTail(short)).toEqual(short);
  });
});

describe("buildStoryPrompt", () => {
  it("includes the tail chapters and the next chapter number", () => {
    const p = buildStoryPrompt(entries, 13);
    expect(p).toContain("Chapter 12:");
    expect(p).toContain("Chapter 5:");
    expect(p).not.toContain("Chapter 4:");
    expect(p).toContain("ONLY chapter 13");
  });

  it("handles an empty story", () => {
    const p = buildStoryPrompt([], 1);
    expect(p).toContain("(the story hasn't started yet)");
    expect(p).toContain("ONLY chapter 1");
  });
});

describe("continueStory", () => {
  afterEach(() => {
    delete process.env.AI_PROVIDER;
  });

  it("returns the deterministic beat in mock mode", async () => {
    const out = await continueStory(entries, 5);
    expect(out.usedModel).toBe(false);
    expect(out.text).toBe(mockContinuation(5));
  });
});
