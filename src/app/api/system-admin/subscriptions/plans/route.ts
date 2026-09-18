import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, unauthorized, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";

/**
 * GET /api/system-admin/subscriptions/plans
 *
 * Return the active SubscriptionPlan catalog with per-plan feature and quota
 * summaries. Used by the superadmin subscription control panel's plan picker so
 * the operator can see pricing, included students/staff/storage/SMS and feature
 * flags before switching a tenant's plan.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, {
      allowSystemAdmin: true,
    });
    if ("response" in access) return access.response;

    const { user } = access.authContext;
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !access.authContext.isImpersonated) {
      return unauthorized("Only platform system administrators can list subscription plans.");
    }

    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPrice: "asc" },
    });

    return successResponse(plans);
  } catch (error) {
    return handleApiError(error, "Failed to load subscription plans");
  }
}
