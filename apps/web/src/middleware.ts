import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const AUTH_ROUTES = ["/login", "/register"];
const PROTECTED_ROUTES = ["/dashboard", "/composer", "/calendar", "/analytics", "/media", "/settings"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cookie-existence check only — cheap, no DB round trip. This is an optimistic UX
  // redirect, not the security boundary: every protected API call is still validated
  // server-side by the NestJS AuthGuard against the real session table.
  const hasSessionCookie = Boolean(getSessionCookie(request));
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (!hasSessionCookie && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSessionCookie && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/composer/:path*",
    "/calendar/:path*",
    "/analytics/:path*",
    "/media/:path*",
    "/settings/:path*",
    "/login",
    "/register",
  ],
};
