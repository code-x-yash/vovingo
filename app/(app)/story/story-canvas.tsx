"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StoryEntry } from "@/lib/story/store";

type Props = { initialEntries: StoryEntry[]; userId: number };

function chapterLabel(entry: StoryEntry, userId: number): string {
  if (entry.chapter % 2 === 0) return "AI";
  return entry.userId === userId ? "You" : "A writer";
}

export function StoryCanvas({ initialEntries, userId }: Props) {
  const [entries, setEntries] = useState<StoryEntry[]>(initialEntries);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [voted, setVoted] = useState<Set<number>>(new Set());

  async function write() {
    const trimmed = text.trim();
    if (trimmed.length < 40) {
      toast.error("Give the story at least a couple of sentences.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "write", text: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        entry?: StoryEntry;
        aiEntry?: StoryEntry;
        error?: string;
      };
      if (!res.ok || !data.entry || !data.aiEntry) {
        toast.error(data.error ?? "Something went wrong.");
        return;
      }
      setEntries((prev) => [...prev, data.entry as StoryEntry, data.aiEntry as StoryEntry]);
      setText("");
      toast.success("Chapter added — the AI answered back");
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function vote(entryId: number) {
    if (voted.has(entryId)) return;
    setVoted((prev) => new Set(prev).add(entryId));
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, votes: e.votes + 1 } : e))
    );
    try {
      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "vote", entryId }),
      });
      if (!res.ok) {
        setVoted((prev) => {
          const next = new Set(prev);
          next.delete(entryId);
          return next;
        });
        setEntries((prev) =>
          prev.map((e) => (e.id === entryId ? { ...e, votes: e.votes - 1 } : e))
        );
      }
    } catch {
      /* keep the optimistic state */
    }
  }

  return (
    <section className="animate-fade-up mt-6 rounded-3xl border border-border bg-card p-4 shadow-xs sm:p-6">
      <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
        {entries.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            The story is waiting for its first chapter. You&apos;re up.
          </p>
        )}
        {entries.map((entry) => {
          const ai = entry.chapter % 2 === 0;
          return (
            <article
              key={entry.id}
              className={cn(
                "rounded-2xl border p-4",
                ai
                  ? "border-primary/25 bg-primary/5"
                  : "border-border/70 bg-background/50"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-eyebrow",
                    ai && "text-primary"
                  )}
                >
                  {ai && <Sparkles className="size-3" />}
                  Chapter {entry.chapter} · {chapterLabel(entry, userId)}
                </span>
                <button
                  type="button"
                  onClick={() => void vote(entry.id)}
                  disabled={voted.has(entry.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs tabular-nums transition-colors",
                    voted.has(entry.id)
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ThumbsUp className="size-3.5" />
                  {entry.votes}
                </button>
              </div>
              <p className="mt-2 text-sm leading-relaxed">{entry.text}</p>
            </article>
          );
        })}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Write the next chapter — 2-5 sentences. Leave a hook at the end…"
          className="min-h-28 w-full resize-y rounded-2xl border border-input bg-background p-4 text-[15px] leading-relaxed outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
        />
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{text.trim() ? text.trim().split(/\s+/).length : 0} words</span>
          <span>The AI writes the chapter after yours</span>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={() => void write()} disabled={submitting || text.trim().length < 40}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Writing…
              </>
            ) : (
              "Add my chapter"
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}
