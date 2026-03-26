import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Paths that do not require authentication
const PUBLIC_PATHS = ["/login"];

export async function middleware(request: NextRequest) {
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

  // Token exists, strictly validate using edge-compatible jose library
  try {
    const secret = process.env.JWT_SECRET || "default_super_secret_key_for_jwt_2026_fallback";
    const encodedSecret = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, encodedSecret);
    const role = payload.role as string;
    
    // System Admin redirection logic
    if (role === "SYSTEM_ADMIN") {
      // If system admin is trying to access standard school routes, redirect to system panel
      // unless it's an asset or public path
      if (!pathname.startsWith("/system-admin") && !isPublicPath) {
        return NextResponse.redirect(new URL("/system-admin", request.url));
      }
    } else {
      // If regular user (including Super Admin) tries to access system admin area, block them
      if (pathname.startsWith("/system-admin")) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
    
    // Valid context, proceed
    return NextResponse.next();
  } catch (error) {
    console.warn("Middleware detected tampered or expired JWT Token. Re-routing to login.", error);
    // Invalid/expired token, force a hard re-login by overriding path cookies
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("auth_token");
    return response;
  }
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
