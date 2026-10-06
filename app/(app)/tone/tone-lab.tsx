"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, ClipboardCopy, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isQuotaWall, Paywall } from "@/components/billing/paywall";
import { cn } from "@/lib/utils";
import { REGISTERS, REGISTER_LABEL, type Register, type ToneReport } from "@/lib/ai/tone";

type Mode = "check" | "register";

export function ToneLab() {
  const [mode, setMode] = useState<Mode>("check");
  const [text, setText] = useState("");
  const [register, setRegister] = useState<Register>("formal");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ToneReport | null>(null);
  const [rewrite, setRewrite] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  async function run() {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("Paste some text first.");
      return;
    }
    setLoading(true);
    setReport(null);
    setRewrite(null);
    setCopied(false);
    try {
      const res = await fetch("/api/ai/tone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "check"
            ? { action: "check", text: trimmed }
            : { action: "register", text: trimmed, register }
        ),
      });
      const data = (await res.json().catch(() => ({}))) as {
        report?: ToneReport;
        output?: string;
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        if (isQuotaWall(res.status, data)) {
          setPaywallOpen(true);
          return;
        }
        toast.error(data.error ?? "Something went wrong.");
        return;
      }
      if (mode === "check") {
        if (!data.report) {
          toast.error("Couldn't read that text.");
          return;
        }
        setReport(data.report);
      } else {
        if (!data.output) {
          toast.error("Couldn't rewrite that text.");
          return;
        }
        setRewrite(data.output);
      }
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyRewrite() {
    if (!rewrite) return;
    try {
      await navigator.clipboard.writeText(rewrite);
      setCopied(true);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't reach the clipboard.");
    }
  }

  const TONE_STYLE: Record<string, string> = {
    casual: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300",
    formal: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
    friendly: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    confident: "border-primary/30 bg-primary/10 text-primary",
    hedged: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    technical: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300",
    neutral: "border-border bg-muted text-muted-foreground",
  };

  return (
    <section className="animate-fade-up mt-6 rounded-3xl border border-border bg-card p-4 shadow-xs sm:p-6">
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-border/70 bg-background/60 p-1.5">
        {(
          [
            { key: "check", label: "Tone check", icon: Sparkles },
            { key: "register", label: "Switch register", icon: Wand2 },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setMode(tab.key);
              setReport(null);
              setRewrite(null);
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              mode === tab.key
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        placeholder="Paste the email, message or post you're about to send…"
        className="mt-4 min-h-40 w-full resize-y rounded-2xl border border-input bg-background p-4 text-[15px] leading-relaxed outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{words} words</span>
        <span>3 checks a day on Free</span>
      </div>

      {mode === "register" && (
        <div className="mt-4">
          <p className="text-eyebrow">Target register</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {REGISTERS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRegister(r)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  register === r
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {REGISTER_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button onClick={() => void run()} disabled={loading || !text.trim()}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Working…
            </>
          ) : mode === "check" ? (
            <>
              <Sparkles className="size-4" /> Check the tone
            </>
          ) : (
            <>
              <Wand2 className="size-4" /> Rewrite as {REGISTER_LABEL[register].toLowerCase()}
            </>
          )}
        </Button>
      </div>

      {report && (
        <div className="mt-5 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
          <p className="text-eyebrow">How it lands</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {report.tones.map((tone) => (
              <span
                key={tone.label}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium",
                  TONE_STYLE[tone.label] ?? TONE_STYLE.neutral
                )}
              >
                {tone.label} · {Math.round(tone.confidence * 100)}%
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{report.summary}</p>
          <ul className="mt-3 space-y-1.5">
            {report.tones.map((tone) => (
              <li key={tone.label} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" />
                <span>{tone.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rewrite && (
        <div className="mt-5 space-y-3">
          <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-eyebrow">Original</p>
              <span className="text-[11px] text-muted-foreground">{REGISTER_LABEL[register]}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
          </div>
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-eyebrow">Rewritten</p>
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => void copyRewrite()}>
                  {copied ? <Check /> : <ClipboardCopy />} {copied ? "Copied" : "Copy"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setText(rewrite);
                    setRewrite(null);
                    toast.success("Rewrite moved into the editor");
                  }}
                >
                  Use it <ArrowRight />
                </Button>
              </div>
            </div>
            <p className="mt-2 text-sm leading-relaxed">{rewrite}</p>
          </div>
        </div>
      )}

      <Paywall open={paywallOpen} onOpenChange={setPaywallOpen} metric="tone" />
    </section>
  );
}
