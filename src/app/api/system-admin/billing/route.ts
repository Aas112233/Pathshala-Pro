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
import { isPlatformOwnerEmail } from "@/lib/platform-owner";

const PLAN_RATES: Record<string, number> = {
  FREE: 0,
  STARTER: 99,
  PRO: 299,
  ENTERPRISE: 599,
};

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
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !(user as any).impersonatedBy) {
      return unauthorized("Only platform system administrators can access SaaS billing.");
    }

    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
    });
    const tenantCounts = await Promise.all(
      tenants.map(async (tenant) => {
        const [students, users] = await Promise.all([
          prisma.studentProfile.count({ where: { tenantId: tenant.tenantId } }),
          prisma.user.count({ where: { tenantId: tenant.tenantId } }),
        ]);
        return { tenantId: tenant.tenantId, students, users };
      })
    );
    const studentsByTenant = new Map(
      tenantCounts.map((count) => [count.tenantId, count.students])
    );
    const usersByTenant = new Map(
      tenantCounts.map((count) => [count.tenantId, count.users])
    );

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

      const studentCount = studentsByTenant.get(t.tenantId) || 0;
      const usersCount = usersByTenant.get(t.tenantId) || 0;

      return {
        id: t.id,
        tenantId: t.tenantId,
        name: t.name,
        currency: t.currency,
        status: t.subscriptionStatus,
        studentsCount: studentCount,
        usersCount,
        createdAt: t.createdAt,
        trialDaysRemaining: t.subscriptionStatus === "TRIAL" ? trialDaysRemaining : null,
        plan: studentCount > 500 ? "ENTERPRISE" : studentCount > 150 ? "PRO" : "STARTER",
        estimatedMonthlyPrice: t.subscriptionStatus === "ACTIVE" ? (studentCount > 500 ? 599 : studentCount > 150 ? 299 : 149) : 0,
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
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !(user as any).impersonatedBy) {
      return unauthorized("Only platform system administrators can modify billing.");
    }

    const body = await request.json();
    const { tenantId, status, plan } = body;

    if (!tenantId || !status) {
      return badRequest("tenantId and status are required");
    }

    const tenant = await prisma.tenant.findUnique({
      where: { tenantId },
    });

    if (!tenant) return badRequest("Tenant not found");

    const updated = await prisma.tenant.update({
      where: { tenantId },
      data: { subscriptionStatus: status, ...(plan ? { subscriptionPlan: plan } : {}) },
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
