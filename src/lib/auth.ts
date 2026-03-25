import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { User } from "@prisma/client";

export interface AuthContext {
  user: User;
  tenantId: string;
}

/**
 * Extract and validate user from request headers
 * In production, this should validate JWT tokens from NextAuth
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  try {
    // Get authorization header
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.substring(7);
    
    // For development: decode user info from token
    // In production: verify JWT token with NextAuth
    let userId: string | null = null;
    let tenantId: string | null = null;

    // Try to get from header (for internal requests)
    userId = request.headers.get("x-user-id");
    tenantId = request.headers.get("x-tenant-id");

    // If not in headers, decode from token (simplified for dev)
    if (!userId || !tenantId) {
      try {
        const decoded = Buffer.from(token, "base64").toString("utf-8");
        const parsed = JSON.parse(decoded);
        
        // Check for token expiration
        if (parsed.exp && Date.now() > parsed.exp) {
          return null; // Token expired
        }
        
        userId = parsed.userId;
        tenantId = parsed.tenantId;
      } catch {
        return null;
      }
    }

    if (!userId || !tenantId) {
      return null;
    }

    // Validate user exists and is active
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
        tenantId: tenantId,
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return {
      user,
      tenantId,
    };
  } catch (error) {
    console.error("Auth context error:", error);
    return null;
  }
}

/**
 * Get tenant ID from request (for public endpoints)
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
 * Generate a simple auth token (for development)
 * In production, use NextAuth's JWT tokens
 */
export function generateAuthToken(userId: string, tenantId: string): string {
  return Buffer.from(
    JSON.stringify({ userId, tenantId, exp: Date.now() + 24 * 60 * 60 * 1000 })
  ).toString("base64");
}

/**
 * Hash password (simple implementation for dev)
 * In production, use bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  // Simple hash for development - use bcrypt in production
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "pathshala-pro-salt-2026");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify password
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computedHash = await hashPassword(password);
  return computedHash === hash;
}
