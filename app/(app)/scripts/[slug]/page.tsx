import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Mic } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getScript, yourLines } from "@/lib/scripts/packs";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Script · Vovingo" };

export default async function ScriptPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/scripts`);
  if (!user.onboardedAt) redirect("/onboarding");

  const { slug } = await params;
  const script = getScript(slug);
  if (!script) notFound();

  const mine = yourLines(script);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-eyebrow">{script.pack}</p>
        <h1 className="text-h1 mt-2.5">{script.title}</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">{script.blurb}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            You play {script.role}
          </span>
          <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground">
            vs {script.opponent}
          </span>
          <span className="rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground">
            {mine.length} lines to deliver
          </span>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <p className="text-eyebrow">The scene</p>
        <ol className="mt-4 space-y-3.5">
          {script.lines.map((line, i) => {
            const isMine = line.who.toLowerCase() === script.role.toLowerCase();
            return (
              <li
                key={i}
                className={
                  isMine
                    ? "rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3"
                    : "rounded-2xl border border-border/60 bg-background/50 px-4 py-3"
                }
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={
                      isMine
                        ? "text-xs font-semibold text-primary"
                        : "text-xs font-medium text-muted-foreground"
                    }
                  >
                    {isMine ? `You · ${line.who}` : line.who}
                  </span>
                  {isMine && <span className="text-[11px] text-primary/80">your line</span>}
                </div>
                <p className="mt-1.5 text-[15px] leading-relaxed">{line.text}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-2xl border border-primary/25 bg-primary/5 p-5 shadow-xs">
        <p className="text-sm font-medium">Ready to perform it?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The studio opens with your lines preloaded — speak them as{" "}
          {script.role}, and the take lands in your normal speaking analysis.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button render={<Link href={`/speaking?script=${script.slug}`} />}>
            <Mic className="size-4" /> Practise your lines
          </Button>
          <Button variant="ghost" render={<Link href="/scripts" />}>
            All scripts
          </Button>
        </div>
      </section>

      <Link
        href="/writing"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        Prefer to improvise? Open writing prompts <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}
