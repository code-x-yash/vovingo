import { afterEach, describe, expect, test, vi } from "vitest";
import { googleSpeechHostReachable, speechFailureFor } from "@/lib/speech";

describe("speechFailureFor", () => {
  test("ignores benign codes", () => {
    expect(speechFailureFor("no-speech")).toBeNull();
    expect(speechFailureFor("aborted")).toBeNull();
  });

  test("permission errors fall back to typing", () => {
    const failure = speechFailureFor("not-allowed");
    expect(failure?.fallback).toBe("typing");
    expect(failure?.message).toContain("Microphone blocked");
    expect(speechFailureFor("service-not-allowed")?.fallback).toBe("typing");
    expect(speechFailureFor("service-not-allowed")?.message).toContain("Speech service unavailable");
  });

  test("network errors explain the connection problem", () => {
    const failure = speechFailureFor("network");
    expect(failure?.fallback).toBe("typing");
    expect(failure?.message).toContain("internet connection");
  });

  test("audio-capture explains the missing microphone", () => {
    const failure = speechFailureFor("audio-capture");
    expect(failure?.fallback).toBe("typing");
    expect(failure?.message).toContain("No microphone");
  });

  test("language errors fall back to typing", () => {
    expect(speechFailureFor("language-not-supported")?.fallback).toBe("typing");
  });

  test("unknown errors keep listening but surface the code", () => {
    const failure = speechFailureFor("mystery-code");
    expect(failure?.fallback).toBe("retry");
    expect(failure?.message).toContain("(mystery-code)");
  });
});

describe("googleSpeechHostReachable", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("returns true when the host responds (even as an opaque no-cors response)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ type: "opaque" }));
    await expect(googleSpeechHostReachable()).resolves.toBe(true);
  });

  test("returns false when the request is refused (offline, CSP, proxy)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(googleSpeechHostReachable()).resolves.toBe(false);
  });
});
