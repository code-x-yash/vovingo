import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  return NextResponse.json({ user });
}
