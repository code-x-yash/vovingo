import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { jsonRateLimited, readJson } from "@/lib/api/http";
import { fieldErrors } from "@/lib/auth/schemas";
import { writingPrompts } from "@/lib/content/writing-prompts";
import { listRecentWritings, submitWriting } from "@/lib/writing/store";
import { enforceQuota, recordUsage } from "@/lib/billing/entitlements";

const submitSchema = z.object({
  slug: z.string().trim().min(1).max(60),
  text: z
    .string()
    .trim()
    .min(20, { error: "Write a bit more before submitting." })
    .max(4000, { error: "Keep it under 4000 characters." }),
});

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const recent = await listRecentWritings(user.id);
  return NextResponse.json({ prompts: writingPrompts, recent });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!user.onboardedAt) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 409 });
  }

  const limit = rateLimit(`writing:${clientIp(request.headers)}`, 20, 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const body = await readJson(request);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  const denied = await enforceQuota(user.id, "writing");
  if (denied) return denied;

  const result = await submitWriting(user.id, parsed.data.slug, parsed.data.text);
  if (!result.ok) {
    if (result.code === "not_found") {
      return NextResponse.json({ error: "Prompt not found." }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: `Write at least ${result.minWords} words (you have ${result.current}).`,
        minWords: result.minWords,
        current: result.current,
      },
      { status: 422 }
    );
  }
  await recordUsage(user.id, "writing", { slug: parsed.data.slug });
  return NextResponse.json(result);
}
