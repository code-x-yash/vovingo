import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { dueWords } from "@/lib/vocab/store";
import { Button } from "@/components/ui/button";
import { ReviewSession } from "./review-session";

export const metadata = { title: "Review due words" };

export default async function ReviewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/vocab/review");
  if (!user.onboardedAt) redirect("/onboarding");

  const cards = await dueWords(user.id, 60);

  if (cards.length === 0) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
        <div className="animate-fade-up">
          <p className="text-eyebrow">Vocabulary</p>
          <h1 className="text-h1 mt-3">You&apos;re all caught up.</h1>
          <p className="mx-auto mt-3 max-w-sm text-[15px] text-muted-foreground">
            New words enter your deck as you learn.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2.5">
            <Button render={<Link href="/vocab" />}>Browse vocabulary</Button>
            <Button variant="outline" render={<Link href="/dashboard" />}>
              Back to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-eyebrow">Vocabulary</p>
          <h1 className="text-h1 mt-2.5">Review</h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            {cards.length} word{cards.length === 1 ? "" : "s"} due — one at a time, out loud if you
            can.
          </p>
        </div>
        <Link
          href="/vocab"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronLeft className="size-4" /> Library
        </Link>
      </header>
      <ReviewSession cards={cards} />
    </div>
  );
}
