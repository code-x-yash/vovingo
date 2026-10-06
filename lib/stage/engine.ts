import * as z from "zod";
import { completeOrFallback } from "@/lib/ai/complete";

export type StagePrompt = {
  id: string;
  title: string;
  prompt: string;
};

export const STAGE_PROMPTS: StagePrompt[] = [
  {
    id: "award",
    title: "Accepting the award",
    prompt:
      "You just won an award nobody expected. Deliver your acceptance speech — thank someone surprising, mention one flop, and end on a line they'll quote tomorrow.",
  },
  {
    id: "quit",
    title: "The dramatic exit",
    prompt:
      "You're quitting in the most theatrical way possible. Monologue your reasons to your stunned manager — make it dramatic, but keep it clean.",
  },
  {
    id: "villain",
    title: "The villain explains",
    prompt:
      "Your plan has been revealed. Explain to the hero why you did it — half menace, half reasonable point. End with an offer.",
  },
  {
    id: "storm",
    title: "Warning the town",
    prompt:
      "The storm hits at midnight. Stand on the town square steps and warn everyone — build urgency in three beats and finish with one clear instruction.",
  },
  {
    id: "reunion",
    title: "Reunion toast",
    prompt:
      "You're raising a glass at a reunion you avoided for ten years. Deliver the toast: one memory, one apology, one look-forward.",
  },
  {
    id: "comeback",
    title: "The comeback line",
    prompt:
      "Someone interrupted your big moment. Take the mic back and deliver a comeback that wins the room — witty, not cruel, and end on a mic-drop sentence.",
  },
];

export function promptById(id: string): StagePrompt | null {
  return STAGE_PROMPTS.find((p) => p.id === id) ?? null;
}

export function pickStagePrompt(seed: number): StagePrompt {
  const idx = Math.abs(Math.trunc(seed)) % STAGE_PROMPTS.length;
  return STAGE_PROMPTS[idx];
}

export type AudienceVerdict = {
  cheers: number;
  verdict: string;
  note: string;
};

const clampScore = (v: number) => Math.max(5, Math.min(98, Math.round(v)));

export function verdictBand(cheers: number): string {
  if (cheers >= 85) return "Standing ovation";
  if (cheers >= 68) return "The crowd is with you";
  if (cheers >= 45) return "Polite applause";
  return "Crickets";
}

/** Deterministic audience stand-in: energy from pace-proxy words + variety + punch. */
export function mockAudience(take: string): AudienceVerdict {
  const words = take.trim().split(/\s+/).filter(Boolean);
  const unique = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z']/g, ""))).size;
  const uniqueRatio = words.length > 0 ? unique / words.length : 0;
  const exclamations = (take.match(/!/g) ?? []).length;
  let cheers = 35 + Math.min(32, words.length * 1.6) + Math.round(uniqueRatio * 14);
  cheers += Math.min(8, exclamations * 3);
  if (words.length < 8) cheers -= 16;
  const c = clampScore(cheers);
  const note =
    c >= 85
      ? "They're on their feet — the close hit harder than the setup."
      : c >= 68
        ? "The room leaned in — one sharper final line and it's perfect."
        : c >= 45
          ? "Decent warm-up — the middle sags before the finish."
          : "The room checked its phones — punch the opening sooner.";
  return { cheers: c, verdict: verdictBand(c), note };
}

const audienceSchema = z.object({
  cheers: z.number(),
  note: z.string().min(1).max(240),
});

/** Parses the audience JSON; null (use mock) on anything malformed. */
export function parseAudience(raw: string): { cheers: number; note: string } | null {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const parsed = audienceSchema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) return null;
    return { cheers: clampScore(parsed.data.cheers), note: parsed.data.note.trim() };
  } catch {
    return null;
  }
}

export type StageResult = { verdict: AudienceVerdict; usedModel: boolean };

/**
 * The audience's verdict on a dramatic take. Model replies with JSON
 * {cheers, note}; band label always derives from the score, and any failure
 * falls back to the deterministic mock audience.
 */
export async function judgeStage(
  prompt: StagePrompt,
  take: string
): Promise<StageResult> {
  const fallback = mockAudience(take);
  const { text, usedModel } = await completeOrFallback({
    system:
      "You are a lively theatre audience judging a short dramatic monologue in an English learning app. " +
      "Reply with ONLY minified JSON: {\"cheers\":<0-100>,\"note\":\"<max 14 words, one sharp coaching line>\"} " +
      "No prose outside the JSON.",
    prompt: `Stage prompt: ${prompt.prompt}\nThe performer's take: ${take}`,
    maxTokens: 140,
    temperature: 0.8,
    mock: JSON.stringify({ cheers: fallback.cheers, note: fallback.note }),
  });
  const parsed = parseAudience(text);
  if (!parsed) return { verdict: fallback, usedModel };
  return {
    verdict: { cheers: parsed.cheers, verdict: verdictBand(parsed.cheers), note: parsed.note },
    usedModel,
  };
}
