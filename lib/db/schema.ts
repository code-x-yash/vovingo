import { relations, type InferSelectModel, type InferInsertModel } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

const id = () =>
  integer("id", { mode: "number" }).primaryKey({ autoIncrement: true });

const bool = (name: string, dflt = false) =>
  integer(name, { mode: "boolean" }).notNull().default(dflt);

// ---------------------------------------------------------------------------
// JSON content shapes
// ---------------------------------------------------------------------------

export type LessonBlock =
  | { type: "concept"; title: string; body: string }
  | { type: "example"; wrong?: string; right: string; note?: string }
  | { type: "dialogue"; lines: { speaker: string; text: string }[] }
  | { type: "tips"; items: string[] }
  | { type: "video"; url: string; caption?: string }
  | { type: "audio"; url: string; caption?: string };

export type LessonContent = {
  blocks: LessonBlock[];
  keyPhrases?: string[];
};

export type PlanItem = {
  kind: "learn" | "listen" | "vocab" | "speak" | "fix" | "watch" | "read" | "write" | "review" | "challenge";
  title: string;
  subtitle?: string;
  minutes: number;
  ref?: { type: string; id: number };
  done?: boolean;
};

export type Persona = {
  role: string;
  name?: string;
  style?: string;
  opening?: string;
};

export type SkillMap = Record<string, number>;

export type DetectedMistake = {
  key: string;
  title: string;
  category: string;
  wrong: string;
  correct: string;
  why: string;
  severity: "low" | "medium" | "high";
  confidence: number;
};

export type Recommendation = {
  title: string;
  body: string;
  action?: { type: string; id?: number };
};

export type AnalysisScores = {
  grammar?: number;
  vocabulary?: number;
  fluency?: number;
  pronunciation?: number;
  confidence?: number;
  naturalness?: number;
  listening?: number;
  writing?: number;
};

export type UserProfileSnapshot = {
  narrative: string;
  strengths: string[];
  weaknesses: string[];
  skillScores: SkillMap;
  level: string;
};

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  name: text("name").notNull(),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  status: text("status", { enum: ["active", "suspended", "deleted"] })
    .notNull()
    .default("active"),
  emailVerifiedAt: integer("email_verified_at", { mode: "timestamp_ms" }),
  lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    userAgent: text("user_agent"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

export const authAccounts = sqliteTable(
  "auth_accounts",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["google", "phone"] }).notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("auth_accounts_provider_uq").on(t.provider, t.providerAccountId),
    index("auth_accounts_user_idx").on(t.userId),
  ]
);

export const profiles = sqliteTable("profiles", {
  id: id(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  nativeLanguage: text("native_language").default("hindi"),
  englishLevel: text("english_level", {
    enum: [
      "complete_beginner",
      "beginner",
      "elementary",
      "intermediate",
      "upper_intermediate",
      "advanced",
      "unsure",
    ],
  }),
  profession: text("profession"),
  learningStyle: text("learning_style", {
    enum: ["visual", "audio", "reading", "practice"],
  }).default("practice"),
  dailyMinutes: integer("daily_minutes").notNull().default(20),
  targetScore: integer("target_score"),
  timezone: text("timezone").default("Asia/Kolkata"),
  nativeHints: bool("native_hints", true),
  preferredDifficulty: real("preferred_difficulty").notNull().default(0.5),
  onboardedAt: integer("onboarded_at", { mode: "timestamp_ms" }),
  placementCompletedAt: integer("placement_completed_at", { mode: "timestamp_ms" }),
  avatarUrl: text("avatar_url"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const learningGoals = sqliteTable(
  "learning_goals",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    goal: text("goal").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("learning_goals_user_goal_uq").on(t.userId, t.goal)]
);

export const skillScores = sqliteTable(
  "skill_scores",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skill: text("skill", {
      enum: [
        "grammar",
        "vocabulary",
        "fluency",
        "pronunciation",
        "listening",
        "writing",
        "speaking",
        "confidence",
        "reading",
        "overall",
      ],
    }).notNull(),
    score: real("score").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("skill_scores_user_skill_uq").on(t.userId, t.skill)]
);

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: text("plan", { enum: ["free", "pro", "premium"] })
      .notNull()
      .default("free"),
    status: text("status", {
      enum: ["active", "trial", "canceled", "past_due"],
    })
      .notNull()
      .default("active"),
    provider: text("provider").default("manual"),
    providerRef: text("provider_ref"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("subscriptions_user_idx").on(t.userId)]
);

// ---------------------------------------------------------------------------
// Content (CMS-driven)
// ---------------------------------------------------------------------------

export const courses = sqliteTable(
  "courses",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    level: text("level", { enum: ["beginner", "intermediate", "advanced"] }).notNull(),
    category: text("category").notNull().default("general"),
    icon: text("icon").notNull().default("📘"),
    orderIndex: integer("order_index").notNull().default(0),
    published: bool("published", true),
    createdAt: createdAt(),
  }
);

