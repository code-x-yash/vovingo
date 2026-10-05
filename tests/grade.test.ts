import { describe, expect, it } from "vitest";
import { blankCountFor, gradeExercise, normalizeText, type ExerciseLike } from "../lib/exercises/grade";

const mcq = (over: Partial<ExerciseLike> = {}): ExerciseLike => ({
  type: "mcq",
  prompt: { question: "Pick one." },
  options: ["A", "B"],
  correctAnswer: "A",
  explanation: "because",
  ...over,
});

describe("normalizeText", () => {
  it("ignores case, punctuation and spacing", () => {
    expect(normalizeText("  I have been working here since March. ")).toBe(
      "i have been working here since march"
    );
    expect(normalizeText("Don't  worry — it's fine!")).toBe("don t worry it s fine");
  });
});

describe("mcq / choose_natural", () => {
  it("matches the exact option", () => {
    expect(gradeExercise(mcq(), "A").correct).toBe(true);
    expect(gradeExercise(mcq(), "B").correct).toBe(false);
    expect(gradeExercise(mcq(), "a.").correct).toBe(true);
    expect(gradeExercise(mcq(), "B").expected).toEqual(["A"]);
    expect(gradeExercise(mcq(), "A").expected).toBeNull();
  });

  it("works for choose_natural", () => {
    const ex = mcq({ type: "choose_natural", correctAnswer: "I enjoy reading." });
    expect(gradeExercise(ex, "I enjoy reading.").correct).toBe(true);
    expect(gradeExercise(ex, "I enjoy to read.").correct).toBe(false);
  });
});

describe("fill_blank", () => {
  it("grades a single blank case-insensitively", () => {
    const ex: ExerciseLike = {
      type: "fill_blank",
      prompt: { sentence: "She ______ (live) in Berlin for five years." },
      correctAnswer: "has been living",
      explanation: "x",
    };
    expect(gradeExercise(ex, "has been living").correct).toBe(true);
    expect(gradeExercise(ex, "  Has Been Living ").correct).toBe(true);
    expect(gradeExercise(ex, "lives").correct).toBe(false);
    expect(blankCountFor(ex)).toBe(1);
  });

  it("treats an empty answer as \"no article\"", () => {
    const ex: ExerciseLike = {
      type: "fill_blank",
      prompt: { sentence: "Let's grab ___ dinner after the meeting." },
      correctAnswer: "",
      explanation: "x",
    };
    expect(gradeExercise(ex, "").correct).toBe(true);
    expect(gradeExercise(ex, "-").correct).toBe(true);
    expect(gradeExercise(ex, "no article").correct).toBe(true);
    expect(gradeExercise(ex, "a").correct).toBe(false);
  });

  it("grades positional multi-blank answers", () => {
    const ex: ExerciseLike = {
      type: "fill_blank",
      prompt: { sentence: "Yesterday I ___ (buy) a charger and ___ (give) it to him." },
      correctAnswer: ["bought", "gave"],
      explanation: "x",
    };
    expect(gradeExercise(ex, ["bought", "gave"]).correct).toBe(true);
    expect(gradeExercise(ex, ["gave", "bought"]).correct).toBe(false);
    expect(gradeExercise(ex, ["bought"]).correct).toBe(false);
    expect(blankCountFor(ex)).toBe(2);
  });

  it("accepts a flat typed string for multi-blank answers", () => {
    const ex: ExerciseLike = {
      type: "fill_blank",
      prompt: { sentence: "Everyone ___ (be) welcome and each ___ (have) a badge." },
      correctAnswer: ["is", "has"],
      explanation: "x",
    };
    expect(gradeExercise(ex, "is, has").correct).toBe(true);
    expect(gradeExercise(ex, "is has").correct).toBe(false);
  });

  it("does not accept substring impostors on word boundaries", () => {
    const ex: ExerciseLike = {
      type: "fill_blank",
      prompt: { sentence: "Everyone ___ (be) welcome." },
      correctAnswer: "is",
      explanation: "x",
    };
    expect(gradeExercise(ex, "is").correct).toBe(true);
    expect(gradeExercise(ex, "this island").correct).toBe(false);
    expect(gradeExercise(ex, "everyone is welcome").correct).toBe(true);
  });
});

describe("reorder", () => {
  const ex: ExerciseLike = {
    type: "reorder",
    prompt: { instruction: "Build it.", words: ["although", "the deadline moved", "we shipped"] },
    correctAnswer: ["although", "the deadline moved", "we shipped"],
    explanation: "x",
  };

  it("checks sequence order", () => {
    expect(gradeExercise(ex, ["although", "the deadline moved", "we shipped"]).correct).toBe(true);
    expect(gradeExercise(ex, ["we shipped", "although", "the deadline moved"]).correct).toBe(false);
    expect(gradeExercise(ex, ["although", "we shipped"]).correct).toBe(false);
    expect(blankCountFor(ex)).toBe(3);
  });

  it("tolerates punctuation/case drift", () => {
    expect(
      gradeExercise(ex, ["Although", "the deadline moved.", "we shipped"]).correct
    ).toBe(true);
  });
});

describe("open exercises", () => {
  it("grades write/speak as null (attempted, not scored)", () => {
    const write: ExerciseLike = {
      type: "write",
      prompt: { topic: "Write two sentences.", minWords: 30 },
      correctAnswer: null,
      explanation: "keep going",
    };
    expect(gradeExercise(write, "one two three").correct).toBeNull();
    expect(gradeExercise(write, "one two three").feedback).toContain("at least 30 words");
    const speak: ExerciseLike = {
      type: "speak",
      prompt: { target: "Hello" },
      correctAnswer: null,
      explanation: "nice",
    };
    expect(gradeExercise(speak, "Hello there").correct).toBeNull();
    expect(gradeExercise(speak, "Hello there").feedback).toBe("nice");
  });
});
