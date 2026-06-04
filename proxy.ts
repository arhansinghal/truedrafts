import { NextRequest, NextResponse } from "next/server";
import { STUDIO_ENABLED } from "@/lib/studio/enabled";

const PROTECTED = ["/writer", "/admin", "/dashboard"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Writing Studio disabled — its API routes 404 (the pages are 404'd by the
  // studio layout). Flip NEXT_PUBLIC_STUDIO_ENABLED=true to restore.
  if (!STUDIO_ENABLED && pathname.startsWith("/api/studio")) {
    return new NextResponse(null, { status: 404 });
  }

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));

  if (!isProtected) return NextResponse.next();

  // Check for Better Auth session cookie
  const sessionCookie =
    req.cookies.get("better-auth.session_token") ??
    req.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/writer/:path*",
    "/admin/:path*",
    "/dashboard/:path*",
    "/api/studio/:path*",
  ],
};
