import { exec } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export type D1Meta = {
  changes: number;
  last_row_id: number;
  duration?: number;
  rows_read?: number;
  rows_written?: number;
  [key: string]: unknown;
};

export type D1Result<T = Record<string, unknown>> = {
  success: boolean;
  results: T[];
  meta: D1Meta;
};

export type BoundStatement = {
  run(): Promise<D1Result>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[][]>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
};

export type D1Statement = {
  bind(...params: unknown[]): BoundStatement;
};

/**
 * Minimal structural clone of the Cloudflare Workers `D1Database` binding,
 * implemented over the D1 HTTP REST API. Lets local `next dev` talk to the
 * real remote D1 database with Drizzle's production `drizzle-orm/d1` driver
 * shape — so dev and prod run identical SQL.
 */
export type D1Client = {
  prepare(sql: string): D1Statement;
  /** Execute one or more statements (no parameters). Returns one result per statement. */
  exec(sqlText: string): Promise<D1Result[]>;
  batch(statements: D1Statement[]): Promise<D1Result[]>;
};

export class D1HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors: unknown[]
  ) {
    super(message);
    this.name = "D1HttpError";
  }
}

// ---------------------------------------------------------------------------
// Auth: wrangler OAuth (development) or API token (CI)
// ---------------------------------------------------------------------------

const REFRESH_MARGIN_MS = 60_000;
const REFRESH_COOLDOWN_MS = 5_000;

type OAuthState = { token: string; expiresAt: number };

function wranglerConfigCandidates(): string[] {
  const out: string[] = [];
  if (process.env.WRANGLER_CONFIG) out.push(process.env.WRANGLER_CONFIG);
  if (process.env.XDG_CONFIG_HOME) {
    out.push(path.join(process.env.XDG_CONFIG_HOME, ".wrangler", "config", "default.toml"));
  }
  if (process.env.APPDATA) {
    out.push(path.join(process.env.APPDATA, "xdg.config", ".wrangler", "config", "default.toml"));
    out.push(path.join(process.env.APPDATA, ".wrangler", "config", "default.toml"));
  }
  const home = os.homedir();
  out.push(path.join(home, ".wrangler", "config", "default.toml"));
  out.push(path.join(home, ".config", ".wrangler", "config", "default.toml"));
  return out;
}

function readOAuthState(): OAuthState | null {
  for (const candidate of wranglerConfigCandidates()) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const raw = fs.readFileSync(candidate, "utf8");
      const token = raw.match(/oauth_token\s*=\s*"([^"]+)"/)?.[1];
      const exp = raw.match(/expiration_time\s*=\s*"([^"]+)"/)?.[1];
      if (!token) continue;
      return { token, expiresAt: exp ? Date.parse(exp) : 0 };
    } catch {
      // try next candidate
    }
  }
  return null;
}

class AuthProvider {
  private cached: OAuthState | null = null;
  private refreshing: Promise<string> | null = null;
  private lastAttempt = 0;

  constructor(
    private readonly mode: "wrangler-oauth" | "api-token",
    private readonly onRefreshed?: () => void
  ) {}

