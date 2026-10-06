import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { mistakes, speedruns, vocabulary } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { jsonError, jsonRateLimited, readJson } from "@/lib/api/http";
import { fieldErrors } from "@/lib/auth/schemas";
import { awardXp } from "@/lib/progress/leaderboard";
import {
  MODE_META,
  ROUND_SIZE,
  buildGrammarRound,
  buildToneRound,
  buildVocabRound,
  isPlausibleRun,
  xpForRun,
  type SpeedrunMode,
  type SpeedrunQuestion,
} from "@/lib/speedrun/bank";

const modeSchema = z.object({ mode: z.enum(["vocab", "grammar", "tone"]) });
const submitSchema = z.object({
  mode: z.enum(["vocab", "grammar", "tone"]),
  correct: z.number().int().min(0).max(ROUND_SIZE),
  total: z.number().int().min(1).max(ROUND_SIZE),
  scoreMs: z.number().int().min(0).max(600_000),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Not authenticated.");

  const mode = new URL(request.url).searchParams.get("mode") ?? "";
  const parsedMode = modeSchema.safeParse({ mode });
  if (!parsedMode.success) return jsonError(400, "Unknown speedrun mode.");
  const modeKey = parsedMode.data.mode as SpeedrunMode;

  const db = await getDb();
  const questions: SpeedrunQuestion[] =
    modeKey === "vocab"
      ? buildVocabRound(
          await db
            .select({
              id: vocabulary.id,
              word: vocabulary.word,
              definition: vocabulary.definition,
            })
            .from(vocabulary)
            .orderBy(asc(vocabulary.id))
        )
      : modeKey === "grammar"
        ? buildGrammarRound(
            await db
              .select({
                id: mistakes.id,
                wrongExample: mistakes.wrongExample,
                correctExample: mistakes.correctExample,
              })
              .from(mistakes)
              .where(eq(mistakes.category, "grammar"))
              .orderBy(asc(mistakes.id))
          )
        : buildToneRound();

  if (questions.length < 4) {
    return jsonError(503, "Not enough content for this mode yet.");
  }

  const bestRows = await db
    .select({ correct: speedruns.correct, total: speedruns.total, scoreMs: speedruns.scoreMs })
    .from(speedruns)
    .where(and(eq(speedruns.userId, user.id), eq(speedruns.mode, modeKey)))
    .orderBy(sql`${speedruns.correct} DESC, ${speedruns.scoreMs} ASC`)
    .limit(1);

  return NextResponse.json({
    questions,
    seconds: MODE_META[modeKey].seconds,
    label: MODE_META[modeKey].label,
    best: bestRows[0] ?? null,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Not authenticated.");

  const limit = rateLimit(`speedrun:${clientIp(request.headers)}`, 30, 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const body = await readJson(request);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }
  const data = parsed.data;
  if (data.total !== ROUND_SIZE || !isPlausibleRun(data)) {
    return jsonError(400, "That run doesn't look plausible.");
  }

  const db = await getDb();
  await db.insert(speedruns).values({
    userId: user.id,
    mode: data.mode,
    scoreMs: data.scoreMs,
    correct: data.correct,
    total: data.total,
  });
  const xp = xpForRun(data.correct);
  await awardXp(user.id, xp, "speedrun");

  return NextResponse.json({ ok: true, xp, correct: data.correct, total: data.total });
}
