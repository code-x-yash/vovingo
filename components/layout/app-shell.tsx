"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { TopBar, type ShellUser } from "./top-bar";

const HIDDEN_ON = ["/", "/login", "/signup", "/onboarding", "/placement"];

function isImmersive(pathname: string): boolean {
  return /^\/lessons\/[^/]+/.test(pathname);
}

export function AppShell({
  user,
  isPro = false,
  children,
}: {
  user: ShellUser;
  isPro?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();

  if (HIDDEN_ON.includes(pathname) || isImmersive(pathname)) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-dvh w-full">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar user={user} isPro={isPro} />
          <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
        </div>
        <MobileNav />
      </div>
    </TooltipProvider>
  );
}
