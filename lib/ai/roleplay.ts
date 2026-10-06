import { completeOrFallback } from "./complete";
import type { ChatMessage, CoachContext, ScenarioContext } from "@/lib/conversation/reply";

export type RoleplayRequest = {
  kind: "scenario" | "coach";
  scenario?: ScenarioContext;
  coach?: CoachContext;
  history: ChatMessage[];
  userText: string;
  mockReply: string;
};

const SYSTEM_SCENARIO =
  "You are roleplaying as the practice partner in an English conversation exercise. " +
  "Stay in character for the full reply. Keep it to 1-3 short sentences. " +
  "Push the learner with a question, challenge, or follow-up — never lecture, never reveal you are an AI, " +
  "never mention that this is an exercise. Reply with only what your character says, in plain text.";

const SYSTEM_COACH =
  "You are Vovingo, a friendly and direct English coach chatting with your learner. " +
  "Reply like a sharp human coach: 1-3 short sentences, concrete and specific to what they said, " +
  "ending with a question or one small task when it fits. Plain text only, no lists or markdown.";

function transcript(history: ChatMessage[], max = 12): string {
  if (history.length === 0) return "(no messages yet)";
  return history
    .slice(-max)
    .map((m) => `${m.role === "user" ? "Learner" : "Coach"}: ${m.content}`)
    .join("\n");
}

export function buildRoleplayPrompt(req: RoleplayRequest): string {
  const lead =
    req.kind === "scenario" && req.scenario
      ? [
              `Scenario: ${req.scenario.title}${
                req.scenario.description ? ` — ${req.scenario.description}` : ""
              }`,
              req.scenario.persona
                ? `Persona: ${req.scenario.persona.role}${
                    req.scenario.persona.name ? `, ${req.scenario.persona.name}` : ""
                  }${req.scenario.persona.style ? `, style: ${req.scenario.persona.style}` : ""}`
                : null,
            ]
              .filter(Boolean)
              .join("\n")
      : req.coach
        ? [
            `Learner: ${req.coach.name} (${req.coach.streak}-day streak)`,
            `Top pattern to keep an eye on: ${req.coach.patterns[0]?.title ?? "none yet"}`,
            `Vocabulary due for review: ${req.coach.dueWords}`,
          ].join("\n")
        : "General English practice chat.";

  return `${lead}\nTranscript so far:\n${transcript(req.history)}\nLearner's latest message: ${req.userText.trim()}\nReply as ${
    req.kind === "scenario" ? "your character" : "the coach"
  }.`;
}

/**
 * Model-driven persona/coach reply. The deterministic rule reply is passed in
 * as `mockReply` and used verbatim whenever the model (or its binding) is
 * unavailable — chat never blocks or errors on the AI path.
 */
export async function generateChatReply(
  req: RoleplayRequest
): Promise<{ reply: string; usedModel: boolean }> {
  const { text, usedModel } = await completeOrFallback({
    system: req.kind === "scenario" ? SYSTEM_SCENARIO : SYSTEM_COACH,
    prompt: buildRoleplayPrompt(req),
    maxTokens: 180,
    temperature: 0.7,
    mock: req.mockReply,
  });
  const reply = text.trim() || req.mockReply.trim();
  return { reply: reply.length > 0 ? reply : "Tell me more about that.", usedModel };
}
