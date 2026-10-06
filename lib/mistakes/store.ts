import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  lessons,
  mistakes,
  mistakeOccurrences,
  practiceItems,
  practiceSessions,
  skillScores,
  userMistakes,
} from "@/lib/db/schema";
import { completePlanItemsByRef, selectToday } from "@/lib/plan/store";
import { getEntitlements } from "@/lib/billing/entitlements";
import { FREE_RULES_TRACKED } from "@/lib/billing/plans";
import type { DetectRule } from "./detect";
import {
  buildPracticeQuestions,
  gradePractice,
  type PracticeMistake,
  type PracticeQuestion,
  type PracticeResult,
} from "./practice";

export type TrendState = {
  trend: "new" | "stable" | "improving" | "worsening";
  status: "active" | "needs_practice" | "improving" | "resolved";
};

/**
 * Pure trend/status reducer — takes the occurrence count INCLUDING the
 * detection being recorded (null = first ever). Deterministic and unit-tested.
 * (Time-windowed trending lands with the mistake engine UI.)
 */
export function nextTrendState(
  prev: { occurrences: number; practiceCount: number } | null
): TrendState {
  if (!prev || prev.occurrences <= 1) return { trend: "new", status: "active" };
  const { occurrences: n, practiceCount } = prev;
  if (practiceCount === 0) {
    return n >= 3
      ? { trend: "worsening", status: "needs_practice" }
      : { trend: "stable", status: "active" };
  }
  return n >= 3
    ? { trend: "stable", status: "needs_practice" }
    : { trend: "improving", status: "active" };
}

/** All seeded rules that carry regex patterns — the detector's catalog. */
export async function loadDetectRules(): Promise<DetectRule[]> {
  const db = await getDb();
  const rows = await db
    .select({
      key: mistakes.key,
      title: mistakes.title,
      category: mistakes.category,
      why: mistakes.why,
      wrongExample: mistakes.wrongExample,
      correctExample: mistakes.correctExample,
      severity: mistakes.severity,
      detection: mistakes.detection,
    })
    .from(mistakes);

  return rows
    .filter((r) => (r.detection?.patterns?.length ?? 0) > 0)
    .map((r) => ({
      key: r.key,
      title: r.title,
      category: r.category,
      why: r.why,
      wrongExample: r.wrongExample,
      correctExample: r.correctExample,
      severity: r.severity,
      patterns: r.detection?.patterns ?? [],
    }));
}

export type RecordSessionType = "speaking" | "writing" | "conversation" | "practice" | "assessment";

type DetectedInput = {
  key: string;
  wrong: string;
  correct: string;
  confidence: number;
};

/**
 * Persist detected mistakes: bump `user_mistakes` (upsert) and append one
 * `mistake_occurrences` row per detection. Sequential statements only — D1
 * HTTP has no transactions.
 */
