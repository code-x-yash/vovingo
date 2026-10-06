import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Waves } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { ToneLab } from "./tone-lab";

export const metadata: Metadata = { title: "Tone lab · Vovingo" };

export default async function TonePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/tone");
  if (!user.onboardedAt) redirect("/onboarding");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-eyebrow inline-flex items-center gap-1.5">
          <Waves className="size-3.5" />
          Tone lab
        </p>
        <h1 className="text-h1 mt-2.5">Read the room, then rewrite it</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">
          Check how your writing lands — then flip it between formal, casual, friendly and
          technical without losing the meaning.
        </p>
      </header>

      <ToneLab />

      <p className="mt-6 text-xs text-muted-foreground">
        Works on messages, emails and posts ·{" "}
        <Link href="/writing" className="text-primary hover:underline">
          want a full essay review? Open Writing
        </Link>
      </p>
    </div>
  );
}
