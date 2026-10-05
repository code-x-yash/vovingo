import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { speakingSessions } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { jsonRateLimited } from "@/lib/api/http";
import { getStorage, speakingAudioKey } from "@/lib/storage";

const MAX_AUDIO_BYTES = 6 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mpeg": "mp3",
};

const TYPE_BY_EXT: Record<string, string> = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  mp3: "audio/mpeg",
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const limit = rateLimit(`speaking-audio:${clientIp(request.headers)}`, 30, 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_AUDIO_BYTES + 32 * 1024) {
    return NextResponse.json({ error: "That recording is too large (6 MB max)." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const sessionIdValue = form.get("sessionId");
  const fileValue = form.get("file");
  const sessionId = Number(sessionIdValue);
  if (typeof sessionIdValue !== "string" || !Number.isInteger(sessionId) || sessionId < 1) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }
  if (!fileValue || typeof fileValue === "string") {
    return NextResponse.json({ error: "No audio file attached." }, { status: 400 });
  }
  const file = fileValue as File;
  if (file.size === 0) {
    return NextResponse.json({ error: "That recording was empty." }, { status: 400 });
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "That recording is too large (6 MB max)." }, { status: 413 });
  }

  const db = await getDb();
  const rows = await db
    .select({ id: speakingSessions.id })
    .from(speakingSessions)
    .where(and(eq(speakingSessions.id, sessionId), eq(speakingSessions.userId, user.id)))
    .limit(1);
  if (!rows[0]) {
    return NextResponse.json({ error: "That speaking take no longer exists." }, { status: 404 });
  }

  const type = (file.type || "").toLowerCase().split(";")[0] ?? "";
  let ext = EXT_BY_TYPE[type];
  if (!ext) {
    const nameExt = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (TYPE_BY_EXT[nameExt]) ext = nameExt;
  }
  if (!ext) {
    return NextResponse.json({ error: "Unsupported audio format." }, { status: 415 });
  }
  const contentType = TYPE_BY_EXT[ext];

  const bytes = new Uint8Array(await file.arrayBuffer());
  const storage = await getStorage();
  const key = speakingAudioKey(user.id, sessionId, ext);
  await storage.put(key, bytes, { contentType });

  await db
    .update(speakingSessions)
    .set({ audioKey: key })
    .where(and(eq(speakingSessions.id, sessionId), eq(speakingSessions.userId, user.id)));

  return NextResponse.json({ ok: true, audioUrl: `/api/speaking/audio?id=${sessionId}` });
}

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const limit = rateLimit(`speaking-audio-get:${clientIp(request.headers)}`, 120, 60_000);
  if (!limit.ok) return jsonRateLimited(limit.retryAfterSec);

  const sessionId = Number(request.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(sessionId) || sessionId < 1) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }

  const db = await getDb();
  const rows = await db
    .select({ audioKey: speakingSessions.audioKey })
    .from(speakingSessions)
    .where(and(eq(speakingSessions.id, sessionId), eq(speakingSessions.userId, user.id)))
    .limit(1);

  const key = rows[0]?.audioKey;
  if (!rows[0] || !key) {
    return NextResponse.json({ error: "No recording for that take." }, { status: 404 });
  }

  const storage = await getStorage();
  const stored = await storage.get(key);
  if (!stored) {
    return NextResponse.json({ error: "That recording is no longer available." }, { status: 404 });
  }

  return new Response(stored.body as BodyInit, {
    headers: {
      "Content-Type": stored.contentType,
      "Content-Length": String(stored.size),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
