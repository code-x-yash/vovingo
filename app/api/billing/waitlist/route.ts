import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod";
import { getDb } from "@/lib/db";
import { proWaitlist } from "@/lib/db/schema";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { jsonRateLimited, readJson } from "@/lib/api/http";
import { fieldErrors } from "@/lib/auth/schemas";

const waitlistSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200) });

/** Pro waitlist — used when no payment provider is configured (pre-revenue). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const limit = rateLimit(`waitlist:${clientIp(request.headers)}`, 5, 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const body = await readJson(request);
  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  const db = await getDb();
  await db
    .insert(proWaitlist)
    .values({ email: parsed.data.email, source: "pricing" })
    .onConflictDoNothing({ target: [proWaitlist.email] });

  return NextResponse.json({ ok: true });
}
