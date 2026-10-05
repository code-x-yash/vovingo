import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  // Guest requests fall through so each page can redirect with ?next=…
  if (!user) return <>{children}</>;

  return (
    <AppShell user={{ name: user.name, email: user.email }}>{children}</AppShell>
  );
}
