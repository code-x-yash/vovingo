export type SpeechFailure = {
  message: string;
  /** typing: stop listening and switch to the editor. retry: keep listening (may recover). */
  fallback: "typing" | "retry";
};

/**
 * Maps Web Speech API error codes to user-facing outcomes.
 * Returns null for benign codes (silence, manual stop) that should be ignored.
 */
export function speechFailureFor(code: string): SpeechFailure | null {
  switch (code) {
    case "no-speech":
    case "aborted":
      return null;
    case "not-allowed":
      return { message: "Microphone blocked — type your answer instead.", fallback: "typing" };
    case "service-not-allowed":
      return {
        message: "Speech service unavailable in this browser — type your answer instead.",
        fallback: "typing",
      };
    case "network":
      return {
        message: "Speech recognition needs an internet connection — type your answer instead.",
        fallback: "typing",
      };
    case "audio-capture":
      return {
        message: "No microphone detected — check your mic or type instead.",
        fallback: "typing",
      };
    case "language-not-supported":
      return {
        message: "English recognition isn't available in this browser — type your answer instead.",
        fallback: "typing",
      };
    default:
      return {
        message: `Speech recognition hiccuped (${code}) — keep going or type instead.`,
        fallback: "retry",
      };
  }
}

/**
 * Checks whether Google's speech-service host is reachable from the page.
 * Used to explain a `network` recognition failure: connection refused by CSP/proxy/region
 * vs. blocked downstream by an ad blocker (an opaque no-cors response still counts as reachable).
 */
export async function googleSpeechHostReachable(timeoutMs = 2500): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await fetch("https://www.google.com/generate_204", {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal,
      });
      return true;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}
