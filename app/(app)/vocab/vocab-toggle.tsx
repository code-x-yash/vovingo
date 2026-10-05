"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function VocabToggle({ wordId, initial }: { wordId: number; initial: boolean }) {
  const [inVocab, setInVocab] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: inVocab ? "remove" : "add", wordId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; inVocab?: boolean };
      if (!res.ok) {
        toast.error(data.error ?? "Something went wrong.");
        return;
      }
      setInVocab(Boolean(data.inVocab));
      toast.success(data.inVocab ? "Added — due for review now." : "Removed from your review list.");
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy}
      onClick={() => void toggle()}
      aria-pressed={inVocab}
      className={`shrink-0 rounded-full ${
        inVocab
          ? "bg-success/10 text-success hover:bg-success/15"
          : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {inVocab ? (
        <>
          <Check /> In review
        </>
      ) : (
        <>
          <Plus /> Add
        </>
      )}
    </Button>
  );
}
