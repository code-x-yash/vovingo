import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  achievements,
  conversations,
  dailyPlans,
  lessonProgress,
  lessons,
  practiceSessions,
  profiles,
  progressSnapshots,
  skillScores,
  speakingSessions,
  streaks,
  userAchievements,
  userMistakes,
  userVocabulary,
} from "@/lib/db/schema";
import { findStreak } from "@/lib/plan/store";
import { applyActivity, EMPTY_STREAK } from "@/lib/plan/streak";
import { todayKey } from "@/lib/plan/generate";
import {
  criterionMet,
  type AchievementRow,
  type AchievementStats,
} from "./achievements";

export async function collectAchievementStats(userId: number): Promise<AchievementStats> {
  const db = await getDb();

  const lessonRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.status, "completed")));

  const convRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(conversations)
    .where(eq(conversations.userId, userId));

  const speakRows = await db
    .select({
      n: sql<number>`count(*)`,
      secs: sql<number>`coalesce(sum(${speakingSessions.durationSec}), 0)`,
    })
    .from(speakingSessions)
    .where(eq(speakingSessions.userId, userId));

  const wordRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(userVocabulary)
    .where(eq(userVocabulary.userId, userId));

  const resolvedRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(userMistakes)
    .where(and(eq(userMistakes.userId, userId), eq(userMistakes.status, "resolved")));

  const practiceRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(practiceSessions)
    .where(and(eq(practiceSessions.userId, userId), eq(practiceSessions.type, "mistake")));

  const profileRows = await db
    .select({ placementCompletedAt: profiles.placementCompletedAt })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  const planRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(dailyPlans)
    .where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.status, "completed")));

  const streak = (await findStreak(userId)) ?? EMPTY_STREAK;

  return {
    lessons: Number(lessonRows[0]?.n ?? 0),
    conversations: Number(convRows[0]?.n ?? 0),
    speakingSessions: Number(speakRows[0]?.n ?? 0),
    streak: streak.current,
    words: Number(wordRows[0]?.n ?? 0),
    speakingMinutes: Math.round(Number(speakRows[0]?.secs ?? 0) / 60),
    resolvedMistakes: Number(resolvedRows[0]?.n ?? 0),
    mistakePractices: Number(practiceRows[0]?.n ?? 0),
    assessments: profileRows[0]?.placementCompletedAt ? 1 : 0,
    planDays: Number(planRows[0]?.n ?? 0),
  };
}

export async function loadAchievementCatalog(): Promise<AchievementRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: achievements.id,
      key: achievements.key,
      title: achievements.title,
      description: achievements.description,
      icon: achievements.icon,
      xp: achievements.xp,
      criteria: achievements.criteria,
    })
    .from(achievements)
    .orderBy(achievements.id);
  return rows.map((r) => ({ ...r, criteria: r.criteria ?? {} }));
}

export type EarnedAchievement = AchievementRow & { unlockedAt: Date };

export async function getEarnedAchievements(userId: number): Promise<EarnedAchievement[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: achievements.id,
      key: achievements.key,
      title: achievements.title,
      description: achievements.description,
      icon: achievements.icon,
      xp: achievements.xp,
      criteria: achievements.criteria,
      unlockedAt: userAchievements.unlockedAt,
    })
    .from(userAchievements)
    .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
    .where(eq(userAchievements.userId, userId))
    .orderBy(achievements.id);
  return rows.map((r) => ({ ...r, criteria: r.criteria ?? {} }));
}

export type UnlockOutcome = {
  newlyUnlocked: AchievementRow[];
  xpAwarded: number;
};

/**
 * Evaluates the catalog against current stats, persists newly earned
 * achievements (conflict-safe upsert) and awards their XP to the streak.
 * Call on every progress-page load; idempotent.
 */
export async function unlockEarnedAchievements(
  userId: number,
  stats?: AchievementStats
): Promise<UnlockOutcome> {
  const current = stats ?? (await collectAchievementStats(userId));
  const catalog = await loadAchievementCatalog();
  const earned = await getEarnedAchievements(userId);
  const earnedIds = new Set(earned.map((e) => e.id));

  const toUnlock = catalog.filter(
    (a) => !earnedIds.has(a.id) && criterionMet(current, a.criteria)
  );
  if (toUnlock.length === 0) return { newlyUnlocked: [], xpAwarded: 0 };

  const db = await getDb();
  await db
    .insert(userAchievements)
    .values(toUnlock.map((a) => ({ userId, achievementId: a.id })))
    .onConflictDoNothing();

  const xpAwarded = toUnlock.reduce((sum, a) => sum + a.xp, 0);
  if (xpAwarded > 0) {
    const existing = await findStreak(userId);
    const next = applyActivity(existing ?? EMPTY_STREAK, todayKey(), xpAwarded);
    if (existing) {
      await db
        .update(streaks)
        .set({
          current: next.current,
          longest: next.longest,
          totalDays: next.totalDays,
          lastActiveDate: next.lastActiveDate,
          xp: next.xp,
          updatedAt: new Date(),
        })
        .where(eq(streaks.userId, userId));
    } else {
      await db.insert(streaks).values({
        userId,
        current: next.current,
        longest: next.longest,
        totalDays: next.totalDays,
        lastActiveDate: next.lastActiveDate,
        xp: next.xp,
      });
    }
  }

  return { newlyUnlocked: toUnlock, xpAwarded };
}

