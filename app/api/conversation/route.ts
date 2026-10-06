import { NextResponse, type NextRequest } from "next/server";
import * as z from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { jsonRateLimited, readJson } from "@/lib/api/http";
import { fieldErrors } from "@/lib/auth/schemas";
import {
  endConversation,
  getConversationForUser,
  listChatScenarios,
  listConversations,
  sendChatTurn,
  startCoachConversation,
  startScenarioConversation,
} from "@/lib/conversation/store";
import { enforceQuota, recordUsage } from "@/lib/billing/entitlements";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }),
  z.object({
    action: z.literal("start"),
    scenarioId: z.coerce.number().int().min(1).nullish(),
  }),
  z.object({
    action: z.literal("send"),
    conversationId: z.coerce.number().int().min(1),
    message: z.string().trim().min(1, { error: "Say something first." }).max(1000),
  }),
  z.object({
    action: z.literal("end"),
    conversationId: z.coerce.number().int().min(1),
  }),
]);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const idParam = request.nextUrl.searchParams.get("id");
  if (idParam) {
    const conversationId = Number(idParam);
    if (!Number.isInteger(conversationId) || conversationId < 1) {
      return NextResponse.json({ error: "Unknown conversation." }, { status: 400 });
    }
    const data = await getConversationForUser(user.id, conversationId);
    if (!data) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    return NextResponse.json(data);
  }

  const [convs, scenariosList] = await Promise.all([
    listConversations(user.id),
    listChatScenarios(),
  ]);
  return NextResponse.json({ conversations: convs, scenarios: scenariosList });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!user.onboardedAt) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 409 });
  }

  const limit = rateLimit(`chat:${clientIp(request.headers)}`, 40, 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const body = await readJson(request);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (data.action === "list") {
    const [convs, scenariosList] = await Promise.all([
      listConversations(user.id),
      listChatScenarios(),
    ]);
    return NextResponse.json({ conversations: convs, scenarios: scenariosList });
  }

  if (data.action === "start") {
    if (data.scenarioId != null) {
      const started = await startScenarioConversation(user.id, data.scenarioId);
      if (!started) {
        return NextResponse.json({ error: "Scenario not found." }, { status: 404 });
      }
      return NextResponse.json(started);
    }
    const started = await startCoachConversation(user.id);
    return NextResponse.json(started);
  }

  if (data.action === "send") {
    const denied = await enforceQuota(user.id, "conversation");
    if (denied) return denied;

    const result = await sendChatTurn(user.id, data.conversationId, data.message);
    if (!result.ok) {
      const status = result.code === "not_found" ? 404 : 409;
      return NextResponse.json({ error: "Conversation not available." }, { status });
    }
    await recordUsage(user.id, "conversation");
    return NextResponse.json(result);
  }

  const ended = await endConversation(user.id, data.conversationId);
  if (!ended) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
