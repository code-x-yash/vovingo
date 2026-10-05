import { drizzle } from "drizzle-orm/d1";
import { createD1HttpClient, type D1Client } from "./d1-http";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

function createDb(client: D1Client) {
  // `as never`: structurally compatible with the Workers D1Database binding,
  // which shares the exact prepare/bind/run/all/raw surface implemented by
  // the HTTP driver. Keeps one Drizzle instance shape for dev and production.
  return drizzle(client as never, { schema });
}

let dbPromise: Promise<Db> | null = null;

async function createClient(): Promise<D1Client> {
  const mode = process.env.D1_AUTH_MODE ?? "wrangler-oauth";

  if (mode === "binding") {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = await getCloudflareContext({ async: true });
    const binding = context.env.DB;
    if (!binding) {
      throw new Error(
        "D1_AUTH_MODE=binding but no DB binding found in the Cloudflare context. " +
          "Check wrangler.jsonc d1_databases configuration."
      );
    }
    return binding as unknown as D1Client;
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.D1_DATABASE_ID;
  if (!accountId || !databaseId) {
    throw new Error(
      "Missing CLOUDFLARE_ACCOUNT_ID or D1_DATABASE_ID. Copy .env.example to .env.local and fill them in."
    );
  }
  return createD1HttpClient({
    accountId,
    databaseId,
    authMode: mode === "api-token" ? "api-token" : "wrangler-oauth",
  });
}

export async function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = createClient().then(createDb);
  }
  return dbPromise;
}

/** Reset the cached instance (tests / scripts that switch databases). */
export function resetDb(): void {
  dbPromise = null;
}
