import type { DetectedMistake } from "@/lib/db/schema";

export type DetectRule = {
  key: string;
  title: string;
  category: string;
  why: string;
  wrongExample: string;
  correctExample: string;
  severity: "low" | "medium" | "high";
  patterns: string[];
};

const CONFIDENCE: Record<"low" | "medium" | "high", number> = {
  high: 0.9,
  medium: 0.85,
  low: 0.8,
};

/** Pull the full sentence around `index` out of the transcript. */
function sentenceAround(text: string, index: number, matchLen: number): string {
  let start = index;
  while (start > 0 && !/[.!?]/.test(text[start - 1])) start -= 1;
  let end = index + matchLen;
  while (end < text.length && !/[.!?]/.test(text[end])) end += 1;
  end = Math.min(text.length, end + 1);
  const sentence = text.slice(start, end).trim();
  return sentence.length > 0 ? sentence : text.slice(index, index + matchLen).trim();
}

/**
 * Rule-based mistake detector: runs each rule's regexes (from the seeded
 * `mistakes.detection` column) over the transcript. One hit per rule; first
 * matching sentence wins. Shared by speaking, writing and conversation.
 */
export function detectMistakes(
  transcript: string,
  rules: DetectRule[],
  limit = 6
): DetectedMistake[] {
  const text = transcript.trim();
  if (!text || rules.length === 0) return [];

  const lower = text.toLowerCase();
  const out: DetectedMistake[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    if (out.length >= limit) break;
    if (seen.has(rule.key) || rule.patterns.length === 0) continue;

    for (const pattern of rule.patterns) {
      let re: RegExp;
      try {
        re = new RegExp(pattern, "i");
      } catch {
        continue; // never let one bad seed pattern kill the request
      }
      const m = re.exec(lower);
      if (!m) continue;

      seen.add(rule.key);
      out.push({
        key: rule.key,
        title: rule.title,
        category: rule.category,
        wrong: sentenceAround(text, m.index, m[0].length),
        correct: rule.correctExample,
        why: rule.why,
        severity: rule.severity,
        confidence: CONFIDENCE[rule.severity],
      });
      break;
    }
  }

  return out;
}