export async function recordMistakes(
  userId: number,
  detected: DetectedInput[],
  opts: { sessionType: RecordSessionType; sessionId?: number }
): Promise<{ recorded: number; newKeys: string[] }> {
  if (detected.length === 0) return { recorded: 0, newKeys: [] };

  const db = await getDb();
  const keys = [...new Set(detected.map((d) => d.key))];

  const catalog = await db
    .select({ id: mistakes.id, key: mistakes.key, severity: mistakes.severity })
    .from(mistakes)
    .where(inArray(mistakes.key, keys));
  const byKey = new Map(catalog.map((c) => [c.key, c]));
  const resolvable = detected.filter((d) => byKey.has(d.key));
  if (resolvable.length === 0) return { recorded: 0, newKeys: [] };

  const mistakeIds = [...new Set(resolvable.map((d) => byKey.get(d.key)!.id))];
  const existingRows = await db
    .select({
      id: userMistakes.id,
      mistakeId: userMistakes.mistakeId,
      occurrences: userMistakes.occurrences,
      practiceCount: userMistakes.practiceCount,
    })
    .from(userMistakes)
    .where(and(eq(userMistakes.userId, userId), inArray(userMistakes.mistakeId, mistakeIds)));
  const byMistakeId = new Map(existingRows.map((r) => [r.mistakeId, r]));

  // Free plan tracks at most FREE_RULES_TRACKED distinct rules (marketing
  // promise); already-tracked rules keep updating, new ones stop being added.
  const { isPro } = await getEntitlements(userId);
  let trackedTotal = -1;
  const loadTrackedTotal = async (): Promise<number> => {
    if (trackedTotal < 0) {
      const rows = await db
        .select({ value: sql<number>`count(*)` })
        .from(userMistakes)
        .where(eq(userMistakes.userId, userId));
      trackedTotal = rows[0]?.value ?? 0;
    }
    return trackedTotal;
  };

  const now = new Date();
  const occurrencesToInsert: (typeof mistakeOccurrences.$inferInsert)[] = [];
  const newKeys: string[] = [];

  for (const d of resolvable) {
    const catalogRow = byKey.get(d.key)!;
    const prev = byMistakeId.get(catalogRow.id);

    if (!prev && !isPro && (await loadTrackedTotal()) >= FREE_RULES_TRACKED) {
      continue;
    }

    const { trend, status } = nextTrendState(
      prev ? { occurrences: prev.occurrences + 1, practiceCount: prev.practiceCount } : null
    );

    let userMistakeId: number;
    if (prev) {
      const updated = await db
        .update(userMistakes)
        .set({
          occurrences: sql`${userMistakes.occurrences} + 1`,
          lastDetectedAt: now,
          trend,
          status,
          severity: catalogRow.severity,
          updatedAt: now,
        })
        .where(eq(userMistakes.id, prev.id))
        .returning({ id: userMistakes.id });
      userMistakeId = updated[0].id;
    } else {
      const inserted = await db
        .insert(userMistakes)
        .values({
          userId,
          mistakeId: catalogRow.id,
          occurrences: 1,
          firstDetectedAt: now,
          lastDetectedAt: now,
          trend: "new",
          status: "active",
          severity: catalogRow.severity,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: userMistakes.id });
      userMistakeId = inserted[0].id;
      newKeys.push(d.key);
      if (trackedTotal >= 0) trackedTotal += 1;
    }

    occurrencesToInsert.push({
      userId,
      mistakeId: catalogRow.id,
      userMistakeId,
      sessionType: opts.sessionType,
      sessionId: opts.sessionId ?? null,
      sentence: d.wrong,
      correction: d.correct,
      isRepeat: Boolean(prev),
      confidence: d.confidence,
      detectedAt: now,
    });
  }

  if (occurrencesToInsert.length > 0) {
    await db.insert(mistakeOccurrences).values(occurrencesToInsert);
  }

  return { recorded: occurrencesToInsert.length, newKeys };
}

export type MistakeListItem = {
  id: number;
  key: string;
  title: string;
  category: string;
  severity: "low" | "medium" | "high";
  occurrences: number;
  trend: "new" | "stable" | "improving" | "worsening";
  status: "active" | "needs_practice" | "improving" | "resolved";
  practiceCount: number;
  lastPracticedAt: Date | null;
  lastDetectedAt: Date;
  lastSentence: { text: string; correction: string; sessionType: string; detectedAt: Date } | null;
};

export type MistakeListSummary = {
  total: number;
  needsPractice: number;
  practised: number;
  improving: number;
};

