/**
 * Stripe adapter for international cards — active when STRIPE_SECRET_KEY and
 * both price IDs are configured (create two recurring Prices in the Stripe
 * dashboard and paste their IDs). Otherwise checkout falls back to waitlist.
 */

export function stripeConfig(): { secret: string; priceMonthly: string; priceYearly: string } | null {
  const secret = process.env.STRIPE_SECRET_KEY;
  const priceMonthly = process.env.STRIPE_PRICE_MONTHLY;
  const priceYearly = process.env.STRIPE_PRICE_YEARLY;
  if (!secret || !priceMonthly || !priceYearly) return null;
  return { secret, priceMonthly, priceYearly };
}

export function stripePriceId(
  plan: "pro_monthly" | "pro_yearly"
): string | null {
  const config = stripeConfig();
  if (!config) return null;
  return plan === "pro_monthly" ? config.priceMonthly : config.priceYearly;
}

export async function createStripeCheckoutSession(input: {
  plan: "pro_monthly" | "pro_yearly";
  userId: number;
  email: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string }> {
  const price = stripePriceId(input.plan);
  if (!price) throw new Error("Stripe is not configured.");

  const body = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    customer_email: input.email,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "metadata[userId]": String(input.userId),
    "metadata[plan]": input.plan,
    "subscription_data[metadata][userId]": String(input.userId),
  });

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeConfig()!.secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Stripe checkout failed (${response.status}): ${detail.slice(0, 200)}`);
  }
  const session = (await response.json()) as { id: string; url: string };
  return { id: session.id, url: session.url };
}

export async function getStripeSession(sessionId: string): Promise<{
  status: string;
  userId: number | null;
  plan: string | null;
} | null> {
  const config = stripeConfig();
  if (!config) return null;
  const response = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${config.secret}` } }
  );
  if (!response.ok) return null;
  const session = (await response.json()) as {
    status: string;
    metadata?: { userId?: string; plan?: string };
  };
  return {
    status: session.status,
    userId: session.metadata?.userId ? Number(session.metadata.userId) : null,
    plan: session.metadata?.plan ?? null,
  };
}
