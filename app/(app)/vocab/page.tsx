import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpenCheck, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import {
  LIBRARY_PAGE_SIZE,
  VOCAB_CATEGORIES,
  getDueCount,
  searchVocabulary,
} from "@/lib/vocab/store";
import { Button } from "@/components/ui/button";
import { VocabToggle } from "./vocab-toggle";

export const metadata = { title: "Vocabulary" };

type Search = { q?: string; category?: string; page?: string };

const STATUS_META: Record<string, { label: string; className: string }> = {
  learning: { label: "Learning", className: "bg-primary/10 text-primary" },
  reviewing: { label: "Reviewing", className: "bg-warning/15 text-warning" },
  known: { label: "Mastered", className: "bg-success/15 text-success" },
  suspended: { label: "Paused", className: "bg-muted text-muted-foreground" },
};

function buildHref(sp: Search, over: Search): string {
  const merged = { ...sp, ...over };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.category) params.set("category", merged.category);
  if (merged.page && merged.page !== "1") params.set("page", merged.page);
  const qs = params.toString();
  return qs ? `/vocab?${qs}` : "/vocab";
}

function Stat({ value, label, className }: { value: number; label: string; className?: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={`text-xl font-semibold tabular-nums ${className ?? ""}`}>{value}</span>
      <span className="text-[13px] text-muted-foreground">{label}</span>
    </span>
  );
}

export default async function VocabPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/vocab");
  if (!user.onboardedAt) redirect("/onboarding");

  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const category = VOCAB_CATEGORIES.includes(sp.category as never) ? sp.category : undefined;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const library = await searchVocabulary({ userId: user.id, q, category, page });
  const dueCount = await getDueCount(user.id);

  const total = library.total;
  const totalPages = Math.max(1, Math.ceil(total / LIBRARY_PAGE_SIZE));
  const mastered = library.items.filter((i) => i.status === "known").length;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-eyebrow">Vocabulary</p>
        <h1 className="text-h1 mt-2.5">Your word library</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          Words you&apos;re learning, spaced to stick.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-7 gap-y-2.5">
          <Stat value={dueCount} label="due today" className="text-primary" />
          <Stat value={mastered} label="mastered" className="text-success" />
          <Stat value={total} label="total words" />
        </div>
        {dueCount > 0 && (
          <Button render={<Link href="/vocab/review" />}>
            <BookOpenCheck /> Review {dueCount} due
          </Button>
        )}
      </div>

      <div className="divider-fade mt-6" />

      <form action="/vocab" method="get" className="mt-6 flex gap-2">
        {category && <input type="hidden" name="category" value={category} />}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search words or definitions…"
            aria-label="Search words or definitions"
            className="h-10 w-full rounded-xl border border-input bg-card pr-3 pl-9 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <Button type="submit" size="sm" variant="outline" className="h-10 px-4">
          Search
        </Button>
      </form>

      <nav aria-label="Categories" className="mt-4 flex flex-wrap gap-1.5">
        <Link
          href={buildHref(sp, { category: undefined, page: "1" })}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            !category
              ? "border-transparent bg-primary/10 font-medium text-primary"
              : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          All
        </Link>
        {VOCAB_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={buildHref(sp, { category: c, page: "1" })}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              category === c
                ? "border-transparent bg-primary/10 font-medium text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {c}
          </Link>
        ))}
      </nav>

      {library.items.length === 0 ? (
        <div className="mt-7 rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
          <p className="text-h3">No words match{q ? ` “${q}”` : ""}.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Try a different search, or clear the filters to see the whole library again.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="outline" render={<Link href="/vocab" />}>
              Clear search
            </Button>
            {dueCount > 0 && (
              <Button render={<Link href="/vocab/review" />}>
                <BookOpenCheck /> Review {dueCount} due
              </Button>
            )}
          </div>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {library.items.map((item) => {
            const status = item.status ? STATUS_META[item.status] : undefined;
            return (
              <li
                key={item.id}
                className="interactive-card rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                      <h2 className="text-h3">{item.word}</h2>
                      {item.pronunciation && (
                        <span className="font-mono text-sm text-muted-foreground">
                          {item.pronunciation}
                        </span>
                      )}
                      {status && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      )}
                    </div>

                    <p className="mt-2 line-clamp-2 text-[15px] text-muted-foreground">
                      {item.definition}
                    </p>

                    <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border border-border px-2.5 py-0.5">
                        {item.category}
                      </span>
                      {item.topic && <span>{item.topic}</span>}
                      {!item.inVocab && <span>Not in your review list yet</span>}
                    </div>
                  </div>

                  <VocabToggle wordId={item.id} initial={item.inVocab} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link
              href={buildHref(sp, { page: String(page - 1) })}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <ChevronLeft className="size-4" /> Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground tabular-nums">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildHref(sp, { page: String(page + 1) })}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              Next <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
