import type { LessonContent, Persona } from "../db/schema";

export type CourseSeed = {
  slug: string;
  title: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  category: string;
  icon: string;
  orderIndex: number;
};

export type LessonSeed = {
  slug: string;
  courseSlug: string;
  title: string;
  category:
    | "grammar"
    | "vocabulary"
    | "pronunciation"
    | "conversation"
    | "listening"
    | "reading"
    | "writing"
    | "professional"
    | "interview";
  level: "beginner" | "intermediate" | "advanced";
  summary: string;
  durationMin: number;
  orderIndex: number;
  skillFocus:
    | "grammar"
    | "vocabulary"
    | "fluency"
    | "pronunciation"
    | "speaking"
    | "listening"
    | "writing"
    | "confidence";
  content: LessonContent;
};

export type ExerciseSeed = {
  lessonSlug: string;
  type: "mcq" | "fill_blank" | "reorder" | "match" | "speak" | "write" | "choose_natural";
  skill: "grammar" | "vocabulary" | "fluency" | "pronunciation" | "listening" | "writing";
  prompt: Record<string, unknown>;
  options?: string[];
  correctAnswer?: string | string[];
  explanation: string;
  difficulty: number;
  tags: string[];
  orderIndex: number;
};

export type VocabularySeed = {
  word: string;
  definition: string;
  pronunciation: string;
  example: string;
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  category:
    | "daily"
    | "office"
    | "meetings"
    | "interviews"
    | "travel"
    | "social"
    | "technology"
    | "business"
    | "academic"
    | "slang"
    | "advanced";
  topic: string;
  difficulty: number;
  nativeGloss?: Record<string, string>;
};

export type ScenarioSeed = {
  slug: string;
  title: string;
  category: "free" | "topic" | "situation" | "roleplay" | "interview";
  description: string;
  difficulty: number;
  persona?: Persona;
  openingPrompt?: string;
  tags: string[];
  skillFocus?: string;
};

export type PodcastSeed = {
  slug: string;
  title: string;
  topic:
    | "technology"
    | "business"
    | "sports"
    | "culture"
    | "travel"
    | "news"
    | "productivity"
    | "movies"
    | "science"
    | "facts"
    | "career"
    | "everyday";
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  durationSec: number;
  coverEmoji: string;
  publishedDate: string;
  featured?: boolean;
  vocabularyWords: string[];
  transcript: { orderIndex: number; startMs: number; endMs: number; text: string }[];
  questions: {
    type: "main_idea" | "detail" | "inference" | "vocabulary" | "speaker";
    prompt: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    orderIndex: number;
  }[];
};

export type MistakeSeed = {
  key: string;
  title: string;
  category: "grammar" | "vocab" | "pronunciation" | "fluency" | "naturalness" | "style" | "listening";
  subcategory?: string;
  description: string;
  wrongExample: string;
  correctExample: string;
  why: string;
  naturalAlternative?: string;
  severity: "low" | "medium" | "high";
  lessonSlug?: string;
  practicePrompts: string[];
  detection: { patterns?: string[]; kind?: string };
};

export type AchievementSeed = {
  key: string;
  title: string;
  description: string;
  icon: string;
  xp: number;
  criteria: Record<string, unknown>;
};