/** The user's mistake patterns, worst-first, with their latest detected sentence. */
export async function listUserMistakes(
  userId: number
): Promise<{ items: MistakeListItem[]; summary: MistakeListSummary }> {
  const db = await getDb();
  const rows = await db
    .select({
      id: mistakes.id,
      key: mistakes.key,
      title: mistakes.title,
      category: mistakes.category,
      severity: mistakes.severity,
      occurrences: userMistakes.occurrences,
      trend: userMistakes.trend,
      status: userMistakes.status,
      practiceCount: userMistakes.practiceCount,
      lastPracticedAt: userMistakes.lastPracticedAt,
      lastDetectedAt: userMistakes.lastDetectedAt,
    })
    .from(userMistakes)
    .innerJoin(mistakes, eq(userMistakes.mistakeId, mistakes.id))
    .where(eq(userMistakes.userId, userId))
    .orderBy(desc(userMistakes.occurrences), desc(userMistakes.lastDetectedAt))
    .limit(50);

  const occRows = await db
    .select({
      mistakeId: mistakeOccurrences.mistakeId,
      sentence: mistakeOccurrences.sentence,
      correction: mistakeOccurrences.correction,
      sessionType: mistakeOccurrences.sessionType,
      detectedAt: mistakeOccurrences.detectedAt,
    })
    .from(mistakeOccurrences)
    .where(eq(mistakeOccurrences.userId, userId))
    .orderBy(desc(mistakeOccurrences.detectedAt))
    .limit(20);

  const latestByMistake = new Map<number, MistakeListItem["lastSentence"]>();
  for (const o of occRows) {
    if (latestByMistake.has(o.mistakeId)) continue;
    latestByMistake.set(o.mistakeId, {
      text: o.sentence,
      correction: o.correction,
      sessionType: o.sessionType,
      detectedAt: o.detectedAt,
    });
  }

  const items: MistakeListItem[] = rows.map((r) => ({
    id: r.id,
    key: r.key,
    title: r.title,
    category: r.category,
    severity: r.severity,
    occurrences: r.occurrences,
    trend: r.trend,
    status: r.status,
    practiceCount: r.practiceCount,
    lastPracticedAt: r.lastPracticedAt,
    lastDetectedAt: r.lastDetectedAt,
    lastSentence: latestByMistake.get(r.id) ?? null,
  }));

  const summary: MistakeListSummary = {
    total: items.length,
    needsPractice: items.filter((i) => i.status === "needs_practice").length,
    practised: items.filter((i) => i.practiceCount > 0).length,
    improving: items.filter((i) => i.trend === "improving").length,
  };

  return { items, summary };
}

export type MistakeDetail = {
  mistake: {
    id: number;
    key: string;
    title: string;
    category: string;
    description: string;
    wrongExample: string;
    correctExample: string;
    why: string;
    naturalAlternative: string | null;
    severity: "low" | "medium" | "high";
    practicePrompts: string[];
    lessonId: number | null;
  };
  state: {
    occurrences: number;
    trend: "new" | "stable" | "improving" | "worsening";
    status: "active" | "needs_practice" | "improving" | "resolved";
    practiceCount: number;
    lastPracticedAt: Date | null;
    firstDetectedAt: Date;
    lastDetectedAt: Date;
  };
  history: { sentence: string; correction: string; sessionType: string; detectedAt: Date }[];
};

