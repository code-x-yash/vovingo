import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getAllQuotaStates, getEntitlements } from "@/lib/billing/entitlements";

export async function GET(): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const [entitlements, quotas] = await Promise.all([
    getEntitlements(user.id),
    getAllQuotaStates(user.id),
  ]);
  return NextResponse.json({
    isPro: entitlements.isPro,
    plan: entitlements.plan,
    expiresAt: entitlements.expiresAt?.toISOString() ?? null,
    quotas,
  });
}
