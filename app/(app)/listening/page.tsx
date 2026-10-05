import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Headphones } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { listPodcasts, type PodcastListItem } from "@/lib/listening/store";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Listening" };

function minutesOf(p: PodcastListItem): number {
  return Math.max(1, Math.round(p.durationSec / 60));
}

function LevelChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
      {children}
    </span>
  );
}

function EpisodeCard({ p, inRail }: { p: PodcastListItem; inRail?: boolean }) {
  return (
    <Link
      href={`/listening/${p.id}`}
      className={`interactive-card group rounded-2xl border bg-card p-4 shadow-xs ${
        inRail ? "w-64 shrink-0 snap-start" : ""
      } ${p.featured ? "border-primary/30" : "border-border"}`}
    >
      <div
        className={`relative grid place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[var(--brand-1)]/15 via-[var(--brand-2)]/8 to-[var(--brand-3)]/15 ${
          inRail ? "h-32" : "h-40"
        }`}
      >
        <span className="grid size-11 place-items-center rounded-xl bg-card/85 text-primary shadow-xs transition-transform group-hover:scale-105">
          <Headphones className="size-5" />
        </span>
        <span className="absolute right-2 bottom-2 rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {minutesOf(p)} min
        </span>
        {p.bestScore !== null && (
          <span
            className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
              p.bestScore >= 75 ? "bg-success/15 text-success" : "bg-card/90 text-muted-foreground"
            }`}
          >
            {p.bestScore}%
          </span>
        )}
      </div>

      <p className="mt-3.5 text-[15px] leading-snug font-semibold">{p.title}</p>
      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
        {p.description}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <LevelChip>{p.level}</LevelChip>
        <LevelChip>{p.topic}</LevelChip>
        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
          {p.bestScore !== null ? `Best ${p.bestScore}%` : "Not tried yet"}
        </span>
      </div>
    </Link>
  );
}

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="text-h3">{title}</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function Rail({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 mt-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
      {children}
    </div>
  );
}

export default async function ListeningPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/listening");
  if (!user.onboardedAt) redirect("/onboarding");

  const items = await listPodcasts(user.id);

  const started = items.filter((p) => p.sessions > 0);
  const fresh = items.filter((p) => p.sessions === 0);
  const forYou = fresh.slice(0, 6);
  const recommended = fresh.slice(6);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-eyebrow">Listen</p>
        <h1 className="text-h1 mt-2.5">Listening</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          Podcasts and audio picked for your level.
        </p>
      </header>

      {items.length === 0 ? (
        <section className="animate-fade-up mt-8 rounded-2xl border border-dashed bg-card/50 p-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Headphones className="size-6" />
          </span>
          <p className="text-h3 mt-4">Your audio shelf is empty</p>
          <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
            Episodes unlock as you learn — start a lesson and the listening picked for you
            lands here.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button render={<Link href="/lessons" />}>Browse lessons</Button>
            <Button variant="outline" render={<Link href="/dashboard" />}>
              Back to dashboard
            </Button>
          </div>
        </section>
      ) : (
        <div className="mt-8 space-y-8">
          {started.length > 0 && (
            <section className="animate-fade-up">
              <SectionHead
                title="Continue listening"
                sub="Pick up the episode you left running."
              />
              <Rail>
                {started.map((p) => (
                  <EpisodeCard key={p.id} p={p} inRail />
                ))}
              </Rail>
            </section>
          )}

          {forYou.length > 0 && (
            <section className="animate-fade-up">
              <SectionHead
                title="For you"
                sub="Featured episodes, matched to your level."
              />
              <Rail>
                {forYou.map((p) => (
                  <EpisodeCard key={p.id} p={p} inRail />
                ))}
              </Rail>
            </section>
          )}

          {recommended.length > 0 && (
            <section className="animate-fade-up">
              <SectionHead
                title="Recommended for your level"
                sub="A little more to stretch your ear."
              />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {recommended.map((p) => (
                  <EpisodeCard key={p.id} p={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
