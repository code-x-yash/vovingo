import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createD1HttpClient } from "../lib/db/d1-http";
import { loadEnv } from "./load-env";

loadEnv();

const BOOKKEEPING_TABLE = `
CREATE TABLE IF NOT EXISTS applied_migrations (
  id integer PRIMARY KEY AUTOINCREMENT,
  name text NOT NULL UNIQUE,
  checksum text,
  applied_at integer NOT NULL
)`;

type Journal = {
  entries: { idx: number; tag: string; version: string }[];
};

async function main(): Promise<void> {
  const mode = process.argv.includes("--status") ? "status" : "apply";

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.D1_DATABASE_ID;
  if (!accountId || !databaseId) {
    throw new Error(
      "Missing CLOUDFLARE_ACCOUNT_ID or D1_DATABASE_ID. Copy .env.example to .env.local and fill in the values."
    );
  }

  const authMode = process.env.D1_AUTH_MODE === "api-token" ? "api-token" : "wrangler-oauth";
  const client = createD1HttpClient({ accountId, databaseId, authMode });

  await client.exec(BOOKKEEPING_TABLE);
  const appliedResult = await client
    .prepare("SELECT name FROM applied_migrations ORDER BY id")
    .bind()
    .all<{ name: string }>();
  const applied = new Set(appliedResult.results.map((r) => r.name));

  const journalPath = path.join(process.cwd(), "drizzle", "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    throw new Error("No migrations found. Run `npm run db:generate` first.");
  }
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as Journal;

  if (mode === "status") {
    for (const entry of journal.entries) {
      console.log(`${applied.has(entry.tag) ? "✓" : "○"} ${entry.tag}`);
    }
    return;
  }

  let appliedCount = 0;
  for (const entry of journal.entries) {
    if (applied.has(entry.tag)) {
      console.log(`skip   ${entry.tag} (already applied)`);
      continue;
    }

    const file = path.join(process.cwd(), "drizzle", `${entry.tag}.sql`);
    const sql = fs.readFileSync(file, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex").slice(0, 16);
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await client.exec(statements.join("\n"));
    } catch (err) {
      console.error(`\nFailed while applying ${entry.tag}.`);
      console.error(
        "The migration was not recorded, so it can be retried after fixing the error.\n" +
          "If the database ended up partially migrated, restore it with `wrangler d1 time-travel`\n" +
          "or recreate it with `wrangler d1 create vovingo` and update D1_DATABASE_ID."
      );
      throw err;
    }

    await client
      .prepare("INSERT INTO applied_migrations (name, checksum, applied_at) VALUES (?, ?, ?)")
      .bind(entry.tag, checksum, Date.now())
      .run();

    appliedCount++;
    console.log(`apply  ${entry.tag} (${statements.length} statements)`);
  }

  console.log(
    appliedCount === 0
      ? "Database already up to date."
      : `Done. Applied ${appliedCount} migration(s).`
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
