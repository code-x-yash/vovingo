import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod";
import { getDb } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { jsonError, readJson } from "@/lib/api/http";
import { fieldErrors } from "@/lib/auth/schemas";

const settingsSchema = z.object({
  dailyGoalMinutes: z.union([
    z.literal(10),
    z.literal(20),
    z.literal(30),
    z.literal(45),
  ]),
  workoutReminderAt: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Use a time like 07:30." })
    .nullable()
    .optional(),
});

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Not authenticated.");

  const db = await getDb();
  const rows = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, user.id))
    .limit(1);
  const row = rows[0];
  return NextResponse.json({
    dailyGoalMinutes: row?.dailyGoalMinutes ?? 20,
    workoutReminderAt: row?.workoutReminderAt ?? null,
  });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Not authenticated.");

  const body = await readJson(request);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  const db = await getDb();
  const now = new Date();
  await db
    .insert(userSettings)
    .values({
      userId: user.id,
      dailyGoalMinutes: parsed.data.dailyGoalMinutes,
      workoutReminderAt: parsed.data.workoutReminderAt ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        dailyGoalMinutes: parsed.data.dailyGoalMinutes,
        workoutReminderAt: parsed.data.workoutReminderAt ?? null,
        updatedAt: now,
      },
    });

  return NextResponse.json({ ok: true });
}
