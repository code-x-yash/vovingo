import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { jsonRateLimited, readJson } from "@/lib/api/http";
import { fieldErrors } from "@/lib/auth/schemas";
import { enforceQuota, recordUsage } from "@/lib/billing/entitlements";
import { completeOrFallback } from "@/lib/ai/complete";
import {
  REGISTERS,
  TONE_SYSTEM_PROMPT,
  heuristicRegister,
  heuristicTone,
  parseToneReport,
  tonePrompt,
} from "@/lib/ai/tone";

const text = z.string().trim().min(1, { error: "Paste some text first." }).max(3000, {
  error: "Keep it under 3000 characters.",
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("check"), text }),
  z.object({ action: z.literal("register"), text, register: z.enum(REGISTERS) }),
]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!user.onboardedAt) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 409 });
  }

  const limit = rateLimit(`tone:${clientIp(request.headers)}`, 30, 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const body = await readJson(request);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  const denied = await enforceQuota(user.id, "tone");
  if (denied) return denied;

  const data = parsed.data;

  if (data.action === "check") {
    const heuristic = heuristicTone(data.text);
    const { text: raw, usedModel } = await completeOrFallback({
      system: TONE_SYSTEM_PROMPT,
      prompt: tonePrompt(data.text),
      maxTokens: 400,
      temperature: 0.2,
      mock: JSON.stringify(heuristic),
    });
    const report = (usedModel ? parseToneReport(raw) : null) ?? heuristic;
    await recordUsage(user.id, "tone", { action: "check" });
    return NextResponse.json({ ok: true, report, usedModel });
  }

  const mock = heuristicRegister(data.text, data.register);
  const { text: rewritten, usedModel } = await completeOrFallback({
    system:
      `Rewrite the user's text in ${data.register} register. Preserve meaning and roughly the same length. ` +
      "Return ONLY the rewritten text — no preamble, no quotes, no notes.",
    prompt: data.text,
    maxTokens: 700,
    temperature: 0.5,
    mock,
  });
  const output = rewritten || mock;
  if (!output) {
    return NextResponse.json({ error: "Couldn't rewrite that text." }, { status: 502 });
  }
  await recordUsage(user.id, "tone", { action: "register", register: data.register });
  return NextResponse.json({ ok: true, output, usedModel });
}
