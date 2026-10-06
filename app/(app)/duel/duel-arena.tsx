"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw, Swords, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isQuotaWall, Paywall } from "@/components/billing/paywall";
import { cn } from "@/lib/utils";
import type { DuelTopic, DuelVerdict } from "@/lib/duel/engine";

type Phase = "idle" | "write" | "judging" | "result";

function ScoreRow({
  label,
  score,
  mine,
}: {
  label: string;
  score: number;
  mine?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className={cn("font-medium", mine ? "text-primary" : "text-muted-foreground")}>
          {label}
        </span>
        <span className="tabular-nums font-semibold">{score}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", mine ? "bg-primary" : "bg-foreground/40")}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export function DuelArena() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [judgingFor, setJudgingFor] = useState<"start" | "verdict">("start");
  const [topic, setTopic] = useState<DuelTopic | null>(null);
  const [bar, setBar] = useState("");
  const [verdict, setVerdict] = useState<DuelVerdict | null>(null);
  const [xp, setXp] = useState(0);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const words = bar.trim() ? bar.trim().split(/\s+/).length : 0;

  async function handle(res: Response): Promise<Record<string, unknown> | null> {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      if (isQuotaWall(res.status, data)) {
        setPaywallOpen(true);
        return null;
      }
      toast.error((data.error as string) ?? "Something went wrong.");
      return null;
    }
    return data;
  }

  async function start() {
    setJudgingFor("start");
    setPhase("judging");
    setVerdict(null);
    setBar("");
    try {
      const res = await fetch("/api/duel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = await handle(res);
      if (!data) {
        setPhase("idle");
        return;
      }
      setTopic(data.topic as DuelTopic);
      setPhase("write");
    } catch {
      toast.error("Network error — try again.");
      setPhase("idle");
    }
  }

  async function submit() {
    if (!topic) return;
    const trimmed = bar.trim();
    if (trimmed.length < 16) {
      toast.error("Give us at least a couple of lines.");
      return;
    }
    setJudgingFor("verdict");
    setPhase("judging");
    try {
      const res = await fetch("/api/duel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", topicId: topic.id, bar: trimmed }),
      });
      const data = await handle(res);
      if (!data) {
        setPhase("write");
        return;
      }
      setVerdict(data.verdict as DuelVerdict);
      setXp(data.xp as number);
      setPhase("result");
      toast.success(`+${data.xp as number} XP logged`);
    } catch {
      toast.error("Network error — try again.");
      setPhase("write");
    }
  }

  if (phase === "idle") {
    return (
      <section className="animate-fade-up mt-6 rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-8">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
            <Swords className="size-7 text-primary" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">Step up to the mic-less mic</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            You get a topic, you write 2-4 bars, and a rival you never meet answers back. The
            judge decides — clean wins pay 15 XP, losses still pay 7.
          </p>
          <Button className="mt-5" onClick={() => void start()}>
            <Swords className="size-4" /> Start the duel
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">1 duel a day on Free</p>
        </div>
        <Paywall open={paywallOpen} onOpenChange={setPaywallOpen} metric="duel" />
      </section>
    );
  }

  if (phase === "judging") {
    return (
      <section className="mt-6 rounded-3xl border border-border bg-card p-8 shadow-xs">
        <div className="flex flex-col items-center py-6 text-center">
          <Loader2 className="size-7 animate-spin text-primary" />
          <p className="mt-4 text-sm font-medium">
            {judgingFor === "start" ? "Picking your beat…" : "The judge is listening…"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {judgingFor === "start" ? "Choosing a topic" : "Scoring both bars"}
          </p>
        </div>
      </section>
    );
  }

  if (phase === "result" && verdict && topic) {
    const headline =
      verdict.winner === "you"
        ? "You took the round"
        : verdict.winner === "rival"
          ? "The rival takes it"
          : "Dead even";
    return (
      <section className="animate-fade-up mt-6 rounded-3xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <div className="flex items-center gap-2">
          <Trophy
            className={cn(
              "size-5",
              verdict.winner === "you" ? "text-primary" : "text-muted-foreground"
            )}
          />
          <h2 className="text-lg font-semibold">{headline}</h2>
          <span className="ml-auto rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            +{xp} XP
          </span>
        </div>

        <div className="mt-4 space-y-4">
          <ScoreRow label="Your bar" score={verdict.you} mine />
          <ScoreRow label="Rival bar" score={verdict.rivalScore} />
        </div>

        <p className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm leading-relaxed">
          {verdict.note}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <p className="text-eyebrow">Yours</p>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{bar.trim()}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
            <p className="text-eyebrow">Rival</p>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{verdict.rival}</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={() => void start()}>
            <RotateCcw className="size-4" /> Rematch
          </Button>
        </div>
        <Paywall open={paywallOpen} onOpenChange={setPaywallOpen} metric="duel" />
      </section>
    );
  }

  return (
    <section className="animate-fade-up mt-6 rounded-3xl border border-border bg-card p-4 shadow-xs sm:p-6">
      {topic && (
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <p className="text-eyebrow">The beat · {topic.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{topic.prompt}</p>
        </div>
      )}

      <textarea
        value={bar}
        onChange={(e) => setBar(e.target.value)}
        rows={6}
        placeholder={"Drop 2-4 lines here…\nThe rival goes right after you."}
        className="mt-4 min-h-40 w-full resize-y rounded-2xl border border-input bg-background p-4 text-[15px] leading-relaxed outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{words} words</span>
        <span>1 duel a day on Free</span>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={() => void submit()} disabled={bar.trim().length < 16}>
          <Swords className="size-4" /> Drop your bar
        </Button>
      </div>
      <Paywall open={paywallOpen} onOpenChange={setPaywallOpen} metric="duel" />
    </section>
  );
}
