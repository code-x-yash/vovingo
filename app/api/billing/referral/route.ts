import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  getOrCreateReferralCode,
  getReferralStats,
} from "@/lib/billing/entitlements";

/** The signed-in user's referral code + reward history. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const code = await getOrCreateReferralCode(user.id);
  const stats = await getReferralStats(user.id);
  const origin = new URL(request.url).origin;
  return NextResponse.json({ link: `${origin}/signup?ref=${code}`, ...stats });
}
