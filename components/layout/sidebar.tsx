"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, isNavActive } from "./nav";

const STORAGE_KEY = "vovingo.sidebar.collapsed";
const CHANGE_EVENT = "vovingo:sidebar";

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function getSnapshot(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

function toggleSidebar() {
  try {
    const next = !(localStorage.getItem(STORAGE_KEY) === "1");
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => toggleSidebar(), []);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-ui lg:flex",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border/60 px-3",
          collapsed && "flex-col justify-center gap-1.5 px-0 py-2"
        )}
      >
        <Link
          href="/dashboard"
          aria-label="Vovingo home"
          className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <LogoMark />
          {!collapsed && <span className="text-sm font-semibold tracking-tight">Vovingo</span>}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn("size-7 shrink-0 text-muted-foreground", !collapsed && "ml-auto")}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3" aria-label="Sidebar">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label ?? "main"}>
            {group.label && !collapsed && (
              <p className="text-eyebrow px-2.5 pt-4 pb-1.5">{group.label}</p>
            )}
            {group.label && collapsed && gi > 0 && (
              <div className="mx-2 my-2.5 h-px bg-sidebar-border" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isNavActive(pathname, item.href);
                const Icon = item.icon;

                const linkProps = {
                  href: item.href,
                  "aria-label": item.label,
                  "aria-current": active ? ("page" as const) : undefined,
                  className: cn(
                    "flex h-9 items-center gap-2.5 rounded-lg text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    collapsed ? "justify-center px-0" : "px-2.5",
                    active
                      ? "bg-sidebar-accent font-medium text-foreground"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-foreground"
                  ),
                };

                const children = (
                  <>
                    <Icon
                      className={cn("size-[18px] shrink-0", active && "text-sidebar-primary")}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </>
                );

                return collapsed ? (
                  <Tooltip key={item.href}>
                    <TooltipTrigger render={<Link {...linkProps} />}>
                      {children}
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Link key={item.href} {...linkProps}>
                    {children}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
