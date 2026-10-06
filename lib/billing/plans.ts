export type PlanKey = "free" | "pro_monthly" | "pro_yearly";

export type QuotaMetric =
  | "speaking"
  | "writing"
  | "conversation"
  | "stage"
  | "duel"
  | "tone"
  | "lessons";

export type QuotaWindow = "day" | "week";

export type PlanInfo = {
  key: PlanKey;
  name: string;
  price: string;
  period: string;
  blurb: string;
  cta: string;
  featured: boolean;
  features: string[];
};

/**
 * Marketing plans — kept identical to the landing #pricing copy so the
 * pricing page, paywall and landing never disagree.
 */
export const PLANS: PlanInfo[] = [
  {
    key: "free",
    name: "Free",
    price: "₹0",
    period: "forever",
    blurb: "Build the habit before you spend anything.",
    cta: "Start free",
    featured: false,
    features: [
      "5 lessons a week",
      "1 speaking take a day",
      "10 rules tracked",
      "Weekly progress view",
    ],
  },
  {
    key: "pro_monthly",
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
    key: "pro_yearly",
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

/** Free-plan meters. Marketing copy promises these exact numbers. */
export const FREE_QUOTAS: Record<QuotaMetric, number> = {
  speaking: 1,
  writing: 2,
  conversation: 3,
  stage: 1,
  duel: 1,
  tone: 3,
  lessons: 5,
};

export const QUOTA_WINDOWS: Record<QuotaMetric, QuotaWindow> = {
  speaking: "day",
  writing: "day",
  conversation: "day",
  stage: "day",
  duel: "day",
  tone: "day",
  lessons: "week",
};

/** Free plan tracks this many distinct mistake rules; Pro tracks all. */
export const FREE_RULES_TRACKED = 10;

export const UNLIMITED = Number.POSITIVE_INFINITY;

export const REFERRAL_REWARD_DAYS = 7;

export const PRO_DAYS_BY_PLAN: Record<"pro_monthly" | "pro_yearly", number> = {
  pro_monthly: 30,
  pro_yearly: 365,
};

export function quotaLimit(metric: QuotaMetric, isPro: boolean): number {
  return isPro ? UNLIMITED : FREE_QUOTAS[metric];
}

export function planAmountPaise(key: "pro_monthly" | "pro_yearly"): number {
  return key === "pro_monthly" ? 499_00 : 3999_00;
}

export function planDays(key: "pro_monthly" | "pro_yearly"): number {
  return PRO_DAYS_BY_PLAN[key];
}

export type QuotaState = {
  metric: QuotaMetric;
  isPro: boolean;
  limit: number;
  used: number;
  remaining: number;
  allowed: boolean;
  window: QuotaWindow;
};

/**
 * Pure quota math — shared by the API guard and tests. Pro is unlimited;
 * free remaining bottoms out at 0 and `allowed` gates the request.
 */
export function computeQuota(input: {
  metric: QuotaMetric;
  isPro: boolean;
  used: number;
}): QuotaState {
  const limit = quotaLimit(input.metric, input.isPro);
  const remaining = input.isPro ? UNLIMITED : Math.max(0, limit - input.used);
  return {
    metric: input.metric,
    isPro: input.isPro,
    limit,
    used: input.used,
    remaining,
    allowed: input.isPro || input.used < limit,
    window: QUOTA_WINDOWS[input.metric],
  };
}

/** Epoch-ms start of a metric's counting window (UTC). */
export function windowStart(metric: QuotaMetric, now = Date.now()): number {
  if (QUOTA_WINDOWS[metric] === "week") return now - 7 * 24 * 60 * 60 * 1000;
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
