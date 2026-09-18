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
import {
  changeTenantPlan,
  setSubscriptionEndDateTime,
  SUBSCRIPTION_TX_OPTIONS,
} from "@/lib/subscription-service";

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

/** Derived list price for the synthetic plan tier (used only when a tenant has
 * no relational SubscriptionPlan row assigned yet). */
function fallbackPlanAndPrice(studentCount: number): { plan: string; price: number } {
  if (studentCount > 500) return { plan: "ENTERPRISE", price: 599 };
  if (studentCount > 150) return { plan: "PRO", price: 299 };
  return { plan: "STARTER", price: 149 };
}

/**
 * GET /api/system-admin/billing
 * SaaS revenue metrics, subscription counts, and expiring trials.
 *
 * Each row now includes the relational `TenantSubscription` state (plan,
 * subscriptionEndAt, gracePeriodDays, graceEndsAt, status) plus a live
 * `daysRemaining` so the superadmin list reflects real lifecycle data instead
 * of student-count heuristics.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, {
      allowSystemAdmin: true,
    });
    if ("response" in access) return access.response;

    const { user } = access.authContext;
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !access.authContext.isImpersonated) {
      return unauthorized("Only platform system administrators can access SaaS billing.");
    }

    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        subscription: { include: { plan: true } },
      },
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

    const now = Date.now();
    const subscriptionList = tenants.map((t) => {
      const createdAt = new Date(t.createdAt);
      const daysActive = Math.floor((now - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const trialDaysRemaining = Math.max(0, 30 - daysActive);

      const studentCount = studentsByTenant.get(t.tenantId) || 0;
      const usersCount = usersByTenant.get(t.tenantId) || 0;

      const sub = t.subscription;
      const planCode = sub?.plan?.code ?? t.subscriptionPlan;
      const subscriptionStatus = sub?.status ?? t.subscriptionStatus;

      // Live days remaining against the effective end (explicit or period end).
      const effectiveEnd = sub?.subscriptionEndAt ?? sub?.currentPeriodEnd ?? null;
      const daysRemaining = effectiveEnd
        ? Math.max(0, Math.ceil((effectiveEnd.getTime() - now) / (1000 * 60 * 60 * 24)))
        : null;

      const { plan: fallbackPlan, price: fallbackPrice } = fallbackPlanAndPrice(studentCount);
      const plan = planCode && planCode !== "TRIAL" ? planCode : fallbackPlan;

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
        plan,
        estimatedMonthlyPrice: t.subscriptionStatus === "ACTIVE" ? (planCode && planCode !== "TRIAL" ? PLAN_PRICING[planCode as keyof typeof PLAN_PRICING] ?? fallbackPrice : fallbackPrice) : 0,
        // Relational subscription lifecycle data for the superadmin UI.
        subscription: sub
          ? {
              status: subscriptionStatus,
              planCode,
              planName: sub.plan?.name ?? null,
              billingCycle: sub.billingCycle,
              currentPeriodStart: sub.currentPeriodStart,
              currentPeriodEnd: sub.currentPeriodEnd,
              subscriptionEndAt: sub.subscriptionEndAt,
              gracePeriodDays: sub.gracePeriodDays,
              graceEndsAt: sub.graceEndsAt,
              daysRemaining,
            }
          : null,
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
 *
 * Route a plan/status/end-date/grace update through the subscription lifecycle
 * engine (single source of truth = TenantSubscription). The legacy free-text
 * `Tenant.subscriptionStatus` / `Tenant.subscriptionPlan` mirrors are kept in
 * sync by the service, and a SubscriptionChangeLog + SuperAdminActionLog + tenant
 * Notice are produced automatically.
 *
 * Accepted body: { tenantId, plan?, status?, subscriptionEndAt?, gracePeriodDays? }
 */
export async function POST(request: NextRequest) {
  return handleBillingMutation(request);
}

/**
 * PATCH /api/system-admin/billing — alias of POST for partial updates.
 */
export async function PATCH(request: NextRequest) {
  return handleBillingMutation(request);
}

async function handleBillingMutation(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, {
      allowSystemAdmin: true,
    });
    if ("response" in access) return access.response;

    const { user } = access.authContext;
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !access.authContext.isImpersonated) {
      return unauthorized("Only platform system administrators can modify billing.");
    }

    const body = await request.json();
    const { tenantId, status, plan, subscriptionEndAt, gracePeriodDays } = body;

    if (!tenantId || typeof tenantId !== "string") {
      return badRequest("tenantId is required");
    }

    const tenant = await prisma.tenant.findUnique({
      where: { tenantId },
      include: { subscription: true },
    });
    if (!tenant) return badRequest("Tenant not found");

    const ctx = { adminUserId: user.id, adminEmail: user.email };
    const hasEndChange = subscriptionEndAt !== undefined || gracePeriodDays !== undefined;

    if (!plan && !status && !hasEndChange) {
      return badRequest("Provide at least one of: plan, status, subscriptionEndAt, gracePeriodDays");
    }

    let result;

    // 1) End-date / grace changes route through the lifecycle engine.
    if (hasEndChange) {
      const endChange = await prisma.$transaction(
        (tx) =>
          setSubscriptionEndDateTime(tx as any, {
            tenantId,
            subscriptionEndAt: subscriptionEndAt ? new Date(subscriptionEndAt) : tenant.subscription?.subscriptionEndAt ?? tenant.subscription?.currentPeriodEnd ?? new Date(),
            ...(gracePeriodDays !== undefined ? { gracePeriodDays } : {}),
            changedById: user.id,
            changedByEmail: user.email,
            context: ctx,
          }),
        SUBSCRIPTION_TX_OPTIONS
      );
      result = endChange;
    }

    // 2) Plan change routes through the lifecycle engine (plan catalog lookup).
    if (plan && typeof plan === "string") {
      result = await prisma.$transaction(
        (tx) =>
          changeTenantPlan(tx as any, {
            tenantId,
            planCode: plan,
            changedById: user.id,
            changedByEmail: user.email,
            context: ctx,
          }),
        SUBSCRIPTION_TX_OPTIONS
      );
    }

    // 3) Legacy status-only toggle — applied on top of the engine's denormalized
    //    mirror so the superadmin quick actions keep working.
    if (status && typeof status === "string") {
      const updatedTenant = await prisma.tenant.update({
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
        details: { oldStatus: tenant.subscriptionStatus, newStatus: status, updatedBy: user.email },
      });
      return successResponse(updatedTenant, `Subscription status for ${tenant.name} updated to ${status}!`);
    }

    return successResponse(result, "Subscription updated.");
  } catch (error) {
    return handleApiError(error);
  }
}
