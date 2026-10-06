import { TONE_PAIRS } from "./tone";

export type SpeedrunMode = "vocab" | "grammar" | "tone";

export type SpeedrunQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  why?: string;
};

export const ROUND_SIZE = 10;

export const MODE_META: Record<
  SpeedrunMode,
  { label: string; blurb: string; seconds: number }
> = {
  vocab: {
    label: "Vocab dash",
    blurb: "Pick the right meaning before the clock runs out.",
    seconds: 6,
  },
  grammar: {
    label: "Grammar fix",
    blurb: "Spot the sentence that's actually correct.",
    seconds: 7,
  },
  tone: {
    label: "Tone up",
    blurb: "Choose the line you'd send a client.",
    seconds: 8,
  },
};

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function sample<T>(items: T[], count: number): T[] {
  return shuffle(items).slice(0, count);
}

/** Places `correct` among `distractors`, all shuffled. */
export function buildOptions(
  correct: string,
  distractors: string[]
): { options: string[]; correctIndex: number } {
  const options = shuffle([correct, ...distractors]);
  return { options, correctIndex: options.indexOf(correct) };
}

export type VocabRow = { id: number; word: string; definition: string };
export type GrammarRow = { id: number; wrongExample: string; correctExample: string };

export function buildVocabRound(rows: VocabRow[]): SpeedrunQuestion[] {
  const picked = sample(rows, ROUND_SIZE);
  const pool = rows.map((r) => r.definition);
  return picked.map((row) => {
    const distractors = sample(
      pool.filter((definition) => definition !== row.definition),
      3
    );
    const { options, correctIndex } = buildOptions(row.definition, distractors);
    return {
      id: `v${row.id}`,
      prompt: row.word,
      options,
      correctIndex,
    };
  });
}

export function buildGrammarRound(rows: GrammarRow[]): SpeedrunQuestion[] {
  const picked = sample(rows, ROUND_SIZE);
  return picked.map((row) => {
    const { options, correctIndex } = buildOptions(row.correctExample, [row.wrongExample]);
    return {
      id: `g${row.id}`,
      prompt: "Which sentence is correct?",
      options,
      correctIndex,
    };
  });
}

export function buildToneRound(): SpeedrunQuestion[] {
  const picked = sample(TONE_PAIRS, Math.min(ROUND_SIZE, TONE_PAIRS.length));
  return picked.map((pair) => {
    const { options, correctIndex } = buildOptions(pair.formal, [pair.casual]);
    return {
      id: pair.id,
      prompt: pair.casual,
      options,
      correctIndex,
      why: pair.why,
    };
  });
}

/** XP: 5 per correct answer, capped per round. */
export function xpForRun(correct: number): number {
  return Math.min(50, Math.max(0, correct) * 5);
}

/** Rejects impossible score claims (anti-cheat sanity, not proof). */
export function isPlausibleRun(input: {
  correct: number;
  total: number;
  scoreMs: number;
}): boolean {
  if (input.total !== ROUND_SIZE) return false;
  if (!Number.isInteger(input.correct) || input.correct < 0 || input.correct > input.total) {
    return false;
  }
  // 10 questions × at least 500ms of human reaction time.
  if (input.scoreMs < 5_000 || input.scoreMs > 600_000) return false;
  return true;
}
