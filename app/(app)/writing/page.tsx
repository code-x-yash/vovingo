import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { writingPrompts } from "@/lib/content/writing-prompts";
import { listRecentWritings } from "@/lib/writing/store";

export const metadata = { title: "Writing lab" };

const KIND_LABEL: Record<string, string> = {
  email: "Email",
  message: "Message",
  post: "Social post",
  essay: "Essay",
  application: "Application",
  update: "Status update",
  free: "Free write",
};

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function WritingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/writing");
  if (!user.onboardedAt) redirect("/onboarding");

  const recent = await listRecentWritings(user.id);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-eyebrow">Writing</p>
        <h1 className="text-h1 mt-2.5">Writing lab</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          Write for real situations — get pattern-aware feedback in seconds.
        </p>
      </header>

      {recent.length > 0 && (
        <section className="mt-8 animate-fade-up">
          <h2 className="text-eyebrow">Recent submissions</h2>
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {KIND_LABEL[r.kind] ?? r.kind}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {r.excerpt}
                </span>
                {r.patterns > 0 && (
                  <span className="hidden shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive sm:block">
                    {r.patterns} pattern{r.patterns === 1 ? "" : "s"}
                  </span>
                )}
                <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:block">
                  {shortDate(r.createdAt)}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{r.overall}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-eyebrow">Prompts</h2>
        <p className="mt-2.5 text-[15px] text-muted-foreground">
          Pick one — the minimum length keeps you honest.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {writingPrompts.map((p) => (
            <Link
              key={p.slug}
              href={`/writing/${p.slug}`}
              className="interactive-card group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-h3 transition-colors group-hover:text-primary">
                  {p.title}
                </span>
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                  {KIND_LABEL[p.kind] ?? p.kind}
                </span>
              </div>

              <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">{p.brief}</p>

              <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-border px-2.5 py-0.5">
                    {p.level}
                  </span>
                  <span className="rounded-full border border-border px-2.5 py-0.5">
                    min {p.minWords} words
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
