import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { answers, courses, exercises, lessonProgress, lessons, type LessonBlock } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { blankCountFor, type ExerciseLike } from "@/lib/exercises/grade";
import { Check, ChevronLeft, ChevronRight, Lightbulb, Quote, Volume2, X } from "lucide-react";
import { LessonRunner, type RunnerExercise } from "./runner";

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

function BlockView({ block }: { block: LessonBlock }) {
  const card = "rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5";
  switch (block.type) {
    case "concept":
      return (
        <section className={card}>
          <h3 className="mb-2.5 flex items-center gap-2 text-[15px] font-semibold">
            <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary">
              <Lightbulb className="size-3.5" />
            </span>
            {block.title}
          </h3>
          <p className="text-[15px] leading-relaxed text-muted-foreground">{block.body}</p>
        </section>
      );
    case "example":
      return (
        <section className={card}>
          <div className="space-y-2.5 text-[15px]">
            {block.wrong && (
              <p className="flex items-start gap-2.5 text-destructive">
                <X className="mt-1 size-4 shrink-0" strokeWidth={2.5} />
                <span className="line-through decoration-destructive/50">{block.wrong}</span>
              </p>
            )}
            <p className="flex items-start gap-2.5 text-foreground">
              <Check className="mt-1 size-4 shrink-0 text-primary" strokeWidth={2.5} />
              <span>{block.right}</span>
            </p>
            {block.note && (
              <p className="pl-6.5 text-xs leading-relaxed text-muted-foreground">{block.note}</p>
            )}
          </div>
        </section>
      );
    case "tips":
      return (
        <section className={card}>
          <h3 className="mb-2.5 text-[15px] font-semibold">Watch out for</h3>
          <ul className="space-y-2">
            {block.items.map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span
                  aria-hidden
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60"
                />
                {tip}
              </li>
            ))}
          </ul>
        </section>
      );
    case "dialogue":
      return (
        <section className={card}>
          <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
            <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary">
              <Quote className="size-3.5" />
            </span>
            Dialogue
          </h3>
          <div className="space-y-2.5">
            {block.lines.map((line, i) => (
              <p key={i} className="text-sm leading-relaxed">
                <span className="font-semibold">{line.speaker}: </span>
                <span className="text-muted-foreground">{line.text}</span>
              </p>
            ))}
          </div>
        </section>
      );
    case "audio":
      return (
        <section className={`${card} text-sm`}>
          <div className="flex items-center gap-2 font-medium">
            <span className="grid size-6 place-items-center rounded-md bg-primary/10 text-primary">
              <Volume2 className="size-3.5" />
            </span>
            Audio
            {block.caption && <span className="text-muted-foreground">— {block.caption}</span>}
          </div>
          <audio controls preload="none" src={block.url} className="mt-3 w-full" />
        </section>
      );
    case "video":
      return (
        <section className={`${card} text-sm`}>
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">
              Video{" "}
              {block.caption && <span className="text-muted-foreground">— {block.caption}</span>}
            </span>
            <a
              href={block.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              Watch
            </a>
          </div>
        </section>
      );
    default:
      return null;
  }
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/lessons/${slug}`);
  if (!user.onboardedAt) redirect("/onboarding");

  const db = await getDb();

  const lessonRows = await db
    .select({
      id: lessons.id,
      slug: lessons.slug,
      title: lessons.title,
      summary: lessons.summary,
      category: lessons.category,
      level: lessons.level,
      durationMin: lessons.durationMin,
      skillFocus: lessons.skillFocus,
      content: lessons.content,
      courseId: lessons.courseId,
    })
    .from(lessons)
    .where(eq(lessons.published, true))
    .orderBy(asc(lessons.id));

  const lesson = lessonRows.find((l) => l.slug === slug);
  if (!lesson) notFound();

  const exerciseRows = await db
    .select({
      id: exercises.id,
      type: exercises.type,
      skill: exercises.skill,
      prompt: exercises.prompt,
      options: exercises.options,
      correctAnswer: exercises.correctAnswer,
      explanation: exercises.explanation,
      orderIndex: exercises.orderIndex,
    })
    .from(exercises)
    .where(eq(exercises.lessonId, lesson.id))
    .orderBy(asc(exercises.orderIndex), asc(exercises.id));

  const priorAnswerRows = await db
    .select({ exerciseId: answers.exerciseId, correct: answers.correct, createdAt: answers.createdAt })
    .from(answers)
    .where(inArray(answers.exerciseId, exerciseRows.map((e) => e.id)))
    .orderBy(asc(answers.id));
  const bestBy = new Map<number, boolean>();
  for (const a of priorAnswerRows) {
    const prev = bestBy.get(a.exerciseId);
    bestBy.set(a.exerciseId, (prev ?? false) || a.correct);
  }

  const progressRows = await db
    .select()
    .from(lessonProgress)
    .where(eq(lessonProgress.userId, user.id))
    .orderBy(asc(lessonProgress.lessonId));
  const progress = progressRows.find((p) => p.lessonId === lesson.id);

  const course = lesson.courseId
    ? (await db.select().from(courses).where(eq(courses.id, lesson.courseId)).limit(1))[0]
    : undefined;

  const ordered = lessonRows
    .filter((l) => (course ? l.courseId === course.id : true))
    .sort((a, b) => a.id - b.id);
  const pos = ordered.findIndex((l) => l.id === lesson.id);
  const prev = pos > 0 ? ordered[pos - 1] : null;
  const next = pos >= 0 && pos < ordered.length - 1 ? ordered[pos + 1] : null;

  const runnerExercises: RunnerExercise[] = exerciseRows.map((e) => {
    const like: ExerciseLike = {
      type: e.type,
      prompt: e.prompt,
      options: e.options,
      correctAnswer: e.correctAnswer,
      explanation: e.explanation,
    };
    return {
      id: e.id,
      type: e.type,
      skill: e.skill,
      prompt: e.prompt,
      options: e.options ?? null,
      blankCount: blankCountFor(like),
      hasAnswer: e.correctAnswer != null,
    };
  });

  const priorBest: Record<number, boolean> = {};
  for (const [k, v] of bestBy) priorBest[k] = v;

  const blocks = lesson.content?.blocks ?? [];
  const keyPhrases = lesson.content?.keyPhrases ?? [];

  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border/60 bg-background/85 px-4 backdrop-blur-md sm:px-6">
        <Link
          href="/lessons"
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 -ml-2 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <ChevronLeft className="size-4" />
          Lessons
        </Link>
        {course && (
          <span className="hidden truncate text-sm text-muted-foreground sm:block">
            · {course.title}
          </span>
        )}
        {progress?.status === "completed" && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <Check className="size-3.5" /> completed
          </span>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-8 pb-12 sm:px-6">
        <header className="animate-fade-up">
          <p className="text-eyebrow">
            {CATEGORY_LABEL[lesson.category] ?? lesson.category} · {lesson.durationMin} min
          </p>
          <h1 className="text-h1 mt-3">{lesson.title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            {lesson.summary}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border px-2.5 py-1">
              {LEVEL_LABEL[lesson.level] ?? lesson.level}
            </span>
            {progress?.status === "completed" && (
              <span className="flex items-center gap-1 text-primary">
                <Check className="size-3.5" /> completed
              </span>
            )}
          </div>
        </header>

        <div className="flex flex-col gap-3">
          {blocks.map((block, i) => (
            <BlockView key={i} block={block} />
          ))}
        </div>

        {keyPhrases.length > 0 && (
          <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-semibold">Key phrases to steal</h3>
            <div className="flex flex-wrap gap-2">
              {keyPhrases.map((phrase) => (
                <span
                  key={phrase}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs shadow-xs"
                >
                  {phrase}
                </span>
              ))}
            </div>
          </section>
        )}

        <LessonRunner
          lesson={{ slug: lesson.slug, title: lesson.title, nextSlug: next?.slug ?? null }}
          exercises={runnerExercises}
          initial={{
            answered: progress?.exercisesDone ?? 0,
            total: progress?.exercisesTotal ?? exerciseRows.length,
            completed: progress?.status === "completed",
            score: progress?.score ?? null,
          }}
          priorBest={priorBest}
        />

        <footer className="flex items-center justify-between gap-3 border-t border-border pt-5 text-sm">
          {prev ? (
            <Link
              href={`/lessons/${prev.slug}`}
              className="flex min-w-0 items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-4 shrink-0" />
              <span className="truncate">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/lessons/${next.slug}`}
              className="flex min-w-0 items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <span className="truncate">{next.title}</span>
              <ChevronRight className="size-4 shrink-0" />
            </Link>
          ) : (
            <Link href="/lessons" className="text-muted-foreground hover:text-foreground">
              All lessons
            </Link>
          )}
        </footer>
      </div>
    </>
  );
}
