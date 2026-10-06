import { createD1HttpClient } from "../lib/db/d1-http";
import { loadEnv } from "./load-env";

loadEnv();

/**
 * Manual Pro grant — support/ops tool for the owner.
 *
 *   npm run grant-pro -- you@example.com 30
 *
 * Mirrors lib/billing/entitlements.ts grantPro(): extends the active row to
 * max(now, expiry) + days so manual grants stack with purchases/referrals.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  const days = Number(process.argv[3] ?? "30");
  if (!email || !email.includes("@")) {
    throw new Error("Usage: npm run grant-pro -- <email> [days]");
  }
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    throw new Error("days must be an integer between 1 and 3650.");
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.D1_DATABASE_ID;
  if (!accountId || !databaseId) {
    throw new Error("Missing CLOUDFLARE_ACCOUNT_ID or D1_DATABASE_ID (see .env.example).");
  }

  const authMode = process.env.D1_AUTH_MODE === "api-token" ? "api-token" : "wrangler-oauth";
  const db = createD1HttpClient({ accountId, databaseId, authMode });

  const userResult = await db
    .prepare("SELECT id, name FROM users WHERE email = ?")
    .bind(email)
    .all<{ id: number; name: string }>();
  const user = userResult.results[0];
  if (!user) {
    throw new Error(`No user with email ${email}.`);
  }

  const now = Date.now();
  const subResult = await db
    .prepare(
      "SELECT id, expires_at FROM subscriptions WHERE user_id = ? AND plan = 'pro' AND status = 'active' ORDER BY id DESC LIMIT 1"
    )
    .bind(user.id)
    .all<{ id: number; expires_at: number | null }>();
  const current = subResult.results[0];

  const base =
    current?.expires_at != null && current.expires_at > now ? current.expires_at : now;
  const expiresAt = base + days * DAY_MS;

  if (current) {
    await db
      .prepare(
        "UPDATE subscriptions SET expires_at = ?, provider = 'manual', provider_ref = ? WHERE id = ?"
      )
      .bind(expiresAt, `manual:${email}`, current.id)
      .run();
  } else {
    await db
      .prepare(
        "INSERT INTO subscriptions (user_id, plan, status, provider, provider_ref, started_at, expires_at) VALUES (?, 'pro', 'active', 'manual', ?, ?, ?)"
      )
      .bind(user.id, `manual:${email}`, now, expiresAt)
      .run();
  }

  const when = new Date(expiresAt).toISOString().slice(0, 10);
  console.log(`✓ Granted ${days} Pro day${days === 1 ? "" : "s"} to ${email} (id ${user.id}).`);
  console.log(`  Active until ${when}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
