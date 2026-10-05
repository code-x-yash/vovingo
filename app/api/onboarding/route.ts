import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { learningGoals, profiles, users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { jsonRateLimited, readJson } from "@/lib/api/http";
import { fieldErrors } from "@/lib/auth/schemas";

const onboardingSchema = z.object({
  goals: z
    .array(z.string().trim().min(1).max(60))
    .min(1, { error: "Pick at least one goal." })
    .max(8, { error: "Pick up to 8 goals." }),
  nativeLanguage: z.string().trim().min(2).max(40).default("hindi"),
  profession: z.string().trim().max(60).optional().default(""),
  dailyMinutes: z.coerce.number().int().min(5).max(180).default(20),
  englishLevel: z.enum([
    "complete_beginner",
    "beginner",
    "elementary",
    "intermediate",
    "upper_intermediate",
    "advanced",
    "unsure",
  ]),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const limit = rateLimit(`onboarding:${clientIp(request.headers)}`, 30, 5 * 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const body = await readJson(request);
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const db = await getDb();
  const now = new Date();

  await db
    .update(profiles)
    .set({
      nativeLanguage: data.nativeLanguage,
      profession: data.profession || null,
      dailyMinutes: data.dailyMinutes,
      englishLevel: data.englishLevel,
      onboardedAt: now,
      updatedAt: now,
    })
    .where(eq(profiles.userId, user.id));

  // Replace the goal set wholesale — onboarding is the single writer.
  await db.delete(learningGoals).where(eq(learningGoals.userId, user.id));
  if (data.goals.length > 0) {
    await db.insert(learningGoals).values(data.goals.map((goal) => ({ userId: user.id, goal })));
  }

  await db.update(users).set({ updatedAt: now }).where(eq(users.id, user.id));

  return NextResponse.json({
    ok: true,
    next: data.englishLevel === "unsure" ? "/placement" : "/dashboard",
  });
}