export const modules = sqliteTable(
  "modules",
  {
    id: id(),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("modules_course_idx").on(t.courseId)]
);

export const lessons = sqliteTable(
  "lessons",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    courseId: integer("course_id").references(() => courses.id, {
      onDelete: "set null",
    }),
    moduleId: integer("module_id").references(() => modules.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    category: text("category", {
      enum: [
        "grammar",
        "vocabulary",
        "pronunciation",
        "conversation",
        "listening",
        "reading",
        "writing",
        "professional",
        "interview",
      ],
    }).notNull(),
    level: text("level", { enum: ["beginner", "intermediate", "advanced"] }).notNull(),
    summary: text("summary").notNull(),
    durationMin: integer("duration_min").notNull().default(5),
    orderIndex: integer("order_index").notNull().default(0),
    skillFocus: text("skill_focus", { enum: ["grammar", "vocabulary", "fluency", "pronunciation", "speaking", "listening", "writing", "confidence"] }),
    content: text("content", { mode: "json" }).$type<LessonContent>().notNull(),
    published: bool("published", true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("lessons_course_idx").on(t.courseId),
    index("lessons_category_idx").on(t.category),
  ]
);

export const exercises = sqliteTable(
  "exercises",
  {
    id: id(),
    lessonId: integer("lesson_id").references(() => lessons.id, {
      onDelete: "cascade",
    }),
    type: text("type", {
      enum: ["mcq", "fill_blank", "reorder", "match", "speak", "write", "choose_natural"],
    }).notNull(),
    skill: text("skill", {
      enum: ["grammar", "vocabulary", "fluency", "pronunciation", "listening", "writing"],
    }).notNull(),
    prompt: text("prompt", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    options: text("options", { mode: "json" }).$type<string[]>(),
    correctAnswer: text("correct_answer", { mode: "json" }).$type<string | string[]>(),
    explanation: text("explanation").notNull(),
    difficulty: real("difficulty").notNull().default(0.5),
    tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("exercises_lesson_idx").on(t.lessonId), index("exercises_skill_idx").on(t.skill)]
);

export const answers = sqliteTable(
  "answers",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    response: text("response", { mode: "json" }).$type<unknown>(),
    correct: bool("correct"),
    createdAt: createdAt(),
  },
  (t) => [
    index("answers_user_exercise_idx").on(t.userId, t.exerciseId),
    index("answers_user_idx").on(t.userId),
  ]
);

export const lessonProgress = sqliteTable(
  "lesson_progress",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["in_progress", "completed"] })
      .notNull()
      .default("in_progress"),
    exercisesDone: integer("exercises_done").notNull().default(0),
    exercisesTotal: integer("exercises_total").notNull().default(0),
    score: real("score"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    lastPracticedAt: integer("last_practiced_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("lesson_progress_user_lesson_uq").on(t.userId, t.lessonId),
    index("lesson_progress_user_idx").on(t.userId),
  ]
);

export const vocabulary = sqliteTable(
  "vocabulary",
  {
    id: id(),
    word: text("word").notNull(),
    definition: text("definition").notNull(),
    pronunciation: text("pronunciation"),
    example: text("example").notNull(),
    synonyms: text("synonyms", { mode: "json" }).$type<string[]>().default([]),
    antonyms: text("antonyms", { mode: "json" }).$type<string[]>().default([]),
    collocations: text("collocations", { mode: "json" }).$type<string[]>().default([]),
    category: text("category", {
      enum: [
        "daily",
        "office",
        "meetings",
        "interviews",
        "travel",
        "social",
        "technology",
        "business",
        "academic",
        "slang",
        "advanced",
      ],
    }).notNull(),
    topic: text("topic"),
    difficulty: real("difficulty").notNull().default(0.5),
    nativeGloss: text("native_gloss", { mode: "json" }).$type<Record<string, string>>(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("vocabulary_word_category_uq").on(t.word, t.category), index("vocabulary_category_idx").on(t.category)]
);

export const userVocabulary = sqliteTable(
  "user_vocabulary",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    wordId: integer("word_id")
      .notNull()
      .references(() => vocabulary.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["learning", "reviewing", "known", "suspended"] })
      .notNull()
      .default("learning"),
    ease: real("ease").notNull().default(2.5),
    intervalDays: integer("interval_days").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    dueAt: integer("due_at", { mode: "timestamp_ms" }),
    lastReviewedAt: integer("last_reviewed_at", { mode: "timestamp_ms" }),
    correctCount: integer("correct_count").notNull().default(0),
    wrongCount: integer("wrong_count").notNull().default(0),
    source: text("source", {
      enum: ["lesson", "podcast", "reading", "manual", "coach", "speaking"],
    }).default("manual"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("user_vocabulary_user_word_uq").on(t.userId, t.wordId),
    index("user_vocabulary_due_idx").on(t.userId, t.dueAt),
    index("user_vocabulary_status_idx").on(t.userId, t.status),
  ]
);

