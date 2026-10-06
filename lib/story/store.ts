import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { storyEntries } from "@/lib/db/schema";

export type StoryEntry = typeof storyEntries.$inferSelect;

const LIST_LIMIT = 60;

export async function listStory(): Promise<StoryEntry[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(storyEntries)
    .orderBy(desc(storyEntries.chapter), desc(storyEntries.id))
    .limit(LIST_LIMIT);
  return rows.reverse();
}

export async function nextChapter(): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ max: sql<number | null>`max(${storyEntries.chapter})` })
    .from(storyEntries);
  return (rows[0]?.max ?? 0) + 1;
}

export async function appendEntry(
  userId: number,
  chapter: number,
  text: string
): Promise<StoryEntry> {
  const db = await getDb();
  const inserted = await db
    .insert(storyEntries)
    .values({ userId, chapter, text })
    .returning();
  return inserted[0];
}

export async function voteEntry(id: number): Promise<boolean> {
  const db = await getDb();
  const updated = await db
    .update(storyEntries)
    .set({ votes: sql`${storyEntries.votes} + 1` })
    .where(eq(storyEntries.id, id))
    .returning({ id: storyEntries.id });
  return updated.length > 0;
}
