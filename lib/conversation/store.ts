import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  conversations,
  conversationMessages,
  lessonProgress,
  mistakes,
  scenarios,
  skillScores,
  userMistakes,
  userVocabulary,
  users,
} from "@/lib/db/schema";
import { findStreak } from "@/lib/plan/store";
import { EMPTY_STREAK } from "@/lib/plan/streak";
import { detectMistakes } from "@/lib/mistakes/detect";
import { loadDetectRules, recordMistakes } from "@/lib/mistakes/store";
import { generateChatReply } from "@/lib/ai/roleplay";
import {
  coachReply,
  initialCoachMessage,
  initialScenarioMessage,
  scenarioReply,
  type ChatMessage,
  type CoachContext,
  type ScenarioContext,
} from "./reply";

export type ConversationRow = typeof conversations.$inferSelect;

export type ChatTurnResponse = {
  reply: string;
  detected: { key: string; title: string; category: string; severity: string }[];
  messageCount: number;
};

export type StartResult = {
  id: number;
  title: string;
  resumed: boolean;
  messages: ChatMessage[];
};

export async function listChatScenarios(): Promise<
  { id: number; title: string; category: string; description: string }[]
> {
  const db = await getDb();
  return db
    .select({
      id: scenarios.id,
      title: scenarios.title,
      category: scenarios.category,
      description: scenarios.description,
    })
    .from(scenarios)
    .orderBy(asc(scenarios.category), asc(scenarios.id))
    .limit(30);
}

export async function collectCoachContext(userId: number): Promise<CoachContext> {
  const db = await getDb();

  const userRows = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const skillRows = await db
    .select({ skill: skillScores.skill, score: skillScores.score })
    .from(skillScores)
    .where(eq(skillScores.userId, userId));

  const patternRows = await db
    .select({ title: mistakes.title, category: mistakes.category })
    .from(userMistakes)
    .innerJoin(mistakes, eq(userMistakes.mistakeId, mistakes.id))
    .where(
      and(
        eq(userMistakes.userId, userId),
        inArray(userMistakes.status, ["active", "needs_practice"])
      )
    )
    .orderBy(desc(userMistakes.occurrences), desc(userMistakes.lastDetectedAt))
    .limit(3);

  const now = new Date();
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

  const lessonRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.status, "completed")));

  const streak = (await findStreak(userId)) ?? EMPTY_STREAK;

  return {
    name: userRows[0]?.name ?? "there",
    streak: streak.current,
    skills: skillRows,
    patterns: patternRows,
    dueWords: Number(dueRows[0]?.n ?? 0),
    lessonsDone: Number(lessonRows[0]?.n ?? 0),
  };
}

async function loadMessages(conversationId: number): Promise<ChatMessage[]> {
  const db = await getDb();
  const rows = await db
    .select({ role: conversationMessages.role, content: conversationMessages.content })
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(asc(conversationMessages.id))
    .limit(200);
  return rows;
}

async function activeConversation(
  userId: number,
  scenarioId: number | null
): Promise<ConversationRow | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        scenarioId === null
          ? sql`${conversations.scenarioId} is null`
          : eq(conversations.scenarioId, scenarioId),
        eq(conversations.status, "active")
      )
    )
    .orderBy(desc(conversations.id))
    .limit(1);
  return rows[0] ?? null;
}

/** Resumes an active chat if one exists, otherwise opens a coach conversation. */
export async function startCoachConversation(userId: number): Promise<StartResult> {
  const existing = await activeConversation(userId, null);
  if (existing) {
    return {
      id: existing.id,
      title: existing.title ?? "AI Coach",
      resumed: true,
      messages: await loadMessages(existing.id),
    };
  }

  const ctx = await collectCoachContext(userId);
  const opening = initialCoachMessage(ctx);
  const db = await getDb();
  const inserted = await db
    .insert(conversations)
    .values({ userId, mode: "free", title: "AI Coach", messageCount: 1 })
    .returning({ id: conversations.id });
  const id = inserted[0].id;
  await db.insert(conversationMessages).values({
    conversationId: id,
    role: "ai",
    content: opening,
  });
  return { id, title: "AI Coach", resumed: false, messages: [{ role: "ai", content: opening }] };
}

export async function startScenarioConversation(
  userId: number,
  scenarioId: number
): Promise<StartResult | null> {
  const db = await getDb();
  const scenarioRows = await db
    .select({
      id: scenarios.id,
      title: scenarios.title,
      description: scenarios.description,
      category: scenarios.category,
      openingPrompt: scenarios.openingPrompt,
      persona: scenarios.persona,
    })
    .from(scenarios)
    .where(eq(scenarios.id, scenarioId))
    .limit(1);
  const scenario = scenarioRows[0];
  if (!scenario) return null;

  const existing = await activeConversation(userId, scenarioId);
  if (existing) {
    return {
      id: existing.id,
      title: existing.title ?? scenario.title,
      resumed: true,
      messages: await loadMessages(existing.id),
    };
  }

  const ctx: ScenarioContext = {
    title: scenario.title,
    description: scenario.description,
    persona: scenario.persona,
    openingPrompt: scenario.openingPrompt,
  };
  const opening = initialScenarioMessage(ctx);
  const mode =
    scenario.category === "interview"
      ? "interview"
      : scenario.category === "roleplay"
        ? "roleplay"
        : "free";

  const inserted = await db
    .insert(conversations)
    .values({
      userId,
      scenarioId,
      mode,
      persona: scenario.persona,
      title: scenario.title,
      messageCount: 1,
    })
    .returning({ id: conversations.id });
  const id = inserted[0].id;
  await db.insert(conversationMessages).values({
    conversationId: id,
    role: "ai",
    content: opening,
  });
  return { id, title: scenario.title, resumed: false, messages: [{ role: "ai", content: opening }] };
}