  async getToken(options: { forceRefresh?: boolean } = {}): Promise<string> {
    if (this.mode === "api-token") {
      const token = process.env.CLOUDFLARE_API_TOKEN;
      if (!token) {
        throw new Error(
          "D1_AUTH_MODE=api-token requires CLOUDFLARE_API_TOKEN to be set. " +
            "Create one at https://dash.cloudflare.com/profile/api-tokens with Account → D1 → Edit."
        );
      }
      return token;
    }

    if (!options.forceRefresh) {
      const state = this.cached ?? readOAuthState();
      if (state && state.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
        this.cached = state;
        return state.token;
      }
    }

    if (this.refreshing) return this.refreshing;

    this.refreshing = this.doRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async doRefresh(): Promise<string> {
    const now = Date.now();
    if (now - this.lastAttempt < REFRESH_COOLDOWN_MS && this.cached) {
      return this.cached.token;
    }
    this.lastAttempt = now;

    // A wrangler command refreshes an expired OAuth token and rewrites its config.
    await execAsync("npx wrangler whoami", {
      timeout: 90_000,
      windowsHide: true,
      cwd: process.cwd(),
    }).catch((err: unknown) => {
      throw new Error(
        "Failed to refresh wrangler OAuth credentials. Run `npx wrangler login` first." +
          (err instanceof Error ? ` (${err.message})` : "")
      );
    });

    const state = readOAuthState();
    if (!state || !state.token) {
      throw new Error("Wrangler OAuth token not found after refresh. Run `npx wrangler login`.");
    }
    this.cached = state;
    this.onRefreshed?.();
    return state.token;
  }
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

type Options = {
  accountId: string;
  databaseId: string;
  authMode: "wrangler-oauth" | "api-token";
  baseUrl?: string;
  timeoutMs?: number;
};

const isAuthError = (status: number, errors: unknown[]): boolean => {
  if (status === 401) return true;
  if (status === 403) return true;
  return errors.some(
    (e) =>
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      [9109, 10000, 10001].includes((e as { code: number }).code)
  );
};

export function createD1HttpClient(options: Options): D1Client {
  const baseUrl =
    options.baseUrl ??
    `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/d1/database/${options.databaseId}/query`;
  const timeoutMs = options.timeoutMs ?? 20_000;

  const auth = new AuthProvider(options.authMode);

  async function post(body: unknown, retried = false): Promise<D1Result[]> {
    const token = await auth.getToken();
    let res: Response;
    try {
      res = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new D1HttpError(
        `D1 request failed: ${err instanceof Error ? err.message : String(err)}`,
        0,
        []
      );
    }

    const payload = (await res.json().catch(() => null)) as {
      success?: boolean;
      result?: D1Result[];
      errors?: unknown[];
    } | null;

    if (!res.ok || !payload?.success) {
      const errors = payload?.errors ?? [];
      if (!retried && options.authMode === "wrangler-oauth" && isAuthError(res.status, errors)) {
        // Token likely expired mid-flight: force a wrangler refresh and retry once.
        await auth.getToken({ forceRefresh: true });
        return post(body, true);
      }
      const detail =
        errors.length > 0
          ? JSON.stringify(errors)
          : `HTTP ${res.status} ${res.statusText || ""}`.trim();
      throw new D1HttpError(`D1 query failed: ${detail}`, res.status, errors);
    }

    return payload.result ?? [];
  }

  function makeBound(sql: string, params: unknown[]): BoundStatement {
    return {
      async run(): Promise<D1Result> {
        const [result] = await post({ sql, params });
        return result ?? { success: true, results: [], meta: { changes: 0, last_row_id: 0 } };
      },
      async all<T>(): Promise<D1Result<T>> {
        const [result] = await post({ sql, params });
        return (result ?? { success: true, results: [], meta: { changes: 0, last_row_id: 0 } }) as D1Result<T>;
      },
      async raw<T>(): Promise<T[][]> {
        const [result] = await post({ sql, params });
        // D1 returns row objects in SELECT column order; convert to positional rows.
        // CAVEAT: D1 serialises rows as JSON objects, so a query that selects the
        // same column name from two joined tables (e.g. "id" from both) collapses
        // those keys server-side and positional mapping breaks. Always alias one
        // side (or don't select it) when joining tables with shared column names.
        return ((result?.results ?? []) as Record<string, unknown>[]).map((row) =>
          Object.values(row)
        ) as T[][];
      },
      async first<T>(): Promise<T | null> {
        const [result] = await post({ sql, params });
        const rows = (result?.results ?? []) as T[];
        return rows.length > 0 ? rows[0] : null;
      },
    };
  }

  return {
    prepare(sql: string): D1Statement {
      return {
        bind: (...params: unknown[]) => makeBound(sql, params),
      };
    },
    async exec(sqlText: string): Promise<D1Result[]> {
      return post({ sql: sqlText, params: [] });
    },
    async batch(statements: D1Statement[]): Promise<D1Result[]> {
      // The REST endpoint has no parameterized batch API; execute sequentially
      // (same result set, without the single-request atomicity of a binding batch).
      const out: D1Result[] = [];
      for (const stmt of statements) {
        out.push(await (stmt as unknown as BoundStatement).run());
      }
      return out;
    },
  };
}
