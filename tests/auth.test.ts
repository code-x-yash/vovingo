import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIp, rateLimit, resetRateLimits } from "../lib/auth/rate-limit";
import { fieldErrors, loginSchema, normalizeEmail, signupSchema } from "../lib/auth/schemas";
import { hashPassword, verifyPassword } from "../lib/auth/password";

describe("rate limiter", () => {
  beforeEach(() => resetRateLimits());
  afterEach(() => vi.useRealTimers());

  it("allows requests under the limit and blocks once exceeded", () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("k1", 5, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit("k1", 5, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("keeps separate keys independent", () => {
    for (let i = 0; i < 5; i++) rateLimit("a", 5, 60_000);
    expect(rateLimit("a", 5, 60_000).ok).toBe(false);
    expect(rateLimit("b", 5, 60_000).ok).toBe(true);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    for (let i = 0; i < 3; i++) expect(rateLimit("k2", 3, 60_000).ok).toBe(true);
    expect(rateLimit("k2", 3, 60_000).ok).toBe(false);

    vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
    expect(rateLimit("k2", 3, 60_000).ok).toBe(true);
  });

  it("reads the first forwarded IP", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(clientIp(headers)).toBe("203.0.113.7");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("signup schema", () => {
  const valid = { name: "Asha Rao", email: "asha@example.com", password: "coach2026" };

  it("accepts a valid payload", () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects short passwords with a field error", () => {
    const parsed = signupSchema.safeParse({ ...valid, password: "abc" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      expect(errs.password?.length).toBeGreaterThan(0);
    }
  });

  it("rejects passwords without a number", () => {
    const parsed = signupSchema.safeParse({ ...valid, password: "onlyletters" });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid emails", () => {
    expect(signupSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "x@y", password: "p" }).success).toBe(false);
  });

  it("trims names", () => {
    const parsed = signupSchema.safeParse({ ...valid, name: "  Li  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.name).toBe("Li");
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Asha@Example.COM ")).toBe("asha@example.com");
  });
});

describe("password hashing", () => {
  it("round-trips a password", async () => {
    const hash = await hashPassword("coach2026");
    expect(hash).not.toContain("coach2026");
    expect(await verifyPassword("coach2026", hash)).toBe(true);
    expect(await verifyPassword("wrong-pass1", hash)).toBe(false);
  });
});
