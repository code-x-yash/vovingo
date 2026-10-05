import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { courses, exercises, lessonProgress, lessons } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { getOrCreateTodayPlan } from "@/lib/plan/store";
import { ArrowRight, Check, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const CATEGORY_LABEL: Record<string, string> = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  pronunciation: "Pronunciation",
  conversation: "Conversation",
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  professional: "Professional",
  interview: "Interview",
};

export const metadata = { title: "Lessons" };

export default async function LessonsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/lessons");
  if (!user.onboardedAt) redirect("/onboarding");

  const db = await getDb();

  const courseRows = await db
    .select()
    .from(courses)
    .orderBy(asc(courses.orderIndex), asc(courses.id));
  const lessonRows = await db
    .select({
      id: lessons.id,
      slug: lessons.slug,
      title: lessons.title,
      summary: lessons.summary,
      category: lessons.category,
      level: lessons.level,
      durationMin: lessons.durationMin,
      orderIndex: lessons.orderIndex,
      courseId: lessons.courseId,
    })
    .from(lessons)
    .where(eq(lessons.published, true))
    .orderBy(asc(lessons.orderIndex), asc(lessons.id));

  const progressRows = await db
    .select({ lessonId: lessonProgress.lessonId, status: lessonProgress.status })
    .from(lessonProgress)
    .where(eq(lessonProgress.userId, user.id));
  const progressBy = new Map(progressRows.map((p) => [p.lessonId, p.status]));

  const exerciseCounts = await db
    .select({ lessonId: exercises.lessonId, n: sql<number>`count(*)` })
    .from(exercises)
    .groupBy(exercises.lessonId);
  const exerciseCountBy = new Map(exerciseCounts.map((r) => [r.lessonId, Number(r.n)]));

  const lessonsByCourse = new Map<number, typeof lessonRows>();
  for (const l of lessonRows) {
    const list = lessonsByCourse.get(l.courseId ?? -1) ?? [];
    list.push(l);
    lessonsByCourse.set(l.courseId ?? -1, list);
  }

  const totalLessons = lessonRows.length;
  const doneLessons = lessonRows.filter((l) => progressBy.get(l.id) === "completed").length;
  const plan = await getOrCreateTodayPlan(user.id);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-eyebrow">Learn</p>
        <h1 className="text-h1 mt-2.5">Lessons</h1>
        <p className="mt-1.5 max-w-lg text-[15px] text-muted-foreground">
          Build the skills you need to communicate naturally.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{doneLessons}</span> of {totalLessons}{" "}
            completed
          </span>
          {plan.focus && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 font-medium text-primary">
              Current focus: {plan.focus}
              <ArrowRight className="size-3" />
            </span>
          )}
        </div>
      </header>

      {courseRows.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No courses yet — run <code className="font-mono">npm run db:seed</code> to load content.
        </div>
      )}

      <div className="mt-8 space-y-8">
        {courseRows.map((course) => {
          const list = lessonsByCourse.get(course.id) ?? [];
          const done = list.filter((l) => progressBy.get(l.id) === "completed").length;
          const pct = list.length > 0 ? Math.round((done / list.length) * 100) : 0;

          return (
            <section key={course.id} className="animate-fade-up">
              <div className="flex items-end justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3.5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[var(--brand-1)]/15 to-[var(--brand-2)]/15 text-lg">
                    {course.icon}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-h2 truncate">{course.title}</h2>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      {LEVEL_LABEL[course.level] ?? course.level} · {course.category} ·{" "}
                      {list.length} lessons
                    </p>
                  </div>
                </div>
                <div className="hidden w-40 shrink-0 text-right sm:block">
                  <p className="text-xs font-medium tabular-nums">
                    {done}/{list.length} done
                  </p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-2)] transition-all duration-700 ease-ui"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>

              <ol className="relative mt-5 ml-5 border-l border-border">
                {list.map((lesson, i) => {
                  const status = progressBy.get(lesson.id);
                  const isDone = status === "completed";
                  const started = status === "in_progress";
                  const last = i === list.length - 1;
                  return (
                    <li key={lesson.id} className={cn(!last && "pb-1")}>
                      <Link
                        href={`/lessons/${lesson.slug}`}
                        className="group -ml-[9px] flex items-center gap-3.5 rounded-xl px-1 py-2.5 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40 sm:px-2"
                      >
                        <span
                          className={cn(
                            "relative z-10 grid size-[18px] shrink-0 place-items-center rounded-full border-2 transition-colors",
                            isDone
                              ? "border-primary bg-primary text-primary-foreground"
                              : started
                                ? "border-primary bg-background text-primary"
                                : "border-border bg-background text-transparent group-hover:border-primary/40"
                          )}
                        >
                          {isDone ? (
                            <Check className="size-3" strokeWidth={3} />
                          ) : started ? (
                            <PlayCircle className="size-3" />
                          ) : null}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium transition-colors group-hover:text-primary">
                            {lesson.title}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {CATEGORY_LABEL[lesson.category] ?? lesson.category} ·{" "}
                            {lesson.durationMin} min ·{" "}
                            {exerciseCountBy.get(lesson.id) ?? 0} exercises
                          </span>
                        </span>

                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70 tabular-nums">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
