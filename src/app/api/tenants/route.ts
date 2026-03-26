import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, unauthorized } from "@/lib/api-response";
import { jwtVerify } from "jose";

/**
 * GET /api/tenants
 * List all tenants for System Admin
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value ||
      request.headers.get("authorization")?.substring(7);

    if (!token) return unauthorized();

    const secret = process.env.JWT_SECRET || "default_super_secret_key_for_jwt_2026_fallback";
    const encodedSecret = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, encodedSecret);

    if (payload.role !== "SYSTEM_ADMIN") {
      return unauthorized("Only system administrators can access this.");
    }

    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { users: true, studentProfiles: true }
        }
      }
    });

    return successResponse(tenants);
  } catch (error) {
    console.error("Fetch tenants error:", error);
    return errorResponse("Internal server error", 500);
  }
}