export const podcasts = sqliteTable(
  "podcasts",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    topic: text("topic", {
      enum: [
        "technology",
        "business",
        "sports",
        "culture",
        "travel",
        "news",
        "productivity",
        "movies",
        "science",
        "facts",
        "career",
        "everyday",
      ],
    }).notNull(),
    description: text("description").notNull(),
    level: text("level", { enum: ["beginner", "intermediate", "advanced"] }).notNull(),
    durationSec: integer("duration_sec").notNull().default(300),
    audioUrl: text("audio_url"),
    coverEmoji: text("cover_emoji").default("🎧"),
    publishedDate: text("published_date"),
    featured: bool("featured"),
    vocabularyIds: text("vocabulary_ids", { mode: "json" }).$type<number[]>().default([]),
    published: bool("published", true),
    createdAt: createdAt(),
  },
  (t) => [index("podcasts_topic_idx").on(t.topic)]
);

export const podcastTranscripts = sqliteTable(
  "podcast_transcripts",
  {
    id: id(),
    podcastId: integer("podcast_id")
      .notNull()
      .references(() => podcasts.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    startMs: integer("start_ms").notNull().default(0),
    endMs: integer("end_ms").notNull().default(0),
    text: text("text").notNull(),
  },
  (t) => [index("podcast_transcripts_podcast_idx").on(t.podcastId)]
);

export const listeningQuestions = sqliteTable(
  "listening_questions",
  {
    id: id(),
    podcastId: integer("podcast_id")
      .notNull()
      .references(() => podcasts.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["main_idea", "detail", "inference", "vocabulary", "speaker"],
    }).notNull(),
    prompt: text("prompt").notNull(),
    options: text("options", { mode: "json" }).$type<string[]>().notNull(),
    correctIndex: integer("correct_index").notNull(),
    explanation: text("explanation").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => [index("listening_questions_podcast_idx").on(t.podcastId)]
);

export const videos = sqliteTable(
  "videos",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    level: text("level", { enum: ["beginner", "intermediate", "advanced"] }).notNull(),
    category: text("category", {
      enum: ["educational", "conversation", "interview", "public_speaking", "business", "scene"],
    }).notNull(),
    videoUrl: text("video_url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    durationSec: integer("duration_sec").notNull().default(180),
    published: bool("published", true),
    createdAt: createdAt(),
  },
  (t) => [index("videos_category_idx").on(t.category)]
);

export const videoTranscripts = sqliteTable(
  "video_transcripts",
  {
    id: id(),
    videoId: integer("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    startMs: integer("start_ms").notNull().default(0),
    endMs: integer("end_ms").notNull().default(0),
    text: text("text").notNull(),
  },
  (t) => [index("video_transcripts_video_idx").on(t.videoId)]
);

export const songs = sqliteTable(
  "songs",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    durationSec: integer("duration_sec").notNull().default(200),
    coverUrl: text("cover_url"),
    language: text("language").default("en"),
    level: text("level", { enum: ["beginner", "intermediate", "advanced"] }).default("intermediate"),
    lyricsProvider: text("lyrics_provider"),
    lyricsRef: text("lyrics_ref"),
    syncedLyricsUrl: text("synced_lyrics_url"),
    licenseType: text("license_type").default("external"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().default({}),
    published: bool("published", true),
    createdAt: createdAt(),
  }
);

export const scenarios = sqliteTable(
  "scenarios",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    category: text("category", { enum: ["free", "topic", "situation", "roleplay", "interview"] }).notNull(),
    description: text("description").notNull(),
    difficulty: real("difficulty").notNull().default(0.5),
    persona: text("persona", { mode: "json" }).$type<Persona>(),
    openingPrompt: text("opening_prompt"),
    tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
    skillFocus: text("skill_focus"),
    createdAt: createdAt(),
  },
  (t) => [index("scenarios_category_idx").on(t.category)]
);

export const readingPassages = sqliteTable(
  "reading_passages",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    level: text("level", { enum: ["beginner", "intermediate", "advanced"] }).notNull(),
    category: text("category", {
      enum: ["story", "news", "article", "conversation", "professional"],
    }).notNull(),
    paragraphs: text("paragraphs", { mode: "json" }).$type<string[]>().notNull(),
    vocabularyIds: text("vocabulary_ids", { mode: "json" }).$type<number[]>().default([]),
    questions: text("questions", { mode: "json" })
      .$type<{ prompt: string; options: string[]; correctIndex: number; explanation: string }[]>()
      .default([]),
    published: bool("published", true),
    createdAt: createdAt(),
  }
);

// ---------------------------------------------------------------------------
// Mistake pattern engine
// ---------------------------------------------------------------------------

