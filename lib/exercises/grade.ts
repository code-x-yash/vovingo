export type ExerciseLike = {
  type: "mcq" | "fill_blank" | "reorder" | "match" | "speak" | "write" | "choose_natural";
  prompt: Record<string, unknown>;
  options?: string[] | null;
  correctAnswer?: string | string[] | null;
  explanation: string;
};

export type UserResponse = string | string[];

export type GradeResult = {
  correct: boolean | null;
  feedback: string;
  expected: string[] | null;
  blankCount: number;
};

const EMPTY_ANSWER_ALIASES = new Set(["", "-", "no article", "noarticle", "nothing", "zero", "n/a"]);

/** Case/punctuation-insensitive comparison key. */
export function normalizeText(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .toLowerCase()
    .replace(/[.,!?;:'"()[\]{}\u2014\u2013-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asList(response: UserResponse): string[] {
  return Array.isArray(response) ? response : [response];
}

function expectedList(correctAnswer: string | string[] | null | undefined): string[] {
  if (correctAnswer == null) return [];
  return Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
}

/** Heuristic split for multi-blank answers typed in one box: "bought, gave". */
function splitFlat(s: string): string[] {
  return s
    .split(/[,;/]| and /i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function sequenceEquals(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

export function blankCountFor(ex: ExerciseLike): number {
  if (ex.type === "reorder" || ex.type === "match") {
    const words = ex.prompt.words;
    if (Array.isArray(words)) return words.length;
    return expectedList(ex.correctAnswer).length || 1;
  }
  if (ex.type === "fill_blank") {
    if (Array.isArray(ex.correctAnswer)) return ex.correctAnswer.length;
    const sentence = typeof ex.prompt.sentence === "string" ? ex.prompt.sentence : "";
    const holes = (sentence.match(/_{3,}/g) ?? []).length;
    return Math.max(holes, 1);
  }
  return 1;
}

/**
 * Server-side grading. Never trust the client with correctAnswer.
 * Returns correct: null for open exercises (write/speak) — they count as attempted, not scored.
 */
export function gradeExercise(ex: ExerciseLike, response: UserResponse): GradeResult {
  const feedback = ex.explanation;

  if (ex.type === "write" || ex.type === "speak") {
    const words = asList(response).join(" ").split(/\s+/).filter(Boolean).length;
    const minWords = typeof ex.prompt.minWords === "number" ? ex.prompt.minWords : 0;
    if (ex.type === "write" && minWords > 0 && words < minWords) {
      return {
        correct: null,
        feedback: `Aim for at least ${minWords} words (${words} so far). ${feedback}`,
        expected: null,
        blankCount: 1,
      };
    }
    return { correct: null, feedback, expected: null, blankCount: 1 };
  }

  const expected = expectedList(ex.correctAnswer);
  const blankCount = blankCountFor(ex);

  if (ex.type === "mcq" || ex.type === "choose_natural") {
    const given = Array.isArray(response) ? response.join("") : response;
    const correct = normalizeText(given) === normalizeText(expected[0] ?? "");
    return {
      correct,
      feedback,
      expected: correct ? null : expected,
      blankCount,
    };
  }

  if (ex.type === "fill_blank") {
    const correct = Array.isArray(ex.correctAnswer)
      ? gradeMultiBlank(asList(response), expected)
      : gradeSingleBlank(Array.isArray(response) ? response.join(", ") : response, expected[0] ?? "");
    return {
      correct,
      feedback,
      expected: correct ? null : expected,
      blankCount,
    };
  }

  // reorder + match: positional sequence check
  const given = asList(response).map(normalizeText).filter((v) => v.length > 0);
  const want = expected.map(normalizeText);
  const correct = sequenceEquals(given, want);
  return {
    correct,
    feedback,
    expected: correct ? null : expected,
    blankCount,
  };
}

function gradeSingleBlank(given: string, want: string): boolean {
  const g = normalizeText(given);
  const w = normalizeText(want);
  if (w === "") return EMPTY_ANSWER_ALIASES.has(g);
  if (g === w) return true;
  if (g.length === 0) return false;
  // Tolerate extra context around the answer, but only on word boundaries
  // ("this island" must not satisfy "is").
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const whole = (needle: string, hay: string) =>
    new RegExp(`(^|\\s)${esc(needle)}($|\\s)`).test(hay);
  return whole(w, g) || whole(g, w);
}

function gradeMultiBlank(given: string[], want: string[]): boolean {
  let parts = given.map((g) => g.trim()).filter((g) => g.length > 0);
  if (parts.length === 1 && want.length > 1) parts = splitFlat(parts[0]);
  if (parts.length !== want.length) return false;
  return parts.every((g, i) => gradeSingleBlank(g, want[i]));
}
