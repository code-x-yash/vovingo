import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSpeakingFeed } from "@/lib/speaking/store";
import { SpeakingStudio } from "./speaking-studio";

export const metadata = { title: "Speaking practice" };

export default async function SpeakingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/speaking");
  if (!user.onboardedAt) redirect("/onboarding");

  const feed = await getSpeakingFeed(user.id);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-eyebrow">Speak</p>
        <h1 className="text-h1 mt-2.5">Speaking practice</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          Talk for a minute — get scores, fixes and your next steps.
        </p>
      </header>
      <SpeakingStudio initial={feed} />
    </div>
  );
}