export const mistakes = sqliteTable(
  "mistakes",
  {
    id: id(),
    key: text("key").notNull().unique(),
    title: text("title").notNull(),
    category: text("category", {
      enum: ["grammar", "vocab", "pronunciation", "fluency", "naturalness", "style", "listening"],
    }).notNull(),
    subcategory: text("subcategory"),
    description: text("description").notNull(),
    wrongExample: text("wrong_example").notNull(),
    correctExample: text("correct_example").notNull(),
    why: text("why").notNull(),
    naturalAlternative: text("natural_alternative"),
    severity: text("severity", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
    lessonId: integer("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    practicePrompts: text("practice_prompts", { mode: "json" }).$type<string[]>().default([]),
    detection: text("detection", { mode: "json" })
      .$type<{ patterns?: string[]; kind?: string }>()
      .default({}),
    createdAt: createdAt(),
  },
  (t) => [index("mistakes_category_idx").on(t.category)]
);

export const userMistakes = sqliteTable(
  "user_mistakes",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mistakeId: integer("mistake_id")
      .notNull()
      .references(() => mistakes.id, { onDelete: "cascade" }),
    occurrences: integer("occurrences").notNull().default(0),
    firstDetectedAt: integer("first_detected_at", { mode: "timestamp_ms" }).notNull(),
    lastDetectedAt: integer("last_detected_at", { mode: "timestamp_ms" }).notNull(),
    trend: text("trend", { enum: ["new", "stable", "improving", "worsening"] })
      .notNull()
      .default("new"),
    trendPercent: real("trend_percent").notNull().default(0),
    status: text("status", { enum: ["active", "needs_practice", "improving", "resolved"] })
      .notNull()
      .default("active"),
    severity: text("severity", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
    practiceCount: integer("practice_count").notNull().default(0),
    lastPracticedAt: integer("last_practiced_at", { mode: "timestamp_ms" }),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("user_mistakes_user_mistake_uq").on(t.userId, t.mistakeId),
    index("user_mistakes_user_status_idx").on(t.userId, t.status),
  ]
);

export const mistakeOccurrences = sqliteTable(
  "mistake_occurrences",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mistakeId: integer("mistake_id")
      .notNull()
      .references(() => mistakes.id, { onDelete: "cascade" }),
    userMistakeId: integer("user_mistake_id").references(() => userMistakes.id, {
      onDelete: "cascade",
    }),
    sessionType: text("session_type", {
      enum: ["speaking", "writing", "conversation", "practice", "assessment"],
    }).notNull(),
    sessionId: integer("session_id"),
    sentence: text("sentence").notNull(),
    correction: text("correction").notNull(),
    isRepeat: bool("is_repeat"),
    confidence: real("confidence").notNull().default(1),
    detectedAt: integer("detected_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    index("mistake_occurrences_user_mistake_idx").on(t.userId, t.mistakeId),
    index("mistake_occurrences_detected_idx").on(t.detectedAt),
  ]
);

// ---------------------------------------------------------------------------
// Assessment
// ---------------------------------------------------------------------------

export const assessmentSessions = sqliteTable(
  "assessment_sessions",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["placement", "weekly", "level"] }).notNull().default("placement"),
    status: text("status", { enum: ["active", "completed", "abandoned"] })
      .notNull()
      .default("active"),
    stage: text("stage", {
      enum: ["grammar", "vocabulary", "reading", "listening", "writing", "speaking", "done"],
    }).notNull().default("grammar"),
    scores: text("scores", { mode: "json" }).$type<SkillMap>().default({}),
    profile: text("profile", { mode: "json" }).$type<UserProfileSnapshot>(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("assessment_sessions_user_idx").on(t.userId)]
);

export const assessmentAnswers = sqliteTable(
  "assessment_answers",
  {
    id: id(),
    assessmentId: integer("assessment_id")
      .notNull()
      .references(() => assessmentSessions.id, { onDelete: "cascade" }),
    section: text("section").notNull(),
    questionKey: text("question_key").notNull(),
    response: text("response", { mode: "json" }).$type<unknown>(),
    correct: bool("correct"),
    points: real("points").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("assessment_answers_session_idx").on(t.assessmentId)]
);

// ---------------------------------------------------------------------------
// Speaking & AI analysis
// ---------------------------------------------------------------------------

