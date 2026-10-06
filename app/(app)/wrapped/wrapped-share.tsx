"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function WrappedShare({ summary }: { summary: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      toast.success("Copied — paste it anywhere");
    } catch {
      toast.error("Couldn't reach the clipboard.");
    }
  }

  return (
    <Button onClick={() => void copy()}>
      <Share2 className="size-4" /> Copy my Wrapped
    </Button>
  );
}
