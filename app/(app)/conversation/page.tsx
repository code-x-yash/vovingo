import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronRight, MessagesSquare, Sparkles } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import {
  getConversationForUser,
  listChatScenarios,
  listConversations,
} from "@/lib/conversation/store";
import { Badge } from "@/components/ui/badge";
import { ChatView, type ClientMessage } from "./chat";
import { StartChatButton } from "./start-button";

export const metadata = { title: "Coach & chats" };

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function relativeTime(value: Date): string {
  const minutes = Math.floor((Date.now() - value.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return value.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ConversationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/conversation");
  if (!user.onboardedAt) redirect("/onboarding");

  const sp = await searchParams;
  const rawId = sp.id ? Number(sp.id) : null;
  if (rawId !== null && Number.isInteger(rawId) && rawId > 0) {
    const data = await getConversationForUser(user.id, rawId);
    if (!data) redirect("/conversation");
    const initial: ClientMessage[] = data.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    return (
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 pt-5 pb-4 sm:px-6">
          <div className="min-w-0">
            <Link
              href="/conversation"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              All chats
            </Link>
            <h1 className="text-h2 mt-2 truncate">
              {data.conversation.title ?? "Conversation"}
            </h1>
          </div>
          <Badge
            variant="outline"
            className={
              data.conversation.status === "ended"
                ? "mt-1 shrink-0 border-border/60 text-muted-foreground"
                : "mt-1 shrink-0 border-primary/30 bg-primary/10 text-primary"
            }
          >
            {cap(data.conversation.status)}
          </Badge>
        </div>
        <ChatView
          conversationId={rawId}
          initialMessages={initial}
          ended={data.conversation.status === "ended"}
        />
      </div>
    );
  }

  const [convs, scenarioList] = await Promise.all([
    listConversations(user.id),
    listChatScenarios(),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-eyebrow">AI Coach</p>
        <h1 className="text-h1 mt-2.5">Coach &amp; chats</h1>
        <p className="mt-1.5 max-w-xl text-[15px] text-muted-foreground">
          Practise real conversations — your recurring patterns get detected as you type.
        </p>
      </header>

      <section className="animate-fade-up relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 size-56 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="ai-sparkle grid size-7 place-items-center rounded-lg text-white shadow-xs">
              <Sparkles className="size-4" />
            </span>
            <p className="text-eyebrow">AI Coach</p>
          </div>
          <p className="text-h3 mt-4">Ask me anything about your English.</p>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            I already know your skill scores, recurring patterns, due words and streak, so
            advice starts where you actually are — not at generic beginner tips.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <StartChatButton>Open coach chat</StartChatButton>
            <span className="text-xs text-muted-foreground">
              &ldquo;What should I practise today?&rdquo; works wonders.
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-eyebrow">Recent chats</h2>
          {convs.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {convs.length} most recent
            </span>
          )}
        </div>

        {convs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
            <p className="text-sm font-medium">
              No chats yet — tell me what you&apos;re working on.
            </p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
              An interview next week, small talk with colleagues, an email you&apos;re stuck
              on — open the coach and describe it.
            </p>
            <div className="mt-4 flex justify-center">
              <StartChatButton>Start your first chat</StartChatButton>
            </div>
          </div>
        ) : (
          <ul className="grid gap-2">
            {convs.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/conversation?id=${c.id}`}
                  className="interactive-card group flex items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-xs"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                    <MessagesSquare className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium transition-colors group-hover:text-primary">
                      {c.title ?? "Conversation"}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {c.messageCount} message{c.messageCount === 1 ? "" : "s"} ·{" "}
                      {relativeTime(c.startedAt)}
                      {c.status === "ended" ? " · ended" : ""}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="divider-fade" />

      <section className="space-y-4">
        <div>
          <p className="text-eyebrow">Scenarios</p>
          <h2 className="text-h2 mt-2.5">Roleplay a real situation</h2>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Interviews, small talk and more with a practice partner.
          </p>
        </div>

        {scenarioList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
            <p className="text-sm font-medium">No scenarios loaded yet.</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
              You can still practise any real situation in a free-form coach chat.
            </p>
            <div className="mt-4 flex justify-center">
              <StartChatButton>Open the coach</StartChatButton>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {scenarioList.map((s) => (
              <article
                key={s.id}
                className="interactive-card flex flex-col rounded-2xl border border-border bg-card p-5 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-h3 min-w-0">{s.title}</h3>
                  <span className="shrink-0 rounded-full border border-border/60 bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {cap(s.category)}
                  </span>
                </div>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {s.description}
                </p>
                <div className="mt-4">
                  <StartChatButton scenarioId={s.id} variant="outline">
                    Start
                  </StartChatButton>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
