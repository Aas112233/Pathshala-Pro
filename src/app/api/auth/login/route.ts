import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  badRequest,
  unauthorized,
  handleApiError,
} from "@/lib/api-response";
import { loginSchema } from "@/lib/schemas";
import { verifyPassword, generateAuthToken } from "@/lib/auth";
import {
  smartRateLimit,
  recordRateLimitFailure,
  recordRateLimitSuccess,
  dedupeRequest,
} from "@/lib/rate-limit";
import { setAuthCookie } from "@/lib/auth-cookies";
import { getEffectivePermissions } from "@/lib/permissions";

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

    // Server-side duplicate prevention: identical login POSTs within 2s are rejected.
    if (!dedupeRequest(`LOGIN_POST_${ip}_${email}`, 2000)) {
      return errorResponse("Duplicate request detected. Please wait a moment.", 409);
    }

    // Smart adaptive rate limiting: tightens automatically as failures accumulate.
    const limitKey = `LOGIN_${ip}_${email}`;
    const rateCheck = smartRateLimit(limitKey, { preset: "auth" });

    if (!rateCheck.success) {
      const minutes = Math.max(1, Math.ceil(rateCheck.retryAfterSeconds / 60));
      return errorResponse(
        `Too many login attempts. Please try again in ${minutes} minute${minutes > 1 ? "s" : ""}.`,
        429
      );
    }

    // Local helper: every auth failure feeds the adaptive backoff.
    const failAuth = (message: string) => {
      recordRateLimitFailure(limitKey);
      return unauthorized(message);
    };

    // Find user by email
    const user = await prisma.user.findFirst({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      return failAuth("Invalid email or password");
    }

    if (!user.isActive) {
      return failAuth("Account is deactivated");
    }

    // Verify password
    const isValid = await verifyPassword(password, user.hash);
    if (!isValid) {
      return failAuth("Invalid email or password");
    }

    // Successful authentication — clear any adaptive penalties for this client.
    recordRateLimitSuccess(limitKey);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate cryptographically signed JWT NextAuth token
    const token = await generateAuthToken(user.id, user.tenantId, user.role);

    const response = successResponse(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
          permissions: getEffectivePermissions(user.role, user.permissions),
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
