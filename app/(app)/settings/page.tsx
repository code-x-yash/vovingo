import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Crown, Gift, Gauge, UserRound } from "lucide-react";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import {
  countTrackedRules,
  getAllQuotaStates,
  getEntitlements,
  getReferralStats,
} from "@/lib/billing/entitlements";
import { FREE_RULES_TRACKED } from "@/lib/billing/plans";
import { Button } from "@/components/ui/button";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { ReferralCard } from "@/components/settings/referral-card";

export const metadata: Metadata = { title: "Settings · Vovingo" };

const METRIC_LABEL: Record<string, { label: string; unit: string }> = {
  speaking: { label: "Speaking takes", unit: "a day" },
  writing: { label: "Writing grades", unit: "a day" },
  conversation: { label: "Coach messages", unit: "a day" },
  lessons: { label: "Lessons", unit: "a week" },
};

const VISIBLE_METRICS = ["speaking", "writing", "conversation", "lessons"];

function formatDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function SectionCard({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
      <p className="text-eyebrow">{title}</p>
      {body && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{body}</p>}
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/settings");

  const [entitlements, quotas, referral, trackedRules] = await Promise.all([
    getEntitlements(user.id),
    getAllQuotaStates(user.id),
    getReferralStats(user.id),
    countTrackedRules(user.id),
  ]);
  const db = await getDb();
  const settingsRows = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, user.id))
    .limit(1);
  const settings = settingsRows[0];

  const visibleQuotas = quotas.filter((q) => VISIBLE_METRICS.includes(q.metric));
  const planLabel = entitlements.isPro
    ? entitlements.expiresAt
      ? `Pro · renews or ends ${formatDate(entitlements.expiresAt)}`
      : "Pro"
    : "Free plan";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pt-8 pb-12 sm:px-6">
      <header className="animate-fade-up">
        <p className="text-eyebrow">Settings</p>
        <h1 className="text-h1 mt-2.5">Your account</h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">
          Plan, usage, referrals and practice preferences — everything in one place.
        </p>
      </header>

      <SectionCard title="Account">
        <div className="mt-4 flex items-center gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--brand-1)] to-[var(--brand-2)] text-sm font-semibold text-white">
            {user.name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase() ?? "")
              .join("") || "?"}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-sm font-medium">
              <UserRound className="size-3.5 text-muted-foreground" />
              {user.name}
            </p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Plan"
        body={
          entitlements.isPro
            ? "Pro is active. Every meter is off."
            : "Free plan — the daily and weekly limits below reset automatically."
        }
      >
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/60 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Crown
              className={`size-4 ${entitlements.isPro ? "text-primary" : "text-muted-foreground"}`}
            />
            {planLabel}
          </p>
          {entitlements.isPro ? null : (
            <CheckoutButton plan="pro_monthly" size="sm">
              Upgrade to Pro
            </CheckoutButton>
          )}
        </div>

        <div className="mt-5 space-y-3.5">
          {visibleQuotas.map((q) => {
            const info = METRIC_LABEL[q.metric];
            if (!info) return null;
            const pct = q.isPro ? 100 : Math.min(100, (q.used / q.limit) * 100);
            return (
              <div key={q.metric}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {info.label} <span className="text-xs">· {info.unit}</span>
                  </span>
                  <span className="font-medium tabular-nums">
                    {q.isPro ? "Unlimited" : `${q.used} / ${q.limit}`}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${
                      q.allowed
                        ? "bg-gradient-to-r from-[var(--brand-1)] to-[var(--brand-2)]"
                        : "bg-destructive"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          <div>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                Rules tracked <span className="text-xs">· lifetime</span>
              </span>
              <span className="font-medium tabular-nums">
                {entitlements.isPro ? "All 45" : `${trackedRules} / ${FREE_RULES_TRACKED}`}
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Refer a friend"
        body="Your friend starts on the free plan. When they finish onboarding, you earn Pro days."
      >
        <ReferralCard code={referral.code} />
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[13px] text-muted-foreground">
            <Gift className="mr-1 inline size-3.5" />
            {referral.rewardedCount} friend{referral.rewardedCount === 1 ? "" : "s"} joined
          </span>
          <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[13px] text-muted-foreground">
            <CalendarDays className="mr-1 inline size-3.5" />
            {referral.rewardDays} Pro day{referral.rewardDays === 1 ? "" : "s"} earned
          </span>
        </div>
      </SectionCard>

      <SectionCard
        title="Practice preferences"
        body="Your daily goal shapes lesson length and the plan builder."
      >
        <PreferencesForm
          initialGoal={settings?.dailyGoalMinutes ?? 20}
          initialReminder={settings?.workoutReminderAt ?? null}
        />
      </SectionCard>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Gauge className="size-4" />
          Compare the plans side by side.
        </p>
        <Button variant="outline" size="sm" render={<Link href="/pricing" />}>
          View pricing
        </Button>
      </div>
    </div>
  );
}