export const speakingSessions = sqliteTable(
  "speaking_sessions",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mode: text("mode", {
      enum: ["free", "topic", "situation", "roleplay", "assessment", "daily", "shadowing"],
    }).notNull(),
    scenarioId: integer("scenario_id").references(() => scenarios.id, { onDelete: "set null" }),
    prompt: text("prompt"),
    durationSec: integer("duration_sec").notNull().default(0),
    transcript: text("transcript").default(""),
    wpm: real("wpm"),
    pauseCount: integer("pause_count").default(0),
    longPauseCount: integer("long_pause_count").default(0),
    avgPauseMs: real("avg_pause_ms"),
    fillerCount: integer("filler_count").default(0),
    wordCount: integer("word_count").default(0),
    uniqueWordCount: integer("unique_word_count").default(0),
    grammarScore: real("grammar_score"),
    vocabularyScore: real("vocabulary_score"),
    fluencyScore: real("fluency_score"),
    pronunciationScore: real("pronunciation_score"),
    confidenceScore: real("confidence_score"),
    naturalnessScore: real("naturalness_score"),
    audioKey: text("audio_key"),
    analysisId: integer("analysis_id"),
    status: text("status", { enum: ["processing", "completed", "failed"] })
      .notNull()
      .default("processing"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("speaking_sessions_user_idx").on(t.userId, t.createdAt),
    index("speaking_sessions_status_idx").on(t.status),
  ]
);

export const speakingSegments = sqliteTable(
  "speaking_segments",
  {
    id: id(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => speakingSessions.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    startMs: integer("start_ms").notNull().default(0),
    endMs: integer("end_ms").notNull().default(0),
    text: text("text").notNull(),
    final: bool("final", true),
  },
  (t) => [index("speaking_segments_session_idx").on(t.sessionId)]
);

export const aiAnalysis = sqliteTable(
  "ai_analysis",
  {
    id: id(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    subjectType: text("subject_type", {
      enum: ["speaking", "writing", "conversation", "assessment", "placement", "weekly", "daily_plan"],
    }).notNull(),
    subjectId: integer("subject_id"),
    provider: text("provider").notNull(),
    model: text("model"),
    promptVersion: text("prompt_version"),
    temperature: real("temperature"),
    input: text("input", { mode: "json" }).$type<unknown>(),
    output: text("output", { mode: "json" }).$type<unknown>(),
    summary: text("summary"),
    scores: text("scores", { mode: "json" }).$type<SkillMap>(),
    recommendations: text("recommendations", { mode: "json" }).$type<Recommendation[]>(),
    latencyMs: integer("latency_ms"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    success: bool("success", true),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [
    index("ai_analysis_user_subject_idx").on(t.userId, t.subjectType, t.subjectId),
    index("ai_analysis_created_idx").on(t.createdAt),
  ]
);

// ---------------------------------------------------------------------------
// Practice
// ---------------------------------------------------------------------------

export const practiceSessions = sqliteTable(
  "practice_sessions",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["mistake", "vocab_srs", "daily", "adaptive", "conversation", "lesson", "placement"],
    }).notNull(),
    mistakeId: integer("mistake_id").references(() => mistakes.id, { onDelete: "set null" }),
    questionCount: integer("question_count").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    score: real("score"),
    durationSec: integer("duration_sec").notNull().default(0),
    completed: bool("completed"),
    createdAt: createdAt(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("practice_sessions_user_idx").on(t.userId, t.createdAt)]
);

export const practiceItems = sqliteTable(
  "practice_items",
  {
    id: id(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => practiceSessions.id, { onDelete: "cascade" }),
    exerciseId: integer("exercise_id").references(() => exercises.id, { onDelete: "set null" }),
    kind: text("kind", { enum: ["exercise", "speak", "write", "review", "explain"] }).notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    response: text("response", { mode: "json" }).$type<unknown>(),
    correct: bool("correct"),
    feedback: text("feedback", { mode: "json" }).$type<unknown>(),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => [index("practice_items_session_idx").on(t.sessionId)]
);

export const dailyPlans = sqliteTable(
  "daily_plans",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    minutesTarget: integer("minutes_target").notNull().default(20),
    focus: text("focus"),
    focusReason: text("focus_reason"),
    focusMistakeId: integer("focus_mistake_id").references(() => mistakes.id, {
      onDelete: "set null",
    }),
    items: text("items", { mode: "json" }).$type<PlanItem[]>().notNull().default([]),
    generatedBy: text("generated_by", { enum: ["ai", "rule"] }).notNull().default("rule"),
    status: text("status", { enum: ["active", "completed", "superseded"] }).notNull().default("active"),
    completedCount: integer("completed_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("daily_plans_user_date_uq").on(t.userId, t.date)]
);

export const writingAnalyses = sqliteTable(
  "writing_analyses",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["email", "message", "post", "essay", "application", "update", "free"],
    }).notNull().default("free"),
    original: text("original").notNull(),
    corrected: text("corrected"),
    natural: text("natural"),
    tone: text("tone"),
    scores: text("scores", { mode: "json" }).$type<SkillMap>(),
    mistakes: text("mistakes", { mode: "json" }).$type<DetectedMistake[]>().default([]),
    feedback: text("feedback", { mode: "json" }).$type<unknown>(),
    analysisId: integer("analysis_id").references(() => aiAnalysis.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("writing_analyses_user_idx").on(t.userId, t.createdAt)]
);

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------

export const conversations = sqliteTable(
  "conversations",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scenarioId: integer("scenario_id").references(() => scenarios.id, { onDelete: "set null" }),
    mode: text("mode", { enum: ["free", "roleplay", "interview"] }).notNull().default("free"),
    persona: text("persona", { mode: "json" }).$type<Persona>(),
    title: text("title").default("Conversation"),
    status: text("status", { enum: ["active", "ended"] }).notNull().default("active"),
    messageCount: integer("message_count").notNull().default(0),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("conversations_user_idx").on(t.userId, t.createdAt)]
);

export const conversationMessages = sqliteTable(
  "conversation_messages",
  {
    id: id(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "ai"] }).notNull(),
    content: text("content").notNull(),
    analysis: text("analysis", { mode: "json" }).$type<unknown>(),
    createdAt: createdAt(),
  },
  (t) => [index("conversation_messages_conv_idx").on(t.conversationId)]
);

