import { and, asc, eq, like, lte, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userVocabulary, vocabulary } from "@/lib/db/schema";
import { nextDueAt, schedule, type Rating, type SrsState } from "./scheduler";
import { completePlanItemsByRef, selectToday } from "@/lib/plan/store";

export const LIBRARY_PAGE_SIZE = 30;

export type DueCard = {
  wordId: number;
  word: string;
  pronunciation: string | null;
  definition: string;
  example: string;
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  category: string;
  nativeGloss: Record<string, string> | null;
  srs: { ease: number; intervalDays: number; reps: number; lapses: number };
};

export type LibraryItem = {
  id: number;
  word: string;
  pronunciation: string | null;
  definition: string;
  example: string;
  category: string;
  topic: string | null;
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  difficulty: number;
  inVocab: boolean;
  status: string | null;
};

export async function getDueCount(userId: number): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(userVocabulary)
    .where(
      and(
        eq(userVocabulary.userId, userId),
        lte(userVocabulary.dueAt, new Date()),
        ne(userVocabulary.status, "suspended")
      )
    );
  return Number(rows[0]?.n ?? 0);
}

export async function dueWords(userId: number, limit = 60): Promise<DueCard[]> {
  const db = await getDb();
  const rows = await db
    .select({
      wordId: userVocabulary.wordId,
      word: vocabulary.word,
      pronunciation: vocabulary.pronunciation,
      definition: vocabulary.definition,
      example: vocabulary.example,
      synonyms: vocabulary.synonyms,
      antonyms: vocabulary.antonyms,
      collocations: vocabulary.collocations,
      category: vocabulary.category,
      nativeGloss: vocabulary.nativeGloss,
      dueAt: userVocabulary.dueAt,
      ease: userVocabulary.ease,
      intervalDays: userVocabulary.intervalDays,
      reps: userVocabulary.reps,
      lapses: userVocabulary.lapses,
    })
    .from(userVocabulary)
    .innerJoin(vocabulary, eq(userVocabulary.wordId, vocabulary.id))
    .where(
      and(
        eq(userVocabulary.userId, userId),
        lte(userVocabulary.dueAt, new Date()),
        ne(userVocabulary.status, "suspended")
      )
    )
    .orderBy(asc(userVocabulary.dueAt), asc(userVocabulary.id))
    .limit(limit);

  return rows.map((r) => ({
    wordId: r.wordId,
    word: r.word,
    pronunciation: r.pronunciation,
    definition: r.definition,
    example: r.example,
    synonyms: r.synonyms ?? [],
    antonyms: r.antonyms ?? [],
    collocations: r.collocations ?? [],
    category: r.category,
    nativeGloss: r.nativeGloss ?? null,
    srs: { ease: r.ease, intervalDays: r.intervalDays, reps: r.reps, lapses: r.lapses },
  }));
}

export type LibraryQuery = {
  userId: number;
  q?: string;
  category?: string;
  page: number;
};

