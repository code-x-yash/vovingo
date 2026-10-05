"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  Lightbulb,
  MessageCircle,
  Mic,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Type,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { googleSpeechHostReachable, speechFailureFor } from "@/lib/speech";
import { cn } from "@/lib/utils";
import type { RecentSession, ScenarioPrompt, SpeakingMode } from "@/lib/speaking/store";

type Chosen = { mode: SpeakingMode; scenarioId: number | null; prompt: string; label: string };

type Analysis = {
  summary: string;
  scores: Record<string, number>;
  metrics: {
    wordCount: number;
    uniqueWordCount: number;
    wpm: number;
    pauseCount: number;
    longPauseCount: number;
    fillerCount: number;
  };
  mistakes: { key: string; title: string; wrong: string; correct: string; why: string; severity: string }[];
  recommendations: { title: string; body: string }[];
};

type SubmitResponse = { sessionId: number; analysis: Analysis; planXp: number; error?: string };

const SCORE_LABELS: Record<string, string> = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  fluency: "Fluency",
  pronunciation: "Pronunciation",
  confidence: "Confidence",
  naturalness: "Naturalness",
};

const wordCount = (t: string) => t.split(/\s+/).filter(Boolean).length;
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// Minimal structural types for the Web Speech API (not in TS lib.dom).
type SpeechAlternativeLike = { transcript: string };
type SpeechResultLike = { isFinal: boolean; 0: SpeechAlternativeLike };
type SpeechEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechResultLike>;
};
type SpeechErrorLike = { error?: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onresult: ((e: SpeechEventLike) => void) | null;
  onerror: ((e: SpeechErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionOptionsLike = { langs: string[]; processLocally?: boolean };
type SpeechRecognitionStatics = {
  available?: (options: SpeechRecognitionOptionsLike) => Promise<string>;
  install?: (options: SpeechRecognitionOptionsLike) => Promise<boolean>;
};
type SpeechRecognitionCtor = (new () => SpeechRecognitionLike) & SpeechRecognitionStatics;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const CATEGORY_MODE: Record<string, SpeakingMode> = {
  free: "free",
  topic: "topic",
  situation: "situation",
  roleplay: "roleplay",
};

const CATEGORY_ICON: Record<string, typeof Mic> = {
  free: Mic,
  topic: Sparkles,
  situation: MessageCircle,
  roleplay: Users,
};

function averageOf(scores: Record<string, number>): number {
  const values = Object.values(scores);
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function ratingFor(score: number): string {
  if (score >= 85) return "Strong command";
  if (score >= 70) return "Good progress";
  if (score >= 55) return "Building";
  return "Keep going";
}

export function SpeakingStudio({
  initial,
}: {
  initial: { scenarios: ScenarioPrompt[]; topics: string[]; recent: RecentSession[] };
}) {
  const [stage, setStage] = useState<"pick" | "record" | "review" | "result">("pick");
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [recent, setRecent] = useState<RecentSession[]>(initial.recent);
  const [editText, setEditText] = useState(false);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const recordingRef = useRef(false);
  const errorToastRef = useRef(false);
  const sawErrorRef = useRef(false);
  const errorRestartsRef = useRef(0);
  const cloudFallbackTriedRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const [uploadedAudio, setUploadedAudio] = useState<string | null>(null);

  useEffect(() => {
    if (stage !== "record") return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [stage]);

  const stopAudioCapture = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* already stopped */
      }
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  }, []);

  const startAudioCapture = useCallback(async () => {
    audioBlobRef.current = null;
    audioChunksRef.current = [];
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
      if (typeof MediaRecorder === "undefined") return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!recordingRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
      const mime = candidates.find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioBlobRef.current = blob.size > 0 ? blob : null;
        audioChunksRef.current = [];
      };
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch {
      /* capture is a bonus — transcription still works without it */
    }
  }, []);

  const stopRecognition = useCallback(() => {
    recordingRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    recRef.current = null;
    setRecording(false);
    setInterim("");
    stopAudioCapture();
  }, [stopAudioCapture]);

  useEffect(() => () => stopRecognition(), [stopRecognition]);

  function attachAndStart(SR: SpeechRecognitionCtor, useLocal: boolean) {
    // The user may have pressed Stop while we checked/installed the offline pack.
    if (!recordingRef.current) return;
    try {
      const rec = new SR();
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = true;
      if (useLocal) rec.processLocally = true;
      rec.onresult = (event: SpeechEventLike) => {
        let live = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            setTranscript((prev) => `${prev} ${res[0].transcript}`.trim());
          } else {
            live += res[0].transcript;
          }
        }
        setInterim(live);
      };
      rec.onerror = (event: SpeechErrorLike) => {
        if (!recordingRef.current) return;
        const code = event?.error ?? "unknown";
        console.warn("[speech] recognition error:", code, useLocal ? "(local)" : "(cloud)");
        // Offline pack raced us (or wasn't really installed) — fall back to cloud once.
        if (code === "language-not-supported" && useLocal && !cloudFallbackTriedRef.current) {
          cloudFallbackTriedRef.current = true;
          try {
            rec.stop();
          } catch {
            /* already stopped */
          }
          attachAndStart(SR, false);
          return;
        }
        const failure = speechFailureFor(code);
        if (!failure) return;
        if (!errorToastRef.current) {
          errorToastRef.current = true;
          if (code === "network") {
            stopRecognition();
            setTyped(true);
            void googleSpeechHostReachable().then((reachable) => {
              toast.error(
                reachable
                  ? "Speech recognition couldn't start — an ad blocker or privacy extension often blocks Google's speech service. Type your answer, or allow google.com for this site."
                  : "Can't reach Google's speech service from this browser — check your connection, proxy, or region, then type your answer."
              );
            });
            return;
          }
          toast.error(failure.message);
        }
        if (failure.fallback === "typing") {
          stopRecognition();
          setTyped(true);
        } else {
          sawErrorRef.current = true;
        }
      };
      rec.onend = () => {
        // Chrome ends recognition after long silences — restart while recording.
        if (!recordingRef.current || recRef.current !== rec) return;
        if (sawErrorRef.current) {
          // Cap error-driven restarts so a failing service can't loop forever.
          sawErrorRef.current = false;
          errorRestartsRef.current += 1;
          if (errorRestartsRef.current >= 3) {
            stopRecognition();
            setTyped(true);
            toast.error("Speech recognition keeps failing — type your answer instead.");
            return;
          }
        }
        window.setTimeout(() => {
          if (!recordingRef.current || recRef.current !== rec) return;
          try {
            rec.start();
          } catch {
            /* restarting */
          }
        }, 350);
      };
      recRef.current = rec;
      rec.start();
      setTyped(false);
      void startAudioCapture();
    } catch {
      recordingRef.current = false;
      recRef.current = null;
      setRecording(false);
      setTyped(true);
      toast.error("Couldn't start the microphone — type your answer instead.");
    }
  }

  // On-device first (Chrome 142+): recognition runs locally, so ad blockers,
  // proxies and region blocks on Google's cloud service can't break it.
  async function beginWithBestMode(SR: SpeechRecognitionCtor) {
    let useLocal = false;
    try {
      if (typeof SR.available === "function") {
        const status = await SR.available({ langs: ["en-US"], processLocally: true });
        if (status === "available") {
          useLocal = true;
        } else if (status === "downloadable" || status === "downloading") {
          toast.info("Downloading offline speech recognition — one time only…");
          const installed =
            typeof SR.install === "function"
              ? await SR.install({ langs: ["en-US"], processLocally: true })
              : false;
          if (installed) {
            useLocal = true;
            toast.success("Offline speech recognition ready.");
          } else {
            toast.error("Offline speech pack couldn't download — trying online recognition instead.");
          }
        }
      }
    } catch {
      useLocal = false;
    }
    attachAndStart(SR, useLocal);
  }

  function startRecognition() {
    const SR = getSpeechRecognition();
    if (!SR) {
      setTyped(true);
      toast.info("Speech recognition isn't available in this browser — type your answer.");
      return;
    }
    if (recordingRef.current) return;
    recordingRef.current = true;
    setRecording(true);
    setTyped(false);
    errorToastRef.current = false;
    sawErrorRef.current = false;
    errorRestartsRef.current = 0;
    cloudFallbackTriedRef.current = false;
    void beginWithBestMode(SR);
  }

  function pickPrompt(next: Chosen) {
    setChosen(next);
    setTranscript("");
    setInterim("");
    setElapsed(0);
    setResult(null);
    setEditText(false);
    audioBlobRef.current = null;
    setUploadedAudio(null);
    const SR = getSpeechRecognition();
    setTyped(!SR);
    setStage("record");
    if (!SR) toast.info("Speech recognition isn't available here — type your answer.");
  }

  function toggleRecord() {
    if (recording) {
      stopRecognition();
    } else {
      setTranscript("");
      startRecognition();
    }
  }

  function switchToTyping() {
    stopRecognition();
    setTyped(true);
  }

  function toReview() {
    stopRecognition();
    setStage("review");
  }

  const uploadTakeAudio = useCallback(async (sessionId: number, blob: Blob) => {
    try {
      const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
      const form = new FormData();
      form.append("sessionId", String(sessionId));
      form.append("file", blob, `take.${ext}`);
      const res = await fetch("/api/speaking/audio", { method: "POST", body: form });
      if (!res.ok) return;
      const data = (await res.json()) as { audioUrl?: string };
      if (data.audioUrl) setUploadedAudio(data.audioUrl);
    } catch {
      /* best-effort — the analysis already succeeded */
    }
  }, []);

  async function submit() {
    if (!chosen) return;
    const finalText = transcript.trim();
    if (wordCount(finalText) < 3) {
      toast.error("Give at least 3 words to analyse.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/speaking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: chosen.mode,
          scenarioId: chosen.scenarioId,
          prompt: chosen.prompt,
          transcript: finalText,
          durationSec: Math.max(1, elapsed),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as SubmitResponse;
      if (!res.ok) {
        toast.error(data.error ?? "Something went wrong.");
        return;
      }
      setResult(data);
      if (data.planXp) toast.success(`Daily plan complete — +${data.planXp} XP`);
      const blob = audioBlobRef.current;
      if (blob && blob.size > 0) void uploadTakeAudio(data.sessionId, blob);
      setRecent((prev) => [
        {
          id: data.sessionId,
          mode: chosen.mode,
          prompt: chosen.prompt,
          wpm: data.analysis.metrics.wpm,
          wordCount: data.analysis.metrics.wordCount,
          scores: data.analysis.scores,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setStage("result");
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function backToPick() {
    stopRecognition();
    setStage("pick");
    setChosen(null);
    setResult(null);
    setTranscript("");
    setElapsed(0);
    audioBlobRef.current = null;
    setUploadedAudio(null);
  }

  const words = wordCount(transcript);
  const avgScore = result ? averageOf(result.analysis.scores) : 0;

  return (
    <div className="flex flex-1 flex-col gap-8">
      {stage === "pick" && (
        <>
          <section className="animate-fade-up">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-h3">Pick a scenario</h2>
              <span className="text-xs text-muted-foreground">structured practice</span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {initial.scenarios.map((s) => {
                const Icon = CATEGORY_ICON[s.category] ?? Sparkles;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      pickPrompt({
                        mode: CATEGORY_MODE[s.category] ?? "situation",
                        scenarioId: s.id,
                        prompt: s.openingPrompt ?? s.title,
                        label: s.title,
                      })
                    }
                    className="interactive-card group rounded-2xl border border-border bg-card p-4 text-left shadow-xs sm:p-5"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                        <Icon className="size-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[15px] font-semibold">{s.title}</span>
                          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                            {s.category}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {s.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="animate-fade-up">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-h3">or just talk</h2>
              <span className="text-xs text-muted-foreground">free practice</span>
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {initial.topics.map((t) => (
                <li key={t}>
                  <button
                    type="button"
                    onClick={() =>
                      pickPrompt({ mode: "free", scenarioId: null, prompt: t, label: t })
                    }
                    className="interactive-card flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm shadow-xs"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Mic className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t}</span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {recent.length > 0 && (
            <section className="animate-fade-up">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-h3">Recent takes</h2>
                <span className="text-xs text-muted-foreground">last {Math.min(5, recent.length)}</span>
              </div>
              <ul className="mt-3 divide-y divide-border/70 rounded-2xl border border-border bg-card shadow-xs">
                {recent.slice(0, 5).map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {r.prompt ?? "Free talk"}
                    </span>
                    <span className="text-xs">
                      fluency <b className="font-semibold">{Math.round(r.scores.fluency ?? 0)}</b>
                    </span>
                    <span className="text-xs">
                      grammar <b className="font-semibold">{Math.round(r.scores.grammar ?? 0)}</b>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.createdAt.slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {stage === "record" && chosen && (
        <section className="animate-fade-up relative flex flex-col items-center overflow-hidden rounded-3xl border border-border bg-card px-4 py-8 text-center shadow-xs sm:px-10 sm:py-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[480px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
          />

          <div className="relative w-full">
            <p className="text-eyebrow">
              {chosen.scenarioId ? "Scenario" : "Topic"}
            </p>
            <p className="text-h2 mx-auto mt-3 max-w-xl">{chosen.prompt}</p>

            {!typed ? (
              <>
                <p className="mt-6 font-mono text-5xl font-medium tabular-nums">{mmss(elapsed)}</p>
                <p className="mt-2 flex items-center justify-center gap-2 text-sm">
                  {recording ? (
                    <span className="inline-flex items-center gap-1.5 font-medium text-destructive">
                      <span className="size-2 animate-pulse rounded-full bg-destructive" />
                      Recording
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Press the mic and start talking</span>
                  )}
                </p>

                {/* Live waveform */}
                <div
                  className="mx-auto mt-5 flex h-12 items-center justify-center gap-1"
                  aria-hidden
                >
                  {Array.from({ length: 21 }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "w-1.5 rounded-full bg-primary/70 origin-bottom",
                        recording && "animate-wave"
                      )}
                      style={{
                        height: `${28 + ((i * 37) % 60)}%`,
                        animationDelay: `${(i % 7) * 0.13}s`,
                        opacity: recording ? 1 : 0.35,
                      }}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={toggleRecord}
                  aria-label={recording ? "Stop recording" : "Start recording"}
                  className={cn(
                    "relative mx-auto mt-7 grid size-20 place-items-center rounded-full transition-all duration-200 ease-ui focus-visible:ring-3 focus-visible:ring-ring/50",
                    recording
                      ? "animate-recording-pulse bg-destructive text-white hover:bg-destructive/90"
                      : "bg-primary text-primary-foreground shadow-lg hover:scale-105 active:scale-95"
                  )}
                >
                  {recording ? (
                    <Square className="size-7 fill-current" />
                  ) : (
                    <Mic className="size-8" />
                  )}
                </button>

                <p className="mx-auto mt-5 min-h-10 max-w-lg text-sm leading-relaxed text-muted-foreground">
                  {interim ||
                    (recording
                      ? "Listening… take your time, speak naturally."
                      : "")}
                </p>

                <div className="mt-2 flex items-center justify-center gap-2">
                  <Button variant="ghost" size="sm" onClick={switchToTyping}>
                    <Type /> Type instead
                  </Button>
                </div>
              </>
            ) : (
              <div className="mx-auto mt-6 w-full max-w-2xl text-left">
                <textarea
                  autoFocus
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  rows={8}
                  placeholder="Type what you would say out loud…"
                  className="min-h-44 w-full resize-y rounded-2xl border border-input bg-background p-4 text-[15px] leading-relaxed outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{words} words · {mmss(elapsed)}</span>
                  {words < 3 && <span>At least 3 words.</span>}
                </div>
              </div>
            )}

            <div className="mt-7 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={backToPick}>
                Back
              </Button>
              <Button onClick={toReview} disabled={words < 3 && !typed} size="lg">
                Finish · {words} words
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </section>
      )}

      {stage === "review" && (
        <section className="animate-fade-up flex flex-col gap-5 rounded-3xl border border-border bg-card p-5 shadow-xs sm:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-h2">Review your transcript</h2>
            <span className="text-sm text-muted-foreground tabular-nums">
              {words} words · {mmss(elapsed)}
            </span>
          </div>

          {editText ? (
            <textarea
              autoFocus
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={8}
              className="w-full resize-y rounded-2xl border border-input bg-background p-4 text-[15px] leading-relaxed outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            />
          ) : (
            <p className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-muted/50 p-4 text-[15px] leading-relaxed">
              {transcript}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditText((v) => !v)}>
                {editText ? "Done editing" : "Edit text"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStage("record");
                  setEditText(false);
                }}
              >
                <RotateCcw /> Redo
              </Button>
            </div>
            <Button onClick={() => void submit()} disabled={submitting || words < 3} size="lg">
              {submitting ? (
                "Analysing…"
              ) : (
                <>
                  <Send /> Analyse my speech
                </>
              )}
            </Button>
          </div>
        </section>
      )}

      {stage === "result" && result && (
        <section className="flex flex-col gap-5">
          {/* Hero score */}
          <div className="animate-fade-up relative overflow-hidden rounded-3xl border border-border bg-card px-5 py-8 text-center shadow-xs sm:px-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-28 left-1/2 h-56 w-[420px] -translate-x-1/2 rounded-full bg-primary/12 blur-3xl"
            />
            <div className="relative">
              <h2 className="text-h2">Your analysis</h2>
              <p className="text-display text-gradient mt-4">{avgScore}</p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {ratingFor(avgScore)}
              </p>
              <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                {result.analysis.summary}
              </p>
              {uploadedAudio && (
                <audio controls preload="none" src={uploadedAudio} className="mx-auto mt-5 w-full max-w-md" />
              )}

              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
                <span>
                  <b className="font-semibold">{result.analysis.metrics.wpm}</b>{" "}
                  <span className="text-muted-foreground">wpm</span>
                </span>
                <span>
                  <b className="font-semibold">{result.analysis.metrics.wordCount}</b>{" "}
                  <span className="text-muted-foreground">words</span>
                </span>
                <span>
                  <b className="font-semibold">{result.analysis.metrics.fillerCount}</b>{" "}
                  <span className="text-muted-foreground">fillers</span>
                </span>
                <span>
                  <b className="font-semibold">{result.analysis.metrics.longPauseCount}</b>{" "}
                  <span className="text-muted-foreground">long pauses</span>
                </span>
              </div>
            </div>
          </div>

          {/* Score breakdown */}
          <div className="animate-fade-up rounded-3xl border border-border bg-card p-5 shadow-xs sm:p-6">
            <p className="text-eyebrow">Scores</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {Object.entries(result.analysis.scores).map(([skill, value]) => (
                <div key={skill}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-muted-foreground">
                      {SCORE_LABELS[skill] ?? skill}
                    </span>
                    <span className="font-semibold tabular-nums">{Math.round(value)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-2)] transition-all duration-700 ease-ui"
                      style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Conversational feedback */}
          {result.analysis.mistakes.length > 0 && (
            <div className="animate-fade-up rounded-3xl border border-border bg-card p-5 shadow-xs sm:p-6">
              <div className="flex items-center gap-2.5">
                <span className="ai-sparkle grid size-7 place-items-center rounded-lg text-white shadow-xs">
                  <Sparkles className="size-4" />
                </span>
                <h3 className="text-h3">What I noticed</h3>
              </div>
              <ul className="mt-4 flex flex-col gap-4">
                {result.analysis.mistakes.map((m) => (
                  <li
                    key={m.key}
                    className="rounded-2xl border border-border bg-background/60 p-4"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold">{m.title}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          m.severity === "high"
                            ? "bg-destructive/10 text-destructive"
                            : m.severity === "medium"
                              ? "bg-warning/15 text-warning"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {m.severity}
                      </span>
                    </div>
                    <p className="mt-2.5 flex items-start gap-2 text-sm text-muted-foreground">
                      <X className="mt-0.5 size-4 shrink-0 text-destructive" strokeWidth={2.5} />
                      <span className="line-through decoration-destructive/50">{m.wrong}</span>
                    </p>
                    <p className="mt-1.5 flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.5} />
                      <span className="font-medium">{m.correct}</span>
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{m.why}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next steps */}
          <div className="animate-fade-up rounded-3xl border border-border bg-card p-5 shadow-xs sm:p-6">
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
                <Lightbulb className="size-4" />
              </span>
              <h3 className="text-h3">Next steps</h3>
            </div>
            <ul className="mt-4 flex flex-col gap-3">
              {result.analysis.recommendations.map((r) => (
                <li key={r.title} className="flex items-start gap-3 text-sm">
                  <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
                  <div>
                    <p className="font-medium">{r.title}</p>
                    <p className="mt-0.5 text-muted-foreground">{r.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={backToPick} size="lg">
              <RotateCcw /> Practice again
            </Button>
            <Button variant="outline" size="lg" render={<Link href="/dashboard" />}>
              Back to dashboard
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
