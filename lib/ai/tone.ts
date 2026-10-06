import * as z from "zod";

export type ToneHit = { label: string; confidence: number; note: string };

export type ToneReport = { tones: ToneHit[]; summary: string };

export const REGISTERS = ["formal", "casual", "friendly", "technical"] as const;
export type Register = (typeof REGISTERS)[number];

export const REGISTER_LABEL: Record<Register, string> = {
  formal: "Formal",
  casual: "Casual",
  friendly: "Friendly",
  technical: "Technical",
};

const TONE_NOTES: Record<string, string> = {
  casual: "Contractions and everyday wording — great with peers, loose with clients.",
  formal: "Full forms and structured phrasing — right for official or academic writing.",
  friendly: "Warm opens and upbeat markers — disarms the reader quickly.",
  confident: "Direct claims without hedges — your point lands hard.",
  hedged: "Hedges like “maybe” and “I think” soften the point — trim two of them.",
  technical: "Domain vocabulary and precision terms — keep it only if the reader shares it.",
  neutral: "Balanced register — safe for most readers, but a little flavourless.",
};

type Scored = "casual" | "formal" | "friendly" | "confident" | "hedged" | "technical";

const CONTRACTIONS: [RegExp, string][] = [
  [/\bI'm\b/g, "I am"],
  [/\byou're\b/gi, "you are"],
  [/\bwe're\b/gi, "we are"],
  [/\bthey're\b/gi, "they are"],
  [/\bit's\b/gi, "it is"],
  [/\bthat's\b/gi, "that is"],
  [/\bthere's\b/gi, "there is"],
  [/\bdon't\b/gi, "do not"],
  [/\bdoesn't\b/gi, "does not"],
  [/\bdidn't\b/gi, "did not"],
  [/\bcan't\b/gi, "cannot"],
  [/\bwon't\b/gi, "will not"],
  [/\bwouldn't\b/gi, "would not"],
  [/\bshouldn't\b/gi, "should not"],
  [/\bI've\b/g, "I have"],
  [/\bwe've\b/gi, "we have"],
  [/\bI'll\b/g, "I will"],
  [/\bwe'll\b/gi, "we will"],
  [/\blet's\b/gi, "let us"],
  [/\bisn't\b/gi, "is not"],
  [/\baren't\b/gi, "are not"],
  [/\bI'd\b/g, "I would"],
];

const EXPANSIONS: [RegExp, string][] = [
  [/\bdo not\b/gi, "don't"],
  [/\bdoes not\b/gi, "doesn't"],
  [/\bdid not\b/gi, "didn't"],
  [/\bit is\b/gi, "it's"],
  [/\bthat is\b/gi, "that's"],
  [/\bI am\b/g, "I'm"],
  [/\byou are\b/gi, "you're"],
  [/\bwe are\b/gi, "we're"],
  [/\bwe will\b/gi, "we'll"],
  [/\bI will\b/g, "I'll"],
  [/\bI have\b/g, "I've"],
  [/\bcannot\b/gi, "can't"],
  [/\bwill not\b/gi, "won't"],
  [/\bwe would\b/gi, "we'd"],
  [/\bhave not\b/gi, "haven't"],
  [/\bis not\b/gi, "isn't"],
];

const SLANG_TO_NEUTRAL: [RegExp, string][] = [
  [/\bgonna\b/gi, "going to"],
  [/\bwanna\b/gi, "want to"],
  [/\bgotta\b/gi, "have to"],
  [/\bkinda\b/gi, "somewhat"],
  [/\bsorta\b/gi, "somewhat"],
  [/\bawesome\b/gi, "excellent"],
  [/\bstuff\b/gi, "material"],
  [/\bthings\b/gi, "items"],
  [/\bbut\b/gi, "however"],
  [/\bso\b/gi, "therefore"],
];

const NEUTRAL_TO_TECHNICAL: [RegExp, string][] = [
  [/\bhelp\b/gi, "facilitate"],
  [/\buse\b/gi, "utilize"],
  [/\bfix\b/gi, "resolve"],
  [/\bproblem\b/gi, "issue"],
  [/\bshow\b/gi, "demonstrate"],
  [/\bchange\b/gi, "modify"],
  [/\bidea\b/gi, "proposal"],
  [/\bcheck\b/gi, "validate"],
  [/\bstart\b/gi, "initiate"],
  [/\bend\b/gi, "conclude"],
];

function countMatches(text: string, re: RegExp): number {
  return (text.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`)) ?? [])
    .length;
}

const SIGNALS: { label: Scored; test: RegExp }[] = [
  { label: "casual", test: /\b(I'm|you're|don't|can't|it's|we'll|hey|yeah|cool|gonna|wanna)\b/gi },
  { label: "formal", test: /\b(therefore|furthermore|nevertheless|hereby|regarding|kindly|pursuant|shall|respectfully|accordingly)\b/gi },
  { label: "friendly", test: /\b(hi|hello|hey|thanks|thank you|cheers|awesome|great|love|appreciate|nice)\b/gi },
  { label: "confident", test: /\b(definitely|absolutely|clearly|certainly|must|proven|recommend|guarantee|will)\b/gi },
  { label: "hedged", test: /\b(maybe|perhaps|probably|somewhat|roughly|I think|I guess|kind of|sort of|just|possibly)\b/gi },
  { label: "technical", test: /\b(api|latency|throughput|database|algorithm|leverage|framework|infrastructure|metric|pipeline|stakeholder)\b/gi },
];

/** Deterministic tone read of the text — works with no model at all. */
export function heuristicTone(text: string): ToneReport {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = Math.max(1, words.length);

  const scored: { label: Scored; raw: number }[] = SIGNALS.map(({ label, test }) => ({
    label,
    raw: countMatches(trimmed, test),
  }));

  if (trimmed.includes("!")) scored.find((s) => s.label === "friendly")!.raw += 1;
  if (/[A-Z][A-Za-z]+ [A-Z][A-Za-z]+/.test(trimmed)) {
    scored.find((s) => s.label === "formal")!.raw += 1;
  }

  const hits = scored
    .map((s) => ({ ...s, norm: s.raw / Math.sqrt(wordCount) }))
    .filter((s) => s.raw > 0)
    .sort((a, b) => b.norm - a.norm);

  if (hits.length === 0) {
    return {
      tones: [{ label: "neutral", confidence: 0.6, note: TONE_NOTES.neutral }],
      summary: "Neutral register — clear, but it could take a stronger stance.",
    };
  }

  const top = hits.slice(0, 3).map((h, i) => ({
    label: h.label,
    confidence: Math.min(0.95, Math.round((0.72 + h.norm * 0.1 - i * 0.12) * 100) / 100),
    note: TONE_NOTES[h.label] ?? "",
  }));

  const lead = top[0];
  return {
    tones: top,
    summary: `Mostly ${lead.label}: ${lead.note}`,
  };
}

function applyMap(text: string, map: [RegExp, string][]): string {
  let out = text;
  for (const [re, to] of map) out = out.replace(re, to);
  return out;
}

/** Deterministic register rewrite used as the model stand-in (and fallback). */
export function heuristicRegister(text: string, register: Register): string {
  const trimmed = text.trim();
  switch (register) {
    case "formal": {
      let out = applyMap(trimmed, CONTRACTIONS);
      out = applyMap(out, SLANG_TO_NEUTRAL);
      out = out.replace(/(^|[.!?]\s+)(hey|hi|hello)[,!.\s]+/gi, (_m, pre) => `${pre}Hello, `);
      out = out.replace(/!/g, ".");
      return out;
    }
    case "casual": {
      let out = applyMap(trimmed, EXPANSIONS);
      out = out.replace(/\bHello,\s*/g, "Hey, ");
      out = out.replace(/\bHowever,\s*/g, "But ");
      return out;
    }
    case "friendly": {
      let out = applyMap(trimmed, EXPANSIONS);
      out = out.replace(/\bHello,\s*/g, "Hey, ");
      out = out.replace(/\bvery\b/gi, "really");
      out = out.replace(/\bregards\b/gi, "cheers");
      if (!/^(hey|hi|thanks|love)/i.test(out)) out = `Hey — ${out.charAt(0).toLowerCase()}${out.slice(1)}`;
      return out;
    }
    case "technical": {
      let out = applyMap(trimmed, NEUTRAL_TO_TECHNICAL);
      out = out.replace(/\bwe should\b/gi, "we ought to");
      out = out.replace(/\bmake sure\b/gi, "ensure");
      return out;
    }
  }
}

const toneReportSchema = z.object({
  tones: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
        confidence: z.number().min(0).max(1),
        note: z.string().max(300),
      })
    )
    .min(1)
    .max(5),
  summary: z.string().min(1).max(500),
});

/** Parse a model's JSON report; returns null when the model went off-script. */
export function parseToneReport(raw: string): ToneReport | null {
  const fenced = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const parsed = toneReportSchema.safeParse(JSON.parse(fenced));
    if (!parsed.success) return null;
    const tones = parsed.data.tones
      .slice(0, 3)
      .map((t) => ({ label: t.label.toLowerCase(), confidence: t.confidence, note: t.note }));
    return { tones, summary: parsed.data.summary };
  } catch {
    return null;
  }
}

export const TONE_SYSTEM_PROMPT =
  "You are a precise writing analyst. Reply with ONLY minified JSON, no prose, no code fences, " +
  'in the exact shape {"tones":[{"label":"<one word>","confidence":0.0-1.0,"note":"<max 12 words>"}],"summary":"<one sentence>"}. ' +
  "Pick 1-3 tones from: casual, formal, friendly, confident, hedged, technical, neutral.";

export function tonePrompt(text: string): string {
  return `Analyse the register and emotional stance of this text:\n\n${text}`;
}
