import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { SpeedrunGame } from "./speedrun-game";

export const metadata: Metadata = { title: "Speedrun · Vovingo" };

export default async function SpeedrunPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/speedrun");
  if (!user.onboardedAt) redirect("/onboarding");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-eyebrow">Speedrun</p>
        <h1 className="text-h1 mt-2.5">Beat the clock</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">
          Ten questions. One timer. Five XP per hit — the round reshuffles every run.
        </p>
      </header>
      <SpeedrunGame />
    </div>
  );
}
