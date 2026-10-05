import { computeMetrics, type SpeakingMetrics } from "./metrics";
import { detectMistakes, type DetectRule } from "@/lib/mistakes/detect";
import type { DetectedMistake, Recommendation } from "@/lib/db/schema";

export type SkillScores = {
  grammar: number;
  vocabulary: number;
  fluency: number;
  pronunciation: number;
  confidence: number;
  naturalness: number;
};

export type SpeakingInput = {
  transcript: string;
  durationSec: number;
  prompt?: string | null;
  rules: DetectRule[];
};

export type SpeakingResult = {
  metrics: SpeakingMetrics;
  scores: SkillScores;
  mistakes: DetectedMistake[];
  summary: string;
  recommendations: Recommendation[];
};

export type ProviderCall = {
  result: SpeakingResult;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
};

export interface AIProvider {
  readonly name: string;
  readonly model: string | null;
  analyzeSpeaking(input: SpeakingInput): Promise<ProviderCall>;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Piecewise-linear interpolation over anchor points [[x,y], …]. */
function piecewise(x: number, anchors: [number, number][]): number {
  if (x <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    const [x1, y1] = anchors[i - 1];
    const [x2, y2] = anchors[i];
    if (x <= x2) return y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
  }
  return anchors[anchors.length - 1][1];
}

/** WPM fit: 115–155 is the sweet spot (plateau), crawl and sprint both score lower. */
export function wpmFit(wpm: number): number {
  return piecewise(wpm, [
    [0, 0],
    [40, 30],
    [70, 55],
    [95, 78],
    [115, 100],
    [155, 100],
    [185, 88],
    [230, 65],
    [320, 45],
  ]);
}

export function scoreFluency(m: SpeakingMetrics): number {
  if (m.wordCount === 0) return 0;
  // fillers per minute ≈ fillerRatio * wpm
  const fillersPerMin = m.fillerRatio * m.wpm;
  const fillerPenalty = Math.min(20, Math.max(0, fillersPerMin - 1.5) * 5);
  const pausePenalty = Math.min(15, m.longPauseCount * 3);
  return r1(clamp(wpmFit(m.wpm) - fillerPenalty - pausePenalty));
}

export function scoreGrammar(mistakes: DetectedMistake[], wordCount: number): number {
  if (wordCount === 0) return 0;
  const weight = { high: 1.4, medium: 1, low: 0.6 } as const;
  const drag = mistakes.reduce((sum, d) => sum + weight[d.severity], 0) * 8;
  const score = clamp(100 - drag);
  // Tiny samples can't prove grammar skill — nudge toward a neutral midpoint.
  return r1(wordCount < 12 ? score * 0.7 + 60 * 0.3 : score);
}

export function scoreVocabulary(m: SpeakingMetrics): number {
  if (m.wordCount === 0) return 0;
  const diversity = r1((m.uniqueWordCount / m.wordCount) * 1000) / 1000;
  const score =
    40 +
    35 * clamp(diversity / 0.6, 0, 1) +
    15 * clamp((m.avgWordLen - 3.4) / 2.6, 0, 1) +
    (m.wordCount >= 40 ? 10 : 0) -
    40 * clamp((m.fillerRatio - 0.03) / 0.09, 0, 1) -
    30 * clamp((m.topTokenShare - 0.14) / 0.2, 0, 1);
  return r1(clamp(score));
}

/**
 * Transcript-only proxy for pronunciation: without audio we can only read the
 * STT result — pacing, completeness of sentences, and filler density stand in
 * for how clean the speech came through. Full pronunciation scoring needs the
 * audio pipeline (storage phase).
 */
export function scorePronunciation(m: SpeakingMetrics): number {
  if (m.wordCount === 0) return 0;
  const pacing = wpmFit(m.wpm) / 100;
  const completeness = m.hasPunctuation ? 1 : 0.72;
  const clarity = 1 - clamp(m.fillerRatio / 0.08, 0, 1);
  const proxy = 0.45 * pacing + 0.3 * completeness + 0.25 * clarity;
  return r1(clamp(35 + 60 * proxy));
}

export function scoreConfidence(m: SpeakingMetrics): number {
  if (m.wordCount === 0) return 0;
  const score =
    45 +
    Math.min(30, m.wordCount / 3.5) +
    (m.fillerRatio <= 0.02 ? 10 : 0) +
    (m.wpm >= 95 ? 8 : 0) -
    m.hedgeCount * 3.5 -
    (m.wpm > 0 && m.wpm < 70 ? 12 : 0);
  return r1(clamp(score));
}

export function scoreNaturalness(m: SpeakingMetrics): number {
  if (m.wordCount === 0) return 0;
  const score =
    42 +
    Math.min(25, m.contractionCount * 5) +
    Math.min(23, m.connectorCount * 3.5) -
    m.hedgeCount * 2 -
    25 * clamp((m.fillerRatio - 0.04) / 0.1, 0, 1) -
    (m.connectorCount === 0 ? 8 : 0);
  return r1(clamp(score));
}

const SKILL_LABEL: Record<keyof SkillScores, string> = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  fluency: "Fluency",
  pronunciation: "Pronunciation",
  confidence: "Confidence",
  naturalness: "Naturalness",
};

