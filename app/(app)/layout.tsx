import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { getEntitlements } from "@/lib/billing/entitlements";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  // Guest requests fall through so each page can redirect with ?next=…
  if (!user) return <>{children}</>;

  const { isPro } = await getEntitlements(user.id);
  return (
    <AppShell user={{ name: user.name, email: user.email }} isPro={isPro}>
      {children}
    </AppShell>
  );
}
