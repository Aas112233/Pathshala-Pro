import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  unauthorized,
  badRequest,
  handleApiError,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/audit-logger";

const PLAN_PRICING = {
  TRIAL: 0,
  STARTER: 149,
  PRO: 299,
  ENTERPRISE: 599,
};

/**
 * GET /api/system-admin/billing
 * SaaS revenue metrics, subscription counts, and expiring trials
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, {
      allowSystemAdmin: true,
    });
    if ("response" in access) return access.response;

    const { user } = access.authContext;
    if (
      user.role !== "SYSTEM_ADMIN" &&
      user.role !== "SUPER_ADMIN" &&
      user.role !== "ADMIN" &&
      user.tenantId !== "system"
    ) {
      return unauthorized("Only system administrators can access SaaS billing.");
    }

    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { studentProfiles: true, users: true },
        },
      },
    });

    const activeCount = tenants.filter((t) => t.subscriptionStatus === "ACTIVE").length;
    const trialCount = tenants.filter((t) => t.subscriptionStatus === "TRIAL").length;
    const suspendedCount = tenants.filter((t) => t.subscriptionStatus === "SUSPENDED").length;
    const expiredCount = tenants.filter((t) => t.subscriptionStatus === "EXPIRED").length;

    // Calculate Estimated MRR ($249 average per active tenant)
    const estimatedMRR = activeCount * 249;
    const estimatedARR = estimatedMRR * 12;

    const subscriptionList = tenants.map((t) => {
      // Calculate age and days remaining
      const createdAt = new Date(t.createdAt);
      const daysActive = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const trialDaysRemaining = Math.max(0, 30 - daysActive);

      return {
        id: t.id,
        tenantId: t.tenantId,
        name: t.name,
        currency: t.currency,
        status: t.subscriptionStatus,
        studentsCount: t._count.studentProfiles,
        usersCount: t._count.users,
        createdAt: t.createdAt,
        trialDaysRemaining: t.subscriptionStatus === "TRIAL" ? trialDaysRemaining : null,
        plan: t._count.studentProfiles > 500 ? "ENTERPRISE" : t._count.studentProfiles > 150 ? "PRO" : "STARTER",
        estimatedMonthlyPrice: t.subscriptionStatus === "ACTIVE" ? (t._count.studentProfiles > 500 ? 599 : t._count.studentProfiles > 150 ? 299 : 149) : 0,
      };
    });

    return successResponse({
      metrics: {
        totalSchools: tenants.length,
        activeSubscriptions: activeCount,
        trialSchools: trialCount,
        suspendedSchools: suspendedCount,
        expiredSchools: expiredCount,
        estimatedMRR,
        estimatedARR,
        trialConversionRate: tenants.length > 0 ? ((activeCount / tenants.length) * 100).toFixed(1) : "0",
      },
      subscriptions: subscriptionList,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/system-admin/billing
 * Update school subscription plan or status
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, {
      allowSystemAdmin: true,
    });
    if ("response" in access) return access.response;

    const { user } = access.authContext;
    if (
      user.role !== "SYSTEM_ADMIN" &&
      user.role !== "SUPER_ADMIN" &&
      user.role !== "ADMIN" &&
      user.tenantId !== "system"
    ) {
      return unauthorized("Only system administrators can modify billing.");
    }

    const body = await request.json();
    const { tenantId, status } = body;

    if (!tenantId || !status) {
      return badRequest("tenantId and status are required");
    }

    const tenant = await prisma.tenant.findUnique({
      where: { tenantId },
    });

    if (!tenant) return badRequest("Tenant not found");

    const updated = await prisma.tenant.update({
      where: { tenantId },
      data: { subscriptionStatus: status },
    });

    await logAuditEvent({
      tenantId,
      userId: user.id,
      userEmail: user.email,
      action: "UPDATE",
      entity: "Tenant",
      entityId: tenant.id,
      details: {
        oldStatus: tenant.subscriptionStatus,
        newStatus: status,
        updatedBy: user.email,
      },
    });

    return successResponse(
      updated,
      `Subscription status for ${tenant.name} updated to ${status}!`
    );
  } catch (error) {
    return handleApiError(error);
  }
}
