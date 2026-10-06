import { getAIProvider, type CompleteRequest } from "./provider";

export type CompleteFallback = {
  text: string;
  usedModel: boolean;
};

/**
 * Runs a provider completion without ever throwing: on any provider/binding
 * failure (or while running the mock provider) it returns `req.mock` — the
 * feature's deterministic stand-in — so callers always get usable output.
 */
export async function completeOrFallback(req: CompleteRequest): Promise<CompleteFallback> {
  try {
    const provider = getAIProvider();
    const call = await provider.complete(req);
    if (call.text.trim()) {
      return { text: call.text.trim(), usedModel: provider.name !== "mock" };
    }
  } catch {
    /* binding/model unavailable — fall back below */
  }
  return { text: (req.mock ?? "").trim(), usedModel: false };
}