function buildSummary(m: SpeakingMetrics, scores: SkillScores, mistakeCount: number): string {
  if (m.wordCount === 0) return "No speech detected — nothing to analyse yet.";
  const entries = Object.entries(scores) as [keyof SkillScores, number][];
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const best = SKILL_LABEL[sorted[0][0]];
  const worst = SKILL_LABEL[sorted[sorted.length - 1][0]];
  const parts = [
    `${m.wordCount} words in about ${Math.round(m.wpm)} wpm`,
    `strongest: ${best} (${sorted[0][1]})`,
    `work on: ${worst} (${sorted[sorted.length - 1][1]})`,
  ];
  if (mistakeCount > 0) parts.push(`${mistakeCount} pattern${mistakeCount === 1 ? "" : "s"} to fix`);
  return parts.join(" · ") + ".";
}

const SKILL_TIPS: Record<keyof SkillScores, Recommendation> = {
  grammar: {
    title: "Drill one grammar pattern",
    body: "Your grammar score moved least in this take. Run a short fix session on your top pattern.",
    action: { type: "mistakes" },
  },
  vocabulary: {
    title: "Reach for a precise word",
    body: "Vary your word choice — swap repeated general words (good, nice, thing) for specific ones.",
    action: { type: "vocab" },
  },
  fluency: {
    title: "Keep the words flowing",
    body: "Aim for 115–155 wpm: keep talking through small stumbles and repair at the end of the sentence.",
  },
  pronunciation: {
    title: "Record and shadow",
    body: "Shadow a short clip out loud — clear beats fast. Focus on the ends of words.",
  },
  confidence: {
    title: "Speak first, edit later",
    body: "Trim hedges like “maybe” and “I think”. State your point, then support it.",
  },
  naturalness: {
    title: "Sound like yourself",
    body: "Use contractions (it's, don't, I've) and connectors (but, so, because) the way you'd speak to a friend.",
  },
};

function buildRecommendations(
  m: SpeakingMetrics,
  scores: SkillScores,
  mistakes: DetectedMistake[]
): Recommendation[] {
  const out: Recommendation[] = [];

  if (mistakes.length > 0) {
    const first = mistakes[0];
    out.push({
      title: `Fix: ${first.title}`,
      body: first.why,
      action: { type: "mistake" },
    });
  }

  const sorted = (Object.entries(scores) as [keyof SkillScores, number][]).sort(
    (a, b) => a[1] - b[1]
  );
  const tip = SKILL_TIPS[sorted[0][0]];
  out.push(tip);

  if (m.wpm > 0 && m.wpm < 90) {
    out.push({
      title: "Pick up the pace",
      body: `You spoke at ${m.wpm} wpm — push toward 115+ by continuing sentences instead of restarting them.`,
    });
  } else if (m.wpm > 175) {
    out.push({
      title: "Slow down at the seams",
      body: `You spoke at ${m.wpm} wpm. Pause for a beat between ideas so listeners can follow.`,
    });
  }

  if (m.fillerRatio > 0.04) {
    out.push({
      title: "Silence the fillers",
      body: `${m.fillerCount} filler${m.fillerCount === 1 ? "" : "s"} in ${m.wordCount} words. When one starts, pause instead — silence is fine.`,
    });
  }

  return out.slice(0, 4);
}

/**
 * Deterministic mock AI: real heuristics, no network, same input → same
 * output. Refuses to run in production unless ALLOW_MOCK_AI=true.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";
  readonly model = "heuristics-v1";

  async analyzeSpeaking(input: SpeakingInput): Promise<ProviderCall> {
    const started = Date.now();
    const metrics = computeMetrics(input.transcript, input.durationSec);
    const mistakes = detectMistakes(input.transcript, input.rules);

    const scores: SkillScores = {
      grammar: scoreGrammar(mistakes, metrics.wordCount),
      vocabulary: scoreVocabulary(metrics),
      fluency: scoreFluency(metrics),
      pronunciation: scorePronunciation(metrics),
      confidence: scoreConfidence(metrics),
      naturalness: scoreNaturalness(metrics),
    };

    const summary = buildSummary(metrics, scores, mistakes.length);
    const recommendations = buildRecommendations(metrics, scores, mistakes);

    return {
      result: { metrics, scores, mistakes, summary, recommendations },
      latencyMs: Date.now() - started,
      tokensIn: metrics.wordCount + input.rules.length,
      tokensOut: summary.split(/\s+/).length + recommendations.length * 12,
    };
  }
}

export function getAIProvider(): AIProvider {
  const kind = process.env.AI_PROVIDER ?? "mock";
  if (kind !== "mock") {
    throw new Error(
      `Unknown AI_PROVIDER "${kind}". Only "mock" is implemented so far — real providers arrive in a later phase.`
    );
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_AI !== "true") {
    throw new Error(
      "MockAIProvider refuses to run in production. Set ALLOW_MOCK_AI=true (explicit opt-in) or implement a real provider."
    );
  }
  return new MockAIProvider();
}
