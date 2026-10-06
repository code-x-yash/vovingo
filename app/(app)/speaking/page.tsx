import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSpeakingFeed } from "@/lib/speaking/store";
import type { SpeakingMode } from "@/lib/speaking/store";
import { getScript, practicePrompt } from "@/lib/scripts/packs";
import { SpeakingStudio, type StudioInitialScript } from "./speaking-studio";

export const metadata = { title: "Speaking practice" };

const PACK_MODE: Record<string, SpeakingMode> = {
  debate: "topic",
  sitcom: "situation",
  roleplay: "situation",
};

export default async function SpeakingPage({
  searchParams,
}: {
  searchParams: Promise<{ script?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/speaking");
  if (!user.onboardedAt) redirect("/onboarding");

  const [feed, sp] = await Promise.all([getSpeakingFeed(user.id), searchParams]);
  const script = sp.script ? getScript(sp.script) : null;
  const initialScript: StudioInitialScript | null = script
    ? {
        mode: PACK_MODE[script.pack] ?? "situation",
        scenarioId: null,
        prompt: practicePrompt(script),
        label: script.title,
      }
    : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-eyebrow">Speak</p>
        <h1 className="text-h1 mt-2.5">Speaking practice</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          Talk for a minute — get scores, fixes and your next steps.
        </p>
      </header>
      <SpeakingStudio initial={feed} initialScript={initialScript} />
    </div>
  );
}