/** One pattern with the user's tracking state and their own occurrences (latest first). */
export async function getUserMistakeDetail(
  userId: number,
  mistakeId: number
): Promise<MistakeDetail | null> {
  const db = await getDb();
  const stateRows = await db
    .select({
      occurrences: userMistakes.occurrences,
      trend: userMistakes.trend,
      status: userMistakes.status,
      practiceCount: userMistakes.practiceCount,
      lastPracticedAt: userMistakes.lastPracticedAt,
      firstDetectedAt: userMistakes.firstDetectedAt,
      lastDetectedAt: userMistakes.lastDetectedAt,
    })
    .from(userMistakes)
    .where(and(eq(userMistakes.userId, userId), eq(userMistakes.mistakeId, mistakeId)))
    .limit(1);
  const state = stateRows[0];
  if (!state) return null;

  const mistakeRows = await db
    .select({
      id: mistakes.id,
      key: mistakes.key,
      title: mistakes.title,
      category: mistakes.category,
      description: mistakes.description,
      wrongExample: mistakes.wrongExample,
      correctExample: mistakes.correctExample,
      why: mistakes.why,
      naturalAlternative: mistakes.naturalAlternative,
      severity: mistakes.severity,
      practicePrompts: mistakes.practicePrompts,
      lessonId: mistakes.lessonId,
    })
    .from(mistakes)
    .where(eq(mistakes.id, mistakeId))
    .limit(1);
  const m = mistakeRows[0];
  if (!m) return null;

  const historyRows = await db
    .select({
      sentence: mistakeOccurrences.sentence,
      correction: mistakeOccurrences.correction,
      sessionType: mistakeOccurrences.sessionType,
      detectedAt: mistakeOccurrences.detectedAt,
    })
    .from(mistakeOccurrences)
    .where(and(eq(mistakeOccurrences.userId, userId), eq(mistakeOccurrences.mistakeId, mistakeId)))
    .orderBy(desc(mistakeOccurrences.detectedAt))
    .limit(10);

  return {
    mistake: {
      id: m.id,
      key: m.key,
      title: m.title,
      category: m.category,
      description: m.description,
      wrongExample: m.wrongExample,
      correctExample: m.correctExample,
      why: m.why,
      naturalAlternative: m.naturalAlternative,
      severity: m.severity,
      practicePrompts: m.practicePrompts ?? [],
      lessonId: m.lessonId,
    },
    state,
    history: historyRows,
  };
}

