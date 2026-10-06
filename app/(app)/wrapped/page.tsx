import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import {
  ArrowRight,
  BookOpen,
  Flame,
  Languages,
  Mic,
  PartyPopper,
  PenLine,
  Sparkles,
  Target,
  Timer,
  Trophy,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import {
  conversations,
  lessonProgress,
  mistakes,
  skillScores,
  speakingSessions,
  speedruns,
  userAchievements,
  userMistakes,
  userVocabulary,
  writingAnalyses,
} from "@/lib/db/schema";
import { findStreak } from "@/lib/plan/store";
import { EMPTY_STREAK } from "@/lib/plan/streak";
import { divisionFor } from "@/lib/progress/leaderboard";
import { Button } from "@/components/ui/button";
import { WrappedShare } from "./wrapped-share";

export const metadata: Metadata = { title: "Wrapped · Vovingo" };

function num(n: unknown): number {
  return Number(n ?? 0);
}

export default async function WrappedPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/wrapped");
  if (!user.onboardedAt) redirect("/onboarding");

  const db = await getDb();
  const year = new Date().getFullYear();

  const [streak, spkRow, vocabRow, lessonRow, writingRow, convRow, runRow, mistakeRows, skillRows, achRow] =
    await Promise.all([
      findStreak(user.id),
      db
        .select({
          n: sql<number>`count(*)`,
          sec: sql<number>`coalesce(sum(${speakingSessions.durationSec}), 0)`,
          words: sql<number>`coalesce(sum(${speakingSessions.wordCount}), 0)`,
        })
        .from(speakingSessions)
        .where(eq(speakingSessions.userId, user.id)),
      db
        .select({ n: sql<number>`count(*)` })
        .from(userVocabulary)
        .where(eq(userVocabulary.userId, user.id)),
      db
        .select({ n: sql<number>`count(*)` })
        .from(lessonProgress)
        .where(eq(lessonProgress.userId, user.id)),
      db
        .select({ n: sql<number>`count(*)` })
        .from(writingAnalyses)
        .where(eq(writingAnalyses.userId, user.id)),
      db
        .select({ n: sql<number>`count(*)` })
        .from(conversations)
        .where(eq(conversations.userId, user.id)),
      db
        .select({
          n: sql<number>`count(*)`,
          best: sql<number | null>`max(${speedruns.correct})`,
        })
        .from(speedruns)
        .where(eq(speedruns.userId, user.id)),
      db
        .select({ title: mistakes.title, occurrences: userMistakes.occurrences })
        .from(userMistakes)
        .innerJoin(mistakes, eq(userMistakes.mistakeId, mistakes.id))
        .where(eq(userMistakes.userId, user.id))
        .orderBy(desc(userMistakes.occurrences))
        .limit(1),
      db
        .select({ skill: skillScores.skill, score: skillScores.score })
        .from(skillScores)
        .where(eq(skillScores.userId, user.id))
        .orderBy(desc(skillScores.score))
        .limit(1),
      db
        .select({ n: sql<number>`count(*)` })
        .from(userAchievements)
        .where(eq(userAchievements.userId, user.id)),
    ]);

  const s = streak ?? EMPTY_STREAK;
  const takes = num(spkRow[0]?.n);
  const minutes = Math.round(num(spkRow[0]?.sec) / 60);
  const spokenWords = num(spkRow[0]?.words);
  const wordsInLibrary = num(vocabRow[0]?.n);
  const achievements = num(achRow[0]?.n);
  const writings = num(writingRow[0]?.n);
  const chats = num(convRow[0]?.n);
  const runs = num(runRow[0]?.n);
  const bestRun = num(runRow[0]?.best);
  const nemesis = mistakeRows[0];
  const skillLabel = skillRows[0]?.skill
    ? skillRows[0].skill.charAt(0).toUpperCase() + skillRows[0].skill.slice(1)
    : null;
  const division = divisionFor(s.xp);
  const hasData = takes > 0 || minutes > 0 || s.xp > 0;

  const summary =
    `My Vovingo ${year} Wrapped: ${minutes} min spoken across ${takes} takes, ${spokenWords} words out loud, ` +
    `${wordsInLibrary} in my library, ${s.longest}-day best streak, ${s.xp} XP in ${division.name}` +
    `${skillLabel ? `, top skill ${skillLabel}` : ""}.`;

  const bigStats = [
    { icon: Mic, value: minutes, label: "minutes spoken" },
    { icon: Languages, value: wordsInLibrary, label: "words collected" },
    { icon: Trophy, value: s.longest, label: "day best streak" },
    { icon: Sparkles, value: s.xp, label: "lifetime XP" },
  ];

  const smallStats = [
    { icon: Mic, value: takes, label: "speaking takes" },
    { icon: Target, value: spokenWords, label: "words said aloud" },
    { icon: BookOpen, value: num(lessonRow[0]?.n), label: "lessons finished" },
    { icon: PenLine, value: writings, label: "writings analysed" },
    { icon: Sparkles, value: chats, label: "coach chats" },
    { icon: Timer, value: runs, label: "speedrun rounds" },
    { icon: Trophy, value: achievements, label: "achievements" },
    { icon: Flame, value: s.current, label: "day streak now" },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-primary/15 blur-3xl"
        />
        <div className="relative">
          <p className="text-eyebrow inline-flex items-center gap-1.5">
            <PartyPopper className="size-3.5" />
            {year} Wrapped
          </p>
          <h1 className="text-h1 mt-3">{user.name.split(" ")[0]}, this was your year in English</h1>
          <p className="mt-2 max-w-xl text-[15px] text-muted-foreground">
            {hasData
              ? "Every take, lesson and late-night drill — rolled into one reel. Here's the highlight package."
              : "The pages are still blank — but this is exactly where the story starts."}
          </p>
          <div className="mt-4">
            <WrappedShare summary={summary} />
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {bigStats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="animate-fade-up rounded-2xl border border-border bg-card p-4 text-center shadow-xs"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <Icon className="mx-auto size-4 text-primary" />
              <p className="text-display text-gradient mt-2.5 tabular-nums">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
            </div>
          );
        })}
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {smallStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-border/70 bg-background/60 p-4"
            >
              <p className="flex items-center gap-1.5 text-eyebrow">
                <Icon className="size-3" />
                {stat.label}
              </p>
              <p className="mt-2 text-h2 tabular-nums">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-5 shadow-xs">
          <p className="text-eyebrow">Your superpower</p>
          <p className="text-h2 mt-3">{skillLabel ?? "Not calibrated yet"}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {skillLabel
              ? "The skill carrying your scores — keep feeding it."
              : "Take the placement test and your top skill lands here."}
          </p>
          {!skillLabel && (
            <Link
              href="/placement"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              Take placement <ArrowRight className="size-3" />
            </Link>
          )}
        </section>

        <section className="rounded-2xl border border-destructive/25 bg-destructive/5 p-5 shadow-xs">
          <p className="text-eyebrow">Your nemesis</p>
          <p className="text-h2 mt-3">{nemesis?.title ?? "No patterns yet"}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {nemesis
              ? `Caught ${nemesis.occurrences} time${nemesis.occurrences === 1 ? "" : "s"} — beat it in ${year + 1}.`
              : "Record a speaking take and I'll name the pattern that keeps tripping you."}
          </p>
          {nemesis && (
            <Link
              href={`/mistakes`}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              Practise it <ArrowRight className="size-3" />
            </Link>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-eyebrow">League</p>
            <p className="text-h2 mt-2.5">
              {division.name} {division.next !== null ? `· ${division.next - s.xp} XP to promote` : "· top division"}
            </p>
          </div>
          <span className="grid size-11 place-items-center rounded-xl bg-orange-500/10 text-orange-500">
            <Flame className="size-5" />
          </span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {runs > 0 && bestRun > 0 ? `Speedrun personal best ${bestRun}/10 · ` : ""}
          Current streak {s.current} day{s.current === 1 ? "" : "s"} · longest {s.longest}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/leaderboard" />}>
            See the leagues
          </Button>
          <Button render={<Link href="/speaking" />}>
            Start {year + 1} right <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}
