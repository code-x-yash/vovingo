"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function StartChatButton({
  scenarioId,
  children,
  variant = "default",
}: {
  scenarioId?: number | null;
  children: ReactNode;
  variant?: "default" | "outline" | "ghost" | "secondary";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          scenarioId: scenarioId ?? null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; id?: number };
      if (!res.ok || typeof data.id !== "number") {
        setError(data.error ?? "Could not start the chat.");
        return;
      }
      router.push(`/conversation?id=${data.id}`);
    } catch {
      setError("Network error — try again.");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <Button variant={variant} size="lg" disabled={busy} onClick={() => void start()}>
        {busy ? "Opening…" : children}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
