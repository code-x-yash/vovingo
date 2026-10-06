import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Laugh, Mic } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { speakingSessions } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Bloopers · Vovingo" };

function overallOf(s: {
  grammarScore: number | null;
  vocabularyScore: number | null;
  fluencyScore: number | null;
  pronunciationScore: number | null;
  confidenceScore: number | null;
}): number {
  const parts = [
    s.grammarScore,
    s.vocabularyScore,
    s.fluencyScore,
    s.pronunciationScore,
    s.confidenceScore,
  ].filter((v): v is number => v != null);
  if (parts.length === 0) return 100;
  return parts.reduce((sum, v) => sum + v, 0) / parts.length;
}

export default async function BloopersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/bloopers");
  if (!user.onboardedAt) redirect("/onboarding");

  const db = await getDb();
  const sessions = await db
    .select({
      id: speakingSessions.id,
      prompt: speakingSessions.prompt,
      transcript: speakingSessions.transcript,
      wpm: speakingSessions.wpm,
      fillerCount: speakingSessions.fillerCount,
      longPauseCount: speakingSessions.longPauseCount,
      wordCount: speakingSessions.wordCount,
      grammarScore: speakingSessions.grammarScore,
      vocabularyScore: speakingSessions.vocabularyScore,
      fluencyScore: speakingSessions.fluencyScore,
      pronunciationScore: speakingSessions.pronunciationScore,
      confidenceScore: speakingSessions.confidenceScore,
      createdAt: speakingSessions.createdAt,
    })
    .from(speakingSessions)
    .where(eq(speakingSessions.userId, user.id))
    .orderBy(desc(speakingSessions.createdAt))
    .limit(60);

  // Bloopers = chaotic takes: low score and/or heavy filler usage.
  const ranked = sessions
    .filter((s) => (s.wordCount ?? 0) >= 8 && s.transcript)
    .map((s) => {
      const overall = overallOf(s);
      const chaos = (100 - overall) + (s.fillerCount ?? 0) * 4 + (s.longPauseCount ?? 0) * 3;
      return { ...s, overall: Math.round(overall), chaos };
    })
    .sort((a, b) => b.chaos - a.chaos)
    .slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-eyebrow">Bloopers</p>
        <h1 className="text-h1 mt-2.5">Your finest chaotic moments</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">
          Every legend has a reel. These are the takes where the fillers won — replay them,
          laugh, then beat them with the next one.
        </p>
      </header>

      {ranked.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Laugh className="size-5" />
          </span>
          <p className="mt-4 text-sm font-medium">No bloopers yet.</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            Record a few speaking takes — the messy ones automatically land here for the
            highlight reel.
          </p>
          <div className="mt-5 flex justify-center">
            <Button render={<Link href="/speaking" />}>
              <Mic className="size-4" /> Record a take
            </Button>
          </div>
        </div>
      ) : (
        <ol className="space-y-4">
          {ranked.map((s, i) => (
            <li key={s.id}>
              <figure className="rounded-2xl border border-border bg-card p-5 shadow-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-eyebrow">BLOOPER {String(i + 1).padStart(2, "0")}</span>
                  <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-medium text-destructive">
                    overall {s.overall}
                  </span>
                </div>
                <blockquote className="mt-3 text-[15px]/[17px] text-foreground">
                  &ldquo;
                  {(s.transcript ?? "").length > 240
                    ? `${(s.transcript ?? "").slice(0, 240)}…`
                    : s.transcript}
                  &rdquo;
                </blockquote>
                <figcaption className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5">
                    {s.prompt?.slice(0, 48) ?? "Free talk"}
                    {(s.prompt?.length ?? 0) > 48 ? "…" : ""}
                  </span>
                  <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5">
                    {s.fillerCount ?? 0} fillers
                  </span>
                  <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5">
                    {s.longPauseCount ?? 0} long pauses
                  </span>
                  <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5">
                    {s.wpm ?? 0} wpm
                  </span>
                  <span className="ml-auto">
                    {s.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ol>
      )}

      <div className="flex justify-center pt-2">
        <Button variant="outline" render={<Link href="/speaking" />}>
          Beat your best take <Mic className="size-4" />
        </Button>
      </div>
    </div>
  );
}
