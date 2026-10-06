import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { profiles, skillScores, users } from "@/lib/db/schema";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { hashPassword } from "@/lib/auth/password";
import { fieldErrors, normalizeEmail, signupSchema } from "@/lib/auth/schemas";
import { createSession } from "@/lib/auth/session";
import { jsonError, jsonRateLimited, readJson } from "@/lib/api/http";
import { attachReferral } from "@/lib/billing/entitlements";

const BASELINE_SKILLS = [
  "grammar",
  "vocabulary",
  "fluency",
  "pronunciation",
  "listening",
  "writing",
  "speaking",
  "confidence",
  "reading",
  "overall",
] as const;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = clientIp(request.headers);
  const limit = rateLimit(`signup:${ip}`, 10, 5 * 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const body = await readJson(request);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  const email = normalizeEmail(parsed.data.email);
  const db = await getDb();

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return jsonError(409, "An account with this email already exists.", {
      fields: { email: ["An account with this email already exists."] },
    });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const inserted = await db
    .insert(users)
    .values({ email, name: parsed.data.name, passwordHash })
    .returning({ id: users.id });
  const userId = inserted[0]!.id;

  await db.insert(profiles).values({ userId });
  await db.insert(skillScores).values(BASELINE_SKILLS.map((skill) => ({ userId, skill, score: 0 })));

  // Referral attribution (invalid or self codes are silently ignored).
  if (parsed.data.ref) {
    await attachReferral(userId, parsed.data.ref).catch(() => undefined);
  }

  await createSession(userId, request.headers.get("user-agent"));

  return NextResponse.json(
    { user: { id: userId, email, name: parsed.data.name }, redirectTo: "/onboarding" },
    { status: 201 }
  );
}