export async function getConversationForUser(
  userId: number,
  conversationId: number
): Promise<{ conversation: ConversationRow; messages: ChatMessage[] } | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);
  const conversation = rows[0];
  if (!conversation) return null;
  return { conversation, messages: await loadMessages(conversationId) };
}

export async function listConversations(
  userId: number,
  limit = 10
): Promise<
  {
    id: number;
    title: string | null;
    scenarioId: number | null;
    mode: string;
    status: string;
    messageCount: number;
    startedAt: Date;
  }[]
> {
  const db = await getDb();
  return db
    .select({
      id: conversations.id,
      title: conversations.title,
      scenarioId: conversations.scenarioId,
      mode: conversations.mode,
      status: conversations.status,
      messageCount: conversations.messageCount,
      startedAt: conversations.startedAt,
    })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.id))
    .limit(limit);
}

export type SendResult =
  | ({ ok: true; conversationId: number } & ChatTurnResponse)
  | { ok: false; code: "not_found" | "ended" };

/**
 * One chat turn: detect patterns in the user's message, record them, generate
 * the deterministic mock reply, and persist both messages. Sequential D1.
 */
export async function sendChatTurn(
  userId: number,
  conversationId: number,
  text: string
): Promise<SendResult> {
  const db = await getDb();
  const convRows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);
  const conv = convRows[0];
  if (!conv) return { ok: false, code: "not_found" };
  if (conv.status === "ended") return { ok: false, code: "ended" };

  const history = await loadMessages(conversationId);

  const rules = await loadDetectRules();
  const detected = detectMistakes(text, rules, 4);
  if (detected.length > 0) {
    await recordMistakes(userId, detected, {
      sessionType: "conversation",
      sessionId: conversationId,
    });
  }

  let mockReply: string;
  let kind: "scenario" | "coach";
  let scenarioCtx: ScenarioContext | undefined;
  let coachCtx: CoachContext | undefined;
  if (conv.scenarioId !== null) {
    kind = "scenario";
    const scenarioRows = await db
      .select({
        title: scenarios.title,
        description: scenarios.description,
        openingPrompt: scenarios.openingPrompt,
        persona: scenarios.persona,
      })
      .from(scenarios)
      .where(eq(scenarios.id, conv.scenarioId))
      .limit(1);
    const s = scenarioRows[0];
    scenarioCtx = s
      ? {
          title: s.title,
          description: s.description,
          persona: conv.persona ?? s.persona,
          openingPrompt: s.openingPrompt,
        }
      : {
          title: conv.title ?? "Practice chat",
          description: "",
          persona: conv.persona,
          openingPrompt: null,
        };
    mockReply = scenarioReply(history, scenarioCtx, text);
  } else {
    kind = "coach";
    coachCtx = await collectCoachContext(userId);
    mockReply = coachReply(history, coachCtx, text);
  }
  const gen = await generateChatReply({
    kind,
    ...(scenarioCtx ? { scenario: scenarioCtx } : {}),
    ...(coachCtx ? { coach: coachCtx } : {}),
    history,
    userText: text,
    mockReply,
  });
  const reply = gen.reply;

  const now = new Date();
  await db.insert(conversationMessages).values({
    conversationId,
    role: "user",
    content: text,
    analysis:
      detected.length > 0
        ? {
            detected: detected.map((d) => ({
              key: d.key,
              title: d.title,
              category: d.category,
              severity: d.severity,
            })),
          }
        : null,
    createdAt: now,
  });
  await db.insert(conversationMessages).values({
    conversationId,
    role: "ai",
    content: reply,
    createdAt: now,
  });
  await db
    .update(conversations)
    .set({ messageCount: sql`${conversations.messageCount} + 2` })
    .where(eq(conversations.id, conversationId));

  return {
    ok: true,
    conversationId,
    reply,
    detected: detected.map((d) => ({
      key: d.key,
      title: d.title,
      category: d.category,
      severity: d.severity,
    })),
    messageCount: conv.messageCount + 2,
  };
}

export async function endConversation(userId: number, conversationId: number): Promise<boolean> {
  const db = await getDb();
  const updated = await db
    .update(conversations)
    .set({ status: "ended", endedAt: new Date() })
    .where(
      and(eq(conversations.id, conversationId), eq(conversations.userId, userId))
    )
    .returning({ id: conversations.id });
  return updated.length > 0;
}
