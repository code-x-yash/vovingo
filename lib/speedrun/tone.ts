/**
 * Curated tone pairs for the Speedrun "Tone up" mode — zero-cost content:
 * a casual line and its sharper professional rewrite, plus why it matters.
 */
export type TonePair = {
  id: string;
  casual: string;
  formal: string;
  why: string;
};

export const TONE_PAIRS: TonePair[] = [
  {
    id: "tone-1",
    casual: "hey, need this asap, thx",
    formal: "Hi team, could you send this over by end of day? Thanks.",
    why: "Spelling out words and naming the deadline reads professional, not pushy.",
  },
  {
    id: "tone-2",
    casual: "sup, u joining the call?",
    formal: "Hi! Are we still on for the call at 4?",
    why: "Text-speak lands badly with clients — spell it out.",
  },
  {
    id: "tone-3",
    casual: "dunno, maybe ask someone else",
    formal: "I'm not sure — let me check and get back to you.",
    why: "'I'll check' buys time; 'ask someone else' sounds dismissive.",
  },
  {
    id: "tone-4",
    casual: "that idea is bad tbh",
    formal: "I see the appeal, but I think it has a few risks.",
    why: "Disagree with the idea, not the person.",
  },
  {
    id: "tone-5",
    casual: "im busy, do it later",
    formal: "I'm heads-down on something right now — can we revisit this after 3?",
    why: "Offer a concrete time instead of a flat refusal.",
  },
  {
    id: "tone-6",
    casual: "wrong, see the doc",
    formal: "The document has the updated numbers — page 4, table 2.",
    why: "Pointing to the exact place saves everyone a round trip.",
  },
  {
    id: "tone-7",
    casual: "gonna be late, sry",
    formal: "Apologies, I'm running about 10 minutes late. Please go ahead without me.",
    why: "Apologise once, then give people a next step.",
  },
  {
    id: "tone-8",
    casual: "idc, whatever works",
    formal: "I'm flexible — happy to go with whatever works for the team.",
    why: "'Whatever works' can read as indifference; 'flexible' reads as a choice.",
  },
  {
    id: "tone-9",
    casual: "u shouldve told me earlier",
    formal: "For next time, flagging this earlier would help us adjust the plan.",
    why: "Future-facing feedback lands better than blame.",
  },
  {
    id: "tone-10",
    casual: "no. cant do that.",
    formal: "That won't be possible this week — here's what I can do instead.",
    why: "Pair every no with an alternative.",
  },
  {
    id: "tone-11",
    casual: "k, done",
    formal: "Finished — the report is in the shared folder.",
    why: "State where things landed so nobody has to ask.",
  },
  {
    id: "tone-12",
    casual: "this is taking forever",
    formal: "This is taking longer than expected — I'll update you by Friday.",
    why: "Quantify the delay and commit to a checkpoint.",
  },
];
