import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Logo, LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { CheckoutReturn } from "@/components/billing/checkout-return";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Pricing · Vovingo" };

const PLANS = [
  {
    key: "free" as const,
    name: "Free",
    price: "₹0",
    period: "forever",
    blurb: "Build the habit before you spend anything.",
    cta: "Start free",
    featured: false,
    features: [
      "5 lessons a week",
      "1 speaking take a day",
      "2 writing grades a day",
      "3 coach messages a day",
      "10 rules tracked",
      "Weekly progress view",
    ],
  },
  {
    key: "pro_monthly" as const,
    name: "Pro monthly",
    price: "₹499",
    period: "per month",
    blurb: "The full loop, with nothing metered.",
    cta: "Start Pro",
    featured: true,
    features: [
      "Unlimited lessons and takes",
      "Unlimited writing and coach chats",
      "All 45 grammar rules",
      "AI coach and roleplay",
      "Listening labs",
      "Weekly written report",
    ],
  },
  {
    key: "pro_yearly" as const,
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
    q: "When does Pro billing switch on?",
    a: "Payments are being enabled account-wide. Until then, checkout saves you a seat on the Pro waitlist and you can keep using the free plan.",
  },
  {
    q: "Is there a free plan?",
    a: "The Free plan covers five lessons a week, one speaking take a day, two writing grades, three coach messages and ten tracked rules. Upgrade to Pro only when you want the whole loop without limits.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes. Cancel from your account and Pro runs until the end of the period you already paid for.",
  },
  {
    q: "Do referrals really add Pro days?",
    a: "Yes. Share your code from Settings — when a friend signs up and finishes onboarding, you earn 7 Pro days, stacking with every friend who joins.",
  },
];

function PlanCard({
  plan,
  loggedIn,
}: {
  plan: (typeof PLANS)[number];
  loggedIn: boolean;
}) {
  const isFree = plan.key === "free";
  return (
    <div
      className={`flex flex-col rounded-2xl border bg-card p-5 shadow-xs ${
        plan.featured ? "border-primary ring-1 ring-primary/20 shadow-md" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{plan.name}</p>
        {plan.featured ? (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            Most popular
          </span>
        ) : null}
      </div>
      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="text-h1 tabular-nums">{plan.price}</span>
        <span className="text-sm text-muted-foreground">{plan.period}</span>
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{plan.blurb}</p>
      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-success" />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-6">
        {isFree ? (
          <Button
            className="w-full"
            variant="outline"
            render={
              <Link href={loggedIn ? "/dashboard" : "/signup"} />
            }
          >
            {plan.cta}
          </Button>
        ) : loggedIn ? (
          <CheckoutButton plan={plan.key} className="w-full" variant={plan.featured ? "default" : "outline"}>
            {plan.cta}
          </CheckoutButton>
        ) : (
          <Button
            className="w-full"
            variant={plan.featured ? "default" : "outline"}
            render={<Link href={`/signup?next=${encodeURIComponent("/pricing")}`} />}
          >
            {plan.cta} <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo href="/" />
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            {user ? (
              <Button render={<Link href="/dashboard" />}>Dashboard</Button>
            ) : (
              <>
                <Button variant="ghost" render={<Link href="/login" />}>
                  Log in
                </Button>
                <Button render={<Link href="/signup" />}>Get started</Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {params.checkout === "success" && params.session_id && user ? (
          <CheckoutReturn sessionId={params.session_id} />
        ) : null}

        <section className="relative overflow-hidden border-b border-border/50">
          <div className="grid-pattern pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-4 pb-12 pt-14 text-center sm:px-6 sm:pt-20">
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
              <ShieldCheck className="size-3" />
              Cancel any time
            </Badge>
            <div className="space-y-4">
              <h1 className="text-display text-balance">
                Start free. <span className="text-gradient">Upgrade when it clicks.</span>
              </h1>
              <p className="mx-auto max-w-2xl text-pretty text-[15px]/[17px] text-muted-foreground">
                One subscription, the whole loop. The free plan is real — five lessons a week and a
                daily take, forever.
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6">
          <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <PlanCard key={plan.key} plan={plan} loggedIn={Boolean(user)} />
            ))}
          </div>
          <p className="mx-auto mt-6 flex max-w-5xl items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <LogoMark className="size-4 rounded" />
            Prices in INR. GST included where applicable.
          </p>
        </section>

        <section className="border-t border-border/60 bg-muted/25 px-4 py-14 sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <div className="text-center">
              <p className="text-eyebrow">FAQ</p>
              <h2 className="text-h2 mt-2">Pricing questions</h2>
            </div>
            <div className="mt-8 rounded-2xl border border-border bg-card px-5 py-2 shadow-xs">
              <Accordion defaultValue={["pfaq-0"]}>
                {FAQS.map((f, i) => (
                  <AccordionItem key={f.q} value={`pfaq-${i}`}>
                    <AccordionTrigger className="py-3.5 text-[15px]">{f.q}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
          <Logo href="/" />
          <Link
            href="/#faq"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Help
          </Link>
        </div>
      </footer>
    </div>
  );
}
