import * as z from "zod";
import { completeOrFallback } from "@/lib/ai/complete";

export type DuelTopic = {
  id: string;
  title: string;
  prompt: string;
  rivalBars: string[];
};

export const DUEL_TOPICS: DuelTopic[] = [
  {
    id: "commute",
    title: "Morning commute",
    prompt:
      "The beat: the morning commute. Write 2-4 lines about the chaos of getting to work — rhythm beats perfection, land a rhyme on the last word.",
    rivalBars: [
      "Bus is late again, I'm counting every stop, / coffee in my hand but the energy won't hop.",
      "Traffic lights are laughing, every light turns red, / I'm practising my speech for the words I should have said.",
    ],
  },
  {
    id: "deadline",
    title: "Deadline day",
    prompt:
      "The beat: deadline day. Write 2-4 lines about shipping under pressure — keep the meter steady and close on a rhyme.",
    rivalBars: [
      "Clock says five, the file says send it now, / one more pass on every line, I'll show them how.",
      "Red pen on the calendar, the countdown's getting loud, / I ship it with a rhythm and I stand out from the crowd.",
    ],
  },
  {
    id: "grocery",
    title: "Grocery run",
    prompt:
      "The beat: the grocery run. Write 2-4 lines about shopping like a sport — punch the last word of each line.",
    rivalBars: [
      "Aisle seven's where I wrestle with the snacks I shouldn't grab, / the basket's getting heavier than the budget that I have.",
      "Queue is moving slower than the words I'm trying to say, / I rehearse my small talk for the clerk at the register today.",
    ],
  },
  {
    id: "gym",
    title: "Gym at 6am",
    prompt:
      "The beat: the 6am gym. Write 2-4 lines about showing up before sunrise — make the last line hit.",
    rivalBars: [
      "Alarm rings twice, I'm up before the city wakes, / the treadmill's humming rhythm while my early morning aches.",
      "Six on the clock and I'm already at the rack, / every rep's a sentence and I'm nailing every fact.",
    ],
  },
  {
    id: "group-project",
    title: "Group project",
    prompt:
      "The beat: the group project that only you are doing. Write 2-4 lines about your teammates — finish with a rhyme.",
    rivalBars: [
      "Shared doc is empty but the deadline's getting near, / I'm typing all the answers while they're typing 'sounds good, cheers.'",
      "Four names on the title, one name does the work, / I'm filling every column like a nervous company clerk.",
    ],
  },
  {
    id: "airport",
    title: "Airport security",
    prompt:
      "The beat: airport security. Write 2-4 lines about shoes, laptops and the little tray — keep it clean and close tight.",
    rivalBars: [
      "Laptop in the tray again, my belt is in my hand, / the scanner's beeping rhythm for the things I understand.",
      "Shoes off, coat off, everything is going through the light, / I'm narrating every step to get the wording right.",
    ],
  },
];

export function topicById(id: string): DuelTopic | null {
  return DUEL_TOPICS.find((t) => t.id === id) ?? null;
}

export function pickTopic(seed: number): DuelTopic {
  const idx = Math.abs(Math.trunc(seed)) % DUEL_TOPICS.length;
  return DUEL_TOPICS[idx];
}

export function pickRivalBar(topic: DuelTopic, seed: number): string {
  const idx = Math.abs(Math.trunc(seed)) % topic.rivalBars.length;
  return topic.rivalBars[idx];
}

export type DuelVerdict = {
  rival: string;
  you: number;
  rivalScore: number;
  winner: "you" | "rival" | "tie";
  note: string;
};

const clampScore = (v: number) => Math.max(5, Math.min(98, Math.round(v)));

function djb2(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return h;
}

export function deriveWinner(you: number, rivalScore: number): "you" | "rival" | "tie" {
  if (you >= rivalScore + 2) return "you";
  if (rivalScore >= you + 2) return "rival";
  return "tie";
}

/** Deterministic scoring stand-in used in mock mode and as the LLM fallback. */
export function mockVerdict(topic: DuelTopic, userBar: string, rivalBar: string): DuelVerdict {
  const words = userBar.trim().split(/\s+/).filter(Boolean);
  const unique = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z']/g, ""))).size;
  const uniqueRatio = words.length > 0 ? unique / words.length : 0;
  let you = 35 + Math.min(27, words.length * 1.8) + Math.round(uniqueRatio * 15);
  if (words.length < 6) you -= 18;
  const rivalSeed = Math.abs(djb2(`${topic.id}:${rivalBar}`)) % 9;
  const rivalScore = 64 + rivalSeed;
  const winner = deriveWinner(you, rivalScore);
  const note =
    winner === "you"
      ? "Your bar landed cleaner — sharper images and a tighter close."
      : winner === "rival"
        ? "The rival's close was tighter — push a rhyme on the last line."
        : "Dead even — both bars held. Next round decides it.";
  return {
    rival: rivalBar,
    you: clampScore(you),
    rivalScore: clampScore(rivalScore),
    winner,
    note,
  };
}

const verdictSchema = z.object({
  rival: z.string().min(1).max(400),
  you: z.number(),
  rivalScore: z.number(),
  note: z.string().min(1).max(240),
});

/** Parses the judge's JSON; returns null (use mock) on anything malformed. */
export function parseVerdict(raw: string): {
  rival: string;
  you: number;
  rivalScore: number;
  note: string;
} | null {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const parsed = verdictSchema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) return null;
    return {
      rival: parsed.data.rival.trim(),
      you: clampScore(parsed.data.you),
      rivalScore: clampScore(parsed.data.rivalScore),
      note: parsed.data.note.trim(),
    };
  } catch {
    return null;
  }
}

export type JudgeResult = { verdict: DuelVerdict; usedModel: boolean };

/**
 * Judges the learner's bar against a rival's. Model replies with JSON
 * {rival, you, rivalScore, note}; any failure falls back to the
 * deterministic mock verdict so the duel always resolves.
 */
export async function judgeDuel(topic: DuelTopic, userBar: string): Promise<JudgeResult> {
  const rivalBar = pickRivalBar(topic, userBar.length + topic.title.length);
  const fallback = mockVerdict(topic, userBar, rivalBar);
  const { text, usedModel } = await completeOrFallback({
    system:
      "You judge rap-style practice bars in an English learning app. Reply with ONLY minified JSON: " +
      '{"rival":"<your 2-line rival bar on the same topic>","you":<0-100>,"rivalScore":<0-100>,"note":"<max 14 words, one coaching line>"} ' +
      "Score rhythm, imagery and English flow. No prose outside the JSON.",
    prompt: `Topic: ${topic.title} — ${topic.prompt}\nLearner's bar: ${userBar}`,
    maxTokens: 220,
    temperature: 0.8,
    mock: JSON.stringify(fallback),
  });
  const parsed = parseVerdict(text);
  if (!parsed || !parsed.rival) return { verdict: fallback, usedModel };
  return {
    verdict: {
      rival: parsed.rival,
      you: parsed.you,
      rivalScore: parsed.rivalScore,
      winner: deriveWinner(parsed.you, parsed.rivalScore),
      note: parsed.note,
    },
    usedModel,
  };
}
