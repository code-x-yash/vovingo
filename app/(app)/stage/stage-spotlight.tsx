"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Clapperboard, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isQuotaWall, Paywall } from "@/components/billing/paywall";
import { cn } from "@/lib/utils";
import type { AudienceVerdict, StagePrompt } from "@/lib/stage/engine";

type Phase = "idle" | "judging" | "result";

export function StageSpotlight() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [judgingFor, setJudgingFor] = useState<"start" | "verdict">("start");
  const [prompt, setPrompt] = useState<StagePrompt | null>(null);
  const [take, setTake] = useState("");
  const [verdict, setVerdict] = useState<AudienceVerdict | null>(null);
  const [xp, setXp] = useState(0);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const words = take.trim() ? take.trim().split(/\s+/).length : 0;

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
    setTake("");
    try {
      const res = await fetch("/api/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const data = await handle(res);
      if (!data) {
        setPhase("idle");
        return;
      }
      setPrompt(data.prompt as StagePrompt);
      setPhase("idle");
    } catch {
      toast.error("Network error — try again.");
      setPhase("idle");
    }
  }

  async function submit() {
    if (!prompt) return;
    const trimmed = take.trim();
    if (trimmed.length < 40) {
      toast.error("Give the audience at least a couple of sentences.");
      return;
    }
    setJudgingFor("verdict");
    setPhase("judging");
    try {
      const res = await fetch("/api/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", promptId: prompt.id, take: trimmed }),
      });
      const data = await handle(res);
      if (!data) return;
      setVerdict(data.verdict as AudienceVerdict);
      setXp(data.xp as number);
      setPhase("result");
      toast.success(`+${data.xp as number} XP logged`);
    } catch {
      toast.error("Network error — try again.");
      setPhase("idle");
    }
  }

  if (phase === "judging") {
    return (
      <section className="mt-6 rounded-3xl border border-border bg-card p-8 shadow-xs">
        <div className="flex flex-col items-center py-6 text-center">
          <Loader2 className="size-7 animate-spin text-primary" />
          <p className="mt-4 text-sm font-medium">
            {judgingFor === "start" ? "Writing your prompt…" : "The audience is reacting…"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {judgingFor === "start" ? "Finding the right scene" : "Counting the cheers"}
          </p>
        </div>
      </section>
    );
  }

  if (phase === "result" && verdict && prompt) {
    const cheering = verdict.cheers >= 68;
    return (
      <section className="animate-fade-up mt-6 rounded-3xl border border-border bg-card p-4 shadow-xs sm:p-6">
        <div className="flex items-center gap-2">
          <Sparkles
            className={cn("size-5", cheering ? "text-primary" : "text-muted-foreground")}
          />
          <h2 className="text-lg font-semibold">{verdict.verdict}</h2>
          <span className="ml-auto rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            +{xp} XP
          </span>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">Crowd energy</span>
            <span className="tabular-nums font-semibold">{verdict.cheers}/100</span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                cheering ? "bg-primary" : "bg-foreground/40"
              )}
              style={{ width: `${verdict.cheers}%` }}
            />
          </div>
        </div>

        <p className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm leading-relaxed">
          {verdict.note}
        </p>

        <div className="mt-4 rounded-2xl border border-border/70 bg-background/50 p-4">
          <p className="text-eyebrow">Your take · {prompt.title}</p>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{take.trim()}</p>
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={() => void start()}>
            <RotateCcw className="size-4" /> Take another bow
          </Button>
        </div>
        <Paywall open={paywallOpen} onOpenChange={setPaywallOpen} metric="stage" />
      </section>
    );
  }

  return (
    <section className="animate-fade-up mt-6 rounded-3xl border border-border bg-card p-4 shadow-xs sm:p-6">
      {!prompt ? (
        <div className="mx-auto max-w-md py-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
            <Clapperboard className="size-7 text-primary" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">House lights down</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            You get a scene, you deliver the take, and the audience decides — standing ovation
            pays 15 XP, even the crickets pay 7.
          </p>
          <Button className="mt-5" onClick={() => void start()}>
            <Clapperboard className="size-4" /> Step into the scene
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">1 stage take a day on Free</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <p className="text-eyebrow">The scene · {prompt.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{prompt.prompt}</p>
          </div>

          <textarea
            value={take}
            onChange={(e) => setTake(e.target.value)}
            rows={7}
            placeholder="Lights on. Deliver your monologue…"
            className="mt-4 min-h-44 w-full resize-y rounded-2xl border border-input bg-background p-4 text-[15px] leading-relaxed outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{words} words</span>
            <span>1 stage take a day on Free</span>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={() => void submit()} disabled={take.trim().length < 40}>
              <Clapperboard className="size-4" /> Face the audience
            </Button>
          </div>
        </>
      )}
      <Paywall open={paywallOpen} onOpenChange={setPaywallOpen} metric="stage" />
    </section>
  );
}
