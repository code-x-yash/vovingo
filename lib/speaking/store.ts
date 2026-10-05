import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { aiAnalysis, scenarios, skillScores, speakingSessions } from "@/lib/db/schema";
import { getAIProvider, type SpeakingResult } from "@/lib/ai/provider";
import { loadDetectRules, recordMistakes } from "@/lib/mistakes/store";
import { completePlanItemsByRef, selectToday } from "@/lib/plan/store";
import { FREE_TOPICS } from "./prompts";

export type SpeakingMode = "free" | "topic" | "situation" | "roleplay";

export type SubmitSpeakingInput = {
  userId: number;
  mode: SpeakingMode;
  scenarioId: number | null;
  prompt: string;
  transcript: string;
  durationSec: number;
};

export type SubmitSpeakingOutcome = {
  sessionId: number;
  analysis: SpeakingResult;
  planXp: number;
};

/** Weighted move of a stored skill toward the analysis score. */
export function drift(base: number, target: number, rate = 0.12): number {
  return Math.round((base + (target - base) * rate) * 100) / 100;
}

const SPEAKING_SKILLS = ["grammar", "vocabulary", "fluency", "pronunciation", "confidence", "speaking"] as const;

async function bumpSkills(
  userId: number,
  targets: Record<(typeof SPEAKING_SKILLS)[number], number>
): Promise<Record<string, number>> {
  const db = await getDb();
  const skills = [...SPEAKING_SKILLS];
  const rows = await db
    .select({ id: skillScores.id, skill: skillScores.skill, score: skillScores.score })
    .from(skillScores)
    .where(and(eq(skillScores.userId, userId), inArray(skillScores.skill, skills)));
  const bySkill = new Map(rows.map((r) => [r.skill, r]));

  const updated: Record<string, number> = {};
  for (const skill of skills) {
    const existing = bySkill.get(skill);
    const next = drift(existing?.score ?? 50, targets[skill]);
    updated[skill] = next;
    if (existing) {
      await db.update(skillScores).set({ score: next, updatedAt: new Date() }).where(eq(skillScores.id, existing.id));
    } else {
      await db.insert(skillScores).values({ userId, skill, score: next });
    }
  }
  return updated;
}

export async function submitSpeaking(input: SubmitSpeakingInput): Promise<SubmitSpeakingOutcome> {
  const db = await getDb();
  const rules = await loadDetectRules();
  const provider = getAIProvider();

  const { result, latencyMs, tokensIn, tokensOut } = await provider.analyzeSpeaking({
    transcript: input.transcript,
    durationSec: input.durationSec,
    prompt: input.prompt,
    rules,
  });

  const now = new Date();
  const m = result.metrics;
  const s = result.scores;

  const [session] = await db
    .insert(speakingSessions)
    .values({
      userId: input.userId,
      mode: input.mode,
      scenarioId: input.scenarioId,
      prompt: input.prompt,
      durationSec: input.durationSec,
      transcript: input.transcript,
      wpm: m.wpm,
      pauseCount: m.pauseCount,
      longPauseCount: m.longPauseCount,
      avgPauseMs: m.avgPauseMs,
      fillerCount: m.fillerCount,
      wordCount: m.wordCount,
      uniqueWordCount: m.uniqueWordCount,
      grammarScore: s.grammar,
      vocabularyScore: s.vocabulary,
      fluencyScore: s.fluency,
      pronunciationScore: s.pronunciation,
      confidenceScore: s.confidence,
      naturalnessScore: s.naturalness,
      status: "processing",
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: speakingSessions.id });

  const [analysisRow] = await db
    .insert(aiAnalysis)
    .values({
      userId: input.userId,
      subjectType: "speaking",
      subjectId: session.id,
      provider: provider.name,
      model: provider.model,
      promptVersion: "heuristics-v1",
      input: { transcript: input.transcript, durationSec: input.durationSec, prompt: input.prompt },
      output: { scores: s, metrics: m, summary: result.summary, recommendations: result.recommendations },
      summary: result.summary,
      scores: s,
      recommendations: result.recommendations,
      latencyMs,
      tokensIn,
      tokensOut,
      success: true,
      createdAt: now,
    })
    .returning({ id: aiAnalysis.id });

  await db
    .update(speakingSessions)
    .set({ analysisId: analysisRow.id, status: "completed", updatedAt: new Date() })
    .where(eq(speakingSessions.id, session.id));

  await recordMistakes(input.userId, result.mistakes, {
    sessionType: "speaking",
    sessionId: session.id,
  });

  const speakingSkill =
    (s.grammar + s.vocabulary + s.fluency + s.pronunciation + s.confidence + s.naturalness) / 6;
  await bumpSkills(input.userId, {
    grammar: s.grammar,
    vocabulary: s.vocabulary,
    fluency: s.fluency,
    pronunciation: s.pronunciation,
    confidence: s.confidence,
    speaking: speakingSkill,
  });

  let planXp = 0;
  const plan = await selectToday(input.userId);
  if (plan) {
    const outcome = await completePlanItemsByRef(input.userId, plan, {
      type: "speaking",
      id: 0,
    });
    if (outcome.ok) planXp = outcome.xpGained;
  }

  return { sessionId: session.id, analysis: result, planXp };
}

