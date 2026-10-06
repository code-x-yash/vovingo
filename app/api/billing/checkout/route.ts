import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod";
import { getDb } from "@/lib/db";
import { paymentOrders } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { jsonError, jsonRateLimited, readJson } from "@/lib/api/http";
import { fieldErrors } from "@/lib/auth/schemas";
import { planAmountPaise } from "@/lib/billing/plans";
import { createRazorpayOrder, razorpayConfig } from "@/lib/billing/razorpay";
import { createStripeCheckoutSession, stripeConfig } from "@/lib/billing/stripe";

const checkoutSchema = z.object({
  plan: z.enum(["pro_monthly", "pro_yearly"]),
});

/**
 * Creates a payment session. Returns one of:
 *  - { mode: "razorpay", ... }  → client opens Razorpay checkout with an order
 *  - { mode: "stripe", url }     → client redirects to Stripe Checkout
 *  - { mode: "waitlist" }        → no provider configured yet (pre-revenue)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Not authenticated.");

  const limit = rateLimit(`checkout:${clientIp(request.headers)}`, 10, 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const body = await readJson(request);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }
  const plan = parsed.data.plan;
  const origin = new URL(request.url).origin;
  const db = await getDb();

  const razorpay = razorpayConfig();
  if (razorpay) {
    const amountPaise = planAmountPaise(plan);
    const order = await createRazorpayOrder({
      amountPaise,
      receipt: `vovingo_${user.id}_${Date.now()}`,
      notes: { userId: String(user.id), plan },
    });
    await db.insert(paymentOrders).values({
      userId: user.id,
      plan,
      provider: "razorpay",
      providerOrderId: order.id,
      amountPaise,
      currency: order.currency,
      status: "created",
    });
    return NextResponse.json({
      mode: "razorpay",
      keyId: razorpay.keyId,
      orderId: order.id,
      amount: amountPaise,
      currency: order.currency,
      plan,
    });
  }

  const stripe = stripeConfig();
  if (stripe) {
    const session = await createStripeCheckoutSession({
      plan,
      userId: user.id,
      email: user.email,
      successUrl: `${origin}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/pricing?checkout=canceled`,
    });
    await db.insert(paymentOrders).values({
      userId: user.id,
      plan,
      provider: "stripe",
      providerOrderId: session.id,
      amountPaise: planAmountPaise(plan),
      currency: "INR",
      status: "created",
    });
    return NextResponse.json({ mode: "stripe", url: session.url, plan });
  }

  return NextResponse.json({ mode: "waitlist", plan });
}