export async function searchVocabulary(
  query: LibraryQuery
): Promise<{ items: LibraryItem[]; total: number }> {
  const db = await getDb();
  const needle = query.q?.trim();
  const conds = [
    needle ? or(like(vocabulary.word, `%${needle}%`), like(vocabulary.definition, `%${needle}%`)) : undefined,
    query.category ? eq(vocabulary.category, query.category as never) : undefined,
  ].filter(Boolean);

  const countRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(vocabulary)
    .where(conds.length > 0 ? and(...conds) : undefined);

  // NOTE: never select the same physical column name (e.g. "id") from two
  // joined tables — D1's REST API serialises rows as objects and collapses
  // duplicate keys, which corrupts Drizzle's positional row mapping. Derive
  // presence from `uvStatus` instead of selecting userVocabulary.id.
  const rows = await db
    .select({
      id: vocabulary.id,
      word: vocabulary.word,
      pronunciation: vocabulary.pronunciation,
      definition: vocabulary.definition,
      example: vocabulary.example,
      synonyms: vocabulary.synonyms,
      antonyms: vocabulary.antonyms,
      collocations: vocabulary.collocations,
      category: vocabulary.category,
      topic: vocabulary.topic,
      difficulty: vocabulary.difficulty,
      uvStatus: userVocabulary.status,
      uvDueAt: userVocabulary.dueAt,
    })
    .from(vocabulary)
    .leftJoin(userVocabulary, and(eq(userVocabulary.wordId, vocabulary.id), eq(userVocabulary.userId, query.userId)))
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(asc(vocabulary.word))
    .limit(LIBRARY_PAGE_SIZE)
    .offset(Math.max(0, (query.page - 1)) * LIBRARY_PAGE_SIZE);

  return {
    items: rows.map((r) => ({
      id: r.id,
      word: r.word,
      pronunciation: r.pronunciation,
      definition: r.definition,
      example: r.example,
      category: r.category,
      topic: r.topic,
      difficulty: r.difficulty,
      synonyms: r.synonyms ?? [],
      antonyms: r.antonyms ?? [],
      collocations: r.collocations ?? [],
      inVocab: r.uvStatus != null,
      status: r.uvStatus,
    })),
    total: Number(countRows[0]?.n ?? 0),
  };
}

export async function addWord(
  userId: number,
  wordId: number,
  source: "lesson" | "podcast" | "reading" | "manual" | "coach" | "speaking" = "manual"
): Promise<boolean> {
  const db = await getDb();
  const now = new Date();
  const inserted = await db
    .insert(userVocabulary)
    .values({
      userId,
      wordId,
      status: "learning",
      dueAt: now, // starts life due - the learner sees it in today's review
      source,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: userVocabulary.id });
  return inserted.length > 0;
}

export async function removeWord(userId: number, wordId: number): Promise<boolean> {
  const db = await getDb();
  const deleted = await db
    .delete(userVocabulary)
    .where(and(eq(userVocabulary.userId, userId), eq(userVocabulary.wordId, wordId)))
    .returning({ id: userVocabulary.id });
  return deleted.length > 0;
}

export type ReviewOutcome = {
  remaining: number;
  nextDueAt: Date;
  state: SrsState & { status: string };
  planXp: number;
};

export async function reviewWord(
  userId: number,
  wordId: number,
  rating: Rating,
  now = new Date()
): Promise<ReviewOutcome | null> {
  const db = await getDb();
  const rows = await db
    .select({
      id: userVocabulary.id,
      ease: userVocabulary.ease,
      intervalDays: userVocabulary.intervalDays,
      reps: userVocabulary.reps,
      lapses: userVocabulary.lapses,
    })
    .from(userVocabulary)
    .where(and(eq(userVocabulary.userId, userId), eq(userVocabulary.wordId, wordId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const next = schedule(
    { ease: row.ease, intervalDays: row.intervalDays, reps: row.reps, lapses: row.lapses },
    rating
  );
  const due = nextDueAt(now, next.intervalDays);
  const counters =
    rating === "again"
      ? { wrongCount: sql`${userVocabulary.wrongCount} + 1` }
      : { correctCount: sql`${userVocabulary.correctCount} + 1` };

  await db
    .update(userVocabulary)
    .set({
      ease: next.ease,
      intervalDays: next.intervalDays,
      reps: next.reps,
      lapses: next.lapses,
      status: next.status,
      dueAt: due,
      lastReviewedAt: now,
      ...counters,
      updatedAt: now,
    })
    .where(eq(userVocabulary.id, row.id));

  const remaining = await getDueCount(userId);

  let planXp = 0;
  if (remaining === 0) {
    const plan = await selectToday(userId);
    if (plan) {
      const outcome = await completePlanItemsByRef(userId, plan, {
        type: "vocabulary",
        id: 0,
      });
      if (outcome.ok) planXp = outcome.xpGained;
    }
  }

  return { remaining, nextDueAt: due, state: next, planXp };
}

export const VOCAB_CATEGORIES = [
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
] as const;
