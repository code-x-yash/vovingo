import { describe, expect, it } from "vitest";
import {
  gradeListening,
  toPublicQuestions,
  type ListeningQuestion,
} from "../lib/listening/grade";

function q(id: number, correctIndex: number): ListeningQuestion {
  return {
    id,
    type: "detail",
    prompt: `Question ${id}?`,
    options: ["A", "B", "C"],
    correctIndex,
    explanation: `Because answer ${correctIndex}.`,
  };
}

describe("gradeListening", () => {
  it("scores a perfect attempt at 100", () => {
    const g = gradeListening([q(1, 0), q(2, 2)], [0, 2]);
    expect(g.score).toBe(100);
    expect(g.correctCount).toBe(2);
    expect(g.total).toBe(2);
    expect(g.results.every((r) => r.correct)).toBe(true);
  });

  it("scores partial attempts by proportion", () => {
    const g = gradeListening([q(1, 0), q(2, 1), q(3, 2), q(4, 0)], [0, 2, 2, 1]);
    expect(g.correctCount).toBe(2);
    expect(g.score).toBe(50);
    expect(g.results[1].correct).toBe(false);
    expect(g.results[3].correct).toBe(false);
  });

  it("treats null and missing answers as wrong", () => {
    const g = gradeListening([q(1, 0), q(2, 1), q(3, 2)], [null]);
    expect(g.correctCount).toBe(0);
    expect(g.score).toBe(0);
    expect(g.results).toHaveLength(3);
    expect(g.results[0].correct).toBe(false);
    expect(g.results[2].correct).toBe(false);
  });

  it("rejects out-of-range answers", () => {
    const questions = [q(1, 0), q(2, 1)];
    expect(gradeListening(questions, [5, -1]).score).toBe(0);
    expect(gradeListening(questions, [0.5 as unknown as number, 1]).correctCount).toBe(1);
  });

  it("returns zero on an empty question set", () => {
    const g = gradeListening([], []);
    expect(g.score).toBe(0);
    expect(g.total).toBe(0);
  });

  it("keeps results aligned with question order and carries explanations", () => {
    const g = gradeListening([q(7, 2), q(3, 0)], [2, 1]);
    expect(g.results.map((r) => r.questionId)).toEqual([7, 3]);
    expect(g.results[0].correct).toBe(true);
    expect(g.results[0].explanation).toBe("Because answer 2.");
    expect(g.results[1].correctIndex).toBe(0);
  });
});

describe("toPublicQuestions", () => {
  it("strips correctIndex and explanation", () => {
    const pub = toPublicQuestions([q(1, 2)]);
    expect(pub[0]).toEqual({ id: 1, type: "detail", prompt: "Question 1?", options: ["A", "B", "C"] });
    expect("correctIndex" in pub[0]).toBe(false);
    expect("explanation" in pub[0]).toBe(false);
  });
});
