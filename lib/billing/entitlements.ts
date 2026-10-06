import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  events,
  referralCodes,
  referrals,
  subscriptions,
  userMistakes,
} from "@/lib/db/schema";
import {
  computeQuota,
  windowStart,
  type QuotaMetric,
  type QuotaState,
} from "./plans";

export type Entitlements = {
  isPro: boolean;
  plan: "free" | "pro";
  expiresAt: Date | null;
};

const PRO_STATUS = inArray(subscriptions.plan, ["pro", "premium"]);

async function activeProRows(userId: number) {
  const db = await getDb();
  const now = Date.now();
  const rows = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"), PRO_STATUS));
  return rows.filter((row) => row.expiresAt == null || row.expiresAt.getTime() > now);
}

export async function getEntitlements(userId: number): Promise<Entitlements> {
  const active = await activeProRows(userId);
  if (active.length === 0) return { isPro: false, plan: "free", expiresAt: null };
  const expiries = active.map((row) => row.expiresAt?.getTime() ?? null);
  const latest = expiries.some((value) => value == null)
    ? null
    : new Date(Math.max(...(expiries as number[])));
  return { isPro: true, plan: "pro", expiresAt: latest };
}

export function usageEventName(metric: QuotaMetric): string {
  return `quota:${metric}`;
}

export async function countUsage(userId: number, metric: QuotaMetric): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ value: sql<number>`count(*)` })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        eq(events.name, usageEventName(metric)),
        gte(events.createdAt, new Date(windowStart(metric)))
      )
    );
  return rows[0]?.value ?? 0;
}

export async function getQuotaState(userId: number, metric: QuotaMetric): Promise<QuotaState> {
  const [{ isPro }, used] = await Promise.all([
    getEntitlements(userId),
    countUsage(userId, metric),
  ]);
  return computeQuota({ metric, isPro, used });
}

export const ALL_QUOTA_METRICS: QuotaMetric[] = [
  "speaking",
  "writing",
  "conversation",
  "stage",
  "duel",
  "tone",
  "lessons",
];

export async function getAllQuotaStates(userId: number): Promise<QuotaState[]> {
  const { isPro } = await getEntitlements(userId);
  const used = await Promise.all(ALL_QUOTA_METRICS.map((metric) => countUsage(userId, metric)));
  return ALL_QUOTA_METRICS.map((metric, index) =>
    computeQuota({ metric, isPro, used: used[index] ?? 0 })
  );
}

export async function recordUsage(
  userId: number,
  metric: QuotaMetric,
  props: Record<string, unknown> = {}
): Promise<void> {
  const db = await getDb();
  await db.insert(events).values({
    userId,
    name: usageEventName(metric),
    props: { ...props, window: windowStart(metric) },
  });
}

/**
 * Returns a 402 when the free plan has no passes left for this metric,
 * otherwise null so the route can continue. One shared guard for every
 * metered endpoint.
 */
export async function enforceQuota(
  userId: number,
  metric: QuotaMetric
): Promise<NextResponse | null> {
  const state = await getQuotaState(userId, metric);
  if (state.allowed) return null;
  const windowPhrase = state.window === "week" ? "this week" : "today";
  return NextResponse.json(
    {
      error: `You've used your ${state.limit} free ${metric} passes ${windowPhrase}. Upgrade to Pro for unlimited.`,
      code: "quota_exceeded",
      metric,
      used: state.used,
      limit: state.limit,
      upgradePath: "/pricing",
    },
    { status: 402 }
  );
}

export async function countTrackedRules(userId: number): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ value: sql<number>`count(*)` })
    .from(userMistakes)
    .where(eq(userMistakes.userId, userId));
  return rows[0]?.value ?? 0;
}

/**
 * Extends (or starts) a Pro subscription for `days` from now or from the
 * current expiry — whichever is later — so referral rewards stack.
 */
export async function grantPro(
  userId: number,
  input: { days: number; provider: string; providerRef?: string }
): Promise<{ expiresAt: Date }> {
  const db = await getDb();
  const now = Date.now();
  const existing = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), PRO_STATUS))
    .orderBy(desc(subscriptions.id))
    .limit(1);

  const current = existing[0];
  const base =
    current?.expiresAt && current.expiresAt.getTime() > now ? current.expiresAt.getTime() : now;
  const expiresAt = new Date(base + input.days * 24 * 60 * 60 * 1000);

  if (current) {
    await db
      .update(subscriptions)
      .set({
        plan: "pro",
        status: "active",
        provider: input.provider,
        providerRef: input.providerRef ?? current.providerRef,
        startedAt: current.startedAt ?? new Date(now),
        expiresAt,
      })
      .where(eq(subscriptions.id, current.id));
  } else {
    await db.insert(subscriptions).values({
      userId,
      plan: "pro",
      status: "active",
      provider: input.provider,
      providerRef: input.providerRef,
      startedAt: new Date(now),
      expiresAt,
    });
  }
  return { expiresAt };
}

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function makeReferralCode(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return `VOV${out}`;
}

export async function getOrCreateReferralCode(userId: number): Promise<string> {
  const db = await getDb();
  const existing = await db
    .select({ code: referralCodes.code })
    .from(referralCodes)
    .where(eq(referralCodes.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0].code;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeReferralCode();
    try {
      await db.insert(referralCodes).values({ userId, code });
      return code;
    } catch {
      // unique collision — retry
    }
  }
  throw new Error("Could not allocate a referral code.");
}

export type ReferralStats = {
  code: string;
  rewardedCount: number;
  pendingCount: number;
  rewardDays: number;
};

export async function getReferralStats(userId: number): Promise<ReferralStats> {
  const db = await getDb();
  const code = await getOrCreateReferralCode(userId);
  const rows = await db
    .select({ status: referrals.status, rewardDays: referrals.rewardDays })
    .from(referrals)
    .where(eq(referrals.referrerUserId, userId));
  return {
    code,
    rewardedCount: rows.filter((row) => row.status === "rewarded").length,
    pendingCount: rows.filter((row) => row.status === "pending").length,
    rewardDays: rows
      .filter((row) => row.status === "rewarded")
      .reduce((sum, row) => sum + (row.rewardDays ?? 0), 0),
  };
}

/** Attributes a signup to a referral code. Silently ignores invalid/self codes. */
export async function attachReferral(referredUserId: number, rawCode: string): Promise<void> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return;
  const db = await getDb();
  const rows = await db
    .select({ referrerUserId: referralCodes.userId })
    .from(referralCodes)
    .where(eq(referralCodes.code, code))
    .limit(1);
  const referrer = rows[0]?.referrerUserId;
  if (referrer == null || referrer === referredUserId) return;
  try {
    await db.insert(referrals).values({
      referrerUserId: referrer,
      referredUserId,
      code,
      status: "pending",
    });
  } catch {
    // already attributed (referred_user_id is unique) — ignore
  }
}

/**
 * Called when a referred user finishes onboarding: flips the referral to
 * rewarded and grants the referrer stacking Pro days.
 */
export async function completeReferral(referredUserId: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(referrals)
    .where(and(eq(referrals.referredUserId, referredUserId), eq(referrals.status, "pending")))
    .limit(1);
  const referral = rows[0];
  if (!referral) return false;

  await db
    .update(referrals)
    .set({ status: "rewarded", rewardedAt: new Date() })
    .where(eq(referrals.id, referral.id));
  await grantPro(referral.referrerUserId, {
    days: referral.rewardDays,
    provider: "referral",
    providerRef: `referral:${referral.id}`,
  });
  return true;
}
