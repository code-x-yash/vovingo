import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Headphones } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getListeningDetail } from "@/lib/listening/store";
import { Badge } from "@/components/ui/badge";
import { QuizRunner, type RunnerQuestion, type RunnerSegment } from "./quiz-runner";

export const metadata = { title: "Listening episode" };

export default async function ListeningEpisodePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/listening");
  if (!user.onboardedAt) redirect("/onboarding");

  const { id } = await params;
  const podcastId = Number(id);
  if (!Number.isInteger(podcastId) || podcastId < 1) notFound();

  const detail = await getListeningDetail(user.id, podcastId);
  if (!detail) notFound();

  const questions: RunnerQuestion[] = detail.questions.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    options: q.options,
  }));
  const transcript: RunnerSegment[] = detail.transcript.map((t) => ({ text: t.text }));
  const minutes = Math.max(1, Math.round(detail.podcast.durationSec / 60));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-12 sm:px-6">
      <Link
        href="/listening"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← All episodes
      </Link>

      <div className="animate-fade-up mt-5 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[var(--brand-1)]/15 via-card to-[var(--brand-2)]/15 shadow-xs">
        <div className="relative grid aspect-video place-items-center">
          <span className="grid size-16 place-items-center rounded-2xl bg-card text-primary shadow-md">
            <Headphones className="size-8" />
          </span>
          <span className="absolute right-3 bottom-3 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
            {minutes} min
          </span>
          {detail.bestScore !== null && (
            <span className="absolute top-3 left-3 rounded-full bg-card/90 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary">
              Best {detail.bestScore}%
            </span>
          )}
        </div>
      </div>

      <header className="animate-fade-up mt-6">
        <p className="text-eyebrow">
          {detail.podcast.topic} · {detail.podcast.level}
        </p>
        <h1 className="text-h1 mt-2.5">{detail.podcast.title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          {detail.podcast.description}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="border-border text-muted-foreground">
            {detail.podcast.topic}
          </Badge>
          <Badge variant="outline" className="border-border text-muted-foreground">
            {detail.podcast.level}
          </Badge>
          <Badge variant="outline" className="border-border text-muted-foreground">
            {minutes} min
          </Badge>
          <Badge variant="outline" className="border-border text-muted-foreground">
            {detail.questionCount} questions
          </Badge>
          {detail.bestScore !== null && (
            <Badge variant="outline" className="border-primary/40 text-primary">
              Best {detail.bestScore}%
            </Badge>
          )}
        </div>
      </header>

      <div className="mt-8">
        <QuizRunner
          podcastId={detail.podcast.id}
          questions={questions}
          transcript={transcript}
        />
      </div>
    </div>
  );
}
