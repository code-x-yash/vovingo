import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { profiles, skillScores } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { jsonRateLimited, readJson } from "@/lib/api/http";
import { fieldErrors } from "@/lib/auth/schemas";
import { LEVEL_BASELINE, PLACEMENT_QUESTIONS, scorePlacement } from "@/lib/content/placement";

/** Questions without answers — safe to ship to the client. */
export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  return NextResponse.json({
    questions: PLACEMENT_QUESTIONS.map((q, index) => ({
      index,
      prompt: q.prompt,
      options: q.options,
      skill: q.skill,
      difficulty: q.difficulty,
    })),
  });
}

const submitSchema = z.object({
  answers: z.array(z.number().int().min(-1)).max(PLACEMENT_QUESTIONS.length),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const limit = rateLimit(`placement:${clientIp(request.headers)}`, 20, 5 * 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const body = await readJson(request);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid submission.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  const result = scorePlacement(parsed.data.answers);
  const baseline = LEVEL_BASELINE[result.level];
  const now = new Date();

  const db = await getDb();
  await db
    .update(profiles)
    .set({
      englishLevel: result.level,
      preferredDifficulty: baseline,
      placementCompletedAt: now,
      onboardedAt: now,
      updatedAt: now,
    })
    .where(eq(profiles.userId, user.id));

  // Overall comes from the weighted ratio; per-skill from that skill's
  // questions; skills the test didn't sample start slightly below overall.
  const allSkills = [
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

  const overall = Math.round(result.ratio * 100);
  const rows = allSkills.map((skill) => {
    const measured = result.perSkill[skill];
    const score = skill === "overall" ? overall : (measured ?? Math.round(overall * 0.7));
    return { userId: user.id, skill, score };
  });

  for (const row of rows) {
    await db
      .insert(skillScores)
      .values(row)
      .onConflictDoUpdate({
        target: [skillScores.userId, skillScores.skill],
        set: { score: row.score, updatedAt: now },
      });
  }

  return NextResponse.json({
    ok: true,
    level: result.level,
    correct: result.correctCount,
    total: result.total,
    ratio: result.ratio,
    next: "/dashboard",
  });
}
