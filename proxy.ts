import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/placement",
  "/lessons",
  "/courses",
  "/vocab",
  "/speak",
  "/speaking",
  "/mistakes",
  "/practice",
  "/progress",
  "/coach",
  "/conversation",
  "/listening",
  "/writing",
  "/settings",
];

const AUTH_PAGES = ["/login", "/signup"];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Optimistic auth check: presence of the session cookie only. Real session
 * validation happens in route handlers and server components via getSessionUser().
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (matches(pathname, PROTECTED_PREFIXES) && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  if (matches(pathname, AUTH_PAGES) && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
