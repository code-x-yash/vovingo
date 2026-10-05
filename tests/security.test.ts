import { describe, expect, it } from "vitest";
import { MAX_JSON_BYTES, jsonError, jsonRateLimited, readJson } from "../lib/api/http";

describe("readJson", () => {
  it("parses a normal JSON body", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ mode: "free" }),
      headers: { "content-type": "application/json" },
    });
    expect(await readJson(request)).toEqual({ mode: "free" });
  });

  it("returns null for malformed JSON", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: "{nope",
      headers: { "content-type": "application/json" },
    });
    expect(await readJson(request)).toBeNull();
  });

  it("returns null for an empty body", async () => {
    const request = new Request("http://localhost/api", { method: "POST" });
    expect(await readJson(request)).toBeNull();
  });

  it("rejects oversized payloads by declared length", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-length": String(MAX_JSON_BYTES + 1) },
    });
    expect(await readJson(request)).toBeNull();
  });

  it("ignores an unparseable content-length", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
      headers: { "content-length": "banana" },
    });
    expect(await readJson(request)).toEqual({ ok: true });
  });
});

describe("json helpers", () => {
  it("jsonError embeds extra fields with the status", async () => {
    const res = jsonError(404, "Gone.", { fields: { email: "Required" } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Gone.", fields: { email: "Required" } });
  });

  it("jsonRateLimited carries Retry-After", async () => {
    const res = jsonRateLimited(42);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    const body = (await res.json()) as { error: string; retryAfterSec: number };
    expect(body.retryAfterSec).toBe(42);
  });
});
