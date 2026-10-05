import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { jsonRateLimited, readJson } from "@/lib/api/http";
import { fieldErrors } from "@/lib/auth/schemas";
import {
  getUserMistakeDetail,
  listUserMistakes,
  loadPracticePool,
  saveMistakePractice,
} from "@/lib/mistakes/store";
import { buildPracticeQuestions, toPublicQuestions } from "@/lib/mistakes/practice";

const practiceSchema = z.object({
  mistakeId: z.coerce.number().int().min(1),
  answers: z.array(z.union([z.number().int().min(0).max(20), z.null()])).min(1).max(10),
  durationSec: z.coerce.number().int().min(0).max(3600),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const idParam = request.nextUrl.searchParams.get("id");
  if (idParam) {
    const mistakeId = Number(idParam);
    if (!Number.isInteger(mistakeId) || mistakeId < 1) {
      return NextResponse.json({ error: "Unknown pattern." }, { status: 400 });
    }
    const detail = await getUserMistakeDetail(user.id, mistakeId);
    if (!detail) return NextResponse.json({ error: "Pattern not found." }, { status: 404 });
    const pool = await loadPracticePool(mistakeId);
    const questions = buildPracticeQuestions(
      {
        id: detail.mistake.id,
        key: detail.mistake.key,
        title: detail.mistake.title,
        category: detail.mistake.category,
        wrongExample: detail.mistake.wrongExample,
        correctExample: detail.mistake.correctExample,
        why: detail.mistake.why,
      },
      pool,
      mistakeId
    );
    return NextResponse.json({ ...detail, questions: toPublicQuestions(questions) });
  }

  const list = await listUserMistakes(user.id);
  return NextResponse.json(list);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!user.onboardedAt) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 409 });
  }

  const limit = rateLimit(`practice:${clientIp(request.headers)}`, 30, 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const body = await readJson(request);
  const parsed = practiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  const { mistakeId, answers, durationSec } = parsed.data;
  const outcome = await saveMistakePractice(user.id, mistakeId, answers, durationSec);

  if (!outcome.ok) {
    if (outcome.code === "no_questions") {
      return NextResponse.json(
        { error: "This pattern has no practice questions yet." },
        { status: 422 }
      );
    }
    const status = outcome.code === "not_found" ? 404 : 409;
    return NextResponse.json({ error: "Pattern not available." }, { status });
  }

  const { results, correctCount, total, score, practiceCount, trend, status, planXp, skill } =
    outcome;
  return NextResponse.json({
    ok: true,
    mistakeId,
    results,
    correctCount,
    total,
    score,
    practiceCount,
    trend,
    status,
    planXp,
    skill,
  });
}
