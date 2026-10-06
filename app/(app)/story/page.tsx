import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Feather } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { listStory } from "@/lib/story/store";
import { StoryCanvas } from "./story-canvas";

export const metadata: Metadata = { title: "Co-op story · Vovingo" };

export default async function StoryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/story");
  if (!user.onboardedAt) redirect("/onboarding");

  const entries = await listStory();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-eyebrow inline-flex items-center gap-1.5">
          <Feather className="size-3.5" />
          Co-op story
        </p>
        <h1 className="text-h1 mt-2.5">One story, one chapter at a time</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">
          Add the next chapter to a story that everyone is writing together — the AI jumps in
          after every line to keep it moving. Read back, vote for the chapters you liked.
        </p>
      </header>

      <StoryCanvas initialEntries={entries} userId={user.id} />

      <p className="mt-6 text-xs text-muted-foreground">
        Writing practice that isn&apos;t an essay ·{" "}
        <Link href="/writing" className="text-primary hover:underline">
          want it graded? Open Writing
        </Link>
      </p>
    </div>
  );
}
