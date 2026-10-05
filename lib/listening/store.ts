import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  listeningQuestions,
  listeningSessions,
  podcastTranscripts,
  podcasts,
  skillScores,
} from "@/lib/db/schema";
import { drift } from "@/lib/speaking/store";
import { completePlanItemsByRef, getOrCreateTodayPlan } from "@/lib/plan/store";
import { addWord } from "@/lib/vocab/store";
import {
  gradeListening,
  toPublicQuestions,
  type ListeningAnswer,
  type ListeningQuestion,
} from "./grade";

export type PodcastListItem = {
  id: number;
  slug: string;
  title: string;
  topic: string;
  level: string;
  durationSec: number;
  coverEmoji: string;
  description: string;
  featured: boolean;
  publishedDate: string;
  bestScore: number | null;
  sessions: number;
};

export async function listPodcasts(userId: number): Promise<PodcastListItem[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(podcasts)
    .where(eq(podcasts.published, true))
    .orderBy(desc(podcasts.featured), asc(podcasts.id));

  const sessionRows = await db
    .select({
      podcastId: listeningSessions.podcastId,
      score: listeningSessions.score,
      createdAt: listeningSessions.createdAt,
    })
    .from(listeningSessions)
    .where(eq(listeningSessions.userId, userId))
    .orderBy(desc(listeningSessions.id));

  const best = new Map<number, { best: number; count: number }>();
  for (const s of sessionRows) {
    if (s.podcastId === null) continue;
    const prev = best.get(s.podcastId);
    const score = s.score ?? 0;
    if (prev) {
      prev.count += 1;
      prev.best = Math.max(prev.best, score);
    } else {
      best.set(s.podcastId, { best: score, count: 1 });
    }
  }

  return rows.map((p) => {
    const b = best.get(p.id);
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      topic: p.topic,
      level: p.level,
      durationSec: p.durationSec,
      coverEmoji: p.coverEmoji ?? "🎧",
      description: p.description,
      featured: p.featured,
      publishedDate: p.publishedDate ?? "",
      bestScore: b ? b.best : null,
      sessions: b ? b.count : 0,
    };
  });
}

export type TranscriptSegment = { orderIndex: number; startMs: number; endMs: number; text: string };

export type ListeningDetail =
  | {
      podcast: {
        id: number;
        slug: string;
        title: string;
        topic: string;
        level: string;
        durationSec: number;
        coverEmoji: string;
        description: string;
        publishedDate: string;
      };
      transcript: TranscriptSegment[];
      questions: ReturnType<typeof toPublicQuestions>;
      questionCount: number;
      bestScore: number | null;
    }
  | null;

export async function getListeningDetail(
  userId: number,
  podcastId: number
): Promise<ListeningDetail> {
  const db = await getDb();
  const rows = await db
    .select({
      id: podcasts.id,
      slug: podcasts.slug,
      title: podcasts.title,
      topic: podcasts.topic,
      level: podcasts.level,
      durationSec: podcasts.durationSec,
      coverEmoji: podcasts.coverEmoji,
      description: podcasts.description,
      publishedDate: podcasts.publishedDate,
    })
    .from(podcasts)
    .where(and(eq(podcasts.id, podcastId), eq(podcasts.published, true)))
    .limit(1);
  const podcast = rows[0];
  if (!podcast) return null;

  const transcriptRows = await db
    .select()
    .from(podcastTranscripts)
    .where(eq(podcastTranscripts.podcastId, podcastId))
    .orderBy(asc(podcastTranscripts.orderIndex));

  const questionRows = await db
    .select()
    .from(listeningQuestions)
    .where(eq(listeningQuestions.podcastId, podcastId))
    .orderBy(asc(listeningQuestions.orderIndex));

  const sessionRows = await db
    .select({ score: listeningSessions.score })
    .from(listeningSessions)
    .where(
      and(
        eq(listeningSessions.userId, userId),
        eq(listeningSessions.podcastId, podcastId)
      )
    )
    .orderBy(desc(listeningSessions.id))
    .limit(1);

  const questions = questionRows as unknown as ListeningQuestion[];

  return {
    podcast: {
      ...podcast,
      coverEmoji: podcast.coverEmoji ?? "🎧",
      publishedDate: podcast.publishedDate ?? "",
    },
    transcript: transcriptRows.map((t) => ({
      orderIndex: t.orderIndex,
      startMs: t.startMs,
      endMs: t.endMs,
      text: t.text,
    })),
    questions: toPublicQuestions(questions),
    questionCount: questions.length,
    bestScore: sessionRows[0]?.score ?? null,
  };
}

export type SubmitListeningResult =
  | {
      ok: true;
      sessionId: number;
      score: number;
      correctCount: number;
      total: number;
      results: ReturnType<typeof gradeListening>["results"];
      planXp: number;
      skill: number;
      wordsAdded: number;
    }
  | { ok: false; code: "not_found" | "no_questions" };

/** Grades a listening attempt, stores it, bumps the listening skill and adds episode vocabulary. */
export async function submitListening(
  userId: number,
  podcastId: number,
  answers: ListeningAnswer[]
): Promise<SubmitListeningResult> {
  const db = await getDb();

  const podcastRows = await db
    .select({ id: podcasts.id, vocabularyIds: podcasts.vocabularyIds })
    .from(podcasts)
    .where(and(eq(podcasts.id, podcastId), eq(podcasts.published, true)))
    .limit(1);
  if (!podcastRows[0]) return { ok: false, code: "not_found" };

  const questionRows = await db
    .select()
    .from(listeningQuestions)
    .where(eq(listeningQuestions.podcastId, podcastId))
    .orderBy(asc(listeningQuestions.orderIndex));
  const questions = questionRows as unknown as ListeningQuestion[];
  if (questions.length === 0) return { ok: false, code: "no_questions" };

  const grade = gradeListening(questions, answers);

  const inserted = await db
    .insert(listeningSessions)
    .values({
      userId,
      podcastId,
      mode: "normal",
      answers: answers as unknown[],
      score: grade.score,
      completed: true,
    })
    .returning({ id: listeningSessions.id });
  const sessionId = inserted[0].id;

  // listening skill drifts toward the attempt score
  const skillRows = await db
    .select()
    .from(skillScores)
    .where(and(eq(skillScores.userId, userId), eq(skillScores.skill, "listening")))
    .limit(1);
  let nextSkill = Math.round(drift(skillRows[0]?.score ?? 50, grade.score, 0.12) * 100) / 100;
  if (skillRows[0]) {
    await db
      .update(skillScores)
      .set({ score: nextSkill, updatedAt: new Date() })
      .where(eq(skillScores.id, skillRows[0].id));
  } else {
    nextSkill = grade.score;
  }

  // episode vocabulary enters the deck (due now)
  let wordsAdded = 0;
  const wordIds: number[] = Array.isArray(podcastRows[0].vocabularyIds)
    ? podcastRows[0].vocabularyIds
    : [];
  for (const wordId of wordIds) {
    if (await addWord(userId, wordId, "podcast")) wordsAdded += 1;
  }

  const plan = await getOrCreateTodayPlan(userId);
  const outcome = await completePlanItemsByRef(userId, plan, { type: "podcast", id: podcastId });
  const planXp = outcome.ok ? outcome.xpGained : 0;

  return {
    ok: true,
    sessionId,
    score: grade.score,
    correctCount: grade.correctCount,
    total: grade.total,
    results: grade.results,
    planXp,
    skill: skillRows[0] ? nextSkill : grade.score,
    wordsAdded,
  };
}
