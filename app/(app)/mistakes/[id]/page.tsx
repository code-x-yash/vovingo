import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BookOpen, Check, Mic, X } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getLinkedLesson, getUserMistakeDetail, loadPracticePool } from "@/lib/mistakes/store";
import { buildPracticeQuestions } from "@/lib/mistakes/practice";
import {
  MISTAKE_CATEGORY_LABEL,
  MISTAKE_SEVERITY_LABEL,
  MISTAKE_STATUS_LABEL,
  MISTAKE_TREND_LABEL,
  severityTone,
  shortDate,
  statusTone,
  trendTone,
} from "@/lib/mistakes/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PracticeRunner } from "./practice-runner";

export const metadata = { title: "Mistake pattern" };

function sessionLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function MistakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const mistakeId = Number(rawId);
  if (!Number.isInteger(mistakeId) || mistakeId < 1) notFound();

  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/mistakes/${rawId}`);
  if (!user.onboardedAt) redirect("/onboarding");

  const detail = await getUserMistakeDetail(user.id, mistakeId);
  if (!detail) notFound();

  const pool = await loadPracticePool(mistakeId);
  const questions = buildPracticeQuestions(
    {
      id: detail.mistake.id,
      key: detail.mistake.key,
      title: detail.mistake.title,
      category: detail.mistake.category,
      wrongExample: detail.mistake.wrongExample,
      correctExample: detail.mistake.correctExample,
      why: detail.mistake.why,
    },
    pool,
    mistakeId
  );
  const lesson = detail.mistake.lessonId ? await getLinkedLesson(detail.mistake.lessonId) : null;
  const seen = shortDate(detail.state.lastDetectedAt);
  const practised = shortDate(detail.state.lastPracticedAt);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-12 sm:px-6">
      <Link
        href="/mistakes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All patterns
      </Link>

      <header className="animate-fade-up mt-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={severityTone(detail.mistake.severity)}>
                {MISTAKE_SEVERITY_LABEL[detail.mistake.severity] ?? detail.mistake.severity}
              </Badge>
              <Badge variant="outline" className="border-border text-muted-foreground">
                {MISTAKE_CATEGORY_LABEL[detail.mistake.category] ?? detail.mistake.category}
              </Badge>
              <Badge variant="outline" className={statusTone(detail.state.status)}>
                {MISTAKE_STATUS_LABEL[detail.state.status] ?? detail.state.status}
              </Badge>
              <Badge variant="outline" className={trendTone(detail.state.trend)}>
                {MISTAKE_TREND_LABEL[detail.state.trend] ?? detail.state.trend}
              </Badge>
            </div>
            <h1 className="text-h1 mt-3">{detail.mistake.title}</h1>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-gradient text-4xl font-semibold tabular-nums">
              {detail.state.occurrences}
            </p>
            <p className="text-eyebrow mt-1.5">times detected</p>
          </div>
        </div>

        <div className="divider-fade mt-5" />

        <p className="mt-4 text-[13px] text-muted-foreground">
          {MISTAKE_CATEGORY_LABEL[detail.mistake.category] ?? detail.mistake.category} · last
          seen {seen ?? "recently"}
          {detail.state.practiceCount > 0 && (
            <>
              {" "}
              · practised {detail.state.practiceCount}×
              {practised && <> ({practised})</>}
            </>
          )}
        </p>
      </header>

      <section className="animate-fade-up mt-7 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <h2 className="text-eyebrow">What&apos;s going on</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          {detail.mistake.description}
        </p>

        <div className="mt-5 space-y-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
              <X className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-eyebrow">The problem</p>
              <p className="mt-2 text-[15px] leading-relaxed text-destructive line-through decoration-destructive/40">
                {detail.mistake.wrongExample}
              </p>
            </div>
          </div>

          <div className="divider-fade" />

          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-success/10 text-success">
              <Check className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-eyebrow">Better</p>
              <p className="mt-2 text-[15px] leading-relaxed text-success">
                {detail.mistake.correctExample}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Why: </span>
          {detail.mistake.why}
        </p>

        {detail.mistake.naturalAlternative && (
          <div className="mt-4 rounded-xl bg-muted/60 p-4 text-[15px] leading-relaxed">
            <span className="font-medium text-foreground">Sounds more natural: </span>
            {detail.mistake.naturalAlternative}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <h2 className="text-eyebrow">Practise it</h2>
        <p className="mt-2.5 text-[15px] text-muted-foreground">
          Three quick questions built from this pattern — feedback when you finish.
        </p>
        <div className="mt-5">
          <PracticeRunner mistakeId={mistakeId} questions={questions} />
        </div>
      </section>

      {detail.history.length > 0 && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <h2 className="text-eyebrow">In your words</h2>
          <p className="mt-2.5 text-[15px] text-muted-foreground">
            Where this pattern showed up.
          </p>
          <div className="mt-4 space-y-3">
            {detail.history.map((h, i) => (
              <div key={i} className="rounded-xl border border-border bg-background/40 p-4">
                <p className="flex items-start gap-2 text-[15px] leading-relaxed text-destructive">
                  <X className="mt-1 size-3.5 shrink-0" />
                  {h.sentence}
                </p>
                <p className="mt-2 flex items-start gap-2 text-[15px] leading-relaxed text-success">
                  <Check className="mt-1 size-3.5 shrink-0" />
                  {h.correction}
                </p>
                <p className="mt-2.5 text-xs text-muted-foreground">
                  {sessionLabel(h.sessionType)}
                  {shortDate(h.detectedAt) && <> · {shortDate(h.detectedAt)}</>}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <h2 className="text-eyebrow">Speaking prompts</h2>
          <p className="mt-2.5 text-[15px] text-muted-foreground">
            Use these to hit the pattern out loud.
          </p>
          <div className="mt-4 space-y-3">
            {detail.mistake.practicePrompts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Talk about your day and keep this pattern in mind.
              </p>
            ) : (
              detail.mistake.practicePrompts.map((p, i) => (
                <p key={i} className="rounded-xl border border-border p-3.5 text-sm leading-relaxed">
                  {p}
                </p>
              ))
            )}
            <Button render={<Link href="/speaking" />}>
              <Mic className="size-4" /> Practise in speaking
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <h2 className="text-eyebrow">Learn the rule</h2>
          <p className="mt-2.5 text-[15px] text-muted-foreground">
            The full explanation, with exercises.
          </p>
          <div className="mt-4 space-y-3">
            {lesson ? (
              <>
                <p className="text-sm text-muted-foreground">{lesson.title}</p>
                <Button variant="outline" render={<Link href={`/lessons/${lesson.slug}`} />}>
                  <BookOpen className="size-4" /> Open lesson
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No linked lesson yet — the practice quiz above drills the same rule.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
