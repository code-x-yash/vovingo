"use client";

import { useSyncExternalStore, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const emptySubscribe = () => () => {};

export function ReferralCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  // "" on the server and during hydration, absolute origin after hydration.
  const origin = useSyncExternalStore(
    emptySubscribe,
    () => window.location.origin,
    () => ""
  );
  const link = `${origin}/signup?ref=${code}`;

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Select the link and copy manually.");
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          readOnly
          value={link}
          aria-label="Referral link"
          className="h-9 flex-1 min-w-0 font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => void copy(link)}
          className="shrink-0"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Code <span className="font-mono font-semibold text-foreground">{code}</span> — you earn 7
        Pro days for every friend who signs up and finishes onboarding. Days stack.
      </p>
    </div>
  );
}
