import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { paymentOrders } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { jsonError, jsonRateLimited, readJson } from "@/lib/api/http";
import { fieldErrors } from "@/lib/auth/schemas";
import { grantPro } from "@/lib/billing/entitlements";
import { planDays } from "@/lib/billing/plans";
import { verifyRazorpaySignature } from "@/lib/billing/razorpay";
import { getStripeSession } from "@/lib/billing/stripe";

const verifySchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("razorpay"),
    orderId: z.string().min(1).max(100),
    paymentId: z.string().min(1).max(100),
    signature: z.string().min(1).max(200),
  }),
  z.object({
    provider: z.literal("stripe"),
    sessionId: z.string().min(1).max(200),
  }),
]);

/**
 * Confirms a checkout with the payment provider and activates Pro. The amount
 * always comes from our own payment_orders row — never from the client.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return jsonError(401, "Not authenticated.");

  const limit = rateLimit(`verify:${clientIp(request.headers)}`, 20, 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const body = await readJson(request);
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  const db = await getDb();
  const data = parsed.data;

  if (data.provider === "razorpay") {
    const rows = await db
      .select()
      .from(paymentOrders)
      .where(
        and(
          eq(paymentOrders.userId, user.id),
          eq(paymentOrders.providerOrderId, data.orderId)
        )
      )
      .limit(1);
    const order = rows[0];
    if (!order) return jsonError(404, "Payment order not found.");
    if (order.status === "paid") return NextResponse.json({ ok: true, alreadyPaid: true });

    const valid = await verifyRazorpaySignature({
      orderId: data.orderId,
      paymentId: data.paymentId,
      signature: data.signature,
    });
    if (!valid) {
      await db
        .update(paymentOrders)
        .set({ status: "failed" })
        .where(eq(paymentOrders.id, order.id));
      return jsonError(400, "Payment signature verification failed.");
    }

    const now = new Date();
    await db
      .update(paymentOrders)
      .set({ status: "paid", paymentRef: data.paymentId, paidAt: now })
      .where(eq(paymentOrders.id, order.id));
    const { expiresAt } = await grantPro(user.id, {
      days: planDays(order.plan),
      provider: "razorpay",
      providerRef: data.paymentId,
    });
    return NextResponse.json({ ok: true, expiresAt: expiresAt.toISOString() });
  }

  const session = await getStripeSession(data.sessionId);
  if (!session) return jsonError(404, "Checkout session not found.");
  if (session.userId !== user.id) return jsonError(403, "This checkout belongs to another account.");
  if (session.status !== "complete") return jsonError(409, "Checkout is not complete yet.");

  const rows = await db
    .select()
    .from(paymentOrders)
    .where(
      and(eq(paymentOrders.userId, user.id), eq(paymentOrders.providerOrderId, data.sessionId))
    )
    .limit(1);
  const order = rows[0];
  if (!order) return jsonError(404, "Payment order not found.");
  if (order.status === "paid") return NextResponse.json({ ok: true, alreadyPaid: true });

  await db
    .update(paymentOrders)
    .set({ status: "paid", paymentRef: data.sessionId, paidAt: new Date() })
    .where(eq(paymentOrders.id, order.id));
  const { expiresAt } = await grantPro(user.id, {
    days: planDays(order.plan),
    provider: "stripe",
    providerRef: data.sessionId,
  });
  return NextResponse.json({ ok: true, expiresAt: expiresAt.toISOString() });
}
