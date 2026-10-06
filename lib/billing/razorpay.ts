/**
 * Razorpay adapter — active only when RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET
 * are configured. Without keys the checkout route falls back to the Pro
 * waitlist, so nothing here runs until the owner creates an account.
 */

export function razorpayConfig(): { keyId: string; keySecret: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export type RazorpayOrder = { id: string; amount: number; currency: string };

export async function createRazorpayOrder(input: {
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  const config = razorpayConfig();
  if (!config) throw new Error("Razorpay is not configured.");

  const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Razorpay order failed (${response.status}): ${detail.slice(0, 200)}`);
  }
  const order = (await response.json()) as RazorpayOrder;
  return { id: order.id, amount: order.amount, currency: order.currency };
}

function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  return crypto.subtle
    .importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((key) => crypto.subtle.sign("HMAC", key, encoder.encode(message)))
    .then((buffer) =>
      [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
    );
}

/** Razorpay signature = HMAC-SHA256(order_id|payment_id, key_secret). */
export async function verifyRazorpaySignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<boolean> {
  const config = razorpayConfig();
  if (!config) return false;
  const expected = await hmacSha256Hex(
    config.keySecret,
    `${input.orderId}|${input.paymentId}`
  );
  return expected === input.signature.toLowerCase();
}
