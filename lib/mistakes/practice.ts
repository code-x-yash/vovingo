export type PracticeMistake = {
  id: number;
  key: string;
  title: string;
  category: string;
  wrongExample: string;
  correctExample: string;
  why: string;
};

export type PracticeQuestionKind = "choose_correct" | "spot_wrong" | "why";

export type PracticeQuestion = {
  id: number;
  kind: PracticeQuestionKind;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type PublicPracticeQuestion = Pick<
  PracticeQuestion,
  "id" | "kind" | "prompt" | "options"
>;

export type PracticeResult = {
  correct: boolean;
  correctIndex: number;
  explanation: string;
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim();
    if (v.length === 0 || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/**
 * Assembles answer + distractors into shuffled options. Returns null when no
 * usable distractor exists (never emit a one-option "quiz").
 */
function buildOptions(
  answer: string,
  distractorPool: string[],
  take: number,
  rnd: () => number
): { options: string[]; correctIndex: number } | null {
  const answerTrimmed = answer.trim();
  if (answerTrimmed.length === 0) return null;
  const distractors = shuffle(
    uniqueNonEmpty(distractorPool).filter((v) => v !== answerTrimmed),
    rnd
  ).slice(0, take);
  if (distractors.length === 0) return null;
  const options = shuffle([answerTrimmed, ...distractors], rnd);
  return { options, correctIndex: options.indexOf(answerTrimmed) };
}

function shorten(text: string, max = 70): string {
  const clean = text.trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

/**
 * Deterministic practice quiz for one mistake: choose-the-correct,
 * spot-the-problem and why-is-it-wrong, using other catalog mistakes as
 * distractors. Same (mistake, pool, seed) always yields the same questions —
 * the server rebuilds them to grade, so client and server agree.
 */
export function buildPracticeQuestions(
  mistake: PracticeMistake,
  pool: PracticeMistake[],
  seed: number
): PracticeQuestion[] {
  const others = pool.filter((o) => o.id !== mistake.id);
  if (others.length === 0) return [];

  const questions: PracticeQuestion[] = [];
  const rndFor = (i: number) => mulberry32(((seed >>> 0) * 31 + i * 7 + 1) >>> 0);

  const q1 = buildOptions(
    mistake.correctExample,
    others.map((o) => o.correctExample),
    3,
    rndFor(questions.length)
  );
  if (q1) {
    questions.push({
      id: questions.length,
      kind: "choose_correct",
      prompt: "Which sentence is correct?",
      options: q1.options,
      correctIndex: q1.correctIndex,
      explanation: mistake.why,
    });
  }

  const q2 = buildOptions(
    mistake.wrongExample,
    others.map((o) => o.correctExample),
    3,
    rndFor(questions.length)
  );
  if (q2) {
    questions.push({
      id: questions.length,
      kind: "spot_wrong",
      prompt: "Which sentence contains the problem described above?",
      options: q2.options,
      correctIndex: q2.correctIndex,
      explanation: `Correct form: “${mistake.correctExample}” — ${mistake.why}`,
    });
  }

  const q3 = buildOptions(
    mistake.why,
    others.map((o) => o.why),
    2,
    rndFor(questions.length)
  );
  if (q3) {
    questions.push({
      id: questions.length,
      kind: "why",
      prompt: `Why is “${shorten(mistake.wrongExample)}” a problem?`,
      options: q3.options,
      correctIndex: q3.correctIndex,
      explanation: `→ ${mistake.correctExample}`,
    });
  }

  return questions;
}

/** Server-side grading — null or out-of-range answers count as wrong. */
export function gradePractice(
  questions: PracticeQuestion[],
  answers: (number | null | undefined)[]
): { results: PracticeResult[]; correctCount: number; total: number; score: number } {
  const results = questions.map((q, i) => {
    const a = answers[i];
    const correct =
      typeof a === "number" && Number.isInteger(a) && a >= 0 && a < q.options.length && a === q.correctIndex;
    return { correct, correctIndex: q.correctIndex, explanation: q.explanation };
  });
  const total = questions.length;
  const correctCount = results.filter((r) => r.correct).length;
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  return { results, correctCount, total, score };
}

/** Strips answers for the client payload (the server re-grades on submit). */
export function toPublicQuestions(questions: PracticeQuestion[]): PublicPracticeQuestion[] {
  return questions.map((q) => ({
    id: q.id,
    kind: q.kind,
    prompt: q.prompt,
    options: q.options,
  }));
}
