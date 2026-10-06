import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Flame,
  Languages,
  Lock,
  Mic,
  Target,
  Timer,
  Trophy,
  Wrench,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { skillScores, speakingSessions } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { findStreak } from "@/lib/plan/store";
import { EMPTY_STREAK } from "@/lib/plan/streak";
import {
  collectAchievementStats,
  getEarnedAchievements,
  getRecentActivity,
  loadAchievementCatalog,
  recordProgressSnapshot,
  unlockEarnedAchievements,
  type ActivityItem,
} from "@/lib/progress/store";
import { listUserMistakes } from "@/lib/mistakes/store";
import { shortDate } from "@/lib/mistakes/labels";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Progress" };

const SKILL_ORDER = [
  "grammar",
  "vocabulary",
  "fluency",
  "pronunciation",
  "speaking",
  "listening",
  "reading",
  "writing",
  "confidence",
  "overall",
] as const;

const SKILL_LABEL: Record<string, string> = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  fluency: "Fluency",
  pronunciation: "Pronunciation",
  speaking: "Speaking",
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  confidence: "Confidence",
  overall: "Overall",
};

const ACTIVITY_ICON: Record<ActivityItem["kind"], typeof BookOpen> = {
  lesson: BookOpen,
  speaking: Mic,
  practice: Wrench,
  plan: Target,
};

const ACTIVITY_KINDS: {
  kind: ActivityItem["kind"];
  label: string;
  icon: typeof BookOpen;
}[] = [
  { kind: "lesson", label: "Lessons", icon: BookOpen },
  { kind: "speaking", label: "Speaking", icon: Mic },
  { kind: "practice", label: "Practice", icon: Wrench },
  { kind: "plan", label: "Plans", icon: Target },
];

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-[13px] text-muted-foreground shadow-xs">
      {children}
    </span>
  );
}

