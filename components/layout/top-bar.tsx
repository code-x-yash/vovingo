"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu, TrendingUp } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NAV_GROUPS, isNavActive, pageTitle } from "./nav";
import { useState } from "react";

export type ShellUser = { name: string; email: string };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function TopBar({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <span className="lg:hidden">
        <Logo />
      </span>
      <p className="hidden text-sm font-medium text-muted-foreground lg:block">
        {pageTitle(pathname)}
      </p>

      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                aria-label="Account menu"
                className="gap-1.5 rounded-full pr-1.5 pl-1.5"
              />
            }
          >
            <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-[var(--brand-1)] to-[var(--brand-2)] text-[11px] font-semibold text-white">
              {initials(user.name) || "?"}
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 py-2">
                <span className="block truncate text-sm font-medium text-foreground">
                  {user.name}
                </span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/progress" />}>
              <TrendingUp className="size-4" />
              Progress
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void signOut()}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open menu"
              />
            }
          >
            <Menu className="size-4.5" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <div className="mt-1">
              <Logo />
            </div>
            <nav className="mt-6 flex flex-col gap-1" aria-label="Mobile menu">
              {NAV_GROUPS.map((group) => (
                <div key={group.label ?? "main"}>
                  {group.label && (
                    <p className="text-eyebrow px-3 pt-4 pb-1.5">{group.label}</p>
                  )}
                  {group.items.map((item) => {
                    const active = isNavActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors ${
                          active
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        }`}
                      >
                        <Icon className="size-[18px]" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-6 flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="size-[18px]" />
              Sign out
            </button>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
