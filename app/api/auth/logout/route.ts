import { NextResponse } from "next/server";
import { revokeCurrentSession } from "@/lib/auth/session";

export async function POST(): Promise<NextResponse> {
  await revokeCurrentSession();
  return NextResponse.json({ ok: true });
}