export const listeningSessions = sqliteTable(
  "listening_sessions",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    podcastId: integer("podcast_id").references(() => podcasts.id, { onDelete: "set null" }),
    mode: text("mode", {
      enum: ["normal", "transcript", "no_transcript", "fill_blank", "dictation"],
    }).notNull().default("normal"),
    answers: text("answers", { mode: "json" }).$type<unknown>(),
    score: real("score"),
    completed: bool("completed"),
    createdAt: createdAt(),
  },
  (t) => [index("listening_sessions_user_idx").on(t.userId)]
);

// ---------------------------------------------------------------------------
// Progress & gamification
// ---------------------------------------------------------------------------

export const progressSnapshots = sqliteTable(
  "progress_snapshots",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    overall: real("overall").notNull().default(0),
    skills: text("skills", { mode: "json" }).$type<SkillMap>().default({}),
    wpm: real("wpm"),
    fillerRate: real("filler_rate"),
    vocabDiversity: real("vocab_diversity"),
    speakingMinutes: real("speaking_minutes").default(0),
    notes: text("notes", { mode: "json" }).$type<string[]>().default([]),
    createdAt: createdAt(),
  },
  (t) => [index("progress_snapshots_user_date_idx").on(t.userId, t.date)]
);

export const achievements = sqliteTable("achievements", {
  id: id(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").default("🏅"),
  xp: integer("xp").notNull().default(10),
  criteria: text("criteria", { mode: "json" }).$type<Record<string, unknown>>().default({}),
});

export const userAchievements = sqliteTable(
  "user_achievements",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: integer("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    unlockedAt: integer("unlocked_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("user_achievements_user_ach_uq").on(t.userId, t.achievementId),
    index("user_achievements_user_idx").on(t.userId),
  ]
);

export const streaks = sqliteTable("streaks", {
  id: id(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  current: integer("current").notNull().default(0),
  longest: integer("longest").notNull().default(0),
  lastActiveDate: text("last_active_date"),
  totalDays: integer("total_days").notNull().default(0),
  xp: integer("xp").notNull().default(0),
  updatedAt: updatedAt(),
});

export const notifications = sqliteTable(
  "notifications",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["morning", "evening", "weekly", "achievement", "reminder", "system"],
    }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)]
);

// ---------------------------------------------------------------------------
// Infra: analytics, prompt logs, migrations
// ---------------------------------------------------------------------------

