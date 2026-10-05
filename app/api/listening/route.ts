import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { jsonRateLimited, readJson } from "@/lib/api/http";
import { fieldErrors } from "@/lib/auth/schemas";
import {
  getListeningDetail,
  listPodcasts,
  submitListening,
} from "@/lib/listening/store";

const submitSchema = z.object({
  podcastId: z.coerce.number().int().min(1),
  answers: z
    .array(z.number().int().min(0).max(10).nullable())
    .max(20, { error: "Too many answers." })
    .default([]),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const idParam = request.nextUrl.searchParams.get("id");
  if (idParam) {
    const podcastId = Number(idParam);
    if (!Number.isInteger(podcastId) || podcastId < 1) {
      return NextResponse.json({ error: "Unknown episode." }, { status: 400 });
    }
    const detail = await getListeningDetail(user.id, podcastId);
    if (!detail) return NextResponse.json({ error: "Episode not found." }, { status: 404 });
    return NextResponse.json(detail);
  }

  const items = await listPodcasts(user.id);
  return NextResponse.json({ podcasts: items });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!user.onboardedAt) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 409 });
  }

  const limit = rateLimit(`listening:${clientIp(request.headers)}`, 20, 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const body = await readJson(request);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  const result = await submitListening(user.id, parsed.data.podcastId, parsed.data.answers);
  if (!result.ok) {
    const status = result.code === "not_found" ? 404 : 409;
    const message = result.code === "not_found" ? "Episode not found." : "No questions yet.";
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json(result);
}
