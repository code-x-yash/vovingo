import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getWritingPrompt } from "@/lib/content/writing-prompts";
import { Editor } from "./editor";

export const metadata = { title: "Writing prompt" };

const KIND_LABEL: Record<string, string> = {
  email: "Email",
  message: "Message",
  post: "Social post",
  essay: "Essay",
  application: "Application",
  update: "Status update",
  free: "Free write",
};

export default async function WritingPromptPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/writing");
  if (!user.onboardedAt) redirect("/onboarding");

  const { slug } = await params;
  const prompt = getWritingPrompt(slug);
  if (!prompt) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up max-w-2xl">
        <Link
          href="/writing"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronLeft className="size-4" /> All prompts
        </Link>

        <p className="text-eyebrow mt-5">{KIND_LABEL[prompt.kind] ?? prompt.kind}</p>
        <h1 className="text-h1 mt-2.5">{prompt.title}</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">{prompt.brief}</p>

        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="rounded-full border border-border px-2.5 py-1">{prompt.level}</span>
          <span className="rounded-full border border-border px-2.5 py-1">
            min {prompt.minWords} words
          </span>
        </div>

        <ul className="mt-5 flex flex-col gap-2">
          {prompt.hints.map((h, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      </header>

      <div className="divider-fade mt-7" />

      <Editor slug={prompt.slug} minWords={prompt.minWords} />
    </div>
  );
}
