import type { ElementType, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Headphones,
  Lightbulb,
  MessagesSquare,
  Mic,
  Play,
  Quote,
  ScanSearch,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Logo, LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSessionUser } from "@/lib/auth/session";

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

const LOOP = [
  { icon: Mic, label: "You speak", detail: "Record a take in your own words" },
  { icon: Sparkles, label: "AI analyzes", detail: "Grammar, fluency and pronunciation scored" },
  { icon: Target, label: "A pattern appears", detail: "The rule you keep breaking gets named" },
  { icon: TrendingUp, label: "You practice", detail: "Short drills built from your own mistake" },
  { icon: CheckCircle2, label: "It sticks", detail: "Scores climb and the pattern disappears" },
];

const STEPS = [
  {
    n: "01",
    icon: BookOpen,
    title: "Learn",
    body: "Bite-size lessons and listening episodes pitched at the level you actually sit at.",
  },
  {
    n: "02",
    icon: Mic,
    title: "Speak",
    body: "Record a short take every day in your own words. Five minutes is enough to start.",
  },
  {
    n: "03",
    icon: ScanSearch,
    title: "AI analyzes",
    body: "Forty-five rules score the take and flag the exact pattern you just repeated.",
  },
  {
    n: "04",
    icon: TrendingUp,
    title: "Improve",
    body: "The fix becomes a drill. Watch the same score move the following week.",
  },
];

const STATS = [
  { value: "34", label: "lessons" },
  { value: "110", label: "words" },
  { value: "23", label: "scenarios" },
  { value: "11", label: "episodes" },
  { value: "45", label: "grammar rules" },
];

const TESTIMONIALS = [
  {
    initial: "P",
    quote:
      "I stopped guessing between since and for. Three weeks in, my manager noticed the emails before I told him.",
    name: "Priya S.",
    role: "Product manager, Bengaluru",
  },
  {
    initial: "A",
    quote:
      "The coach remembers what I get wrong. Every session starts with my own mistakes instead of a random lesson.",
    name: "Arjun M.",
    role: "Master's student, Pune",
  },
  {
    initial: "S",
    quote:
      "Twenty minutes a day on the commute. My speaking score went from 61 to 78 in two months.",
    name: "Sofia R.",
    role: "Sales lead, Mumbai",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    blurb: "Build the habit before you spend anything.",
    cta: "Start free",
    featured: false,
    features: ["5 lessons a week", "1 speaking take a day", "10 rules tracked", "Weekly progress view"],
  },
  {
    name: "Pro monthly",
    price: "₹499",
    period: "per month",
    blurb: "The full loop, with nothing metered.",
    cta: "Start Pro",
    featured: true,
    features: [
      "Unlimited lessons and takes",
      "All 45 grammar rules",
      "AI coach and roleplay",
      "Writing and listening labs",
      "Weekly written report",
    ],
  },
  {
    name: "Pro annual",
    price: "₹3,999",
    period: "per year",
    blurb: "Same Pro plan, two months free.",
    cta: "Choose annual",
    featured: false,
    features: [
      "Everything in Pro monthly",
      "Priority scoring on takes",
      "Placement retake any time",
      "Downloadable study pack",
    ],
  },
];

const FAQS = [
  {
    q: "How is Vovingo different from other apps?",
    a: "Most apps hand you a generic lesson. Vovingo scores what you say, finds the rules you break repeatedly, and builds the next session around them — so practice is always aimed at your own mistakes.",
  },
  {
    q: "Do I need to know my English level?",
    a: "No. A three-minute placement check maps your level on day one, and you can retake it whenever you feel the plan is too easy or too hard.",
  },
  {
    q: "How much time should I practice daily?",
    a: "Twenty minutes is the default, and you can set ten, twenty, thirty or forty-five during setup. Consistency beats length — short daily takes move scores faster than weekend marathons.",
  },
  {
    q: "Does the coach really remember my mistakes?",
    a: "Yes. Every take, lesson and drill feeds a personal rule set. Your coach opens each session with the patterns you are still repeating and the ones you have already fixed.",
  },
  {
    q: "Is there a free plan?",
    a: "The Free plan covers five lessons a week, one speaking take a day and ten tracked rules. Upgrade to Pro only when you want the whole loop without limits.",
  },
];

