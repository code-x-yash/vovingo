export type WritingPrompt = {
  slug: string;
  kind: "email" | "message" | "post" | "essay" | "application" | "update" | "free";
  title: string;
  brief: string;
  hints: string[];
  minWords: number;
  level: "beginner" | "intermediate" | "advanced";
};

/**
 * Writing lab prompts. Static content (no DB table) — the analysis results are
 * what get persisted to `writing_analyses`.
 */
export const writingPrompts: WritingPrompt[] = [
  {
    slug: "thank-you-email",
    kind: "email",
    title: "Thank-you email to a colleague",
    brief:
      "Write a short email thanking a colleague for helping you finish a project. Mention what they did and how it helped.",
    hints: [
      "Open with a warm one-line thank you.",
      "Be specific about what they did.",
      "Close with a friendly offer to return the favour.",
    ],
    minWords: 50,
    level: "beginner",
  },
  {
    slug: "polite-complaint",
    kind: "email",
    title: "Polite complaint to a service",
    brief:
      "You ordered a product and it arrived damaged. Write a polite but clear complaint email asking for a replacement or refund.",
    hints: [
      "Stay polite — 'could you' works better than 'you must'.",
      "Include your order details in one line.",
      "Say exactly what outcome you want.",
    ],
    minWords: 60,
    level: "intermediate",
  },
  {
    slug: "follow-up-application",
    kind: "email",
    title: "Follow up on a job application",
    brief:
      "You applied for a job two weeks ago and haven't heard back. Write a concise follow-up email to the recruiter.",
    hints: [
      "Remind them which role you applied for.",
      "Add one new reason you're a good fit.",
      "Ask politely about next steps.",
    ],
    minWords: 60,
    level: "intermediate",
  },
  {
    slug: "invite-friend",
    kind: "message",
    title: "Invite a friend to dinner",
    brief:
      "Message a friend to invite them to dinner at your place this Saturday. Include the time and one thing you'll cook.",
    hints: [
      "Keep it casual — this is a message, not an essay.",
      "Give the day, date and time clearly.",
      "End with a question so they reply.",
    ],
    minWords: 40,
    level: "beginner",
  },
  {
    slug: "running-late",
    kind: "message",
    title: "Explain why you're running late",
    brief:
      "You're going to be 30 minutes late to a meeting. Message your team to explain and say what they should do without you.",
    hints: [
      "Lead with the delay, not the story.",
      "Give one clear instruction for the meeting.",
      "Apologise once — briefly.",
    ],
    minWords: 40,
    level: "beginner",
  },
  {
    slug: "travel-post",
    kind: "post",
    title: "Social post about a trip",
    brief:
      "Write a short social media post about a recent trip. Describe one moment you loved and one thing you'd recommend.",
    hints: [
      "Paint one specific picture, not a whole itinerary.",
      "Use at least one past-tense verb correctly.",
      "Finish with a recommendation or question.",
    ],
    minWords: 50,
    level: "intermediate",
  },
  {
    slug: "product-review",
    kind: "post",
    title: "Review something you use daily",
    brief:
      "Write an honest review of a product you use every day. Cover what you like, what you don't, and who you'd recommend it to.",
    hints: [
      "Balance praise and criticism.",
      "Use 'whereas' or 'on the other hand' for contrast.",
      "End with a clear verdict.",
    ],
    minWords: 60,
    level: "intermediate",
  },
  {
    slug: "remote-work-essay",
    kind: "essay",
    title: "Essay: is remote work better?",
    brief:
      "Write a short essay arguing whether remote work is better than office work. Give two reasons with examples.",
    hints: [
      "State your position in the first sentence.",
      "One reason per paragraph, each with an example.",
      "Acknowledge the other side before your conclusion.",
    ],
    minWords: 80,
    level: "intermediate",
  },
  {
    slug: "opinion-education",
    kind: "essay",
    title: "Essay: what schools should teach",
    brief:
      "Write an opinion essay on one practical skill schools should teach but usually don't (money, cooking, negotiation…).",
    hints: [
      "Pick ONE skill and defend it.",
      "Use linking words: firstly, however, therefore.",
      "Close with why it matters for real life.",
    ],
    minWords: 80,
    level: "advanced",
  },
  {
    slug: "cover-paragraph",
    kind: "application",
    title: "Cover letter opening paragraph",
    brief:
      "Write the opening paragraph of a cover letter: say which role you want, why this company, and one achievement you're proud of.",
    hints: [
      "Name the role in the first line.",
      "Show you know what the company does.",
      "Quantify your achievement if you can.",
    ],
    minWords: 60,
    level: "advanced",
  },
  {
    slug: "weekly-update",
    kind: "update",
    title: "Weekly status update",
    brief:
      "Write a weekly update for your manager: what you finished, what you're doing next, and one blocker you need help with.",
    hints: [
      "Use short bullet-style sentences.",
      "Be honest about the blocker — no padding.",
      "Keep it skimmable in 20 seconds.",
    ],
    minWords: 50,
    level: "intermediate",
  },
  {
    slug: "free-write",
    kind: "free",
    title: "Free write: anything on your mind",
    brief:
      "Write freely for a few minutes about anything — your day, a plan, an opinion. The AI looks for recurring patterns to help you fix.",
    hints: [
      "Don't edit while you write.",
      "Try to use a mix of sentence lengths.",
      "Read it once before submitting.",
    ],
    minWords: 60,
    level: "intermediate",
  },
];

export function getWritingPrompt(slug: string): WritingPrompt | null {
  return writingPrompts.find((p) => p.slug === slug) ?? null;
}