export const events = sqliteTable(
  "events",
  {
    id: id(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    props: text("props", { mode: "json" }).$type<Record<string, unknown>>().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("events_name_idx").on(t.name, t.createdAt), index("events_user_idx").on(t.userId)]
);

export const promptLogs = sqliteTable(
  "prompt_logs",
  {
    id: id(),
    purpose: text("purpose").notNull(),
    promptVersion: text("prompt_version").notNull(),
    provider: text("provider").notNull(),
    model: text("model"),
    temperature: real("temperature"),
    input: text("input", { mode: "json" }).$type<unknown>(),
    output: text("output", { mode: "json" }).$type<unknown>(),
    latencyMs: integer("latency_ms"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    success: bool("success", true),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("prompt_logs_purpose_idx").on(t.purpose, t.createdAt)]
);

// ---------------------------------------------------------------------------
// Billing & growth
// ---------------------------------------------------------------------------

export const paymentOrders = sqliteTable(
  "payment_orders",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: text("plan", { enum: ["pro_monthly", "pro_yearly"] }).notNull(),
    provider: text("provider").notNull().default("razorpay"),
    providerOrderId: text("provider_order_id"),
    amountPaise: integer("amount_paise").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: text("status", {
      enum: ["created", "paid", "failed", "refunded"],
    })
      .notNull()
      .default("created"),
    paymentRef: text("payment_ref"),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("payment_orders_user_idx").on(t.userId),
    uniqueIndex("payment_orders_provider_uq").on(t.providerOrderId),
  ]
);

export const proWaitlist = sqliteTable("pro_waitlist", {
  id: id(),
  email: text("email").notNull().unique(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  source: text("source").notNull().default("pricing"),
  createdAt: createdAt(),
});

export const referralCodes = sqliteTable("referral_codes", {
  id: id(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  code: text("code").notNull().unique(),
  createdAt: createdAt(),
});

export const referrals = sqliteTable(
  "referrals",
  {
    id: id(),
    referrerUserId: integer("referrer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    referredUserId: integer("referred_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    code: text("code").notNull(),
    status: text("status", { enum: ["pending", "rewarded"] })
      .notNull()
      .default("pending"),
    rewardDays: integer("reward_days").notNull().default(7),
    rewardedAt: integer("rewarded_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("referrals_referrer_idx").on(t.referrerUserId)]
);

// ---------------------------------------------------------------------------
// Gamification: speedruns, shared story, preferences, web push
// ---------------------------------------------------------------------------

export const speedruns = sqliteTable(
  "speedruns",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mode: text("mode", { enum: ["vocab", "grammar", "tone"] }).notNull(),
    scoreMs: integer("score_ms").notNull(),
    correct: integer("correct").notNull(),
    total: integer("total").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("speedruns_user_mode_idx").on(t.userId, t.mode, t.createdAt)]
);

export const storyEntries = sqliteTable(
  "story_entries",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    chapter: integer("chapter").notNull().default(1),
    votes: integer("votes").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("story_entries_chapter_idx").on(t.chapter, t.createdAt)]
);

export const userSettings = sqliteTable(
  "user_settings",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    workoutReminderAt: text("workout_reminder_at"),
    dailyGoalMinutes: integer("daily_goal_minutes").notNull().default(20),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  }
);

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: id(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    lastSuccessAt: integer("last_success_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)]
);

// ---------------------------------------------------------------------------
// Relations (for db.query.* API)
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  goals: many(learningGoals),
  skillScores: many(skillScores),
  sessions: many(sessions),
  streak: one(streaks),
  userMistakes: many(userMistakes),
  speakingSessions: many(speakingSessions),
  lessonProgress: many(lessonProgress),
  dailyPlans: many(dailyPlans),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
}));

export const learningGoalsRelations = relations(learningGoals, ({ one }) => ({
  user: one(users, { fields: [learningGoals.userId], references: [users.id] }),
}));

export const skillScoresRelations = relations(skillScores, ({ one }) => ({
  user: one(users, { fields: [skillScores.userId], references: [users.id] }),
}));

export const coursesRelations = relations(courses, ({ many }) => ({
  modules: many(modules),
  lessons: many(lessons),
}));

export const modulesRelations = relations(modules, ({ one, many }) => ({
  course: one(courses, { fields: [modules.courseId], references: [courses.id] }),
  lessons: many(lessons),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  course: one(courses, { fields: [lessons.courseId], references: [courses.id] }),
  module: one(modules, { fields: [lessons.moduleId], references: [modules.id] }),
  exercises: many(exercises),
  progress: many(lessonProgress),
}));

export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  user: one(users, { fields: [lessonProgress.userId], references: [users.id] }),
  lesson: one(lessons, { fields: [lessonProgress.lessonId], references: [lessons.id] }),
}));

export const exercisesRelations = relations(exercises, ({ one }) => ({
  lesson: one(lessons, { fields: [exercises.lessonId], references: [lessons.id] }),
}));

export const userVocabularyRelations = relations(userVocabulary, ({ one }) => ({
  user: one(users, { fields: [userVocabulary.userId], references: [users.id] }),
  word: one(vocabulary, { fields: [userVocabulary.wordId], references: [vocabulary.id] }),
}));

export const podcastsRelations = relations(podcasts, ({ many }) => ({
  transcript: many(podcastTranscripts),
  questions: many(listeningQuestions),
}));

export const podcastTranscriptsRelations = relations(podcastTranscripts, ({ one }) => ({
  podcast: one(podcasts, { fields: [podcastTranscripts.podcastId], references: [podcasts.id] }),
}));

export const listeningQuestionsRelations = relations(listeningQuestions, ({ one }) => ({
  podcast: one(podcasts, { fields: [listeningQuestions.podcastId], references: [podcasts.id] }),
}));

export const mistakesRelations = relations(mistakes, ({ one, many }) => ({
  lesson: one(lessons, { fields: [mistakes.lessonId], references: [lessons.id] }),
  userMistakes: many(userMistakes),
}));

export const userMistakesRelations = relations(userMistakes, ({ one, many }) => ({
  user: one(users, { fields: [userMistakes.userId], references: [users.id] }),
  mistake: one(mistakes, { fields: [userMistakes.mistakeId], references: [mistakes.id] }),
  occurrences: many(mistakeOccurrences),
}));