type FeatureRowData = {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  icon: ElementType;
  reverse?: boolean;
  visual: ReactNode;
};

function CoreLoop() {
  return (
    <div className="w-full rounded-2xl border border-border bg-card p-5 text-left shadow-md">
      <p className="text-eyebrow">The core loop</p>
      <ol className="mt-4">
        {LOOP.map((step, i) => {
          const Icon = step.icon;
          return (
            <li key={step.label}>
              <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/60 px-3 py-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[var(--brand-1)] via-[var(--brand-2)] to-[var(--brand-3)] text-white shadow-xs">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{step.label}</span>
                  <span className="block text-xs text-muted-foreground">{step.detail}</span>
                </span>
              </div>
              {i < LOOP.length - 1 ? (
                <div className="flex justify-center py-1.5" aria-hidden>
                  <ArrowDown className="size-3.5 text-muted-foreground/60" />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function WaveformMock() {
  const bars = [24, 40, 58, 32, 66, 46, 74, 36, 60, 42, 68, 30, 52, 64, 38, 48, 72, 34, 56, 44, 62, 28];
  const scores = [
    { label: "Fluency", value: 81 },
    { label: "Grammar", value: 72 },
    { label: "Vocab", value: 64 },
    { label: "Pronun.", value: 77 },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <p className="text-eyebrow">Take 04 · 42 seconds</p>
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          <Sparkles className="size-3" /> Scored
        </span>
      </div>
      <div className="mt-4 flex h-24 items-end gap-1">
        {bars.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-full bg-gradient-to-t from-[var(--brand-1)] to-[var(--brand-3)]"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {scores.map((s) => (
          <div key={s.label} className="rounded-xl border border-border/70 bg-background/60 p-2.5">
            <p className="text-lg font-semibold tabular-nums leading-none">{s.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{s.label}</p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-2)]"
                style={{ width: `${s.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListeningMock() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
      <p className="text-eyebrow">Listening lab</p>
      <div className="mt-4 flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--brand-1)] via-[var(--brand-2)] to-[var(--brand-3)] text-white shadow-sm">
          <Play className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">Episode 07 · Ordering with confidence</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-2)]" />
          </div>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">04:12</span>
      </div>
      <div className="mt-4 space-y-2 rounded-xl border border-border/70 bg-background/60 p-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Could I get the <span className="rounded bg-primary/10 px-1 font-medium text-primary">spicy</span> one,
          and maybe some extra napkins?
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">Sure — anything else for you?</p>
      </div>
      <div className="mt-3 space-y-2">
        {[
          { text: "What did the customer ask for?", correct: false },
          { text: "Extra napkins with the spicy dish", correct: true },
        ].map((o) => (
          <div
            key={o.text}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
              o.correct ? "border-success/40 bg-success/10 text-foreground" : "border-border/70 bg-background/60 text-muted-foreground"
            }`}
          >
            <span
              className={`grid size-4 shrink-0 place-items-center rounded-full border ${
                o.correct ? "border-success bg-success text-white" : "border-border"
              }`}
            >
              {o.correct ? <Check className="size-2.5" /> : null}
            </span>
            {o.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatMock() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-center gap-2">
        <LogoMark className="size-6 rounded-md" />
        <p className="text-sm font-medium">Vovingo coach</p>
        <span className="ml-auto rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          Live
        </span>
      </div>
      <div className="mt-4 space-y-2.5">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border/70 bg-background/60 px-3 py-2 text-sm">
          You said “since 3 years” again in that answer. Want to fix it in sixty seconds?
        </div>
        <div className="ml-auto max-w-[75%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
          Yes, let&apos;s do it.
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border/70 bg-background/60 px-3 py-2 text-sm">
          “Since” takes a starting point — since 2021. “For” counts duration — for three years.
        </div>
        <div className="flex w-fit items-center gap-1 rounded-2xl rounded-tl-sm border border-border/70 bg-background/60 px-3 py-2.5">
          <span className="size-1.5 rounded-full bg-muted-foreground/60" />
          <span className="size-1.5 rounded-full bg-muted-foreground/40" />
          <span className="size-1.5 rounded-full bg-muted-foreground/25" />
        </div>
      </div>
    </div>
  );
}

function ScoreMock() {
  const skills = [
    { label: "Speaking", value: 78 },
    { label: "Listening", value: 71 },
    { label: "Grammar", value: 66 },
    { label: "Writing", value: 69 },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <svg viewBox="0 0 100 100" className="size-28 -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--muted)" strokeWidth="9" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="var(--brand-1)"
              strokeWidth="9"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="78 100"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-2xl font-semibold tabular-nums leading-none">78</p>
              <p className="mt-1 text-[11px] text-muted-foreground">overall</p>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          {skills.map((s) => (
            <div key={s.label}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <span className="text-xs font-medium tabular-nums">{s.value}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-2)]"
                  style={{ width: `${s.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
        <ScanSearch className="size-4 shrink-0 text-destructive" />
        <p className="min-w-0 flex-1 truncate text-xs">
          <span className="font-medium text-destructive">Articles before consonants</span>
          <span className="text-muted-foreground"> · fixed 9 of 12 this month</span>
        </p>
      </div>
    </div>
  );
}

const FEATURE_ROWS: FeatureRowData[] = [
  {
    eyebrow: "Speaking practice",
    title: "Say it out loud. Get a scorecard, not a shrug.",
    body: "Record a take on any prompt. Vovingo scores fluency, grammar, vocabulary and pronunciation, then highlights the exact words that cost you points.",
    points: ["Word-level highlight on every take", "Four scores, one clear next step", "Retry the weak lines until they land"],
    icon: Mic,
    visual: <WaveformMock />,
  },
  {
    eyebrow: "Listening lab",
    title: "Train your ear with transcripts that talk back.",
    body: "Short episodes with synced transcripts and comprehension checks. Tap the line you missed, replay it, and keep the score honest.",
    points: ["11 episodes, four to eight minutes each", "Transcript follows the audio line by line", "Comprehension check after every scene"],
    icon: Headphones,
    reverse: true,
    visual: <ListeningMock />,
  },
  {
    eyebrow: "AI coach",
    title: "A coach that remembers yesterday.",
    body: "Roleplay interviews, small talk and meetings with a coach grounded in your real history — it knows which rules you broke this week.",
    points: ["Roleplay for real situations", "Answers grounded in your mistakes", "Follow-ups that push you one level up"],
    icon: MessagesSquare,
    visual: <ChatMock />,
  },
  {
    eyebrow: "Progress",
    title: "Watch the numbers that actually move.",
    body: "Ten skills tracked over time, with a weekly report in plain English that shows what is fixed and what still needs work.",
    points: ["Skill scores, not vanity streaks", "Weekly report you can read in a minute", "Every fix traces back to a real take"],
    icon: TrendingUp,
    reverse: true,
    visual: <ScoreMock />,
  },
];

function FeatureRow({ eyebrow, title, body, points, icon: Icon, reverse, visual }: FeatureRowData) {
  return (
    <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
      <div className={reverse ? "md:order-2" : undefined}>
        <span className="mb-4 grid size-10 place-items-center rounded-xl border border-border bg-card text-primary shadow-xs">
          <Icon className="size-5" />
        </span>
        <p className="text-eyebrow">{eyebrow}</p>
        <h3 className="text-h2 mt-2 text-balance">{title}</h3>
        <p className="mt-3 text-[15px]/[17px] text-muted-foreground">{body}</p>
        <ul className="mt-4 space-y-2">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm text-foreground">
              <Check className="mt-0.5 size-4 shrink-0 text-success" />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={reverse ? "md:order-1" : undefined}>{visual}</div>
    </div>
  );
}

function StepCard({ step }: { step: (typeof STEPS)[number] }) {
  const Icon = step.icon;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4.5" />
        </span>
        <span className="font-mono text-eyebrow">{step.n}</span>
      </div>
      <h3 className="text-h3 mt-4">{step.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
    </div>
  );
}

function DemoPanel() {
  return (
    <div className="mx-auto mt-10 w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-md sm:p-6">
      <div className="flex items-center gap-2.5 border-b border-border/70 pb-4">
        <LogoMark className="size-7 rounded-md" />
        <p className="text-sm font-medium">Live feedback</p>
        <span className="ml-auto text-eyebrow">Take 12</span>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-3">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-destructive/40 text-destructive">
            <X className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-eyebrow">You said</p>
            <p className="mt-1.5 text-sm">“I am working here since 3 years.”</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-3">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-eyebrow">AI found</p>
            <p className="mt-1.5 text-sm font-medium">Grammar pattern — since / for</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 px-3 py-3">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-success/50 text-success">
            <Check className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-eyebrow">Better</p>
            <p className="mt-1.5 text-sm">“I’ve been working here for 3 years.”</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/60 px-3 py-3">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-border text-muted-foreground">
            <Lightbulb className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-eyebrow">Why</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              “since” marks a starting point, “for” measures a duration.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
        <p className="text-sm text-muted-foreground">Free to start. No card needed.</p>
        <Button render={<Link href="/signup" />}>
          Start learning free <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo href="/" />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Landing">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button variant="ghost" render={<Link href="/login" />}>
              Log in
            </Button>
            <Button render={<Link href="/signup" />}>Get started</Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-border/50">
          <div className="grid-pattern pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
            <Badge variant="outline" className="animate-fade-up border-primary/30 bg-primary/5 text-primary">
              <Sparkles className="size-3" />
              Grounded in your own mistakes
            </Badge>

            <div className="animate-fade-up space-y-5" style={{ animationDelay: "60ms" }}>
              <h1 className="text-display text-balance">
                Your personal AI <span className="text-gradient">English coach</span>
              </h1>
              <p className="mx-auto max-w-2xl text-pretty text-[15px]/[17px] text-muted-foreground">
                Your English. Your patterns. Your coach learns how you speak, finds what keeps
                going wrong, and drills it until it sticks.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button size="lg" render={<Link href="/signup" />}>
                  Get started <ArrowRight className="size-4" />
                </Button>
                <Button size="lg" variant="outline" render={<Link href="/#how" />}>
                  See how it works
                </Button>
              </div>
            </div>

            <div className="animate-fade-up w-full max-w-md" style={{ animationDelay: "140ms" }}>
              <CoreLoop />
            </div>
          </div>
        </section>

        <section className="border-b border-border/60 bg-muted/30">
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-6 sm:px-6">
            <span className="text-sm font-medium text-muted-foreground">Inside the app:</span>
            {STATS.map((s) => (
              <div key={s.label} className="flex items-baseline gap-1.5">
                <span className="text-lg font-semibold tabular-nums">{s.value}</span>
                <span className="text-sm text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="scroll-mt-20 px-4 py-16 sm:px-6">
          <div className="mx-auto w-full max-w-5xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-eyebrow">The method</p>
              <h2 className="text-h2 mt-2">How it works</h2>
              <p className="mt-3 text-[15px]/[17px] text-muted-foreground">
                From first session to visible progress in four small steps.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <StepCard key={s.n} step={s} />
              ))}
            </div>
          </div>
        </section>

        <section id="demo" className="scroll-mt-20 border-y border-border/60 bg-muted/25 px-4 py-16 sm:px-6">
          <div className="mx-auto w-full max-w-5xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-eyebrow">Inside a session</p>
              <h2 className="text-h2 mt-2">One take. One rule. One fix.</h2>
              <p className="mt-3 text-[15px]/[17px] text-muted-foreground">
                Vovingo learns your pattern rules, then drills them. Every take ends with a
                plain-English reason — never just a red mark.
              </p>
            </div>
            <DemoPanel />
          </div>
        </section>

        <section id="features" className="scroll-mt-20 px-4 py-16 sm:px-6">
          <div className="mx-auto w-full max-w-5xl space-y-16">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-eyebrow">What you get</p>
              <h2 className="text-h2 mt-2">Everything a serious learner needs</h2>
              <p className="mt-3 text-[15px]/[17px] text-muted-foreground">
                Four rooms of the app, each aimed at one part of the loop.
              </p>
            </div>
            {FEATURE_ROWS.map((row) => (
              <FeatureRow key={row.eyebrow} {...row} />
            ))}
          </div>
        </section>

        <section className="border-y border-border/60 bg-muted/25 px-4 py-16 sm:px-6">
          <div className="mx-auto w-full max-w-5xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-eyebrow">Learners</p>
              <h2 className="text-h2 mt-2">Quiet progress, loud results</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <figure key={t.name} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-xs">
                  <Quote className="size-4 text-primary/70" />
                  <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-foreground">
                    {t.quote}
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-3 border-t border-border/70 pt-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--brand-1)] via-[var(--brand-2)] to-[var(--brand-3)] text-xs font-semibold text-white">
                      {t.initial}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{t.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{t.role}</span>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-20 px-4 py-16 sm:px-6">
          <div className="mx-auto w-full max-w-5xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-eyebrow">Pricing</p>
              <h2 className="text-h2 mt-2">Start free. Upgrade when it clicks.</h2>
              <p className="mt-3 text-[15px]/[17px] text-muted-foreground">
                One subscription, the whole loop. Cancel any time from your account.
              </p>
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {PLANS.map((p) => (
                <div
                  key={p.name}
                  className={`flex flex-col rounded-2xl border bg-card p-5 shadow-xs ${
                    p.featured
                      ? "border-primary ring-1 ring-primary/20 shadow-md"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{p.name}</p>
                    {p.featured ? (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        Most popular
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-4 flex items-baseline gap-1.5">
                    <span className="text-h1 tabular-nums">{p.price}</span>
                    <span className="text-sm text-muted-foreground">{p.period}</span>
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{p.blurb}</p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-success" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    <Button
                      className="w-full"
                      variant={p.featured ? "default" : "outline"}
                      render={<Link href="/signup" />}
                    >
                      {p.cta}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 border-t border-border/60 bg-muted/25 px-4 py-16 sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <div className="text-center">
              <p className="text-eyebrow">FAQ</p>
              <h2 className="text-h2 mt-2">Questions, answered</h2>
            </div>
            <div className="mt-8 rounded-2xl border border-border bg-card px-5 py-2 shadow-xs">
              <Accordion defaultValue={["faq-0"]}>
                {FAQS.map((f, i) => (
                  <AccordionItem key={f.q} value={`faq-${i}`}>
                    <AccordionTrigger className="py-3.5 text-[15px]">{f.q}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6">
          <div className="mx-auto w-full max-w-5xl">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--brand-1)] via-[var(--brand-2)] to-[var(--brand-3)] p-8 text-center shadow-md sm:p-14">
              <div className="grid-pattern pointer-events-none absolute inset-0 opacity-30" aria-hidden />
              <div className="relative">
                <h2 className="text-h2 text-white">Five minutes a day. Your own mistakes.</h2>
                <p className="mx-auto mt-3 max-w-md text-[15px]/[17px] text-white/85">
                  Set your goals, take the placement check and record your first take. Free to
                  start, no card needed.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button
                    size="lg"
                    className="bg-white text-black hover:bg-white/90"
                    render={<Link href="/signup" />}
                  >
                    Start learning free <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-3">
              <Logo href="/" />
              <p className="max-w-xs text-sm text-muted-foreground">
                Your patterns, your coach, steady progress — one short session at a time.
              </p>
            </div>
            <div>
              <p className="text-eyebrow">Product</p>
              <ul className="mt-3 space-y-2">
                {NAV_LINKS.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-eyebrow">Learn</p>
              <ul className="mt-3 space-y-2">
                {[
                  { href: "/lessons", label: "Lessons" },
                  { href: "/speaking", label: "Speaking" },
                  { href: "/listening", label: "Listening" },
                  { href: "/progress", label: "Progress" },
                ].map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-eyebrow">Account</p>
              <ul className="mt-3 space-y-2">
                {[
                  { href: "/login", label: "Log in" },
                  { href: "/signup", label: "Create account" },
                ].map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-2 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">© 2026 Vovingo. All rights reserved.</p>
            <p className="text-xs text-muted-foreground">Learn · Speak · Fix · Progress</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