export type ScenarioPrompt = {
  id: number;
  slug: string;
  title: string;
  category: string;
  description: string;
  openingPrompt: string | null;
  difficulty: number;
  tags: string[];
  skillFocus: string | null;
};

export type RecentSession = {
  id: number;
  mode: string;
  prompt: string | null;
  wpm: number | null;
  wordCount: number;
  scores: Record<string, number>;
  createdAt: string;
};

export async function getSpeakingFeed(userId: number): Promise<{
  scenarios: ScenarioPrompt[];
  topics: string[];
  recent: RecentSession[];
}> {
  const db = await getDb();

  const scenarioRows = await db
    .select({
      id: scenarios.id,
      slug: scenarios.slug,
      title: scenarios.title,
      category: scenarios.category,
      description: scenarios.description,
      openingPrompt: scenarios.openingPrompt,
      difficulty: scenarios.difficulty,
      tags: scenarios.tags,
      skillFocus: scenarios.skillFocus,
    })
    .from(scenarios)
    .orderBy(scenarios.category, scenarios.id)
    .limit(16);

  const recentRows = await db
    .select({
      id: speakingSessions.id,
      mode: speakingSessions.mode,
      prompt: speakingSessions.prompt,
      wpm: speakingSessions.wpm,
      wordCount: speakingSessions.wordCount,
      grammar: speakingSessions.grammarScore,
      vocabulary: speakingSessions.vocabularyScore,
      fluency: speakingSessions.fluencyScore,
      pronunciation: speakingSessions.pronunciationScore,
      confidence: speakingSessions.confidenceScore,
      naturalness: speakingSessions.naturalnessScore,
      createdAt: speakingSessions.createdAt,
    })
    .from(speakingSessions)
    .where(eq(speakingSessions.userId, userId))
    .orderBy(desc(speakingSessions.createdAt))
    .limit(8);

  // Deterministic topic rotation per user so the list isn't identical for everyone.
  const offset = userId % FREE_TOPICS.length;
  const topics = [...FREE_TOPICS.slice(offset), ...FREE_TOPICS.slice(0, offset)];

  return {
    scenarios: scenarioRows.map((r) => ({ ...r, tags: r.tags ?? [] })),
    topics,
    recent: recentRows.map((r) => ({
      id: r.id,
      mode: r.mode,
      prompt: r.prompt,
      wpm: r.wpm,
      wordCount: r.wordCount ?? 0,
      scores: {
        grammar: r.grammar ?? 0,
        vocabulary: r.vocabulary ?? 0,
        fluency: r.fluency ?? 0,
        pronunciation: r.pronunciation ?? 0,
        confidence: r.confidence ?? 0,
        naturalness: r.naturalness ?? 0,
      },
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
