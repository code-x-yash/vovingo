import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Swords } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { DuelArena } from "./duel-arena";

export const metadata: Metadata = { title: "Rap duel · Vovingo" };

export default async function DuelPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/duel");
  if (!user.onboardedAt) redirect("/onboarding");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-eyebrow inline-flex items-center gap-1.5">
          <Swords className="size-3.5" />
          Rap duel
        </p>
        <h1 className="text-h1 mt-2.5">Two bars, one judge</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">
          Get a beat, drop your lines, and go bar-for-bar against a rival. The judge scores
          rhythm, imagery and English flow — the winner walks away with XP.
        </p>
      </header>

      <DuelArena />

      <p className="mt-6 text-xs text-muted-foreground">
        Writing counts as practice too ·{" "}
        <Link href="/writing" className="text-primary hover:underline">
          want a full essay review? Open Writing
        </Link>
      </p>
    </div>
  );
}
