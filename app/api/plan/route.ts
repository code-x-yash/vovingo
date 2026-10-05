import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { jsonRateLimited, readJson } from "@/lib/api/http";
import { fieldErrors } from "@/lib/auth/schemas";
import {
  completePlanItem,
  findStreak,
  getOrCreateTodayPlan,
  regenerateTodayPlan,
} from "@/lib/plan/store";
import { EMPTY_STREAK } from "@/lib/plan/streak";

const planActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("complete"), index: z.number().int().min(0).max(99) }),
  z.object({ action: z.literal("regenerate") }),
]);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!user.onboardedAt) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 409 });
  }

  const limit = rateLimit(`plan:${clientIp(request.headers)}`, 60, 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const plan = await getOrCreateTodayPlan(user.id);
  const streak = (await findStreak(user.id)) ?? EMPTY_STREAK;
  return NextResponse.json({ plan, streak });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!user.onboardedAt) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 409 });
  }

  const limit = rateLimit(`plan:${clientIp(request.headers)}`, 60, 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const body = await readJson(request);
  const parsed = planActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (data.action === "regenerate") {
    const plan = await regenerateTodayPlan(user.id);
    const streak = (await findStreak(user.id)) ?? EMPTY_STREAK;
    return NextResponse.json({ ok: true, plan, streak });
  }

  const plan = await getOrCreateTodayPlan(user.id);
  const outcome = await completePlanItem(user.id, plan, data.index);
  if (!outcome.ok) {
    return NextResponse.json({ error: "That plan item no longer exists." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    plan: outcome.plan,
    streak: outcome.streak,
    xpGained: outcome.xpGained,
  });
}