export type ActivityItem = {
  kind: "lesson" | "speaking" | "practice" | "plan";
  title: string;
  detail: string | null;
  href: string;
  at: Date;
};

/** Recent real activity across lessons, speaking and mistake practice. */
export async function getRecentActivity(userId: number, limit = 10): Promise<ActivityItem[]> {
  const db = await getDb();

  const lessonRows = await db
    .select({
      slug: lessons.slug,
      title: lessons.title,
      score: lessonProgress.score,
      at: lessonProgress.lastPracticedAt,
    })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.status, "completed")))
    .orderBy(desc(lessonProgress.lastPracticedAt))
    .limit(5);

  const speakRows = await db
    .select({
      id: speakingSessions.id,
      prompt: speakingSessions.prompt,
      wpm: speakingSessions.wpm,
      grammarScore: speakingSessions.grammarScore,
      at: speakingSessions.createdAt,
    })
    .from(speakingSessions)
    .where(eq(speakingSessions.userId, userId))
    .orderBy(desc(speakingSessions.createdAt))
    .limit(5);

  const practiceRows = await db
    .select({
      score: practiceSessions.score,
      correctCount: practiceSessions.correctCount,
      questionCount: practiceSessions.questionCount,
      mistakeId: practiceSessions.mistakeId,
      at: practiceSessions.createdAt,
    })
    .from(practiceSessions)
    .where(eq(practiceSessions.userId, userId))
    .orderBy(desc(practiceSessions.createdAt))
    .limit(5);

  const items: ActivityItem[] = [];

  for (const l of lessonRows) {
    if (!l.at) continue;
    items.push({
      kind: "lesson",
      title: l.title,
      detail: l.score !== null ? `score ${l.score}%` : null,
      href: `/lessons/${l.slug}`,
      at: l.at,
    });
  }
  for (const s of speakRows) {
    items.push({
      kind: "speaking",
      title: s.prompt ? `Spoke: ${s.prompt.slice(0, 60)}` : "Speaking take",
      detail: s.wpm ? `${Math.round(s.wpm)} wpm` : null,
      href: "/speaking",
      at: s.at,
    });
  }
  for (const p of practiceRows) {
    items.push({
      kind: "practice",
      title: "Mistake practice",
      detail: `${p.correctCount}/${p.questionCount} correct`,
      href: p.mistakeId ? `/mistakes/${p.mistakeId}` : "/mistakes",
      at: p.at,
    });
  }

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items.slice(0, limit);
}

/**
 * Records a daily progress snapshot (once per day) so skill history can grow
 * into charts later. Cheap: one lookup, conditional insert.
 */
export async function recordProgressSnapshot(userId: number): Promise<void> {
  const db = await getDb();
  const date = todayKey();

  const existing = await db
    .select({ id: progressSnapshots.id })
    .from(progressSnapshots)
    .where(and(eq(progressSnapshots.userId, userId), eq(progressSnapshots.date, date)))
    .limit(1);
  if (existing.length > 0) return;

  const skillRows = await db
    .select({ skill: skillScores.skill, score: skillScores.score })
    .from(skillScores)
    .where(eq(skillScores.userId, userId));
  const skills: Record<string, number> = {};
  for (const s of skillRows) skills[s.skill] = s.score;

  const speakRows = await db
    .select({
      wpm: speakingSessions.wpm,
      fillerCount: speakingSessions.fillerCount,
      wordCount: speakingSessions.wordCount,
      durationSec: speakingSessions.durationSec,
    })
    .from(speakingSessions)
    .where(eq(speakingSessions.userId, userId))
    .orderBy(desc(speakingSessions.createdAt))
    .limit(10);

  const wpmSamples = speakRows.map((s) => s.wpm).filter((w): w is number => w !== null);
  const avgWpm = wpmSamples.length
    ? wpmSamples.reduce((a, b) => a + b, 0) / wpmSamples.length
    : null;
  const words = speakRows.reduce((a, s) => a + (s.wordCount ?? 0), 0);
  const fillers = speakRows.reduce((a, s) => a + (s.fillerCount ?? 0), 0);
  const fillerRate = words > 0 ? Math.round((fillers / words) * 1000) : null;
  const speakingMinutes =
    Math.round(speakRows.reduce((a, s) => a + s.durationSec, 0) / 60 * 10) / 10;
  const overall = skills["overall"] ?? 0;

  await db.insert(progressSnapshots).values({
    userId,
    date,
    overall,
    skills,
    wpm: avgWpm,
    fillerRate,
    speakingMinutes,
    notes: [],
    createdAt: new Date(),
  });
}
