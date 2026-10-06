import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Drama } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { StageSpotlight } from "./stage-spotlight";

export const metadata: Metadata = { title: "Stage mode · Vovingo" };

export default async function StagePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/stage");
  if (!user.onboardedAt) redirect("/onboarding");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-eyebrow inline-flex items-center gap-1.5">
          <Drama className="size-3.5" />
          Stage mode
        </p>
        <h1 className="text-h1 mt-2.5">Take the monologue, own the room</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">
          One prompt, one dramatic take, one audience that never holds back. The verdict lands
          in seconds — and the XP lands right after.
        </p>
      </header>

      <StageSpotlight />

      <p className="mt-6 text-xs text-muted-foreground">
        Performance writing, scored like a take ·{" "}
        <Link href="/speaking" className="text-primary hover:underline">
          want it spoken out loud? Open Speak
        </Link>
      </p>
    </div>
  );
}
