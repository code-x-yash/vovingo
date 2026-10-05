export type SpeakingMetrics = {
  wordCount: number;
  uniqueWordCount: number;
  wpm: number;
  sentenceCount: number;
  pauseCount: number;
  longPauseCount: number;
  avgPauseMs: number;
  fillerCount: number;
  fillerRatio: number;
  topTokenShare: number;
  avgWordLen: number;
  contractionCount: number;
  connectorCount: number;
  hedgeCount: number;
  hasPunctuation: boolean;
};

/** Standalone hesitation tokens that STT reliably transcribes as words. */
export const FILLER_TOKENS = new Set([
  "um",
  "uh",
  "uhm",
  "erm",
  "er",
  "hmm",
  "mhm",
  "mmm",
  "ah",
  "eh",
]);

/** Multi-word discourse markers counted as fillers too. */
const FILLER_PHRASES = ["you know", "i mean"];

const CONNECTORS = [
  "because",
  "but",
  "so",
  "although",
  "though",
  "while",
  "however",
  "actually",
  "honestly",
  "since",
  "plus",
  "whereas",
  "then",
  "instead",
];

const HEDGES = ["i think", "maybe", "probably", "kind of", "sort of", "not sure", "just", "perhaps"];

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Deterministic, transcript-only fluency metrics.
 *
 * `pauseCount`/`avgPauseMs` are proxies: transcripts have no timing data, so a
 * sentence boundary counts as a pause point and average time-per-sentence is
 * derived from the recorded duration. Real pause timing arrives with audio
 * analysis in a later phase.
 */
export function computeMetrics(transcript: string, durationSec: number): SpeakingMetrics {
  const text = transcript.trim();
  const tokens = text.toLowerCase().match(/[a-z']+/g) ?? [];
  const wordCount = tokens.length;

  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  let topTokenShare = 0;
  for (const n of freq.values()) topTokenShare = Math.max(topTokenShare, n / Math.max(wordCount, 1));

  let fillerCount = 0;
  for (const t of tokens) if (FILLER_TOKENS.has(t)) fillerCount += 1;
  const lowerText = text.toLowerCase();
  for (const phrase of FILLER_PHRASES) {
    let idx = lowerText.indexOf(phrase);
    while (idx !== -1) {
      fillerCount += 1;
      idx = lowerText.indexOf(phrase, idx + phrase.length);
    }
  }

  const sentenceBreaks = (text.match(/[.!?]+/g) ?? []).length;
  const sentenceCount = wordCount === 0 ? 0 : Math.max(1, sentenceBreaks);
  const longPauseCount = (text.match(/\.{3}|…/g) ?? []).length;

  const minutes = Math.max(durationSec, 1) / 60;
  const uniqueWordCount = freq.size;
  const avgWordLen =
    wordCount === 0 ? 0 : round1(tokens.reduce((sum, t) => sum + t.length, 0) / wordCount);

  return {
    wordCount,
    uniqueWordCount,
    wpm: wordCount === 0 ? 0 : round1(wordCount / minutes),
    sentenceCount,
    pauseCount: sentenceCount,
    longPauseCount,
    avgPauseMs:
      sentenceCount === 0 || durationSec <= 0
        ? 0
        : Math.round((durationSec * 1000) / (sentenceCount + 1)),
    fillerCount,
    fillerRatio: wordCount === 0 ? 0 : round1((fillerCount / wordCount) * 1000) / 1000,
    topTokenShare: round1(topTokenShare * 1000) / 1000,
    avgWordLen,
    contractionCount: (lowerText.match(/\b\w+'\w+\b/g) ?? []).length,
    connectorCount: CONNECTORS.reduce(
      (n, c) => n + countWordOccurrence(lowerText, c),
      0
    ),
    hedgeCount: HEDGES.reduce((n, h) => n + lowerText.split(h).length - 1, 0),
    hasPunctuation: /[.!?]/.test(text),
  };
}

function countWordOccurrence(lowerText: string, word: string): number {
  const re = new RegExp(`\\b${word}\\b`, "g");
  return (lowerText.match(re) ?? []).length;
}
