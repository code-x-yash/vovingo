"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles } from "lucide-react";

export type ClientMessage = {
  role: "user" | "ai";
  content: string;
  detected?: string[];
};

type Props = {
  conversationId: number;
  initialMessages: ClientMessage[];
  ended: boolean;
};

export function ChatView({ conversationId, initialMessages, ended }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<ClientMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    try {
      const res = await fetch("/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", conversationId, message: text }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        reply?: string;
        detected?: { title: string }[];
      };
      if (!res.ok || !data.reply) {
        setError(data.error ?? "Could not send — try again.");
        setInput(text);
        return;
      }
      const reply: string = data.reply;
      const detectedTitles = (data.detected ?? []).map((d) => d.title);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text, detected: detectedTitles },
        { role: "ai", content: reply },
      ]);
    } catch {
      setError("Network error — try again.");
      setInput(text);
    } finally {
      setBusy(false);
    }
  }

  async function endChat() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", conversationId }),
      });
    } catch {
      // ending is best-effort — navigation below still runs
    }
    router.push("/conversation");
  }

  return (
    <div className="flex min-h-full w-full max-w-2xl flex-col px-4 pt-5 pb-6 sm:px-6">
      <div
        role="log"
        aria-label="Conversation with your AI coach"
        className="flex-1 space-y-4 overflow-y-auto pb-4"
      >
        {messages.length === 0 && !busy && (
          <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            No messages yet — type your reply below and I&apos;ll take it from there.
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            {m.role === "ai" && (
              <span
                aria-hidden
                className="ai-sparkle mr-2 hidden size-7 shrink-0 place-items-center self-start rounded-lg text-white shadow-xs sm:grid"
              >
                <Sparkles className="size-4" />
              </span>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border/60 bg-card"
              }`}
            >
              <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
              {m.detected && m.detected.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.detected.map((t, j) => (
                    <span
                      key={j}
                      className="rounded-full border border-destructive/40 bg-background/85 px-2 py-0.5 text-[11px] text-destructive"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-2.5 shadow-xs">
              <span className="ai-sparkle grid size-5 shrink-0 place-items-center rounded-md text-white">
                <Sparkles className="size-3" />
              </span>
              <span className="animate-thinking text-sm text-muted-foreground">
                Thinking…
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p role="alert" className="pb-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {ended ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center">
          <p className="text-sm font-medium">This chat has ended.</p>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
            Start a fresh conversation whenever you&apos;re ready.
          </p>
          <div className="mt-4 flex justify-center">
            <Button render={<Link href="/conversation" />}>Start a new chat</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-t border-border/60 pt-4">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Type your reply…"
            aria-label="Your reply"
            maxLength={1000}
            disabled={busy}
            className="h-10 flex-1 rounded-xl"
          />
          <Button
            aria-label="Send"
            className="h-10 shrink-0 rounded-xl px-4"
            disabled={busy || input.trim().length === 0}
            onClick={() => void send()}
          >
            <Send className="size-4" /> Send
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void endChat()}
            className="h-10 shrink-0 rounded-xl px-3 text-muted-foreground"
          >
            End
          </Button>
        </div>
      )}
    </div>
  );
}
