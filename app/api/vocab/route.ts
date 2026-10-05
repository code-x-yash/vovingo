import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { jsonRateLimited, readJson } from "@/lib/api/http";
import { fieldErrors } from "@/lib/auth/schemas";
import {
  LIBRARY_PAGE_SIZE,
  addWord,
  dueWords,
  getDueCount,
  removeWord,
  reviewWord,
  searchVocabulary,
} from "@/lib/vocab/store";

const vocabActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), wordId: z.coerce.number().int().min(1) }),
  z.object({ action: z.literal("remove"), wordId: z.coerce.number().int().min(1) }),
  z.object({
    action: z.literal("review"),
    wordId: z.coerce.number().int().min(1),
    rating: z.enum(["again", "hard", "good", "easy"]),
  }),
]);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!user.onboardedAt) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 409 });
  }

  const limit = rateLimit(`vocab:${clientIp(request.headers)}`, 60, 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const sp = request.nextUrl.searchParams;

  if (sp.get("mode") === "due") {
    const [count, words] = await Promise.all([getDueCount(user.id), dueWords(user.id, 60)]);
    return NextResponse.json({ dueCount: count, words });
  }

  const q = sp.get("q")?.trim() || undefined;
  const category = sp.get("category")?.trim() || undefined;
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);

  const [library, dueCount] = await Promise.all([
    searchVocabulary({ userId: user.id, q, category, page }),
    getDueCount(user.id),
  ]);

  return NextResponse.json({
    items: library.items,
    total: library.total,
    page,
    pageSize: LIBRARY_PAGE_SIZE,
    dueCount,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!user.onboardedAt) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 409 });
  }

  const limit = rateLimit(`vocab:${clientIp(request.headers)}`, 60, 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const body = await readJson(request);
  const parsed = vocabActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (data.action === "add") {
    await addWord(user.id, data.wordId);
    return NextResponse.json({ ok: true, inVocab: true, dueCount: await getDueCount(user.id) });
  }

  if (data.action === "remove") {
    await removeWord(user.id, data.wordId);
    return NextResponse.json({ ok: true, inVocab: false, dueCount: await getDueCount(user.id) });
  }

  const outcome = await reviewWord(user.id, data.wordId, data.rating);
  if (!outcome) {
    return NextResponse.json({ error: "That word is not in your review list." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    remaining: outcome.remaining,
    nextDueAt: outcome.nextDueAt.toISOString(),
    state: outcome.state,
    planXp: outcome.planXp,
  });
}
