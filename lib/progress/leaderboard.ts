import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { events, streaks, users } from "@/lib/db/schema";

export const XP_EVENT = "xp";

/** Epoch-ms of the Monday (UTC) that starts the week containing `now`. */
export function weekStart(now = Date.now()): number {
  const d = new Date(now);
  const day = d.getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (day + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - daysSinceMonday * 86_400_000;
}

export type Division = {
  name: string;
  min: number;
  next: number | null;
};

export const DIVISIONS: Division[] = [
  { name: "Bronze", min: 0, next: 100 },
  { name: "Silver", min: 100, next: 300 },
  { name: "Gold", min: 300, next: 700 },
  { name: "Platinum", min: 700, next: null },
];

export function divisionFor(xp: number): Division {
  let current = DIVISIONS[0];
  for (const division of DIVISIONS) {
    if (xp >= division.min) current = division;
  }
  return current;
}

/** Logs XP as an event so weekly leaderboards can aggregate it. */
export async function recordXp(
  userId: number,
  amount: number,
  source: string
): Promise<void> {
  if (amount <= 0) return;
  const db = await getDb();
  await db.insert(events).values({
    userId,
    name: XP_EVENT,
    props: { amount, source },
  });
}

/**
 * XP for side activities (speedruns, games): bumps the lifetime total in
 * `streaks` and logs the event for the weekly leaderboard. Does not touch
 * streak-day bookkeeping — plan activity owns that.
 */
export async function awardXp(
  userId: number,
  amount: number,
  source: string
): Promise<void> {
  if (amount <= 0) return;
  const db = await getDb();
  const rows = await db
    .select({ id: streaks.id })
    .from(streaks)
    .where(eq(streaks.userId, userId))
    .limit(1);
  if (rows[0]) {
    await db
      .update(streaks)
      .set({ xp: sql`${streaks.xp} + ${amount}`, updatedAt: new Date() })
      .where(eq(streaks.id, rows[0].id));
  } else {
    await db.insert(streaks).values({ userId, xp: amount });
  }
  await recordXp(userId, amount, source);
}

export type LeaderboardRow = {
  rank: number;
  userId: number;
  name: string;
  xp: number;
  currentStreak: number;
  isMe: boolean;
};

export type Leaderboard = {
  weekStartsAt: Date;
  rows: LeaderboardRow[];
  me: LeaderboardRow | null;
  division: Division;
  myWeeklyXp: number;
  playerCount: number;
};

export async function getWeeklyLeaderboard(userId: number): Promise<Leaderboard> {
  const db = await getDb();
  const since = new Date(weekStart());

  const grouped = await db
    .select({
      userId: users.id,
      name: users.name,
      xp: sql<number>`COALESCE(SUM(CAST(json_extract(${events.props}, '$.amount') AS INTEGER)), 0)`,
      currentStreak: sql<number>`COALESCE(${streaks.current}, 0)`,
    })
    .from(events)
    .innerJoin(users, eq(users.id, events.userId))
    .leftJoin(streaks, eq(streaks.userId, users.id))
    .where(and(eq(events.name, XP_EVENT), gte(events.createdAt, since)))
    .groupBy(users.id)
    .orderBy(sql`xp DESC, ${users.id} ASC`)
    .limit(500);

  const rows: LeaderboardRow[] = grouped.map((row, index) => ({
    rank: index + 1,
    userId: row.userId,
    name: row.name,
    xp: row.xp,
    currentStreak: row.currentStreak,
    isMe: row.userId === userId,
  }));

  const me = rows.find((row) => row.isMe) ?? null;
  const myWeeklyXp = me?.xp ?? 0;

  return {
    weekStartsAt: since,
    rows,
    me,
    division: divisionFor(myWeeklyXp),
    myWeeklyXp,
    playerCount: rows.length,
  };
}
