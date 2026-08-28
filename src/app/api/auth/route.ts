import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  badRequest,
  unauthorized,
  handleApiError,
} from "@/lib/api-response";
import { loginSchema, createUserSchema } from "@/lib/schemas";
import { hashPassword, verifyPassword, generateAuthToken } from "@/lib/auth";
import { setAuthCookie } from "@/lib/auth-cookies";
import { smartRateLimitAsync, dedupeRequestAsync } from "@/lib/rate-limit";

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

    // Apply IP-based Rate Limiting
    const ip = request.headers.get("x-forwarded-for") || "unknown_ip";

    if (!(await dedupeRequestAsync(`AUTH_POST_${ip}_${email}`, 2000))) {
      return errorResponse("Duplicate request detected. Please wait a moment.", 409);
    }

    const limitKey = `AUTH_${ip}_${email}`;
    const rateCheck = await smartRateLimitAsync(limitKey, { preset: "auth" });

    if (!rateCheck.success) {
      const minutes = Math.max(1, Math.ceil(rateCheck.retryAfterSeconds / 60));
      return errorResponse(
        `Too many login attempts. Please try again in ${minutes} minute${minutes > 1 ? "s" : ""}.`,
        429
      );
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

    // Generate auth token
    const token = await generateAuthToken(user.id, user.tenantId, user.role);

    const response = successResponse(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
        },
      },
      "Login successful"
    );
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

// Note: Register endpoint moved to /api/users (requires admin auth)
