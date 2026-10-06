import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { scenarios } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { jsonRateLimited, readJson } from "@/lib/api/http";
import { fieldErrors } from "@/lib/auth/schemas";
import { getSpeakingFeed, submitSpeaking } from "@/lib/speaking/store";
import { enforceQuota, recordUsage } from "@/lib/billing/entitlements";

const submitSchema = z.object({
  mode: z.enum(["free", "topic", "situation", "roleplay"]),
  scenarioId: z.coerce.number().int().min(1).nullish(),
  prompt: z.string().trim().max(300).optional().default(""),
  transcript: z
    .string()
    .trim()
    .max(6000)
    .refine((t) => t.split(/\s+/).filter(Boolean).length >= 3, {
      error: "Give at least 3 words to analyse.",
    }),
  durationSec: z.coerce.number().int().min(1).max(1800),
});

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!user.onboardedAt) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 409 });
  }

  const feed = await getSpeakingFeed(user.id);
  return NextResponse.json(feed);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!user.onboardedAt) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 409 });
  }

  const limit = rateLimit(`speaking:${clientIp(request.headers)}`, 15, 60_000);
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

  const denied = await enforceQuota(user.id, "speaking");
  if (denied) return denied;

  let scenarioId: number | null = null;
  let prompt = data.prompt;

  if (data.scenarioId != null) {
    const db = await getDb();
    const rows = await db
      .select({ id: scenarios.id, title: scenarios.title, openingPrompt: scenarios.openingPrompt })
      .from(scenarios)
      .where(eq(scenarios.id, data.scenarioId))
      .limit(1);
    const scenario = rows[0];
    if (!scenario) {
      return NextResponse.json({ error: "That scenario no longer exists." }, { status: 404 });
    }
    scenarioId = scenario.id;
    if (!prompt) prompt = scenario.openingPrompt ?? scenario.title;
  }

  if (!prompt) prompt = "Speak freely — any topic you like.";

  const outcome = await submitSpeaking({
    userId: user.id,
    mode: data.mode,
    scenarioId,
    prompt,
    transcript: data.transcript,
    durationSec: data.durationSec,
  });

  await recordUsage(user.id, "speaking", { mode: data.mode });

  return NextResponse.json({
    ok: true,
    sessionId: outcome.sessionId,
    analysis: {
      summary: outcome.analysis.summary,
      scores: outcome.analysis.scores,
      metrics: outcome.analysis.metrics,
      mistakes: outcome.analysis.mistakes,
      recommendations: outcome.analysis.recommendations,
      emotion: outcome.analysis.emotion,
    },
    planXp: outcome.planXp,
  });
}
