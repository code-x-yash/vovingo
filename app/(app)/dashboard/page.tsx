import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import {
  ArrowRight,
  BookOpen,
  Flame,
  Headphones,
  Languages,
  Mic,
  PenLine,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { getDb } from "@/lib/db";
import {
  learningGoals,
  lessonProgress,
  lessons,
  mistakes,
  profiles,
  skillScores,
  userMistakes,
  userVocabulary,
} from "@/lib/db/schema";
import type { PlanItem } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { getOrCreateTodayPlan, findStreak } from "@/lib/plan/store";
import { EMPTY_STREAK } from "@/lib/plan/streak";
import { Progress } from "@/components/ui/progress";
import { PlanList } from "./plan-list";
import { ScoreRing } from "./score-ring";

const SKILL_ORDER = [
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

const SKILL_LABEL: Record<string, string> = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  fluency: "Fluency",
  pronunciation: "Pronunciation",
  listening: "Listening",
  writing: "Writing",
  speaking: "Speaking",
  confidence: "Confidence",
  reading: "Reading",
  overall: "Overall",
};

const LEVEL_LABEL: Record<string, string> = {
  complete_beginner: "Complete beginner",
  beginner: "Beginner",
  elementary: "Elementary",
  intermediate: "Intermediate",
  upper_intermediate: "Upper intermediate",
  advanced: "Advanced",
  unsure: "Still figuring it out",
};

const KIND_FALLBACK_HREF: Record<PlanItem["kind"], string> = {
  learn: "/lessons",
  read: "/lessons",
  listen: "/listening",
  watch: "/listening",
  vocab: "/vocab/review",
  review: "/vocab/review",
  speak: "/speaking",
  challenge: "/speaking",
  fix: "/mistakes",
  write: "/writing",
};

function greetingForHour(hour: number): string {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function exploreHref(item: { ref?: { type: string; id: number }; kind: PlanItem["kind"] }): string {
  if (item.ref?.type === "lesson") return "/lessons";
  if (item.ref?.type === "mistake") return `/mistakes/${item.ref.id}`;
  if (item.ref?.type === "podcast") return `/listening/${item.ref.id}`;
  return KIND_FALLBACK_HREF[item.kind];
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");
  if (!user.onboardedAt) redirect("/onboarding");

  const db = await getDb();

  const profile = (
    await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1)
  )[0];

  const goals = await db
    .select({ goal: learningGoals.goal })
    .from(learningGoals)
    .where(eq(learningGoals.userId, user.id))
    .orderBy(asc(learningGoals.id))
    .limit(8);

  const streak = (await findStreak(user.id)) ?? EMPTY_STREAK;
  const plan = await getOrCreateTodayPlan(user.id);

  const skillRows = await db
    .select({ skill: skillScores.skill, score: skillScores.score })
    .from(skillScores)
    .where(eq(skillScores.userId, user.id));

  const skillBy = new Map(skillRows.map((r) => [r.skill, r.score]));
  const skills = SKILL_ORDER.filter((s) => skillBy.has(s) && s !== "overall").map((s) => ({
    skill: s,
    label: SKILL_LABEL[s] ?? s,
    score: Math.round(skillBy.get(s) ?? 0),
  }));
  const overall = Math.round(
    skillBy.get("overall") ??
      (skills.length > 0
        ? skills.reduce((sum, s) => sum + s.score, 0) / skills.length
        : 0)
  );

  const patternRows = await db
    .select({
      id: mistakes.id,
      title: mistakes.title,
      category: mistakes.category,
      occurrences: userMistakes.occurrences,
      status: userMistakes.status,
    })
    .from(userMistakes)
    .innerJoin(mistakes, eq(userMistakes.mistakeId, mistakes.id))
    .where(and(eq(userMistakes.userId, user.id), ne(userMistakes.status, "resolved")))
    .orderBy(desc(userMistakes.occurrences), desc(userMistakes.lastDetectedAt))
    .limit(4);

  const lessonsDoneRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, user.id), eq(lessonProgress.status, "completed")));

  const dueRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(userVocabulary)
    .where(
      and(
        eq(userVocabulary.userId, user.id),
        lte(userVocabulary.dueAt, new Date()),
        inArray(userVocabulary.status, ["learning", "reviewing"])
      )
    );

  const continueRows = await db
    .select({
      slug: lessons.slug,
      title: lessons.title,
      category: lessons.category,
      durationMin: lessons.durationMin,
      exercisesDone: lessonProgress.exercisesDone,
      exercisesTotal: lessonProgress.exercisesTotal,
      lastPracticedAt: lessonProgress.lastPracticedAt,
    })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
    .where(and(eq(lessonProgress.userId, user.id), eq(lessonProgress.status, "in_progress")))
    .orderBy(desc(lessonProgress.lastPracticedAt))
    .limit(1);

  const lessonsDone = Number(lessonsDoneRows[0]?.n ?? 0);
  const wordsDue = Number(dueRows[0]?.n ?? 0);
  const continueLesson = continueRows[0];
  const continuePct =
    continueLesson && continueLesson.exercisesTotal > 0
      ? Math.min(
          100,
          Math.round((continueLesson.exercisesDone / continueLesson.exercisesTotal) * 100)
        )
      : 0;

  const firstUndone = (plan.items ?? []).find((i) => !i.done);
  let nextHref = firstUndone ? exploreHref(firstUndone) : null;
  if (firstUndone?.ref?.type === "lesson") {
    const lessonRows = await db
      .select({ slug: lessons.slug })
      .from(lessons)
      .where(eq(lessons.id, firstUndone.ref.id))
      .limit(1);
    if (lessonRows[0]) nextHref = `/lessons/${lessonRows[0].slug}`;
  }

  const topPattern = patternRows[0];
  const now = new Date();
  const today = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const greeting = greetingForHour(now.getHours());
  const firstName = user.name.split(" ")[0];
  const visibleSkills = skills.filter((s) => s.skill !== "overall").slice(0, 5);
  const levelLabel = profile?.englishLevel ? LEVEL_LABEL[profile.englishLevel] : null;

  const exploreTiles = [
    {
      href: "/listening",
      icon: Headphones,
      title: "Listening",
      desc: "Podcasts at your level",
      badge: null,
    },
    {
      href: "/speaking",
      icon: Mic,
      title: "Speaking",
      desc: "60-second daily prompts",
      badge: null,
    },
    {
      href: "/writing",
      icon: PenLine,
      title: "Writing",
      desc: "Instant AI feedback",
      badge: null,
    },
    {
      href: "/vocab",
      icon: Languages,
      title: "Vocabulary",
      desc: "Smart review sessions",
      badge: wordsDue > 0 ? `${wordsDue} due` : null,
    },
    {
      href: "/mistakes",
      icon: Target,
      title: "Mistakes",
      desc: "Your recurring patterns",
      badge: patternRows.length > 0 ? `${patternRows.length}` : null,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-12 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="animate-fade-up">
          <p className="text-eyebrow">{today}</p>
          <h1 className="text-h1 mt-2.5">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Ready to improve your English today?
          </p>
          {(profile?.dailyMinutes || goals.length > 0) && (
            <p className="mt-1 text-[13px] text-muted-foreground/80">
              {profile?.dailyMinutes} min/day goal
              {goals.length > 0 && <> · {goals.map((g) => g.goal).join(", ")}</>}
            </p>
          )}
        </div>

        <div className="animate-fade-up">
          <div className="flex items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2.5 shadow-xs">
            <span className="grid size-8 place-items-center rounded-full bg-orange-500/10 text-orange-500">
              <Flame className="size-4" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold tabular-nums">
                {streak.current}{" "}
                <span className="font-normal text-muted-foreground">day streak</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                {streak.longest > 0 ? `best ${streak.longest} · ` : ""}
                {streak.xp} XP
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mt-7 space-y-6">
        {/* ── Today's plan — the hero ─────────────────────────────── */}
        <section className="relative animate-fade-up overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-28 -right-24 size-64 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-eyebrow">Today&apos;s plan</p>
                {plan.focus && (
                  <p className="mt-2.5 max-w-xl text-sm text-muted-foreground">
                    Focus:{" "}
                    <span className="font-medium text-foreground">{plan.focus}</span>
                    {plan.focusReason ? ` — ${plan.focusReason}` : null}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                  {plan.minutesTarget}
                  <span className="text-sm font-normal text-muted-foreground"> min</span>
                </p>
                <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                  <Zap className="size-3 text-primary" />
                  {plan.items.length * 10 + 50} XP available
                </p>
              </div>
            </div>

            {plan.focusMistakeId && (
              <Link
                href={`/mistakes/${plan.focusMistakeId}`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                Practise this pattern
                <ArrowRight className="size-3" />
              </Link>
            )}

            <div className="mt-4">
              <PlanList
                plan={{
                  items: plan.items ?? [],
                  completedCount: plan.completedCount,
                  minutesTarget: plan.minutesTarget,
                }}
                streak={{
                  current: streak.current,
                  longest: streak.longest,
                  totalDays: streak.totalDays,
                  xp: streak.xp,
                }}
                nextHref={nextHref}
              />
            </div>
          </div>
        </section>

        {/* ── AI insight + communication score ─────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-5">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6 lg:col-span-3">
            <div className="flex items-center gap-2.5">
              <span className="ai-sparkle grid size-7 place-items-center rounded-lg text-white shadow-xs">
                <Sparkles className="size-4" />
              </span>
              <p className="text-eyebrow">AI Coach</p>
            </div>

            {topPattern ? (
              <>
                <p className="text-h3 mt-4.5">I&apos;ve noticed something.</p>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">&ldquo;{topPattern.title}&rdquo;</span>{" "}
                  keeps appearing — {topPattern.occurrences} times in your recent work.
                  {topPattern.status === "improving"
                    ? " It's getting better, though — let's keep the momentum."
                    : " Let's fix that today."}
                </p>
                <Link
                  href={`/mistakes/${topPattern.id}`}
                  className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:translate-y-px"
                >
                  Practice this
                  <ArrowRight className="size-4" />
                </Link>
              </>
            ) : !profile?.placementCompletedAt ? (
              <>
                <p className="text-h3 mt-4.5">Let&apos;s find your baseline.</p>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                  Take the 2-minute assessment and I&apos;ll calibrate your skills and shape
                  every plan around them.
                </p>
                <Link
                  href="/placement"
                  className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:translate-y-px"
                >
                  Take the assessment
                  <ArrowRight className="size-4" />
                </Link>
              </>
            ) : (
              <>
                <p className="text-h3 mt-4.5">Here&apos;s where you stand.</p>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                  Your patterns are quiet right now — the fastest way to grow is a speaking
                  session. I&apos;ll analyze every take and surface what to fix.
                </p>
                <Link
                  href="/speaking"
                  className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:translate-y-px"
                >
                  Start speaking
                  <ArrowRight className="size-4" />
                </Link>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6 lg:col-span-2">
            <p className="text-eyebrow">Communication</p>

            {!profile?.placementCompletedAt ? (
              <div className="mt-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Take the 2-minute placement test to calibrate your skill breakdown.
                </p>
                <Link
                  href="/placement"
                  className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Take placement test
                </Link>
              </div>
            ) : (
              <>
                <div className="mt-3 flex justify-center">
                  <ScoreRing value={overall} label="score" sub={levelLabel ?? undefined} />
                </div>
                <div className="mt-5 space-y-3">
                  {visibleSkills.map((s) => (
                    <div key={s.skill} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-muted-foreground">{s.label}</span>
                        <span className="font-medium tabular-nums">{s.score}</span>
                      </div>
                      <Progress value={s.score} className="h-1.5" />
                    </div>
                  ))}
                </div>
                <Link
                  href="/progress"
                  className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  See full progress
                  <ArrowRight className="size-3" />
                </Link>
              </>
            )}
          </section>
        </div>

        {/* ── Continue learning ─────────────────────────────────────── */}
        {continueLesson && (
          <Link
            href={`/lessons/${continueLesson.slug}`}
            className="interactive-card group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <BookOpen className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-eyebrow">Continue learning</p>
              <p className="mt-1.5 truncate text-[15px] font-semibold">{continueLesson.title}</p>
              <div className="mt-2 flex items-center gap-3">
                <Progress value={continuePct} className="h-1.5 max-w-56 flex-1" />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {continuePct}% complete
                </span>
              </div>
            </div>
            <span className="hidden items-center gap-1.5 text-sm font-medium text-primary sm:flex">
              Continue
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        )}

        {/* ── 3-minute workout ─────────────────────────────────────── */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-lg bg-orange-500/10 text-orange-500">
                <Zap className="size-4" />
              </span>
              <p className="text-eyebrow">3-minute workout</p>
            </div>
            <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5 text-[11px] text-muted-foreground">
              ≈3 min · resets daily
            </span>
          </div>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            {[
              {
                n: "01",
                title: "Fix one pattern",
                href: topPattern ? `/mistakes/${topPattern.id}` : "/mistakes",
                sub: topPattern ? topPattern.title : "Browse your patterns",
              },
              {
                n: "02",
                title: "Speedrun round",
                href: "/speedrun",
                sub: "Ten questions against the clock",
              },
              {
                n: "03",
                title: "Record a take",
                href: "/speaking",
                sub: "One prompt, scored instantly",
              },
            ].map((drill) => (
              <Link
                key={drill.n}
                href={drill.href}
                className="interactive-card group rounded-xl border border-border/70 bg-background/60 p-3.5 transition-colors hover:bg-muted/60"
              >
                <span className="font-mono text-eyebrow">{drill.n}</span>
                <p className="mt-2 text-sm font-semibold transition-colors group-hover:text-primary">
                  {drill.title}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{drill.sub}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Explore ───────────────────────────────────────────────── */}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-h3">Explore</h2>
            <span className="text-xs text-muted-foreground">{lessonsDone} lessons done</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {exploreTiles.map((tile) => {
              const Icon = tile.icon;
              return (
                <Link
                  key={tile.href}
                  href={tile.href}
                  className="interactive-card group relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                      <Icon className="size-[18px]" />
                    </span>
                    {tile.badge && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        {tile.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm font-semibold">{tile.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{tile.desc}</p>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
