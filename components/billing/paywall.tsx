"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const COPY: Record<string, { title: string; body: string }> = {
  speaking: {
    title: "Today's speaking take is used up",
    body: "The free plan includes one scored take a day. Pro removes the meter — unlimited takes, all 45 rules, AI roleplay.",
  },
  writing: {
    title: "Today's writing limit is reached",
    body: "The free plan grades two pieces a day. Pro unlocks unlimited writing feedback and every lab exercise.",
  },
  conversation: {
    title: "Today's coach chats are used up",
    body: "The free plan includes three coach messages a day. Pro keeps the conversation going, with roleplay grounded in your mistakes.",
  },
  lessons: {
    title: "This week's lessons are used up",
    body: "The free plan unlocks five lessons a week. Pro opens all 34, any time, in any order.",
  },
  stage: {
    title: "Today's stage is used up",
    body: "The free plan includes one stage run a day. Pro lets you rehearse until it lands.",
  },
  duel: {
    title: "Today's duel is used up",
    body: "The free plan includes one speed duel a day. Pro keeps the arena open.",
  },
  tone: {
    title: "Today's tone checks are used up",
    body: "The free plan checks tone three times a day. Pro reviews every message you send.",
  },
  default: {
    title: "Free plan limit reached",
    body: "Upgrade to Pro to continue with unlimited access to every exercise, rule and report.",
  },
};

export function Paywall({
  open,
  onOpenChange,
  metric = "default",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric?: string;
}) {
  const copy = COPY[metric] ?? COPY.default;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="mb-2 grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[var(--brand-1)] to-[var(--brand-3)] text-white">
            <Sparkles className="size-5" />
          </span>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button render={<Link href="/pricing" />}>See Pro plans</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** True when a fetch response signals a free-plan quota wall. */
export function isQuotaWall(
  status: number,
  data: { code?: string } | null
): boolean {
  return status === 402 && data?.code === "quota_exceeded";
}
