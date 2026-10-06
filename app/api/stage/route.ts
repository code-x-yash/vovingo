import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { jsonRateLimited, readJson } from "@/lib/api/http";
import { fieldErrors } from "@/lib/auth/schemas";
import { enforceQuota, recordUsage } from "@/lib/billing/entitlements";
import { awardXp } from "@/lib/progress/leaderboard";
import {
  STAGE_PROMPTS,
  judgeStage,
  pickStagePrompt,
  promptById,
} from "@/lib/stage/engine";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), promptId: z.string().trim().min(1).optional() }),
  z.object({
    action: z.literal("submit"),
    promptId: z.string().trim().min(1),
    take: z
      .string()
      .trim()
      .min(40, { error: "Give the audience at least a couple of sentences." })
      .max(800, { error: "Keep the take under 800 characters." }),
  }),
]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!user.onboardedAt) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 409 });
  }

  const limit = rateLimit(`stage:${clientIp(request.headers)}`, 12, 60_000);
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
    const denied = await enforceQuota(user.id, "stage");
    if (denied) return denied;

    if (data.promptId) {
      const prompt = promptById(data.promptId);
      if (!prompt) return NextResponse.json({ error: "Unknown prompt." }, { status: 404 });
      return NextResponse.json({ prompt });
    }
    const prompt = pickStagePrompt(Math.floor(Math.random() * STAGE_PROMPTS.length));
    return NextResponse.json({ prompt });
  }

  const denied = await enforceQuota(user.id, "stage");
  if (denied) return denied;

  const prompt = promptById(data.promptId);
  if (!prompt) return NextResponse.json({ error: "Unknown prompt." }, { status: 404 });

  const { verdict } = await judgeStage(prompt, data.take);
  await recordUsage(user.id, "stage");
  const xp = verdict.cheers >= 85 ? 15 : verdict.cheers >= 55 ? 10 : 7;
  await awardXp(user.id, xp, "stage");
  return NextResponse.json({ verdict, xp });
}