function StatBlock({
  icon: Icon,
  eyebrow,
  value,
  sub,
}: {
  icon: typeof BookOpen;
  eyebrow: string;
  value: number;
  sub: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-eyebrow">
        <Icon className="size-3" />
        {eyebrow}
      </p>
      <p className="mt-3 text-h1 tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

export default async function ProgressPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/progress");
  if (!user.onboardedAt) redirect("/onboarding");

  const [streak, stats] = await Promise.all([
    findStreak(user.id),
    collectAchievementStats(user.id),
  ]);
  const s = streak ?? EMPTY_STREAK;

  const unlock = await unlockEarnedAchievements(user.id, stats);
  const [earned, catalog] = await Promise.all([
    getEarnedAchievements(user.id),
    loadAchievementCatalog(),
  ]);
  const earnedIds = new Set(earned.map((e) => e.id));
  const earnedAtById = new Map(earned.map((e) => [e.id, e.unlockedAt]));

  const db = await getDb();
  const skillRows = await db
    .select({ skill: skillScores.skill, score: skillScores.score })
    .from(skillScores)
    .where(eq(skillScores.userId, user.id));
  const skillBy = new Map(skillRows.map((r) => [r.skill, r.score]));
  const skills = SKILL_ORDER.filter((k) => skillBy.has(k)).map((k) => ({
    skill: k,
    label: SKILL_LABEL[k] ?? k,
    score: Math.round(skillBy.get(k) ?? 0),
  }));

  const paceRows = await db
    .select({
      wpm: speakingSessions.wpm,
      fillers: speakingSessions.fillerCount,
      at: speakingSessions.createdAt,
    })
    .from(speakingSessions)
    .where(eq(speakingSessions.userId, user.id))
    .orderBy(desc(speakingSessions.createdAt))
    .limit(10);
  const paceSeries = paceRows.slice().reverse();

  const [activity, mistakeList] = await Promise.all([
    getRecentActivity(user.id),
    listUserMistakes(user.id),
  ]);
  await recordProgressSnapshot(user.id).catch(() => undefined);

  const unlockedCount = earnedIds.size;
  const earnedXp = earned.reduce((sum, e) => sum + e.xp, 0);

  const overallSkill = skills.find((sk) => sk.skill === "overall");
  const barSkills = skills.filter((sk) => sk.skill !== "overall");
  const overallScore =
    overallSkill?.score ??
    (barSkills.length > 0
      ? Math.round(barSkills.reduce((sum, sk) => sum + sk.score, 0) / barSkills.length)
      : 0);

  const activityCounts: Record<ActivityItem["kind"], number> = {
    lesson: 0,
    speaking: 0,
    practice: 0,
    plan: 0,
  };
  for (const item of activity) activityCounts[item.kind] += 1;

  const streakPhrase = s.current > 0 ? `a ${s.current}-day streak` : null;
  const lead =
    stats.speakingMinutes > 0
      ? `You've spoken ${stats.speakingMinutes} minutes out loud, mastered ${
          stats.words
        } word${stats.words === 1 ? "" : "s"}${
          streakPhrase ? ` and kept ${streakPhrase} alive` : ""
        } — that's momentum you can measure.`
      : stats.lessons > 0
        ? `${stats.lessons} lesson${stats.lessons === 1 ? "" : "s"} done and ${
            stats.words
          } word${stats.words === 1 ? "" : "s"} in your library — your first speaking take is the next step.`
        : "Progress starts with a single session — take a two-minute lesson and watch this page fill up.";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-eyebrow">Progress</p>
        <h1 className="text-h1 mt-2.5">Your progress</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">{lead}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip>
            {stats.lessons} lesson{stats.lessons === 1 ? "" : "s"} completed
          </Chip>
          <Chip>
            {stats.conversations} coach chat{stats.conversations === 1 ? "" : "s"}
          </Chip>
          <Chip>
            {stats.planDays} plan{stats.planDays === 1 ? "" : "s"} completed
          </Chip>
        </div>
      </header>

      {unlock.newlyUnlocked.length > 0 && (
        <section className="animate-fade-in rounded-2xl border border-primary/25 bg-primary/5 p-5 shadow-xs sm:p-6">
          <div className="flex items-start gap-3.5">
            <span className="ai-sparkle grid size-9 shrink-0 place-items-center rounded-xl text-white shadow-xs">
              <Trophy className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-eyebrow">Achievement unlocked</p>
              <p className="text-h3 mt-2.5">
                {unlock.newlyUnlocked.map((a) => a.title).join(", ")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                +{unlock.xpAwarded} XP added to your streak.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatBlock
          icon={Mic}
          eyebrow="Speaking"
          value={stats.speakingMinutes}
          sub={`minutes out loud · ${stats.speakingSessions} take${
            stats.speakingSessions === 1 ? "" : "s"
          }`}
        />
        <StatBlock
          icon={Languages}
          eyebrow="Vocabulary"
          value={stats.words}
          sub="words in your library"
        />
        <StatBlock
          icon={Target}
          eyebrow="Mistakes"
          value={stats.resolvedMistakes}
          sub={`${mistakeList.summary.improving} pattern${
            mistakeList.summary.improving === 1 ? "" : "s"
          } improving`}
        />
      </section>

      <div className="divider-fade" />

      <section className="animate-fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-eyebrow">Skills</p>
            <h2 className="text-h2 mt-2.5">Where you stand</h2>
            <p className="mt-1.5 text-[15px] text-muted-foreground">
              Updated from placement, lessons and practice.
            </p>
          </div>
          {(overallSkill || barSkills.length > 0) && (
            <div className="text-right">
              <p className="text-display text-gradient tabular-nums">{overallScore}</p>
              <p className="mt-1.5 text-eyebrow">Overall</p>
            </div>
          )}
        </div>

        {stats.assessments === 0 || barSkills.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-border/60 p-6 text-center sm:p-8">
            <p className="text-sm font-medium">
              Take the 2-minute placement test to calibrate your skill breakdown.
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
              Your scores become the baseline for every plan after that.
            </p>
            <div className="mt-4 flex justify-center">
              <Button render={<Link href="/placement" />}>Take placement test</Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {barSkills.map((sk) => (
              <div key={sk.skill} className="space-y-2">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{sk.label}</span>
                  <span className="font-semibold tabular-nums">{sk.score}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-2)]"
                    style={{ width: `${sk.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {paceSeries.length > 1 && (
        <>
          <div className="divider-fade" />

          <section className="animate-fade-up">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-eyebrow">Pace &amp; fillers</p>
                <h2 className="text-h2 mt-2.5">How you&apos;re sounding lately</h2>
                <p className="mt-1.5 text-[15px] text-muted-foreground">
                  Your last {paceSeries.length} takes — pace in words per minute, then filler
                  words per take. Steady beats fast.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground shadow-xs">
                <Timer className="size-3.5" />
                aim 110–150 wpm
              </span>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {[
                {
                  key: "wpm" as const,
                  label: "Pace (wpm)",
                  values: paceSeries.map((r) => r.wpm ?? 0),
                  floor: 60,
                  ceil: 200,
                  band: [110, 150] as [number, number],
                  fmt: (v: number) => `${v}`,
                },
                {
                  key: "fillers" as const,
                  label: "Filler words per take",
                  values: paceSeries.map((r) => r.fillers ?? 0),
                  floor: 0,
                  ceil: 10,
                  band: null,
                  fmt: (v: number) => `${v}`,
                },
              ].map((chart) => (
                <div key={chart.key} className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5">
                  <p className="text-eyebrow">{chart.label}</p>
                  <div className="relative mt-4 h-28">
                    {chart.band && (
                      <div
                        aria-hidden
                        className="absolute inset-x-0 rounded-md bg-primary/5"
                        style={{
                          bottom: `${((chart.band[0] - chart.floor) / (chart.ceil - chart.floor)) * 100}%`,
                          height: `${((chart.band[1] - chart.band[0]) / (chart.ceil - chart.floor)) * 100}%`,
                        }}
                      />
                    )}
                    <div className="relative flex h-full items-end gap-1.5">
                      {chart.values.map((v, i) => {
                        const pct =
                          Math.max(4, Math.min(100, ((v - chart.floor) / (chart.ceil - chart.floor)) * 100));
                        const inBand =
                          chart.band == null || (v >= chart.band[0] && v <= chart.band[1]);
                        return (
                          <div
                            key={i}
                            title={`Take ${i + 1}: ${chart.fmt(v)}`}
                            className={`flex-1 rounded-t-sm transition-colors ${
                              inBand ? "bg-primary/70" : "bg-muted-foreground/35"
                            }`}
                            style={{ height: `${pct}%` }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <p className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>oldest</span>
                    <span>
                      latest {chart.fmt(chart.values[chart.values.length - 1] ?? 0)}
                      {chart.key === "fillers" ? " fillers" : " wpm"}
                    </span>
                    <span>newest</span>
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <div className="divider-fade" />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Flame className="size-[18px]" />
            </span>
            <h2 className="text-eyebrow">Streak</h2>
          </div>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-display text-gradient tabular-nums">{s.current}</span>
            <span className="text-[15px] text-muted-foreground">
              day{s.current === 1 ? "" : "s"} in a row
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {s.longest > 0 ? `Best run: ${s.longest} days · ` : ""}
            {s.xp} XP
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip>{earnedXp} XP from achievements</Chip>
            <Chip>
              {stats.mistakePractices} mistake practice
              {stats.mistakePractices === 1 ? "" : "s"}
            </Chip>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <h2 className="text-eyebrow">Recent activity</h2>

          {activity.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border/60 p-6 text-center">
              <p className="text-sm font-medium">Nothing here yet.</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Finish a lesson or record a speaking take — it shows up here.
              </p>
              <div className="mt-4 flex justify-center">
                <Button render={<Link href="/lessons" />}>Start a lesson</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {ACTIVITY_KINDS.filter((k) => activityCounts[k.kind] > 0).map((k) => (
                  <span
                    key={k.kind}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[13px] text-muted-foreground"
                  >
                    <k.icon className="size-3.5" />
                    {activityCounts[k.kind]} {k.label}
                  </span>
                ))}
              </div>

              <ul className="mt-4 space-y-2">
                {activity.map((item, i) => {
                  const Icon = ACTIVITY_ICON[item.kind] ?? Target;
                  return (
                    <li key={i}>
                      <Link
                        href={item.href}
                        className="group flex items-center gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2.5 transition-colors hover:bg-muted/60"
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium transition-colors group-hover:text-primary">
                            {item.title}
                          </span>
                          {item.detail && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {item.detail}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {shortDate(item.at)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="divider-fade" />

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-eyebrow">Achievements</p>
            <h2 className="text-h2 mt-2.5">Badges you&apos;ve earned</h2>
          </div>
          <span className="text-sm tabular-nums text-muted-foreground">
            {unlockedCount}/{catalog.length} unlocked
          </span>
        </div>

        {catalog.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-border/60 p-6 text-center">
            <p className="text-sm font-medium">No badges yet.</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
              Complete lessons, keep your streak and take speaking practice — badges unlock
              on their own.
            </p>
            <div className="mt-4 flex justify-center">
              <Button render={<Link href="/lessons" />}>Browse lessons</Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((a) => {
              const isEarned = earnedIds.has(a.id);
              const at = earnedAtById.get(a.id);
              return (
                <div
                  key={a.id}
                  className={`rounded-2xl border p-4 ${
                    isEarned
                      ? "border-primary/25 bg-primary/5"
                      : "border-border/60 bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`grid size-9 place-items-center rounded-xl ${
                        isEarned
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground/70"
                      }`}
                    >
                      {isEarned ? (
                        <Trophy className="size-[18px]" />
                      ) : (
                        <Lock className="size-[18px]" />
                      )}
                    </span>
                    {isEarned && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        Earned
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm font-medium">{a.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    +{a.xp} XP
                    {isEarned && at && <> · {shortDate(at)}</>}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="divider-fade" />

      <section className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-eyebrow">Mistakes</p>
            <h2 className="text-h2 mt-2.5">Patterns to watch</h2>
          </div>
          <Link
            href="/mistakes"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            All patterns
            <ArrowRight className="size-3" />
          </Link>
        </div>

        {mistakeList.items.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-border/60 p-6 text-center">
            <p className="text-sm font-medium">No patterns yet.</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
              Patterns appear after your first speaking analysis — record a take and
              I&apos;ll surface what to fix.
            </p>
            <div className="mt-4 flex justify-center">
              <Button render={<Link href="/speaking" />}>Record a speaking take</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-3 gap-4">
              <div>
                <p className="text-h2 tabular-nums">{mistakeList.summary.total}</p>
                <p className="mt-1 text-xs text-muted-foreground">patterns</p>
              </div>
              <div>
                <p className="text-h2 tabular-nums text-warning">
                  {mistakeList.summary.needsPractice}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">need practice</p>
              </div>
              <div>
                <p className="text-h2 tabular-nums text-success">
                  {mistakeList.summary.improving}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">improving</p>
              </div>
            </div>

            <ul className="mt-5 space-y-2">
              {mistakeList.items.slice(0, 3).map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/mistakes/${m.id}`}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-3.5 py-2.5 text-sm transition-colors hover:bg-muted/60"
                  >
                    <span className="min-w-0 truncate font-medium transition-colors group-hover:text-primary">
                      {m.title}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      ×{m.occurrences}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
