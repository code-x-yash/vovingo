import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronRight,
  CircleDot,
  Mic,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { listUserMistakes, type MistakeListItem } from "@/lib/mistakes/store";
import {
  MISTAKE_CATEGORY_LABEL,
  MISTAKE_SEVERITY_LABEL,
  MISTAKE_STATUS_LABEL,
  MISTAKE_TREND_LABEL,
  severityTone,
  shortDate,
  statusTone,
} from "@/lib/mistakes/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Mistake patterns" };

function StatBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function TrendMark({ trend }: { trend: MistakeListItem["trend"] }) {
  if (trend === "improving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
        <TrendingDown className="size-3.5" />
        {MISTAKE_TREND_LABEL[trend] ?? trend}
      </span>
    );
  }
  if (trend === "new") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warning">
        <CircleDot className="size-3.5" />
        {MISTAKE_TREND_LABEL[trend] ?? trend}
      </span>
    );
  }
  if (trend === "worsening") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
        <TrendingUp className="size-3.5" />
        {MISTAKE_TREND_LABEL[trend] ?? trend}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <Minus className="size-3.5" />
      {MISTAKE_TREND_LABEL[trend] ?? trend}
    </span>
  );
}

export default async function MistakesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/mistakes");
  if (!user.onboardedAt) redirect("/onboarding");

  const { items, summary } = await listUserMistakes(user.id);
  const none = items.length === 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow">Mistakes</p>
          <h1 className="text-h1 mt-2.5">Your English patterns</h1>
          <p className="mt-1.5 max-w-lg text-[15px] text-muted-foreground">
            {none
              ? "We analyze every sentence you speak and write."
              : `${summary.total} pattern${summary.total === 1 ? "" : "s"} · ${summary.needsPractice} need practice · ${summary.practised} practised${summary.improving > 0 ? ` · ${summary.improving} improving` : ""}`}
          </p>
        </div>
        <Button render={<Link href="/speaking" />}>
          <Mic className="size-4" /> Practise speaking
        </Button>
      </header>

      {none ? (
        <section className="animate-fade-up mt-8 rounded-2xl border border-dashed bg-card/50 p-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Mic className="size-6" />
          </span>
          <p className="text-h3 mt-4">No patterns yet</p>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Record a speaking take or submit some writing — your recurring mistakes show up
            here with examples, explanations and targeted practice.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button render={<Link href="/speaking" />}>Record your first take</Button>
            <Button variant="outline" render={<Link href="/lessons" />}>
              Browse lessons
            </Button>
          </div>
        </section>
      ) : (
        <>
          <div className="mt-7 grid grid-cols-2 gap-3 animate-fade-up sm:grid-cols-4">
            <StatBox value={summary.total} label="patterns" />
            <StatBox value={summary.needsPractice} label="need practice" />
            <StatBox value={summary.practised} label="practised" />
            <StatBox value={summary.improving} label="improving" />
          </div>

          <ul className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-xs animate-fade-up">
            {items.map((item, i) => {
              const seen = shortDate(item.lastDetectedAt);
              const practised = shortDate(item.lastPracticedAt);
              return (
                <li key={item.id}>
                  <Link
                    href={`/mistakes/${item.id}`}
                    className="group flex items-start gap-3.5 px-4 py-4 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40 sm:px-5"
                  >
                    <span className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    <span className="min-w-0 flex-1 space-y-2">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[15px] font-medium transition-colors group-hover:text-primary">
                          {item.title}
                        </span>
                        <Badge variant="outline" className={severityTone(item.severity)}>
                          {MISTAKE_SEVERITY_LABEL[item.severity] ?? item.severity}
                        </Badge>
                        <Badge variant="outline" className="border-border text-muted-foreground">
                          {MISTAKE_CATEGORY_LABEL[item.category] ?? item.category}
                        </Badge>
                        <Badge variant="outline" className={statusTone(item.status)}>
                          {MISTAKE_STATUS_LABEL[item.status] ?? item.status}
                        </Badge>
                      </span>

                      <span className="block text-xs text-muted-foreground">
                        ×{item.occurrences} time{item.occurrences === 1 ? "" : "s"}
                        {item.practiceCount > 0 && <> · practised {item.practiceCount}×</>}
                        {practised && <> · last practice {practised}</>}
                        {seen && <> · last seen {seen}</>}
                      </span>

                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <TrendMark trend={item.trend} />
                        {item.lastSentence && (
                          <span className="min-w-0 flex-1 truncate text-xs italic text-muted-foreground">
                            “{item.lastSentence.text}”
                          </span>
                        )}
                      </span>
                    </span>

                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
