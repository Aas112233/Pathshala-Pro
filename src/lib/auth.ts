import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { getJwtSecretKey } from "@/lib/jwt";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";

export interface AuthContext {
  user: User;
  tenantId: string;
  impersonatedBy?: string;
  isImpersonated?: boolean;
}

// Fast in-memory cache for active user lookups (30s TTL) to prevent DB connection pool exhaustion under load
interface CachedUserEntry {
  user: User;
  expiresAt: number;
}
const userAuthCache = new Map<string, CachedUserEntry>();

/** Drop a cached user entry after its row changes (login bump, role/password update). */
export function evictUserAuthCache(tenantId: string, userId: string) {
  userAuthCache.delete(`${tenantId}:${userId}`);
}

/**
 * Extract and validate user from request headers
 * In production, this validates JWT tokens from the Authorization header using jose
 */
export async function getAuthContext(
  request: NextRequest
): Promise<AuthContext | null> {
  try {
    // Get authorization header
    const authHeader = request.headers.get("authorization");
    const cookieToken = request.cookies.get("auth_token")?.value;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : cookieToken;

    if (!token) {
      return null;
    }
    
    // Cryptographically decode and verify from token using jose
    let userId: string | null = null;
    let tenantId: string | null = null;
    let sessionVersion: number | undefined;
    let issuedAt: number | undefined;
    let impersonatedBy: string | undefined;
    let isImpersonated = false;

    try {
      const { payload } = await jwtVerify(token, getJwtSecretKey());

      userId = payload.userId as string;
      tenantId = payload.tenantId as string;
      issuedAt = payload.iat;
      sessionVersion = payload.sessionVersion === undefined ? undefined : Number(payload.sessionVersion);
      const hasImpersonationClaims =
        payload.impersonatedBy !== undefined || payload.isImpersonated !== undefined;
      if (hasImpersonationClaims && (payload.isImpersonated !== true || typeof payload.impersonatedBy !== "string")) {
        return null;
      }
      impersonatedBy = typeof payload.impersonatedBy === "string" ? payload.impersonatedBy : undefined;
      isImpersonated = payload.isImpersonated === true && !!impersonatedBy;
      if (!issuedAt || !Number.isFinite(issuedAt)) {
        return null;
      }
    } catch (error) {
      console.warn("Invalid or expired JWT token");
      return null;
    }

    if (!userId || !tenantId) {
      return null;
    }

    // Check in-memory cache first
    const cacheKey = `${tenantId}:${userId}`;
    const now = Date.now();
    const cached = userAuthCache.get(cacheKey);

    let user: User | null = null;
    if (cached && cached.expiresAt > now) {
      user = cached.user;
    } else {
      // Validate user exists and is active from database
      user = await prisma.user.findUnique({
        where: {
          id: userId,
          tenantId: tenantId,
        },
      });

      if (user && user.isActive) {
        userAuthCache.set(cacheKey, { user, expiresAt: now + 30000 }); // 30s TTL
        // Prevent unbounded cache growth
        if (userAuthCache.size > 2000) {
          const firstKey = userAuthCache.keys().next().value;
          if (firstKey) userAuthCache.delete(firstKey);
        }
      }
    }

    if (!user || !user.isActive) {
      userAuthCache.delete(cacheKey);
      return null;
    }

    // Session pinning uses the dedicated User.sessionVersion counter, bumped
    // only on login for single-session tenants and on credential/role/status
    // changes. Routine row touches (lastLoginAt, profile edits) no longer
    // kill other devices. Legacy tokens without a claim map to 0, the column
    // default, so pre-existing sessions survive the rollout. Impersonation
    // tokens are short-lived platform grants and bypass the pin. Note: the
    // 30s user cache can delay a single-session kick by up to 30s.
    if (!isImpersonated) {
      const tokenVersion = sessionVersion ?? 0;
      const currentVersion = (user as unknown as { sessionVersion?: number }).sessionVersion ?? 0;
      if (tokenVersion !== currentVersion) {
        userAuthCache.delete(cacheKey);
        return null;
      }
    }

    if (isImpersonated && impersonatedBy) {
      const originalAdmin = await prisma.user.findFirst({
        where: { email: impersonatedBy, isActive: true },
        select: { email: true, role: true },
      });
      if (!originalAdmin || (originalAdmin.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(originalAdmin.email))) {
        return null;
      }
    }

    return {
      user,
      tenantId,
      ...(isImpersonated && impersonatedBy ? { impersonatedBy, isImpersonated: true } : {}),
    };
  } catch (error) {
    console.error("Auth context error:", error);
    return null;
  }
}

/**
 * @deprecated Unused. Production endpoints must never trust raw request headers for tenant context.
 * Always authenticate and derive tenantId from cryptographically verified JWT claims via requireApiAccess().
 */
export async function getTenantFromRequest(request: NextRequest): Promise<string | null> {
  const tenantId = request.headers.get("x-tenant-id");
  
  if (tenantId) {
    // Validate tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { tenantId },
    });
    
    if (tenant && tenant.subscriptionStatus !== "SUSPENDED") {
      return tenantId;
    }
  }
  
  return null;
}

/**
 * Generate a cryptographically signed JWT token using Jose
 */
export async function generateAuthToken(
  userId: string,
  tenantId: string,
  role?: string,
  email?: string,
  sessionVersion?: number,
  subscriptionBlocked?: boolean
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 24 * 60 * 60; // 24 hours

  return new SignJWT({ userId, tenantId, role, email, sessionVersion, subscriptionBlocked })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(exp)
    .setIssuedAt(iat)
    .setNotBefore(iat)
    .sign(getJwtSecretKey());
}

/**
 * Hash password securely using bcryptjs for production
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

/**
 * Verify password securely using bcryptjs
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
