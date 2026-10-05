import fs from "node:fs";
import path from "node:path";

/**
 * Minimal .env loader for scripts run outside the Next.js runtime
 * (migrations, seeds, tooling). Existing process env always wins.
 */
export function loadEnv(cwd: string = process.cwd()): void {
  for (const file of [".env", ".env.local"]) {
    const filePath = path.join(cwd, file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      const key = match[1];
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
        (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}
