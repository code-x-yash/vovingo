import { NextResponse } from "next/server";

export const MAX_JSON_BYTES = 256 * 1024;

export function jsonError(
  status: number,
  message: string,
  extra?: Record<string, unknown>
): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function jsonRateLimited(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "Too many attempts. Please wait and try again.", retryAfterSec },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

function declaredLength(request: Request): number | null {
  const raw = request.headers.get("content-length");
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Parses a JSON request body. Returns null for malformed payloads and for
 * oversized payloads (over MAX_JSON_BYTES by declared length), which callers
 * surface as a 400 — one guard shared by every JSON route.
 */
export async function readJson(request: Request): Promise<unknown | null> {
  const length = declaredLength(request);
  if (length != null && length > MAX_JSON_BYTES) return null;
  try {
    return await request.json();
  } catch {
    return null;
  }
}
