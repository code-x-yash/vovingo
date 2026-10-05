import type { AchievementSeed } from "./types";

export const achievements: AchievementSeed[] = [
  { key: "first-lesson", title: "First Steps", description: "Complete your first lesson.", icon: "🌱", xp: 10, criteria: { lessons: 1 } },
  { key: "first-conversation", title: "First Conversation", description: "Finish your first AI conversation.", icon: "💬", xp: 20, criteria: { conversations: 1 } },
  { key: "first-speaking", title: "Found Your Voice", description: "Complete your first speaking session.", icon: "🎙️", xp: 20, criteria: { speakingSessions: 1 } },
  { key: "streak-7", title: "7 Day Streak", description: "Practice 7 days in a row.", icon: "🔥", xp: 50, criteria: { streak: 7 } },
  { key: "streak-30", title: "30 Day Streak", description: "Practice 30 days in a row.", icon: "⚡", xp: 150, criteria: { streak: 30 } },
  { key: "words-100", title: "100 New Words", description: "Add 100 words to your vocabulary.", icon: "📚", xp: 50, criteria: { words: 100 } },
  { key: "speaking-100min", title: "100 Minutes Speaking", description: "Accumulate 100 minutes of speaking practice.", icon: "🎤", xp: 100, criteria: { speakingMinutes: 100 } },
  { key: "grammar-master", title: "Grammar Master", description: "Resolve 10 recurring grammar mistakes.", icon: "✅", xp: 100, criteria: { resolvedMistakes: 10 } },
  { key: "first-practice", title: "On the Fix", description: "Complete your first mistake practice.", icon: "🛠️", xp: 10, criteria: { mistakePractices: 1 } },
  { key: "assessment-done", title: "Know Where You Stand", description: "Complete the placement assessment.", icon: "🧭", xp: 30, criteria: { assessments: 1 } },
  { key: "lesson-10", title: "Ten Lessons In", description: "Complete 10 lessons.", icon: "🎓", xp: 40, criteria: { lessons: 10 } },
  { key: "perfect-week", title: "Perfect Week", description: "Hit your daily plan 7 times in one week.", icon: "🏆", xp: 80, criteria: { planDays: 7 } },
];
