import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getJwtSecretKey } from "@/lib/jwt";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";

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

  // Check for auth token
  const token = request.cookies.get("auth_token")?.value ||
                request.headers.get("authorization")?.substring(7);

  // If user is on a public path (e.g. /login) AND has a valid token,
  // redirect them to the dashboard so they don't get stuck on the login page
  if (isPublicPath) {
    if (token) {
      try {
        await jwtVerify(token, getJwtSecretKey());
        // Token is valid — redirect away from login to dashboard
        return NextResponse.redirect(new URL("/", request.url));
      } catch {
        // Token is invalid/expired — let them stay on login, clear the bad cookie
        const response = NextResponse.next();
        response.cookies.delete("auth_token");
        return response;
      }
    }
    return NextResponse.next();
  }

  // No token on protected route — redirect to login

  if (!token) {
    // Redirect to login if no token
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Token exists, strictly validate using edge-compatible jose library
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    const role = payload.role as string;
    
    // Platform Super Admin / System Admin authorization logic
    const email = payload.email as string | undefined;
    const isPlatformSystemAdmin =
      isPlatformOwnerEmail(email) ||
      role === "SYSTEM_ADMIN" ||
      !!payload.impersonatedBy;

    if (!isPlatformSystemAdmin && pathname.startsWith("/system-admin")) {
      // Regular school admins and users cannot access the SaaS superadmin area
      return NextResponse.redirect(new URL("/", request.url));
    }
    
    // Valid context, proceed
    return NextResponse.next();
  } catch (error: any) {
    console.warn("Middleware JWT verification failed:", error?.code || error?.message || error);
    // Invalid/expired token, force a hard re-login by clearing the cookie
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
