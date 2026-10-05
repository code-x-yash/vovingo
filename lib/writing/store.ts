import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { skillScores, streaks, writingAnalyses } from "@/lib/db/schema";
import type { DetectedMistake } from "@/lib/db/schema";
import { findStreak } from "@/lib/plan/store";
import { applyActivity, EMPTY_STREAK } from "@/lib/plan/streak";
import { todayKey } from "@/lib/plan/generate";
import { detectMistakes } from "@/lib/mistakes/detect";
import { loadDetectRules, recordMistakes } from "@/lib/mistakes/store";
import { drift } from "@/lib/speaking/store";
import { getWritingPrompt } from "@/lib/content/writing-prompts";
import { analyzeWriting, countWords, type WritingScores } from "./analyze";

export type RecentWriting = {
  id: number;
  kind: string;
  createdAt: Date;
  overall: number;
  excerpt: string;
  patterns: number;
};

export async function listRecentWritings(userId: number, limit = 6): Promise<RecentWriting[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: writingAnalyses.id,
      kind: writingAnalyses.kind,
      createdAt: writingAnalyses.createdAt,
      original: writingAnalyses.original,
      scores: writingAnalyses.scores,
      mistakes: writingAnalyses.mistakes,
    })
    .from(writingAnalyses)
    .where(eq(writingAnalyses.userId, userId))
    .orderBy(desc(writingAnalyses.id))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    createdAt: r.createdAt,
    overall: r.scores?.overall ?? 0,
    excerpt: r.original.length > 90 ? `${r.original.slice(0, 90)}…` : r.original,
    patterns: Array.isArray(r.mistakes) ? r.mistakes.length : 0,
  }));
}

export type SubmitWritingOutcome =
  | {
      ok: true;
      analysisId: number;
      scores: WritingScores;
      feedback: string[];
      corrected: string;
      natural: string;
      tone: string;
      mistakes: DetectedMistake[];
      words: number;
      xpGained: number;
      skill: { writing: number; grammar: number };
      patternsLogged: number;
    }
  | { ok: false; code: "not_found" | "too_short"; minWords?: number; current?: number };

/**
 * Full writing pipeline: prompt check → detect recurring patterns → heuristic
 * analysis → persist to writing_analyses → record mistakes (session type
 * "writing") → drift writing/grammar skills → award XP + streak. Sequential D1.
 */
export async function submitWriting(
  userId: number,
  slug: string,
  text: string
): Promise<SubmitWritingOutcome> {
  const prompt = getWritingPrompt(slug);
  if (!prompt) return { ok: false, code: "not_found" };

  const words = countWords(text);
  if (words < prompt.minWords) {
    return { ok: false, code: "too_short", minWords: prompt.minWords, current: words };
  }

  const rules = await loadDetectRules();
  const detected = detectMistakes(text, rules, 6);
  const analysis = analyzeWriting(text, detected, { minWords: prompt.minWords });

  const db = await getDb();
  const inserted = await db
    .insert(writingAnalyses)
    .values({
      userId,
      kind: prompt.kind,
      original: text,
      corrected: analysis.corrected,
      natural: analysis.natural,
      tone: analysis.tone,
      scores: analysis.scores,
      mistakes: detected,
      feedback: { items: analysis.feedback },
    })
    .returning({ id: writingAnalyses.id });
  const analysisId = inserted[0].id;

  if (detected.length > 0) {
    await recordMistakes(userId, detected, { sessionType: "writing", sessionId: analysisId });
  }

  const skillRows = await db
    .select()
    .from(skillScores)
    .where(
      and(
        eq(skillScores.userId, userId),
        inArray(skillScores.skill, ["writing", "grammar"])
      )
    );
  const bySkill = new Map(skillRows.map((r) => [r.skill, r]));

  const writingRow = bySkill.get("writing");
  const grammarRow = bySkill.get("grammar");
  const newWriting = writingRow
    ? Math.round(drift(writingRow.score, analysis.scores.writing, 0.12) * 100) / 100
    : analysis.scores.writing;
  const newGrammar = grammarRow
    ? Math.round(drift(grammarRow.score, analysis.scores.grammar, 0.06) * 100) / 100
    : analysis.scores.grammar;
  if (writingRow) {
    await db
      .update(skillScores)
      .set({ score: newWriting, updatedAt: new Date() })
      .where(eq(skillScores.id, writingRow.id));
  }
  if (grammarRow) {
    await db
      .update(skillScores)
      .set({ score: newGrammar, updatedAt: new Date() })
      .where(eq(skillScores.id, grammarRow.id));
  }

  const XP_PER_WRITE = 10;
  const existing = await findStreak(userId);
  const next = applyActivity(existing ?? EMPTY_STREAK, todayKey(), XP_PER_WRITE);
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

  return {
    ok: true,
    analysisId,
    scores: analysis.scores,
    feedback: analysis.feedback,
    corrected: analysis.corrected,
    natural: analysis.natural,
    tone: analysis.tone,
    mistakes: detected,
    words,
    xpGained: XP_PER_WRITE,
    skill: { writing: newWriting, grammar: newGrammar },
    patternsLogged: detected.length,
  };
}
