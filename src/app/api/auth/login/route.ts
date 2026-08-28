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
  smartRateLimitAsync,
  recordRateLimitFailureAsync,
  recordRateLimitSuccessAsync,
  dedupeRequestAsync,
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
    if (!(await dedupeRequestAsync(`LOGIN_POST_${ip}_${email}`, 2000))) {
      return errorResponse("Duplicate request detected. Please wait a moment.", 409);
    }

    // Smart adaptive rate limiting: tightens automatically as failures accumulate.
    const limitKey = `LOGIN_${ip}_${email}`;
    const rateCheck = await smartRateLimitAsync(limitKey, { preset: "auth" });

    if (!rateCheck.success) {
      const minutes = Math.max(1, Math.ceil(rateCheck.retryAfterSeconds / 60));
      return errorResponse(
        `Too many login attempts. Please try again in ${minutes} minute${minutes > 1 ? "s" : ""}.`,
        429
      );
    }

    // Local helper: every auth failure feeds the adaptive backoff.
    const failAuth = async (message: string) => {
      await recordRateLimitFailureAsync(limitKey);
      return unauthorized(message);
    };

    // Find user by email
    const user = await prisma.user.findFirst({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      return await failAuth("Invalid email or password");
    }

    if (!user.isActive) {
      return await failAuth("Account is deactivated");
    }

    // Verify password
    const isValid = await verifyPassword(password, user.hash);
    if (!isValid) {
      return await failAuth("Invalid email or password");
    }

    // Successful authentication — clear any adaptive penalties for this client.
    await recordRateLimitSuccessAsync(limitKey);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Class-level app access gate for PARENT/STUDENT (principal-controlled)
    if (user.role === "PARENT" || user.role === "STUDENT") {
      const isStudent = user.role === "STUDENT";
      let hasClassAccess = false;
      if (isStudent && (user as any).studentProfileId) {
        const sp = await prisma.studentProfile.findUnique({
          where: { id: (user as any).studentProfileId },
          select: { classId: true, class: { select: { appAccessEnabled: true, studentAppEnabled: true } } },
        });
        hasClassAccess = !!(sp?.class?.appAccessEnabled && sp?.class?.studentAppEnabled);
        if (!sp?.classId) hasClassAccess = false; // no class assigned → deny
      } else if (!isStudent) {
        const links = await prisma.parentStudentLink.findMany({
          where: { parentUserId: user.id, tenantId: user.tenantId },
          include: { studentProfile: { select: { classId: true, class: { select: { appAccessEnabled: true, parentAppEnabled: true } } } } },
        });
        hasClassAccess = links.some((l: any) => l.studentProfile?.class?.appAccessEnabled && l.studentProfile?.class?.parentAppEnabled);
        if (links.length === 0) hasClassAccess = false;
      }
      if (!hasClassAccess) {
        return await failAuth("App access is disabled for your class by the principal. Contact school admin.");
      }
    }

    // Generate cryptographically signed JWT NextAuth token
    const token = await generateAuthToken(user.id, user.tenantId, user.role, user.email);

    const response = successResponse(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          accessLevel: (user as any).accessLevel ?? null,
          isActive: user.isActive,
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
          permissions: getEffectivePermissions(user.role, user.permissions as any, (user as any).accessLevel ?? null),
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
