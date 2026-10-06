import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { jsonRateLimited, readJson } from "@/lib/api/http";
import { fieldErrors } from "@/lib/auth/schemas";
import {
  appendEntry,
  listStory,
  nextChapter,
  voteEntry,
} from "@/lib/story/store";
import { continueStory } from "@/lib/story/ai";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("write"),
    text: z
      .string()
      .trim()
      .min(40, { error: "Give the story at least a couple of sentences." })
      .max(600, { error: "Keep your chapter under 600 characters." }),
  }),
  z.object({ action: z.literal("vote"), entryId: z.coerce.number().int().min(1) }),
]);

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const entries = await listStory();
  return NextResponse.json({ entries });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!user.onboardedAt) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 409 });
  }

  const body = await readJson(request);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (data.action === "vote") {
    const limit = rateLimit(`story-vote:${clientIp(request.headers)}`, 60, 60_000);
    if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);
    const ok = await voteEntry(data.entryId);
    if (!ok) return NextResponse.json({ error: "Chapter not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const limit = rateLimit(`story:${clientIp(request.headers)}`, 8, 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const before = await listStory();
  const chapter = await nextChapter();
  const entry = await appendEntry(user.id, chapter, data.text);
  const cont = await continueStory(
    [...before, { chapter, text: data.text }],
    chapter + 1
  );
  const aiEntry = await appendEntry(user.id, chapter + 1, cont.text);
  return NextResponse.json({ entry, aiEntry });
}
