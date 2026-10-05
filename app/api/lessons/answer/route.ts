import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { answers, exercises, lessonProgress, lessons, skillScores } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { jsonRateLimited, readJson } from "@/lib/api/http";
import { fieldErrors } from "@/lib/auth/schemas";
import { gradeExercise } from "@/lib/exercises/grade";
import { completePlanItemsByRef, selectToday } from "@/lib/plan/store";

const answerSchema = z.object({
  exerciseId: z.coerce.number().int().min(1),
  response: z.union([
    z.string().max(4000),
    z.array(z.string().max(300)).min(1).max(20),
  ]),
});

const bumpScore = (base: number, correct: boolean | null): number => {
  if (correct === true) return Math.min(100, base + Math.max(4, (100 - base) * 0.06));
  if (correct === false) return Math.max(0, base * 0.96);
  return Math.min(100, base + 1); // open exercise: attempted production practice
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!user.onboardedAt) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 409 });
  }

  const limit = rateLimit(`answer:${clientIp(request.headers)}`, 90, 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const body = await readJson(request);
  const parsed = answerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  const { exerciseId, response } = parsed.data;
  const db = await getDb();

  const exerciseRows = await db
    .select({
      id: exercises.id,
      lessonId: exercises.lessonId,
      type: exercises.type,
      skill: exercises.skill,
      prompt: exercises.prompt,
      options: exercises.options,
      correctAnswer: exercises.correctAnswer,
      explanation: exercises.explanation,
      lessonTitle: lessons.title,
      lessonSlug: lessons.slug,
    })
    .from(exercises)
    .innerJoin(lessons, eq(exercises.lessonId, lessons.id))
    .where(and(eq(exercises.id, exerciseId), eq(lessons.published, true)))
    .limit(1);

  const ex = exerciseRows[0];
  if (!ex || !ex.lessonId) {
    return NextResponse.json({ error: "That exercise no longer exists." }, { status: 404 });
  }

  const isEmpty =
    typeof response === "string" ? response.trim().length === 0 : response.join(" ").trim().length === 0;
  if (isEmpty) {
    return NextResponse.json({ error: "Submit an answer first." }, { status: 400 });
  }

  const grade = gradeExercise(
    {
      type: ex.type,
      prompt: ex.prompt,
      options: ex.options,
      correctAnswer: ex.correctAnswer,
      explanation: ex.explanation,
    },
    response
  );

  await db.insert(answers).values({
    userId: user.id,
    exerciseId: ex.id,
    response: { value: response },
    correct: grade.correct ?? false,
  });

  const counts = await db
    .select({
      total: sql<number>`count(*)`,
      gradedTotal: sql<number>`sum(case when ${exercises.correctAnswer} is not null then 1 else 0 end)`,
    })
    .from(exercises)
    .where(eq(exercises.lessonId, ex.lessonId));

  const answeredRows = await db
    .select({ n: sql<number>`count(distinct ${answers.exerciseId})` })
    .from(answers)
    .innerJoin(exercises, eq(answers.exerciseId, exercises.id))
    .where(and(eq(answers.userId, user.id), eq(exercises.lessonId, ex.lessonId)));

  const correctRows = await db
    .select({ n: sql<number>`count(distinct ${answers.exerciseId})` })
    .from(answers)
    .innerJoin(exercises, eq(answers.exerciseId, exercises.id))
    .where(
      and(
        eq(answers.userId, user.id),
        eq(exercises.lessonId, ex.lessonId),
        eq(answers.correct, true),
        isNotNull(exercises.correctAnswer)
      )
    );

  const total = Number(counts[0]?.total ?? 0);
  const gradedTotal = Number(counts[0]?.gradedTotal ?? 0);
  const answered = Number(answeredRows[0]?.n ?? 0);
  const correct = Number(correctRows[0]?.n ?? 0);
  const completed = total > 0 && answered >= total;
  const score = gradedTotal > 0 ? Math.round((correct / gradedTotal) * 100) : null;

  const now = new Date();
  const priorRows = await db
    .select()
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, user.id), eq(lessonProgress.lessonId, ex.lessonId)))
    .limit(1);
  const prior = priorRows[0];

  const progressValues = {
    exercisesDone: answered,
    exercisesTotal: total,
    score,
    status: completed ? ("completed" as const) : ("in_progress" as const),
    completedAt: completed && !prior?.completedAt ? now : (prior?.completedAt ?? null),
    lastPracticedAt: now,
    updatedAt: now,
  };

  if (prior) {
    await db.update(lessonProgress).set(progressValues).where(eq(lessonProgress.id, prior.id));
  } else {
    await db
      .insert(lessonProgress)
      .values({ userId: user.id, lessonId: ex.lessonId, createdAt: now, ...progressValues });
  }

  const skillRows = await db
    .select({ id: skillScores.id, score: skillScores.score })
    .from(skillScores)
    .where(and(eq(skillScores.userId, user.id), eq(skillScores.skill, ex.skill)))
    .limit(1);

  const base = skillRows[0]?.score ?? 50;
  const nextScore = Math.round(bumpScore(base, grade.correct) * 100) / 100;
  if (skillRows[0]) {
    await db
      .update(skillScores)
      .set({ score: nextScore, updatedAt: now })
      .where(eq(skillScores.id, skillRows[0].id));
  } else {
    await db.insert(skillScores).values({ userId: user.id, skill: ex.skill, score: nextScore });
  }

  let planXp = 0;
  if (completed && prior?.status !== "completed") {
    const plan = await selectToday(user.id);
    if (plan) {
      const outcome = await completePlanItemsByRef(user.id, plan, {
        type: "lesson",
        id: ex.lessonId,
      });
      if (outcome.ok) planXp = outcome.xpGained;
    }
  }

  return NextResponse.json({
    ok: true,
    correct: grade.correct,
    feedback: grade.feedback,
    expected: grade.expected,
    progress: { answered, total, completed, score, skills: { [ex.skill]: nextScore } },
    planXp,
  });
}