/** Lesson a mistake links to (separate query — avoids duplicate column names). */
export async function getLinkedLesson(
  lessonId: number
): Promise<{ slug: string; title: string } | null> {
  const db = await getDb();
  const rows = await db
    .select({ slug: lessons.slug, title: lessons.title })
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Distractor catalog for the practice quiz — deterministic (ordered by id,
 * rotated by the mistake id) so the server re-grades the same questions it
 * handed to the client.
 */
export async function loadPracticePool(
  excludeMistakeId: number,
  limit = 8
): Promise<PracticeMistake[]> {
  const db = await getDb();
  const offset = excludeMistakeId % 12;
  let rows = await db
    .select({
      id: mistakes.id,
      key: mistakes.key,
      title: mistakes.title,
      category: mistakes.category,
      wrongExample: mistakes.wrongExample,
      correctExample: mistakes.correctExample,
      why: mistakes.why,
    })
    .from(mistakes)
    .where(ne(mistakes.id, excludeMistakeId))
    .orderBy(asc(mistakes.id))
    .limit(limit)
    .offset(offset);
  if (rows.length === 0 && offset > 0) {
    rows = await db
      .select({
        id: mistakes.id,
        key: mistakes.key,
        title: mistakes.title,
        category: mistakes.category,
        wrongExample: mistakes.wrongExample,
        correctExample: mistakes.correctExample,
        why: mistakes.why,
      })
      .from(mistakes)
      .where(ne(mistakes.id, excludeMistakeId))
      .orderBy(asc(mistakes.id))
      .limit(limit);
  }
  return rows.filter((r) => r.wrongExample && r.correctExample && r.why);
}

const CATEGORY_SKILL: Record<string, (typeof skillScores.$inferSelect)["skill"]> = {
  grammar: "grammar",
  vocab: "vocabulary",
  pronunciation: "pronunciation",
  fluency: "fluency",
  naturalness: "speaking",
  style: "writing",
  listening: "listening",
};

const bumpScore = (base: number, correct: boolean): number => {
  if (correct) return Math.min(100, base + Math.max(4, (100 - base) * 0.06));
  return Math.max(0, base * 0.96);
};

export type PracticeOutcome =
  | {
      ok: true;
      mistakeId: number;
      results: PracticeResult[];
      correctCount: number;
      total: number;
      score: number;
      practiceCount: number;
      trend: MistakeDetail["state"]["trend"];
      status: MistakeDetail["state"]["status"];
      planXp: number;
      skill: { skill: string; score: number } | null;
    }
  | { ok: false; code: "not_found" | "not_tracked" | "no_questions" };

/**
 * Grades a finished practice quiz and persists everything: practice session
 * + items, pattern practice counters (trend recompute), a skill bump for the
 * pattern's category, and today's plan `fix` item. Sequential D1 statements.
 */
export async function saveMistakePractice(
  userId: number,
  mistakeId: number,
  answers: (number | null)[],
  durationSec: number
): Promise<PracticeOutcome> {
  const detail = await getUserMistakeDetail(userId, mistakeId);
  if (!detail) {
    const db = await getDb();
    const catalog = await db
      .select({ id: mistakes.id })
      .from(mistakes)
      .where(eq(mistakes.id, mistakeId))
      .limit(1);
    return { ok: false, code: catalog[0] ? "not_tracked" : "not_found" };
  }

  const pool = await loadPracticePool(mistakeId);
  const questions: PracticeQuestion[] = buildPracticeQuestions(
    {
      id: detail.mistake.id,
      key: detail.mistake.key,
      title: detail.mistake.title,
      category: detail.mistake.category,
      wrongExample: detail.mistake.wrongExample,
      correctExample: detail.mistake.correctExample,
      why: detail.mistake.why,
    },
    pool,
    mistakeId
  );
  if (questions.length === 0) return { ok: false, code: "no_questions" };

  const { results, correctCount, total, score } = gradePractice(questions, answers);
  const db = await getDb();
  const now = new Date();

  const insertedSessions = await db
    .insert(practiceSessions)
    .values({
      userId,
      type: "mistake",
      mistakeId,
      questionCount: total,
      correctCount,
      score,
      durationSec,
      completed: true,
      createdAt: now,
      completedAt: now,
    })
    .returning({ id: practiceSessions.id });
  const sessionId = insertedSessions[0]?.id;

  if (sessionId) {
    await db.insert(practiceItems).values(
      questions.map((q, i) => ({
        sessionId,
        kind: "exercise" as const,
        payload: { prompt: q.prompt, options: q.options, kind: q.kind },
        response: { choice: answers[i] ?? null },
        correct: results[i].correct,
        feedback: { explanation: q.explanation },
        orderIndex: i,
      }))
    );
  }

  const practiceCount = detail.state.practiceCount + 1;
  const { trend, status } = nextTrendState({
    occurrences: detail.state.occurrences,
    practiceCount,
  });
  await db
    .update(userMistakes)
    .set({
      practiceCount,
      lastPracticedAt: now,
      trend,
      status,
      updatedAt: now,
    })
    .where(and(eq(userMistakes.userId, userId), eq(userMistakes.mistakeId, mistakeId)));

  const skill = CATEGORY_SKILL[detail.mistake.category] ?? null;
  let skillOut: { skill: string; score: number } | null = null;
  if (skill) {
    const skillRows = await db
      .select({ id: skillScores.id, score: skillScores.score })
      .from(skillScores)
      .where(and(eq(skillScores.userId, userId), eq(skillScores.skill, skill)))
      .limit(1);
    let nextScore = skillRows[0]?.score ?? 50;
    for (const r of results) nextScore = bumpScore(nextScore, r.correct);
    nextScore = Math.round(nextScore * 100) / 100;
    if (skillRows[0]) {
      await db
        .update(skillScores)
        .set({ score: nextScore, updatedAt: now })
        .where(eq(skillScores.id, skillRows[0].id));
    } else {
      await db.insert(skillScores).values({ userId, skill, score: nextScore });
    }
    skillOut = { skill, score: nextScore };
  }

  let planXp = 0;
  const plan = await selectToday(userId);
  if (plan) {
    const outcome = await completePlanItemsByRef(userId, plan, { type: "mistake", id: mistakeId });
    if (outcome.ok) planXp = outcome.xpGained;
  }

  return {
    ok: true,
    mistakeId,
    results,
    correctCount,
    total,
    score,
    practiceCount,
    trend,
    status,
    planXp,
    skill: skillOut,
  };
}
