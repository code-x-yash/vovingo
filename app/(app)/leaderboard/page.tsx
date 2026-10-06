import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Flame, Trophy } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getWeeklyLeaderboard, weekStart } from "@/lib/progress/leaderboard";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Leagues · Vovingo" };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function LeaderboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/leaderboard");
  if (!user.onboardedAt) redirect("/onboarding");

  const board = await getWeeklyLeaderboard(user.id);
  const visible = board.rows.slice(0, 20);
  const myRank = board.me?.rank ?? null;
  const progressPct = board.division.next
    ? Math.min(
        100,
        Math.max(
          0,
          ((board.myWeeklyXp - board.division.min) / (board.division.next - board.division.min)) * 100
        )
      )
    : 100;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-eyebrow">Leagues</p>
        <h1 className="text-h1 mt-2.5">This week&apos;s board</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">
          Earn XP from lessons, plans and badges to climb. The board resets every Monday —
          divisions move with you.
        </p>
      </header>

      <section className="rounded-2xl border border-primary/25 bg-primary/5 p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-eyebrow">Your division</p>
            <p className="mt-2 flex items-center gap-2 text-h2">
              <Trophy className="size-5 text-primary" />
              {board.division.name}
            </p>
          </div>
          <div className="text-right">
            <p className="text-h1 tabular-nums text-gradient">{board.myWeeklyXp}</p>
            <p className="mt-1 text-eyebrow">XP this week</p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-2)]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {board.division.next
            ? `${board.division.next - board.myWeeklyXp} XP to ${nextDivisionName(board.division.name)}`
            : "Top division — hold the line."}
          {myRank ? ` · you are #${myRank} of ${board.playerCount} this week` : ""}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-eyebrow">Top learners</h2>
          <Badge variant="outline">
            {new Date(weekStart()).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}{" "}
            onward
          </Badge>
        </div>

        {visible.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-border/60 p-6 text-center">
            <p className="text-sm font-medium">No XP logged yet this week.</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
              Finish a plan item or unlock a badge — the board fills up as people practise.
            </p>
          </div>
        ) : (
          <ol className="mt-4 space-y-2">
            {visible.map((row) => (
              <li key={row.userId}>
                <div
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm ${
                    row.isMe
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/60 bg-background/50"
                  }`}
                >
                  <span
                    className={`w-7 shrink-0 text-center font-mono text-xs font-semibold ${
                      row.rank <= 3 ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {row.rank}
                  </span>
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white ${
                      row.rank === 1
                        ? "bg-gradient-to-br from-amber-400 to-orange-500"
                        : "bg-gradient-to-br from-[var(--brand-1)] to-[var(--brand-2)]"
                    }`}
                  >
                    {initials(row.name) || "?"}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {row.name}
                    {row.isMe ? <span className="text-muted-foreground"> (you)</span> : null}
                  </span>
                  {row.currentStreak > 0 && (
                    <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
                      <Flame className="size-3.5" />
                      {row.currentStreak}
                    </span>
                  )}
                  <span className="shrink-0 font-semibold tabular-nums">{row.xp} XP</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function nextDivisionName(current: string): string {
  const order = ["Bronze", "Silver", "Gold", "Platinum"];
  const index = order.indexOf(current);
  return index >= 0 && index < order.length - 1 ? order[index + 1] : "next division";
}
