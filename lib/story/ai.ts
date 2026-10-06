import { completeOrFallback } from "@/lib/ai/complete";

export type StoryEntryLite = { chapter: number; text: string };

const MOCK_BEATS = [
  "Just when things settled, a new problem walked through the door.",
  "Nobody noticed the small detail that would change everything — except the reader.",
  "The plan worked right up until the moment it didn't.",
  "And that was when the second phone began to ring.",
];

/** Deterministic stand-in for the model's continuation. */
export function mockContinuation(chapter: number): string {
  const idx = Math.abs(Math.trunc(chapter)) % MOCK_BEATS.length;
  return MOCK_BEATS[idx];
}

const TAIL_ENTRIES = 8;
const TAIL_CHARS = 900;

export function storyTail(entries: StoryEntryLite[]): StoryEntryLite[] {
  const tail = entries.slice(-TAIL_ENTRIES);
  let budget = TAIL_CHARS;
  const kept: StoryEntryLite[] = [];
  for (let i = tail.length - 1; i >= 0; i--) {
    const e = tail[i];
    if (e.text.length > budget && kept.length > 0) break;
    kept.unshift(e);
    budget -= e.text.length;
  }
  return kept;
}

export function buildStoryPrompt(entries: StoryEntryLite[], chapter: number): string {
  const tail = storyTail(entries);
  const soFar =
    tail.length === 0
      ? "(the story hasn't started yet)"
      : tail.map((e) => `Chapter ${e.chapter}: ${e.text}`).join("\n");
  return `Co-writing a story. Chapters so far:\n${soFar}\nWrite ONLY chapter ${chapter}: 2-4 sentences, under 60 words, continuing naturally from the last line. Plain prose, no title, no quotes, no commentary.`;
}

/**
 * Model continuation of the shared story. Falls back to the deterministic
 * beat whenever the model (or its binding) is unavailable.
 */
export async function continueStory(
  entries: StoryEntryLite[],
  chapter: number
): Promise<{ text: string; usedModel: boolean }> {
  const mock = mockContinuation(chapter);
  const { text, usedModel } = await completeOrFallback({
    system:
      "You are one of the voices in a collaborative story game. Keep the prose playful, " +
      "clean and easy to read for English learners. Reply with only the next chapter's prose.",
    prompt: buildStoryPrompt(entries, chapter),
    maxTokens: 120,
    temperature: 0.9,
    mock,
  });
  const out = text.trim();
  return { text: out.length > 0 ? out : mock, usedModel };
}
