import { describe, expect, it } from "vitest";
import {
  FREE_QUOTAS,
  FREE_RULES_TRACKED,
  PLANS,
  PRO_DAYS_BY_PLAN,
  QUOTA_WINDOWS,
  computeQuota,
  planAmountPaise,
  planDays,
  quotaLimit,
  windowStart,
} from "@/lib/billing/plans";
import { makeReferralCode, usageEventName } from "@/lib/billing/entitlements";
import { verifyRazorpaySignature } from "@/lib/billing/razorpay";

const METRICS = Object.keys(FREE_QUOTAS) as (keyof typeof FREE_QUOTAS)[];

describe("free quota math", () => {
  it("matches the marketing copy numbers", () => {
    expect(FREE_QUOTAS).toEqual({
      speaking: 1,
      writing: 2,
      conversation: 3,
      stage: 1,
      duel: 1,
      tone: 3,
      lessons: 5,
    });
    expect(FREE_RULES_TRACKED).toBe(10);
    expect(QUOTA_WINDOWS.lessons).toBe("week");
    for (const metric of METRICS) {
      if (metric !== "lessons") expect(QUOTA_WINDOWS[metric]).toBe("day");
    }
  });

  it("blocks when free usage reaches the limit", () => {
    const limit = FREE_QUOTAS.writing;
    expect(computeQuota({ metric: "writing", isPro: false, used: 0 }).allowed).toBe(true);
    expect(computeQuota({ metric: "writing", isPro: false, used: limit - 1 }).allowed).toBe(true);
    expect(computeQuota({ metric: "writing", isPro: false, used: limit }).allowed).toBe(false);
    expect(computeQuota({ metric: "writing", isPro: false, used: limit + 5 }).allowed).toBe(false);
  });

  it("never lets free remaining go negative", () => {
    const state = computeQuota({ metric: "speaking", isPro: false, used: 99 });
    expect(state.remaining).toBe(0);
    expect(state.limit).toBe(1);
  });

  it("keeps Pro unlimited on every metric", () => {
    for (const metric of METRICS) {
      const state = computeQuota({ metric, isPro: true, used: 10_000 });
      expect(state.allowed).toBe(true);
      expect(state.limit).toBe(Number.POSITIVE_INFINITY);
      expect(state.remaining).toBe(Number.POSITIVE_INFINITY);
      expect(quotaLimit(metric, true)).toBe(Number.POSITIVE_INFINITY);
    }
  });

  it("reports the counting window", () => {
    expect(computeQuota({ metric: "lessons", isPro: false, used: 0 }).window).toBe("week");
    expect(computeQuota({ metric: "speaking", isPro: false, used: 0 }).window).toBe("day");
  });
});

describe("windowStart", () => {
  it("uses UTC midnight for daily metrics", () => {
    const now = Date.UTC(2026, 9, 6, 13, 45, 30);
    expect(windowStart("speaking", now)).toBe(Date.UTC(2026, 9, 6));
    expect(new Date(windowStart("writing", now)).getUTCHours()).toBe(0);
  });

  it("uses a rolling 7-day window for weekly metrics", () => {
    const now = Date.UTC(2026, 9, 6, 13, 45, 30);
    expect(windowStart("lessons", now)).toBe(now - 7 * 24 * 60 * 60 * 1000);
  });

  it("never returns a start after the given time", () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 1);
    for (const metric of METRICS) {
      expect(windowStart(metric, now)).toBeLessThanOrEqual(now);
    }
  });
});

describe("plan pricing", () => {
  it("matches the landing copy amounts", () => {
    expect(planAmountPaise("pro_monthly")).toBe(49900);
    expect(planAmountPaise("pro_yearly")).toBe(399900);
    expect(planDays("pro_monthly")).toBe(30);
    expect(planDays("pro_yearly")).toBe(365);
    expect(PRO_DAYS_BY_PLAN.pro_monthly).toBe(30);
    expect(PRO_DAYS_BY_PLAN.pro_yearly).toBe(365);
  });

  it("keeps PLANS identical to what pricing renders", () => {
    const byKey = Object.fromEntries(PLANS.map((p) => [p.key, p]));
    expect(byKey.free.price).toBe("₹0");
    expect(byKey.free.features).toContain("5 lessons a week");
    expect(byKey.free.features).toContain("10 rules tracked");
    expect(byKey.pro_monthly.price).toBe("₹499");
    expect(byKey.pro_monthly.features).toContain("Unlimited lessons and takes");
    expect(byKey.pro_yearly.price).toBe("₹3,999");
  });
});

describe("usage events", () => {
  it("names quota events per metric", () => {
    expect(usageEventName("speaking")).toBe("quota:speaking");
    expect(usageEventName("lessons")).toBe("quota:lessons");
  });
});

describe("referral codes", () => {
  it("produces VOV + 6 chars from the safe alphabet", () => {
    const code = makeReferralCode(() => 0);
    expect(code).toMatch(/^VOV[A-Z2-9]{6}$/);
    expect(code).toBe("VOVAAAAAA");
  });

  it("excludes lookalike characters (0/O/1/I/L)", () => {
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    for (let i = 0; i < 500; i += 1) {
      const code = makeReferralCode(() => i / 500);
      const tail = code.slice(3);
      expect(tail).toHaveLength(6);
      for (const ch of tail) expect(alphabet).toContain(ch);
      expect(/[01OIL]/.test(tail)).toBe(false);
    }
  });
});

describe("razorpay signature", () => {
  it("rejects when no key secret is configured", async () => {
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_KEY_ID;
    const valid = await verifyRazorpaySignature({
      orderId: "order_1",
      paymentId: "pay_1",
      signature: "deadbeef",
    });
    expect(valid).toBe(false);
  });

  it("verifies a correct HMAC-SHA256 signature", async () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_x";
    process.env.RAZORPAY_KEY_SECRET = "secret_test_value";
    try {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode("secret_test_value"),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const sig = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode("order_abc|pay_xyz")
      );
      const signature = [...new Uint8Array(sig)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      expect(
        await verifyRazorpaySignature({
          orderId: "order_abc",
          paymentId: "pay_xyz",
          signature,
        })
      ).toBe(true);
      expect(
        await verifyRazorpaySignature({
          orderId: "order_abc",
          paymentId: "pay_tampered",
          signature,
        })
      ).toBe(false);
    } finally {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
    }
  });
});
