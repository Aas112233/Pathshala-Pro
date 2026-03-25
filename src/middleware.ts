import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that do not require authentication
const PUBLIC_PATHS = ["/login", "/api/auth"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  if (isPublicPath) {
    return NextResponse.next();
  }

  // TODO: Add actual auth token/session validation here
  // For now, allow all requests through during development
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files, _next, and api
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
