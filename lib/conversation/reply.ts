export type ChatMessage = { role: "user" | "ai"; content: string };

export type CoachContext = {
  name: string;
  streak: number;
  skills: { skill: string; score: number }[];
  patterns: { title: string; category: string }[];
  dueWords: number;
  lessonsDone: number;
};

export type ScenarioContext = {
  title: string;
  description: string;
  persona: { role: string; name?: string; style?: string; opening?: string } | null;
  openingPrompt: string | null;
};

function lowestSkill(ctx: CoachContext): { skill: string; score: number } | null {
  if (ctx.skills.length === 0) return null;
  return [...ctx.skills].sort((a, b) => a.score - b.score)[0];
}

function userTurns(history: ChatMessage[]): number {
  return history.filter((m) => m.role === "user").length;
}

export function initialCoachMessage(ctx: CoachContext): string {
  const parts = [`Hi ${ctx.name.split(" ")[0]}! I'm your AI coach.`];
  if (ctx.streak > 0) parts.push(`You're on a ${ctx.streak}-day streak — let's keep it going.`);
  const low = lowestSkill(ctx);
  if (ctx.patterns.length > 0) {
    parts.push(`Your top pattern to fix right now: “${ctx.patterns[0].title}”.`);
  } else if (low && low.score < 60) {
    parts.push(`Your ${low.skill} score is ${Math.round(low.score)} — good place to grow.`);
  }
  parts.push("Ask me what to practise, or tell me what feels hard.");
  return parts.join(" ");
}

const COACH_RULES: { match: RegExp; reply: (ctx: CoachContext) => string }[] = [
  {
    match: /\b(hi|hello|hey|good (morning|evening|afternoon))\b/i,
    reply: (ctx) =>
      `Hey ${ctx.name.split(" ")[0]}! What would you like to work on today — speaking, grammar, or vocabulary?`,
  },
  {
    match: /\b(what should|what can|suggest|recommend|plan|today|practice|practise)\b/i,
    reply: (ctx) => {
      const low = lowestSkill(ctx);
      const picks: string[] = [];
      if (ctx.patterns[0]) picks.push(`practise the “${ctx.patterns[0].title}” pattern`);
      if (ctx.dueWords > 0) picks.push(`review ${ctx.dueWords} due word${ctx.dueWords === 1 ? "" : "s"}`);
      if (low && low.score < 70) picks.push(`do a short ${low.skill} drill`);
      picks.push("record a 2-minute speaking take");
      return `Here's my pick for today: ${picks.slice(0, 2).join(", then ")}. Small and daily beats long and rare.`;
    },
  },
  {
    match: /\b(grammar|tense|article|preposition)\b/i,
    reply: (ctx) => {
      const g = ctx.skills.find((s) => s.skill === "grammar");
      const p = ctx.patterns.find((m) => m.category === "grammar");
      return p
        ? `Your recurring grammar issue is “${p.title}”. Open that pattern, read the why, then do its 3-question quiz.`
        : `Grammar score: ${g ? Math.round(g.score) : 0}. Pick a grammar lesson and slow down while writing — accuracy first, speed later.`;
    },
  },
  {
    match: /\b(vocab|word|words|remember|memor)\b/i,
    reply: (ctx) =>
      ctx.dueWords > 0
        ? `You have ${ctx.dueWords} word${ctx.dueWords === 1 ? "" : "s"} due for review right now. Spaced repetition only works if you show up daily — knock them out now.`
        : "Nothing due right now — add a few words you met today in conversation and review them tomorrow.",
  },
  {
    match: /\b(speak|speaking|fluency|pronounce|accent|shy|nervous)\b/i,
    reply: () =>
      "Speaking grows from reps, not perfection. Record a take on /speaking, even 60 seconds — the analysis gives you patterns to fix and your fluency score moves as you improve.",
  },
  {
    match: /\b(streak|xp|points|level|progress|score)\b/i,
    reply: (ctx) =>
      `You're at ${ctx.streak} day${ctx.streak === 1 ? "" : "s"} with ${ctx.lessonsDone} lesson${ctx.lessonsDone === 1 ? "" : "s"} done. Finish today's plan items for bonus XP and the streak keeps climbing.`,
  },
  {
    match: /\b(thank|thanks|great|cool|ok(ay)?)\b/i,
    reply: () => "Anytime! Want a quick task to close out today, or shall I leave you to your plan?",
  },
  {
    match: /\b(bye|goodbye|see you|later)\b/i,
    reply: () => "Good luck — come back tomorrow and we'll keep the streak alive.",
  },
];

const COACH_FALLBACKS = [
  (ctx: CoachContext) =>
    `Tell me more — and if you want a concrete task: ${
      ctx.patterns[0]
        ? `fix “${ctx.patterns[0].title}” with one focused practice`
        : "record one speaking take and review your notes after"
    }.`,
  (ctx: CoachContext) => {
    const low = lowestSkill(ctx);
    return low
      ? `From your scores, ${low.skill} (${Math.round(low.score)}) is the biggest gap. Want a ${low.skill} exercise to close it?`
      : "What part of English feels hardest for you right now?";
  },
  () => "Good point. What would success look like for you this week — more fluent speech, cleaner writing, or a bigger vocabulary?",
];

/** Deterministic coach reply: keyword rules first, then a rotating fallback. */
export function coachReply(history: ChatMessage[], ctx: CoachContext, userText: string): string {
  const text = userText.trim();
  if (text.length === 0) return "Say that again?";
  for (const rule of COACH_RULES) {
    if (rule.match.test(text)) return rule.reply(ctx);
  }
  const idx = userTurns(history) % COACH_FALLBACKS.length;
  return COACH_FALLBACKS[idx](ctx);
}

export function initialScenarioMessage(ctx: ScenarioContext): string {
  if (ctx.persona?.opening && ctx.persona.opening.trim().length > 0) return ctx.persona.opening;
  if (ctx.openingPrompt && ctx.openingPrompt.trim().length > 0) return ctx.openingPrompt;
  return `Hi, I'm ${ctx.persona?.name ?? ctx.persona?.role ?? "your practice partner"}. Let's talk about ${ctx.title.toLowerCase()} — I'll start: what's your take?`;
}

const SCENARIO_FOLLOWUPS = [
  "push a little: why do you think so?",
  "can you give me a specific example from your own life?",
  "flip it: what would the other side argue?",
  "how would you say that more formally?",
  "keep going — what happened next?",
];

const SCENARIO_FALLBACKS = [
  "Could you say a little more about that?",
  "That's one side — now give me the opposite view, even if you don't believe it.",
  "Hmm, not convinced. Convince me in two sentences.",
];

/** Deterministic persona reply: acknowledge, then rotate a follow-up by turn. */
export function scenarioReply(
  history: ChatMessage[],
  ctx: ScenarioContext,
  userText: string
): string {
  const text = userText.trim();
  if (text.length === 0) return "I didn't catch that — try again?";
  const turn = userTurns(history);
  if (text.split(/\s+/).length >= 3) {
    const who = ctx.persona?.name ? `${ctx.persona.name} here.` : "";
    const follow = SCENARIO_FOLLOWUPS[turn % SCENARIO_FOLLOWUPS.length];
    return `${who} ${follow.charAt(0).toUpperCase()}${follow.slice(1)}`.trim();
  }
  return SCENARIO_FALLBACKS[turn % SCENARIO_FALLBACKS.length];
}
