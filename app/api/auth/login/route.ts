import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { verifyPassword } from "@/lib/auth/password";
import { fieldErrors, loginSchema, normalizeEmail } from "@/lib/auth/schemas";
import { createSession } from "@/lib/auth/session";
import { jsonRateLimited, readJson } from "@/lib/api/http";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = clientIp(request.headers);
  const limit = rateLimit(`login:${ip}`, 15, 5 * 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const body = await readJson(request);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  const email = normalizeEmail(parsed.data.email);
  const db = await getDb();
  const rows = await db
    .select({ id: users.id, passwordHash: users.passwordHash, status: users.status, name: users.name })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = rows[0];
  // Same error for unknown email and wrong password — no account enumeration.
  const invalid = () =>
    NextResponse.json({ error: "Incorrect email or password.", fields: { form: ["Incorrect email or password."] } }, { status: 401 });

  if (!user || !user.passwordHash || user.status !== "active") return invalid();
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return invalid();

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await createSession(user.id, request.headers.get("user-agent"));

  return NextResponse.json({ user: { id: user.id, email, name: user.name }, redirectTo: "/dashboard" });
}