export const mistakeOccurrencesRelations = relations(mistakeOccurrences, ({ one }) => ({
  user: one(users, { fields: [mistakeOccurrences.userId], references: [users.id] }),
  mistake: one(mistakes, { fields: [mistakeOccurrences.mistakeId], references: [mistakes.id] }),
  userMistake: one(userMistakes, {
    fields: [mistakeOccurrences.userMistakeId],
    references: [userMistakes.id],
  }),
}));

export const speakingSessionsRelations = relations(speakingSessions, ({ one, many }) => ({
  user: one(users, { fields: [speakingSessions.userId], references: [users.id] }),
  scenario: one(scenarios, { fields: [speakingSessions.scenarioId], references: [scenarios.id] }),
  segments: many(speakingSegments),
  analysis: one(aiAnalysis, { fields: [speakingSessions.analysisId], references: [aiAnalysis.id] }),
}));

export const speakingSegmentsRelations = relations(speakingSegments, ({ one }) => ({
  session: one(speakingSessions, { fields: [speakingSegments.sessionId], references: [speakingSessions.id] }),
}));

export const dailyPlansRelations = relations(dailyPlans, ({ one }) => ({
  user: one(users, { fields: [dailyPlans.userId], references: [users.id] }),
  focusMistake: one(mistakes, { fields: [dailyPlans.focusMistakeId], references: [mistakes.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
  scenario: one(scenarios, { fields: [conversations.scenarioId], references: [scenarios.id] }),
  messages: many(conversationMessages),
}));

export const conversationMessagesRelations = relations(conversationMessages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationMessages.conversationId],
    references: [conversations.id],
  }),
}));

export const practiceSessionsRelations = relations(practiceSessions, ({ one, many }) => ({
  user: one(users, { fields: [practiceSessions.userId], references: [users.id] }),
  mistake: one(mistakes, { fields: [practiceSessions.mistakeId], references: [mistakes.id] }),
  items: many(practiceItems),
}));

export const practiceItemsRelations = relations(practiceItems, ({ one }) => ({
  session: one(practiceSessions, { fields: [practiceItems.sessionId], references: [practiceSessions.id] }),
  exercise: one(exercises, { fields: [practiceItems.exerciseId], references: [exercises.id] }),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, { fields: [userAchievements.userId], references: [users.id] }),
  achievement: one(achievements, { fields: [userAchievements.achievementId], references: [achievements.id] }),
}));

export const streaksRelations = relations(streaks, ({ one }) => ({
  user: one(users, { fields: [streaks.userId], references: [users.id] }),
}));

export const assessmentSessionsRelations = relations(assessmentSessions, ({ one, many }) => ({
  user: one(users, { fields: [assessmentSessions.userId], references: [users.id] }),
  answers: many(assessmentAnswers),
}));

export const assessmentAnswersRelations = relations(assessmentAnswers, ({ one }) => ({
  session: one(assessmentSessions, {
    fields: [assessmentAnswers.assessmentId],
    references: [assessmentSessions.id],
  }),
}));

export const writingAnalysesRelations = relations(writingAnalyses, ({ one }) => ({
  user: one(users, { fields: [writingAnalyses.userId], references: [users.id] }),
  analysis: one(aiAnalysis, { fields: [writingAnalyses.analysisId], references: [aiAnalysis.id] }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Profile = InferSelectModel<typeof profiles>;
export type Lesson = InferSelectModel<typeof lessons>;
export type Exercise = InferSelectModel<typeof exercises>;
export type VocabularyWord = InferSelectModel<typeof vocabulary>;
export type UserVocabulary = InferSelectModel<typeof userVocabulary>;
export type Podcast = InferSelectModel<typeof podcasts>;
export type Scenario = InferSelectModel<typeof scenarios>;
export type Mistake = InferSelectModel<typeof mistakes>;
export type UserMistake = InferSelectModel<typeof userMistakes>;
export type MistakeOccurrence = InferSelectModel<typeof mistakeOccurrences>;
export type SpeakingSession = InferSelectModel<typeof speakingSessions>;
export type DailyPlan = InferSelectModel<typeof dailyPlans>;
export type PracticeSession = InferSelectModel<typeof practiceSessions>;
export type Conversation = InferSelectModel<typeof conversations>;
export type ConversationMessage = InferSelectModel<typeof conversationMessages>;
export type AiAnalysis = InferSelectModel<typeof aiAnalysis>;
export type WritingAnalysis = InferSelectModel<typeof writingAnalyses>;
export type AssessmentSession = InferSelectModel<typeof assessmentSessions>;
export type SkillScore = InferSelectModel<typeof skillScores>;
export type ProgressSnapshot = InferSelectModel<typeof progressSnapshots>;
export type Streak = InferSelectModel<typeof streaks>;
