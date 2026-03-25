import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that do not require authentication
const PUBLIC_PATHS = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow all API routes - they have their own auth checks
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Allow public paths
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  if (isPublicPath) {
    return NextResponse.next();
  }

  // Check for auth token
  const token = request.cookies.get("auth_token")?.value ||
                request.headers.get("authorization")?.substring(7);

  if (!token) {
    // Redirect to login if no token
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Token exists, allow request through
  // In production, validate the token here
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (.*\\..* matches files with extensions)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
