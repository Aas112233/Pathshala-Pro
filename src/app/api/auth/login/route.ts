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
    const token = generateAuthToken(user.id, user.tenantId);

    return successResponse(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
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
