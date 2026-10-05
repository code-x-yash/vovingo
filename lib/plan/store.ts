import { and, asc, desc, eq, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  dailyPlans,
  lessons,
  lessonProgress,
  listeningSessions,
  mistakes,
  podcasts,
  profiles,
  streaks,
  userMistakes,
  userVocabulary,
} from "@/lib/db/schema";
import { buildPlan, todayKey, type PlanSeed } from "./generate";
import { applyActivity, EMPTY_STREAK, XP_PER_ITEM, XP_PLAN_BONUS, type StreakState } from "./streak";

export type PlanRow = typeof dailyPlans.$inferSelect;

export type CompleteOutcome =
  | { ok: true; plan: PlanRow; streak: StreakState; xpGained: number }
  | { ok: false; code: "bad_index" };

export async function findStreak(userId: number): Promise<StreakState | null> {
  const db = await getDb();
  const rows = await db.select().from(streaks).where(eq(streaks.userId, userId)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    current: row.current,
    longest: row.longest,
    totalDays: row.totalDays,
    lastActiveDate: row.lastActiveDate,
    xp: row.xp,
  };
}

async function gatherSeed(userId: number): Promise<PlanSeed> {
  const db = await getDb();
  const now = new Date();

  const profileRows = await db
    .select({ dailyMinutes: profiles.dailyMinutes })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  const dueRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(userVocabulary)
    .where(
      and(
        eq(userVocabulary.userId, userId),
        lte(userVocabulary.dueAt, now),
        inArray(userVocabulary.status, ["learning", "reviewing"])
      )
    );

  const mistakeRows = await db
    .select({
      id: mistakes.id,
      title: mistakes.title,
      category: mistakes.category,
      practicePrompts: mistakes.practicePrompts,
    })
    .from(userMistakes)
    .innerJoin(mistakes, eq(userMistakes.mistakeId, mistakes.id))
    .where(and(eq(userMistakes.userId, userId), inArray(userMistakes.status, ["active", "needs_practice"])))
    .orderBy(desc(userMistakes.occurrences), desc(userMistakes.lastDetectedAt))
    .limit(1);

  const lessonRows = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      category: lessons.category,
      durationMin: lessons.durationMin,
    })
    .from(lessons)
    .leftJoin(
      lessonProgress,
      and(eq(lessonProgress.lessonId, lessons.id), eq(lessonProgress.userId, userId))
    )
    .where(and(eq(lessons.published, true), or(isNull(lessonProgress.id), ne(lessonProgress.status, "completed"))))
    .orderBy(asc(lessons.id))
    .limit(1);

  const podcastRows = await db
    .select({ id: podcasts.id, title: podcasts.title, topic: podcasts.topic })
    .from(podcasts)
    .leftJoin(
      listeningSessions,
      and(
        eq(listeningSessions.podcastId, podcasts.id),
        eq(listeningSessions.userId, userId),
        eq(listeningSessions.completed, true)
      )
    )
    .where(and(eq(podcasts.published, true), isNull(listeningSessions.id)))
    .orderBy(desc(podcasts.featured), asc(podcasts.id))
    .limit(1);

  const m = mistakeRows[0];
  return {
    dailyMinutes: profileRows[0]?.dailyMinutes ?? 20,
    dueVocabCount: Number(dueRows[0]?.n ?? 0),
    topMistake: m ? { id: m.id, title: m.title, category: m.category, prompt: m.practicePrompts?.[0] } : null,
    nextLesson: lessonRows[0] ?? null,
    podcast: podcastRows[0] ?? null,
  };
}

export async function selectToday(userId: number): Promise<PlanRow | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(dailyPlans)
    .where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.date, todayKey())))
    .limit(1);
  return rows[0] ?? null;
}

export async function getOrCreateTodayPlan(userId: number): Promise<PlanRow> {
  const existing = await selectToday(userId);
  if (existing) return existing;

  const seed = await gatherSeed(userId);
  const built = buildPlan(seed);

  const db = await getDb();
  const inserted = await db
    .insert(dailyPlans)
    .values({
      userId,
      date: todayKey(),
      minutesTarget: built.minutesTarget,
      focus: built.focus,
      focusReason: built.focusReason,
      focusMistakeId: built.focusMistakeId,
      items: built.items,
      generatedBy: "rule",
    })
    .onConflictDoNothing()
    .returning();

  if (inserted[0]) return inserted[0];
  const raced = await selectToday(userId);
  if (raced) return raced;
  throw new Error("Could not create today's plan.");
}

export async function regenerateTodayPlan(userId: number): Promise<PlanRow> {
  const seed = await gatherSeed(userId);
  const built = buildPlan(seed);
  const db = await getDb();

  const existing = await selectToday(userId);
  if (existing) {
    const updated = await db
      .update(dailyPlans)
      .set({
        minutesTarget: built.minutesTarget,
        focus: built.focus,
        focusReason: built.focusReason,
        focusMistakeId: built.focusMistakeId,
        items: built.items,
        status: "active",
        completedCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(dailyPlans.id, existing.id))
      .returning();
    if (updated[0]) return updated[0];
  }

  return getOrCreateTodayPlan(userId);
}

export async function completePlanItem(
  userId: number,
  plan: PlanRow,
  index: number
): Promise<CompleteOutcome> {
  return completePlanItems(userId, plan, [index]);
}

/** Marks the given item indexes done (idempotent per item). XP: 10/item + 50 plan bonus. */
export async function completePlanItems(
  userId: number,
  plan: PlanRow,
  indexes: number[]
): Promise<CompleteOutcome> {
  const items = plan.items ?? [];
  if (indexes.some((i) => i < 0 || i >= items.length)) return { ok: false, code: "bad_index" };

  const newlyDone = [...new Set(indexes)].filter((i) => !items[i].done);
  const db = await getDb();

  if (newlyDone.length === 0) {
    const streak = (await findStreak(userId)) ?? EMPTY_STREAK;
    return { ok: true, plan, streak, xpGained: 0 };
  }

  const updatedItems = items.map((item, i) =>
    newlyDone.includes(i) ? { ...item, done: true } : item
  );
  const doneCount = updatedItems.filter((item) => item.done).length;
  const allDone = doneCount === updatedItems.length && updatedItems.length > 0;
  const bonus = allDone && doneCount - newlyDone.length < updatedItems.length ? XP_PLAN_BONUS : 0;

  const updated = await db
    .update(dailyPlans)
    .set({
      items: updatedItems,
      completedCount: doneCount,
      status: allDone ? "completed" : "active",
      updatedAt: new Date(),
    })
    .where(eq(dailyPlans.id, plan.id))
    .returning();
  const planRow = updated[0] ?? plan;

  const xpGained = newlyDone.length * XP_PER_ITEM + bonus;
  const existing = await findStreak(userId);
  const next = applyActivity(existing ?? EMPTY_STREAK, todayKey(), xpGained);

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

  return { ok: true, plan: planRow, streak: next, xpGained };
}

/** Auto-checks plan items matching a resource (e.g. finishing a lesson marks its learn item). */
export async function completePlanItemsByRef(
  userId: number,
  plan: PlanRow,
  ref: { type: string; id: number }
): Promise<CompleteOutcome> {
  const items = plan.items ?? [];
  const indexes = items
    .map((item, i) => (item.ref?.type === ref.type && item.ref.id === ref.id ? i : -1))
    .filter((i) => i >= 0);
  if (indexes.length === 0) {
    const streak = (await findStreak(userId)) ?? EMPTY_STREAK;
    return { ok: true, plan, streak, xpGained: 0 };
  }
  return completePlanItems(userId, plan, indexes);
}
