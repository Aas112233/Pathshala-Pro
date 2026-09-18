import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  unauthorized,
  badRequest,
  handleApiError,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";
import {
  getTenantSubscriptionView,
  getSubscriptionHistory,
  changeTenantPlan,
  setSubscriptionEndDateTime,
  SUBSCRIPTION_TX_OPTIONS,
} from "@/lib/subscription-service";

/**
 * GET /api/system-admin/subscriptions/[tenantId]
 *
 * Composed lifecycle view for the superadmin subscription control panel:
 * plan, status, dates, grace window, days remaining, plus the full
 * SubscriptionChangeLog history timeline and the active plan catalog.
 *
 * POST /api/system-admin/subscriptions/[tenantId]
 *
 * Mutate a tenant's subscription: `{ plan?, subscriptionEndAt?, gracePeriodDays? }`
 * routed through the lifecycle engine (single source of truth = TenantSubscription).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const access = await requireApiAccess(request, { allowSystemAdmin: true });
    if ("response" in access) return access.response;

    const { user } = access.authContext;
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !access.authContext.isImpersonated) {
      return unauthorized("Only platform system administrators can view subscription lifecycle data.");
    }

    const { tenantId } = await params;
    const [view, history, plans] = await Promise.all([
      getTenantSubscriptionView(tenantId),
      getSubscriptionHistory(prisma as any, tenantId, 50),
      prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { monthlyPrice: "asc" } }),
    ]);

    return successResponse({ view, history, plans });
  } catch (error) {
    return handleApiError(error, "Failed to load subscription lifecycle data");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const access = await requireApiAccess(request, { allowSystemAdmin: true });
    if ("response" in access) return access.response;

    const { user } = access.authContext;
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !access.authContext.isImpersonated) {
      return unauthorized("Only platform system administrators can modify subscription lifecycle.");
    }

    const { tenantId } = await params;
    const body = await request.json();
    const { plan, subscriptionEndAt, gracePeriodDays } = body;

    if (!plan && subscriptionEndAt === undefined && gracePeriodDays === undefined) {
      return badRequest("Provide at least one of: plan, subscriptionEndAt, gracePeriodDays");
    }

    const ctx = { adminUserId: user.id, adminEmail: user.email };

    // Plan change routes through the engine (plan catalog lookup + audit + notice).
    if (plan && typeof plan === "string") {
      await prisma.$transaction(
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

    // End-date / grace changes route through the engine (validates future dates,
    // recomputes grace window, mirrors status, logs + notifies).
    if (subscriptionEndAt !== undefined || gracePeriodDays !== undefined) {
      const existing = await prisma.tenantSubscription.findUnique({ where: { tenantId } });
      const currentEnd = existing?.subscriptionEndAt ?? existing?.currentPeriodEnd;
      await prisma.$transaction(
        (tx) =>
          setSubscriptionEndDateTime(tx as any, {
            tenantId,
            subscriptionEndAt: subscriptionEndAt ? new Date(subscriptionEndAt) : currentEnd ?? new Date(),
            ...(gracePeriodDays !== undefined ? { gracePeriodDays } : {}),
            changedById: user.id,
            changedByEmail: user.email,
            context: ctx,
          }),
        SUBSCRIPTION_TX_OPTIONS
      );
    }

    // Return the refreshed view + history.
    const [view, history] = await Promise.all([
      getTenantSubscriptionView(tenantId),
      getSubscriptionHistory(prisma as any, tenantId, 50),
    ]);
    return successResponse({ view, history }, "Subscription updated.");
  } catch (error) {
    return handleApiError(error, "Failed to update subscription");
  }
}
