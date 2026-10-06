import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { jsonRateLimited, readJson } from "@/lib/api/http";
import { fieldErrors } from "@/lib/auth/schemas";
import { enforceQuota, recordUsage } from "@/lib/billing/entitlements";
import { awardXp } from "@/lib/progress/leaderboard";
import { DUEL_TOPICS, judgeDuel, pickTopic, topicById } from "@/lib/duel/engine";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), topicId: z.string().trim().min(1).optional() }),
  z.object({
    action: z.literal("submit"),
    topicId: z.string().trim().min(1),
    bar: z
      .string()
      .trim()
      .min(16, { error: "Give us at least a couple of lines — that's too short to judge." })
      .max(400, { error: "Keep the bar under 400 characters." }),
  }),
]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!user.onboardedAt) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 409 });
  }

  const limit = rateLimit(`duel:${clientIp(request.headers)}`, 12, 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const body = await readJson(request);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (data.action === "start") {
    const denied = await enforceQuota(user.id, "duel");
    if (denied) return denied;

    if (data.topicId) {
      const topic = topicById(data.topicId);
      if (!topic) return NextResponse.json({ error: "Unknown topic." }, { status: 404 });
      return NextResponse.json({ topic });
    }
    const topic = pickTopic(Math.floor(Math.random() * DUEL_TOPICS.length));
    return NextResponse.json({ topic });
  }

  const denied = await enforceQuota(user.id, "duel");
  if (denied) return denied;

  const topic = topicById(data.topicId);
  if (!topic) return NextResponse.json({ error: "Unknown topic." }, { status: 404 });

  const { verdict } = await judgeDuel(topic, data.bar);
  await recordUsage(user.id, "duel");
  const xp = verdict.winner === "you" ? 15 : verdict.winner === "tie" ? 10 : 7;
  await awardXp(user.id, xp, "duel");
  return NextResponse.json({ verdict, xp });
}
