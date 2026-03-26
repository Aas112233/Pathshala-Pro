import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  badRequest,
  unauthorized,
} from "@/lib/api-response";
import { loginSchema } from "@/lib/schemas";
import { verifyPassword, generateAuthToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = 'edge';

/**
 * POST /api/auth/login
 * Authenticate user and return auth token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return badRequest("Invalid input", errors);
    }

    const { email, password } = validation.data;

    // Apply IP-based Rate Limiting (5 attempts per IP in a window)
    const ip = request.headers.get("x-forwarded-for") || "unknown_ip";

    // Using IP + Email limits brute force specific to a single login target over the same IP range
    const limitKey = `LOGIN_${ip}_${email}`;
    const rateCheck = rateLimit(limitKey, 5, 15 * 60 * 1000);

    if (!rateCheck.success) {
      return errorResponse("Too many login attempts. Please try again after 15 minutes.", 429);
    }

    // Find user by email
    const user = await prisma.user.findFirst({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      return unauthorized("Invalid email or password");
    }

    if (!user.isActive) {
      return unauthorized("Account is deactivated");
    }

    // Verify password
    const isValid = await verifyPassword(password, user.hash);
    if (!isValid) {
      return unauthorized("Invalid email or password");
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate cryptographically signed JWT NextAuth token
    const token = await generateAuthToken(user.id, user.tenantId, user.role);

    return successResponse(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
          permissions: (user as any).permissions,
        },
        token,
      },
      "Login successful"
    );
  } catch (error) {
    console.error("Login error:", error);
    return errorResponse("Internal server error", 500);
  }
}
