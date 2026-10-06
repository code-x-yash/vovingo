import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ScrollText } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { PACK_META, SCRIPTS, type ScriptPack } from "@/lib/scripts/packs";

export const metadata: Metadata = { title: "Scripts · Vovingo" };

const PACK_ORDER: ScriptPack[] = ["debate", "roleplay", "sitcom"];

export default async function ScriptsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/scripts");
  if (!user.onboardedAt) redirect("/onboarding");

  const packs = PACK_ORDER.map((pack) => ({
    pack,
    scripts: SCRIPTS.filter((s) => s.pack === pack),
  })).filter((p) => p.scripts.length > 0);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-eyebrow">Scripts</p>
        <h1 className="text-h1 mt-2.5">Rehearse a scene, out loud</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">
          Curated lines from debates, sitcoms and real-life roleplays. Read your
          character&apos;s lines into the mic — the take gets scored like any other.
        </p>
      </header>

      {packs.map(({ pack, scripts }) => (
        <section key={pack} className="animate-fade-up">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-h3">{PACK_META[pack].label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{PACK_META[pack].blurb}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {scripts.length} scene{scripts.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {scripts.map((s) => (
              <Link
                key={s.slug}
                href={`/scripts/${s.slug}`}
                className="interactive-card group rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <ScrollText className="size-[18px]" />
                  </span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                    you: {s.role}
                  </span>
                </div>
                <p className="mt-3 text-[15px] font-semibold transition-colors group-hover:text-primary">
                  {s.title}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.blurb}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                  Open script{" "}
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
