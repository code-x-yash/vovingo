import type { CourseSeed } from "./types";

export const courses: CourseSeed[] = [
  {
    slug: "english-foundations",
    title: "English Foundations",
    description:
      "Rebuild the core: tenses, articles, sentence order and the small words that make or break a sentence.",
    level: "beginner",
    category: "grammar",
    icon: "🧱",
    orderIndex: 1,
  },
  {
    slug: "speak-naturally",
    title: "Speak Naturally",
    description:
      "Sound less like a textbook and more like a person. Fillers, rhythm, contractions and real conversation habits.",
    level: "intermediate",
    category: "conversation",
    icon: "🗣️",
    orderIndex: 2,
  },
  {
    slug: "workplace-english",
    title: "Workplace English",
    description:
      "Emails, meetings, updates and small talk that actually get used at work — plus the phrases teams expect.",
    level: "intermediate",
    category: "professional",
    icon: "💼",
    orderIndex: 3,
  },
  {
    slug: "english-for-interviews",
    title: "English for Interviews",
    description:
      "Answer structure, confident phrasing and precise vocabulary for interviews in any role.",
    level: "intermediate",
    category: "interview",
    icon: "🎯",
    orderIndex: 4,
  },
  {
    slug: "advanced-vocabulary",
    title: "Advanced Vocabulary",
    description:
      "Precise, high-impact words and collocations for essays, presentations and debates — with spaced review.",
    level: "advanced",
    category: "vocabulary",
    icon: "🧩",
    orderIndex: 5,
  },
];
