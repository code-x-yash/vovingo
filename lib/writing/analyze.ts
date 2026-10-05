import type { DetectedMistake } from "@/lib/db/schema";

export type WritingScores = {
  grammar: number;
  vocabulary: number;
  writing: number;
  overall: number;
};

export type WritingAnalysis = {
  scores: WritingScores;
  feedback: string[];
  corrected: string;
  natural: string;
  tone: string;
};

const SEVERITY_PENALTY: Record<"low" | "medium" | "high", number> = {
  low: 8,
  medium: 12,
  high: 16,
};

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Light mechanical fixes the mock "corrector" can honestly apply. */
export function applyMechanicalFixes(text: string): string {
  let out = text.replace(/\s+/g, " ").trim();
  out = out.replace(/\bi\b/g, "I");
  out = out.replace(
    /\ba\s+(apple|egg|orange|idea|issue|answer|example|hour|honest|umbrella|university)\b/gi,
    "an $1"
  );
  out = out.replace(
    /\ban\s+(book|car|house|phone|table|girl|boy|man|woman|user|one|unit)\b/gi,
    "a $1"
  );
  out = out.replace(/(^|[.!?]\s+)([a-z])/g, (_m, prefix: string, ch: string) => prefix + ch.toUpperCase());
  return out;
}

/** Removes accidentally repeated consecutive words. */
export function applyNaturalPolish(text: string): string {
  return text.replace(/\b([a-zA-Z']+)\s+\1\b/g, "$1");
}

function detectTone(text: string): string {
  if (/\b(therefore|furthermore|regarding|sincerely|pursuant|hereby|kindly)\b/i.test(text)) {
    return "formal";
  }
  if (/\b(please|could you|would you|appreciate|thank you)\b/i.test(text)) return "polite";
  if ((text.match(/!/g) ?? []).length >= 2 || /\b(love|amazing|awesome|fantastic)\b/i.test(text)) {
    return "enthusiastic";
  }
  return "neutral";
}

/**
 * Deterministic heuristic "AI" analysis for a writing submission: scores from
 * word count, lexical diversity and detected recurring patterns; mechanical
 * corrections plus a natural-polish pass.
 */
export function analyzeWriting(
  text: string,
  detected: DetectedMistake[] = [],
  opts: { minWords?: number } = {}
): WritingAnalysis {
  const words = countWords(text);
  const tokens = text.toLowerCase().match(/[a-z']+/g) ?? [];
  const unique = new Set(tokens).size;
  const ratio = words > 0 ? unique / words : 0;

  const grammarHits = detected.filter((d) => d.category === "grammar");
  const styleHits = detected.filter((d) =>
    ["style", "naturalness", "fluency"].includes(d.category)
  );

  const grammarPenalty = grammarHits.reduce((sum, d) => sum + SEVERITY_PENALTY[d.severity], 0);
  const grammar = clamp(95 - grammarPenalty - styleHits.length * 3, 30, 95);
  const vocabulary = clamp(Math.round(50 + ratio * 60), 40, 95);
  const writing = clamp(
    Math.round(55 + (Math.min(words, 140) / 140) * 35 - detected.length * 4),
    35,
    95
  );
  const overall = Math.round((grammar + vocabulary + writing) / 3);

  const corrected = applyMechanicalFixes(text);
  const natural = applyNaturalPolish(corrected);
  const tone = detectTone(text);

  const feedback: string[] = [];
  for (const d of detected.slice(0, 6)) {
    feedback.push(`${d.title} — try: “${d.correct}”. ${d.why}`);
  }
  const target = opts.minWords ?? 0;
  if (target > 0 && words < target) {
    feedback.push(`You wrote ${words} words — aim for at least ${target} to fully cover the prompt.`);
  } else {
    feedback.push(`${words} words — good length for this prompt.`);
  }
  if (detected.length === 0) {
    feedback.unshift("No recurring patterns spotted — this draft reads clean.");
  }
  feedback.push(`Tone reads as ${tone} — that suits this kind of writing.`);

  return {
    scores: { grammar, vocabulary, writing, overall },
    feedback,
    corrected,
    natural,
    tone,
  };
}
