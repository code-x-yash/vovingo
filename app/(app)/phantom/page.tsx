import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, isNotNull, or } from "drizzle-orm";
import { Phone } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { scenarios } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { PhantomCall, type CallContact } from "./phantom-call";

export const metadata: Metadata = { title: "Phantom call · Vovingo" };

export default async function PhantomPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/phantom");
  if (!user.onboardedAt) redirect("/onboarding");

  const db = await getDb();
  const rows = await db
    .select({
      id: scenarios.id,
      title: scenarios.title,
      category: scenarios.category,
      description: scenarios.description,
      openingPrompt: scenarios.openingPrompt,
      persona: scenarios.persona,
    })
    .from(scenarios)
    .where(or(isNotNull(scenarios.persona), isNotNull(scenarios.openingPrompt)))
    .orderBy(desc(scenarios.category), desc(scenarios.id))
    .limit(12);

  const contacts: CallContact[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    description: r.description,
    opening: r.openingPrompt,
    persona: r.persona,
  }));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-eyebrow">Phantom call</p>
        <h1 className="text-h1 mt-2.5">Pick up the phone</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">
          A simulated call with a scripted persona — they speak first, you answer out loud,
          and the transcript gets scored when you hang up.
        </p>
      </header>

      {contacts.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border/60 p-8 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Phone className="size-5" />
          </span>
          <p className="mt-4 text-sm font-medium">No one on speed dial yet.</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            Scenario contacts unlock as content loads — meanwhile the AI Coach always picks up.
          </p>
          <div className="mt-5 flex justify-center">
            <Button render={<Link href="/conversation" />}>Open AI Coach</Button>
          </div>
        </div>
      ) : (
        <PhantomCall contacts={contacts} />
      )}
    </div>
  );
}
