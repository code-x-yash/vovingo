export type ScriptPack = "debate" | "sitcom" | "roleplay";

export type ScriptLine = { who: string; text: string };

export type ScriptDef = {
  slug: string;
  pack: ScriptPack;
  title: string;
  blurb: string;
  role: string;
  opponent: string;
  lines: ScriptLine[];
};

export const PACK_META: Record<ScriptPack, { label: string; blurb: string }> = {
  debate: {
    label: "Debate club",
    blurb: "Pick a motion, argue your side out loud, steal the best lines.",
  },
  sitcom: {
    label: "Sitcom scenes",
    blurb: "Two characters, one ridiculous situation — take the funny role.",
  },
  roleplay: {
    label: "Roleplay scripts",
    blurb: "Rehearsed scenes for interviews, travel and other real moments.",
  },
};

export const SCRIPTS: ScriptDef[] = [
  {
    slug: "four-day-week",
    pack: "debate",
    title: "Motion: the four-day week",
    blurb: "Propose a shorter week and defend it against the clock-watchers.",
    role: "Proposition",
    opponent: "Opposition",
    lines: [
      { who: "Moderator", text: "The motion is: this house would make the four-day week standard. Proposition, your opening." },
      { who: "Proposition", text: "Thank you. Four days, same pay, same output — because rested people work harder than tired ones." },
      { who: "Opposition", text: "Same output? Tell that to hospitals, shops and every team already stretched thin." },
      { who: "Proposition", text: "Pilots of the four-day week saw output hold or rise. Fewer meetings, less waste, sharper focus." },
      { who: "Opposition", text: "Pilots are tidy experiments. Real economies are messy — customers don't take Fridays off." },
      { who: "Proposition", text: "Then stagger the days. The point isn't one magic day — it's refusing to measure hours instead of results." },
      { who: "Moderator", text: "Closing statement, Proposition — thirty seconds." },
      { who: "Proposition", text: "A four-day week isn't laziness. It's admitting that burnout costs more than a day off." },
    ],
  },
  {
    slug: "homework-ban",
    pack: "debate",
    title: "Motion: ban homework",
    blurb: "You're against the ban — defend homework without sounding like a villain.",
    role: "Opposition",
    opponent: "Proposition",
    lines: [
      { who: "Moderator", text: "The motion is: this house would ban homework entirely. Opposition, you have the floor." },
      { who: "Proposition", text: "Kids clock eight hours already. Evenings should belong to families, not worksheets." },
      { who: "Opposition", text: "Homework isn't punishment — it's the ten minutes where a student proves the lesson actually stuck." },
      { who: "Proposition", text: "Or it's the hour where a confused student gets stuck alone, with no teacher in sight." },
      { who: "Opposition", text: "Fair — so fix the homework, don't kill it. Short retrieval practice beats busywork every time." },
      { who: "Proposition", text: "And who checks equity? Rich families hire tutors; the ban would level that field." },
      { who: "Opposition", text: "The field levels when everyone practices at home. Ban the burden, not the practice itself." },
      { who: "Moderator", text: "Closing statement, Opposition." },
      { who: "Opposition", text: "Keep homework small, useful and fair — and let students own the progress they make after the bell." },
    ],
  },
  {
    slug: "dishes-standoff",
    pack: "sitcom",
    title: "The dishes standoff",
    blurb: "Your flatmate claims the sink 'isn't that bad'. It is that bad.",
    role: "Jules",
    opponent: "Sam",
    lines: [
      { who: "Sam", text: "Before you say anything — I was going to do them. Tomorrow." },
      { who: "Jules", text: "Sam, the tower of plates has developed its own ecosystem." },
      { who: "Sam", text: "That's a slight exaggeration. The mould is mostly decorative." },
      { who: "Jules", text: "Decorative? Our kitchen smells like a science fair. Twenty minutes, that's all I'm asking." },
      { who: "Sam", text: "Fine. Twenty minutes. But you're on pot duty — I did them last time." },
      { who: "Jules", text: "Deal. And next time, 'tomorrow' has to include an actual date." },
      { who: "Sam", text: "Noted. Writing it on the calendar in permanent marker." },
      { who: "Jules", text: "I'm holding you to that. I'm taking a photo of this conversation." },
    ],
  },
  {
    slug: "group-chat-trip",
    pack: "sitcom",
    title: "The group-chat trip",
    blurb: "Somebody said 'let's book it' — now four opinions collide.",
    role: "Nadia",
    opponent: "Leo",
    lines: [
      { who: "Leo", text: "Okay, I found flights. They're cheap because they leave at 4 a.m." },
      { who: "Nadia", text: "4 a.m.? Leo, that's not a flight, that's a rumour of sleep." },
      { who: "Leo", text: "You save two hundred each. Suffer once, feast all week." },
      { who: "Nadia", text: "Or we spend the two hundred and arrive as functioning humans." },
      { who: "Leo", text: "Compromise: we book the early one, and nobody speaks to me until boarding." },
      { who: "Nadia", text: "Only if we also book the aisle seats. Middle seat and I'm mutinying." },
      { who: "Leo", text: "Done. Group chat's voting now — please don't change your mind at the gate." },
      { who: "Nadia", text: "No promises. I reserve the right to complain the entire way there." },
    ],
  },
  {
    slug: "job-interview",
    pack: "roleplay",
    title: "The job interview",
    blurb: "The classic. Answer like the candidate they'd be foolish not to hire.",
    role: "Candidate",
    opponent: "Interviewer",
    lines: [
      { who: "Interviewer", text: "Thanks for coming in. Start wherever you like — tell me about yourself." },
      { who: "Candidate", text: "I'm a project coordinator who genuinely likes tidy plans and honest deadlines — and I'd love to bring both here." },
      { who: "Interviewer", text: "Good start. What's a project that didn't go as planned?" },
      { who: "Candidate", text: "We launched a feature two weeks late because we kept saying yes to scope. I learned to trade wishes for priorities out loud." },
      { who: "Interviewer", text: "How do you handle feedback you disagree with?" },
      { who: "Candidate", text: "I ask for the evidence behind it, then test the smallest version of their idea. Half the time they're right — and I say so." },
      { who: "Interviewer", text: "Last one: why us, specifically?" },
      { who: "Candidate", text: "Because your product solves a problem I've personally complained about — and I'd rather build the fix than keep complaining." },
    ],
  },
  {
    slug: "airport-desk",
    pack: "roleplay",
    title: "Airport check-in",
    blurb: "Oversized bag, closed gate energy — keep your cool at the desk.",
    role: "Passenger",
    opponent: "Agent",
    lines: [
      { who: "Agent", text: "Good morning — passport and booking reference, please." },
      { who: "Passenger", text: "Here you go. Fair warning: the bag might be slightly over the limit." },
      { who: "Agent", text: "Slightly? It's two kilos over. I can offer a better rate if you check it now." },
      { who: "Passenger", text: "What's the rate? And can I keep the cabin bag as is?" },
      { who: "Agent", text: "Thirty for the extra weight, cabin bag's fine. Payment here." },
      { who: "Passenger", text: "Do it — better than repacking in front of everyone." },
      { who: "Agent", text: "Sorted. Gate 24, boarding closes in forty minutes. Don't wander far." },
      { who: "Passenger", text: "Noted — coffee stays in my hand this time. Thanks for the help." },
    ],
  },
];

export function getScript(slug: string): ScriptDef | null {
  return SCRIPTS.find((s) => s.slug === slug) ?? null;
}

export function scriptsForPack(pack: ScriptPack): ScriptDef[] {
  return SCRIPTS.filter((s) => s.pack === pack);
}

export function yourLines(script: ScriptDef): ScriptLine[] {
  const role = script.role.toLowerCase();
  return script.lines.filter((l) => l.who.toLowerCase() === role);
}

export function practicePrompt(script: ScriptDef): string {
  const mine = yourLines(script);
  const numbered = mine
    .map((l, i) => `${i + 1}. "${l.text}"`)
    .join("\n");
  return `Scene: ${script.title}. Deliver your lines aloud as ${script.role} (replying to ${script.opponent}):\n${numbered}`;
}
