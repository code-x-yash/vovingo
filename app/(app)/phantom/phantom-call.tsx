"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRight,
  Mic,
  Phone,
  PhoneOff,
  Send,
  Sparkles,
  Square,
  Type,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { isQuotaWall, Paywall } from "@/components/billing/paywall";
import { cn } from "@/lib/utils";

export type CallContact = {
  id: number;
  title: string;
  category: string;
  description: string;
  opening: string | null;
  persona: { role: string; name?: string; style?: string; opening?: string } | null;
};

type Phase = "dialer" | "ringing" | "connected" | "report";
type Msg = { role: "user" | "ai"; content: string };

type SpeechAlternativeLike = { transcript: string };
type SpeechResultLike = { isFinal: boolean; 0: SpeechAlternativeLike };
type SpeechEventLike = { resultIndex: number; results: ArrayLike<SpeechResultLike> };
type SpeechErrorLike = { error?: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechEventLike) => void) | null;
  onerror: ((e: SpeechErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const wordCount = (t: string) => t.split(/\s+/).filter(Boolean).length;
const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function callerName(c: CallContact): string {
  return c.persona?.name ?? c.persona?.role ?? c.title;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

const SPEAKING_MODES = new Set(["free", "topic", "situation", "roleplay"]);

export function PhantomCall({ contacts }: { contacts: CallContact[] }) {
  const [phase, setPhase] = useState<Phase>("dialer");
  const [contact, setContact] = useState<CallContact | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [draft, setDraft] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [typed, setTyped] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [sending, setSending] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallMetric, setPaywallMetric] = useState<"conversation" | "speaking">(
    "conversation"
  );
  const [report, setReport] = useState<{
    turns: number;
    words: number;
    seconds: number;
    detected: number;
  } | null>(null);
  const [scoreResult, setScoreResult] = useState<{ avg: number; summary: string } | null>(
    null
  );
  const [scoring, setScoring] = useState(false);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const speakerRef = useRef(true);
  const cancelledRef = useRef(false);
  const userTurnsRef = useRef<string[]>([]);
  const detectedRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    speakerRef.current = speakerOn;
  }, [speakerOn]);

  useEffect(() => {
    if (phase !== "connected") return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    recRef.current = null;
    setListening(false);
    setInterim("");
  }, []);

  useEffect(
    () => () => {
      listeningRef.current = false;
      try {
        recRef.current?.stop();
      } catch {
        /* unmounting */
      }
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* unmounting */
      }
    },
    []
  );

  function speak(text: string) {
    if (!speakerRef.current || !text) return;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "en-US";
      synth.speak(utter);
    } catch {
      /* captions still show the line */
    }
  }

  function startListening() {
    const SR = getSpeechRecognition();
    if (!SR) {
      setTyped(true);
      toast.info("Speech recognition isn't available here — type your reply.");
      return;
    }
    if (listeningRef.current) return;
    listeningRef.current = true;
    setListening(true);
    setTyped(false);
    try {
      const rec = new SR();
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event) => {
        let live = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            setDraft((prev) => `${prev} ${res[0].transcript}`.trim());
          } else {
            live += res[0].transcript;
          }
        }
        setInterim(live);
      };
      rec.onerror = (event) => {
        if (!listeningRef.current) return;
        const code = event?.error ?? "unknown";
        if (code === "network") {
          stopListening();
          setTyped(true);
          toast.error("Speech service unreachable — type your reply instead.");
        } else if (code === "not-allowed" || code === "service-not-allowed") {
          stopListening();
          setTyped(true);
          toast.error("Mic blocked — allow the microphone or type your reply.");
        }
      };
      rec.onend = () => {
        if (!listeningRef.current || recRef.current !== rec) return;
        window.setTimeout(() => {
          if (!listeningRef.current || recRef.current !== rec) return;
          try {
            rec.start();
          } catch {
            /* restarting */
          }
        }, 350);
      };
      recRef.current = rec;
      rec.start();
    } catch {
      listeningRef.current = false;
      setListening(false);
      setTyped(true);
      toast.error("Couldn't start the mic — type your reply instead.");
    }
  }

  async function dial(c: CallContact) {
    setContact(c);
    setPhase("ringing");
    setMessages([]);
    setElapsed(0);
    setDraft("");
    setInterim("");
    setReport(null);
    setScoreResult(null);
    setConversationId(null);
    cancelledRef.current = false;
    userTurnsRef.current = [];
    detectedRef.current = 0;
    if (!getSpeechRecognition()) setTyped(true);

    const minRing = new Promise<void>((resolve) => setTimeout(resolve, 1500));
    try {
      const res = await fetch("/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", scenarioId: c.id }),
      });
      const data = (await res.json().catch(() => null)) as {
        id?: number;
        messages?: Msg[];
        error?: string;
      } | null;
      await minRing;
      if (cancelledRef.current) return;
      if (!res.ok || !data?.id) {
        toast.error(data?.error ?? "Couldn't connect — try again.");
        setPhase("dialer");
        return;
      }
      setConversationId(data.id);
      const msgs = Array.isArray(data.messages) ? data.messages : [];
      setMessages(msgs);
      setPhase("connected");
      const lastAi = [...msgs].reverse().find((m) => m.role === "ai");
      if (lastAi) speak(lastAi.content);
    } catch {
      await minRing;
      if (cancelledRef.current) return;
      toast.error("Network error — the call didn't go through.");
      setPhase("dialer");
    }
  }

  function cancelRing() {
    cancelledRef.current = true;
    stopListening();
    setPhase("dialer");
  }

  async function sendTurn() {
    const text = draft.trim() || interim.trim();
    if (!conversationId) return;
    if (!text) {
      toast.error("Say something first.");
      return;
    }
    stopListening();
    setSending(true);
    setDraft("");
    setInterim("");
    userTurnsRef.current.push(text);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    try {
      const res = await fetch("/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", conversationId, message: text }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        detected?: unknown[];
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        setMessages((prev) => prev.slice(0, -1));
        userTurnsRef.current.pop();
        if (isQuotaWall(res.status, data)) {
          setPaywallMetric("conversation");
          setPaywallOpen(true);
          return;
        }
        toast.error(data.error ?? "The call dropped — try again.");
        return;
      }
      if (Array.isArray(data.detected)) detectedRef.current += data.detected.length;
      const reply = data.reply ?? "…";
      setMessages((prev) => [...prev, { role: "ai", content: reply }]);
      speak(reply);
    } catch {
      setMessages((prev) => prev.slice(0, -1));
      userTurnsRef.current.pop();
      toast.error("Network error — reply not delivered.");
    } finally {
      setSending(false);
    }
  }

  async function endCall() {
    stopListening();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ending */
    }
    const text = userTurnsRef.current.join(" ");
    setReport({
      turns: userTurnsRef.current.length,
      words: wordCount(text),
      seconds: elapsed,
      detected: detectedRef.current,
    });
    setPhase("report");
    if (conversationId) {
      try {
        await fetch("/api/conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "end", conversationId }),
        });
      } catch {
        /* the report matters more than the goodbye */
      }
    }
  }

  async function scoreCall() {
    if (!contact) return;
    const text = userTurnsRef.current.join(" ").trim();
    if (wordCount(text) < 3) {
      toast.error("Speak at least 3 words to get a score.");
      return;
    }
    setScoring(true);
    try {
      const mode = SPEAKING_MODES.has(contact.category) ? contact.category : "roleplay";
      const res = await fetch("/api/speaking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          scenarioId: contact.id,
          prompt: contact.opening ?? contact.title,
          transcript: text,
          durationSec: Math.max(1, report?.seconds ?? 1),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        analysis?: { scores?: Record<string, number>; summary?: string };
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        if (isQuotaWall(res.status, data)) {
          setPaywallMetric("speaking");
          setPaywallOpen(true);
          return;
        }
        toast.error(data.error ?? "Couldn't score the call.");
        return;
      }
      const scores = Object.values(data.analysis?.scores ?? {});
      const avg =
        scores.length > 0
          ? Math.round(scores.reduce((sum, v) => sum + v, 0) / scores.length)
          : 0;
      setScoreResult({ avg, summary: data.analysis?.summary ?? "" });
      toast.success("Call scored");
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setScoring(false);
    }
  }

  function hangUpAndRestart() {
    if (contact) void dial(contact);
  }

  const name = contact ? callerName(contact) : "";
  const draftWords = wordCount(draft.trim() || interim.trim());

  if (phase === "dialer") {
    return (
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {contacts.map((c) => {
          const who = callerName(c);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => void dial(c)}
              className="interactive-card group rounded-2xl border border-border bg-card p-4 text-left shadow-xs sm:p-5"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary transition-colors group-hover:bg-primary/15">
                  {initialsOf(who)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15px] font-semibold">{who}</span>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                      {c.category}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.title}</p>
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                    {c.description}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                    <Phone className="size-3.5" /> Tap to call
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  if (phase === "ringing" && contact) {
    return (
      <div className="mt-6 flex flex-col items-center rounded-3xl border border-border bg-card px-6 py-14 text-center shadow-xs">
        <div className="relative">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/25" />
          <span className="relative grid size-20 place-items-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
            {initialsOf(name)}
          </span>
        </div>
        <p className="text-h3 mt-6">{name}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">Calling…</p>
        <div className="mt-7">
          <Button variant="outline" onClick={cancelRing}>
            <PhoneOff className="size-4" /> Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "connected" && contact) {
    return (
      <>
        <section className="animate-fade-up mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-background/60 px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {initialsOf(name)}
                <span className="absolute -inset-1 animate-pulse rounded-full border border-primary/40" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{name}</p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {mmss(elapsed)} · {contact.title}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSpeakerOn((v) => !v)}
                aria-label={speakerOn ? "Mute voice" : "Unmute voice"}
                className={cn(
                  "grid size-9 place-items-center rounded-full border transition-colors",
                  speakerOn
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground"
                )}
              >
                {speakerOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              </button>
              <button
                type="button"
                onClick={() => void endCall()}
                aria-label="End call"
                className="grid size-9 place-items-center rounded-full bg-destructive text-white transition-colors hover:bg-destructive/90"
              >
                <PhoneOff className="size-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="max-h-[46vh] min-h-56 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
            {messages.map((m, i) =>
              m.role === "ai" ? (
                <div key={i} className="max-w-[85%]">
                  <p className="text-eyebrow">{name}</p>
                  <p className="mt-1.5 text-[17px] leading-relaxed text-foreground">
                    {m.content}
                  </p>
                </div>
              ) : (
                <div key={i} className="ml-auto max-w-[85%] text-right">
                  <p className="text-eyebrow">You</p>
                  <p className="mt-1.5 inline-block rounded-2xl rounded-tr-sm bg-primary/10 px-3.5 py-2 text-left text-[15px] leading-relaxed">
                    {m.content}
                  </p>
                </div>
              )
            )}
            {sending && (
              <p className="text-xs text-muted-foreground">{name} is thinking…</p>
            )}
            {!sending && listening && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
                {interim || "Listening…"}
              </p>
            )}
          </div>

          <div className="border-t border-border/70 bg-background/60 px-4 py-4 sm:px-5">
            {typed ? (
              <div className="flex items-end gap-2">
                <textarea
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendTurn();
                    }
                  }}
                  rows={2}
                  placeholder={`Reply to ${name}…`}
                  className="min-h-16 w-full resize-none rounded-2xl border border-input bg-background px-3.5 py-2.5 text-sm leading-relaxed outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                />
                <Button
                  size="icon"
                  onClick={() => void sendTurn()}
                  disabled={sending || draftWords < 1}
                  aria-label="Send reply"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => (listening ? stopListening() : startListening())}
                  aria-label={listening ? "Stop listening" : "Speak your reply"}
                  className={cn(
                    "grid size-12 shrink-0 place-items-center rounded-full transition-all",
                    listening
                      ? "animate-recording-pulse bg-destructive text-white"
                      : "bg-primary text-primary-foreground shadow-md hover:scale-105 active:scale-95"
                  )}
                >
                  {listening ? <Square className="size-5 fill-current" /> : <Mic className="size-6" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-muted-foreground">
                    {interim || draft || (listening ? "Listening…" : "Tap the mic and speak")}
                  </p>
                  {draftWords > 0 && (
                    <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                      {draftWords} words ready
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    stopListening();
                    setTyped(true);
                  }}
                >
                  <Type /> Type
                </Button>
                <Button
                  onClick={() => void sendTurn()}
                  disabled={sending || draftWords < 1}
                >
                  <Send className="size-4" />
                </Button>
              </div>
            )}
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Each reply uses 1 conversation credit</span>
              <button
                type="button"
                onClick={() => setTyped((v) => !v)}
                className="underline-offset-2 hover:underline"
              >
                {typed ? "Speak instead" : "Type instead"}
              </button>
            </div>
          </div>
        </section>

        <Paywall
          open={paywallOpen}
          onOpenChange={setPaywallOpen}
          metric={paywallMetric}
        />
      </>
    );
  }

  if (phase === "report" && report) {
    return (
      <>
        <section className="animate-fade-up mt-6 rounded-3xl border border-border bg-card p-5 shadow-xs sm:p-7">
          <p className="text-eyebrow">Call ended</p>
          <h2 className="text-h2 mt-2.5">
            {contact ? `With ${callerName(contact)}` : "Nice chat"}
          </h2>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { value: mmss(report.seconds), label: "on the call" },
              { value: report.turns, label: "replies" },
              { value: report.words, label: "words spoken" },
              { value: report.detected, label: "patterns caught" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-border/70 bg-background/60 p-4 text-center"
              >
                <p className="text-h3 tabular-nums">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-primary/25 bg-primary/5 p-4">
            {scoreResult ? (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-eyebrow">Speech score</p>
                  <p className="text-display text-gradient tabular-nums">{scoreResult.avg}</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {scoreResult.summary}
                </p>
                <Link
                  href="/speaking"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  Open speaking studio <ArrowRight className="size-3" />
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Want the full analysis?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Score your half of the call like any other speaking take — grammar,
                  fluency, fillers and all.
                </p>
                <div className="mt-3">
                  <Button onClick={() => void scoreCall()} disabled={scoring}>
                    <Sparkles className="size-4" />
                    {scoring ? "Analysing…" : "Analyse my speech"}
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={hangUpAndRestart}>
              <Phone className="size-4" /> Call again
            </Button>
            <Button variant="outline" onClick={() => setPhase("dialer")}>
              Change contact
            </Button>
            <Button variant="ghost" render={<Link href="/conversation" />}>
              Open in AI Coach
            </Button>
          </div>
        </section>

        <Paywall
          open={paywallOpen}
          onOpenChange={setPaywallOpen}
          metric={paywallMetric}
        />
      </>
    );
  }

  return null;
}
