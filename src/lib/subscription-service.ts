import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  logSuperAdminAction,
  type SuperAdminContext,
  type TenantStatusEnum,
} from "@/lib/superadmin-service";

/**
 * Subscription lifecycle engine.
 *
 * Single source of truth for a tenant's SaaS subscription. Mutations here keep
 * the denormalized `Tenant.subscriptionStatus` / `Tenant.subscriptionPlan`
 * mirrors in sync (existing system-admin UI reads those), write an auditable
 * `SubscriptionChangeLog` row, emit a `SuperAdminActionLog` entry, and notify
 * the tenant through the existing `Notice` system so the header notification
 * center surfaces plan / grace / expiry events.
 */

export interface SubscriptionMutationParams {
  tenantId: string;
  changedById?: string;
  changedByEmail?: string;
  context?: Partial<SuperAdminContext>;
}

/** Standard interactive transaction options for subscription operations */
export const SUBSCRIPTION_TX_OPTIONS = {
  maxWait: 10000,
  timeout: 30000,
};

/** Map a relational SubscriptionStatus to the Tenant free-text status string. */
const TENANT_STATUS_MAP: Record<string, TenantStatusEnum> = {
  TRIALING: "TRIAL",
  ACTIVE: "ACTIVE",
  GRACE: "ACTIVE", // during grace the tenant is still usable
  PAST_DUE: "SUSPENDED",
  CANCELLED: "SUSPENDED",
  UNPAID: "SUSPENDED",
  EXPIRED: "EXPIRED",
  INACTIVE: "EXPIRED",
};

function toTenantStatus(status: string): TenantStatusEnum {
  return TENANT_STATUS_MAP[status] ?? "SUSPENDED";
}

/** Blocked statuses where the tenant cannot use the product. */
export const BLOCKED_SUBSCRIPTION_STATUSES = new Set<string>([
  "PAST_DUE",
  "EXPIRED",
  "INACTIVE",
  "CANCELLED",
  "UNPAID",
]);

/**
 * Resolve a SubscriptionPlan by code (case-insensitive). Throws if the plan
 * catalog does not contain the requested tier so callers surface a clear error.
 */
export async function resolvePlan(
  tx: Prisma.TransactionClient,
  planCode: string
) {
  const plan = await tx.subscriptionPlan.findFirst({
    where: { code: planCode.toUpperCase() },
  });
  if (!plan) {
    throw new Error(
      `Plan '${planCode}' does not exist in the subscription catalog.`
    );
  }
  return plan;
}

/**
 * Return the current subscription row (or null) for a tenant, including its
 * plan relation. Does not create anything.
 */
export async function getTenantSubscription(tx: Prisma.TransactionClient, tenantId: string) {
  return tx.tenantSubscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  });
}

/**
 * Composed subscription view used by the superadmin UI and tenant-facing
 * surfaces. Tolerates a missing subscription row (legacy tenants).
 */
export async function getTenantSubscriptionView(tenantId: string) {
  const [tenant, subscription] = await Promise.all([
    prisma.tenant.findUnique({ where: { tenantId } }),
    getTenantSubscription(prisma as unknown as Prisma.TransactionClient, tenantId),
  ]);

  if (!tenant) {
    throw new Error(`Tenant '${tenantId}' not found.`);
  }

  const enforcement = await getSubscriptionEnforcementState(tenantId);

  if (!subscription) {
    return {
      tenantId,
      planCode: tenant.subscriptionPlan || "STARTER",
      planName: tenant.subscriptionPlan || "Starter",
      status: tenant.subscriptionStatus || "TRIAL",
      billingCycle: "MONTHLY",
      currentPeriodStart: null,
      currentPeriodEnd: null,
      subscriptionEndAt: null,
      gracePeriodDays: 0,
      graceEndsAt: null,
      expiredAt: null,
      daysRemaining: null,
      isBlocked: enforcement.blocked,
      isInGrace: false,
      limits: null,
    };
  }

  const endAt = subscription.subscriptionEndAt ?? subscription.currentPeriodEnd;
  const graceEndsAt = subscription.graceEndsAt;
  const now = new Date();
  const daysRemaining = endAt
    ? Math.max(0, Math.ceil((endAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  return {
    tenantId,
    planCode: subscription.plan?.code ?? (tenant.subscriptionPlan || "STARTER"),
    planName: subscription.plan?.name ?? (tenant.subscriptionPlan || "Starter"),
    status: subscription.status,
    billingCycle: subscription.billingCycle,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    subscriptionEndAt: subscription.subscriptionEndAt,
    gracePeriodDays: subscription.gracePeriodDays,
    graceEndsAt: graceEndsAt,
    expiredAt: subscription.expiredAt,
    daysRemaining,
    isBlocked: enforcement.blocked,
    isInGrace: subscription.status === "GRACE",
    limits: {
      maxStudents: subscription.customMaxStudents ?? subscription.plan?.maxStudents ?? null,
      maxStaff: subscription.customMaxStaff ?? subscription.plan?.maxStaff ?? null,
      maxStorageMb: subscription.customMaxStorageMb ?? subscription.plan?.maxStorageMb ?? null,
    },
  };
}

/**
 * Create a tenant-facing Notice (surfaces in the header notification center).
 * Uses a marker suffix in the title to de-dupe repeat notifications.
 */
async function notifyTenantAboutSubscription(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    marker: string;
    title: string;
    content: string;
    priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    category?: string;
    publishDate?: Date;
  }
) {
  const { tenantId, marker, title, content, priority = "HIGH", category = "BILLING_ALERT", publishDate = new Date() } = params;

  const existing = await tx.notice.findFirst({
    where: {
      tenantId,
      scope: "TENANT",
      category,
      title: { contains: marker },
    },
    orderBy: { createdAt: "desc" },
    take: 1,
  });

  // Re-notify if the last identical notice is older than 24h.
  if (existing) {
    const ageHours = (Date.now() - new Date(existing.createdAt).getTime()) / (1000 * 60 * 60);
    if (ageHours < 24) {
      return existing;
    }
  }

  return tx.notice.create({
    data: {
      tenantId,
      scope: "TENANT",
      title: `${title} ${marker}`,
      content,
      category,
      priority,
      audience: "ALL",
      isPublished: true,
      publishDate,
      authorName: "Pathshala Pro Platform",
      authorRole: "SYSTEM_ADMIN",
    },
  });
}

function defaultEndDate(): Date {
  // 30-day trial horizon for newly created subscriptions.
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

/**
 * Change a tenant's plan at any time. Upserts the subscription row, mirrors
 * plan/status onto Tenant, writes history + audit log, and notifies the tenant.
 */
export async function changeTenantPlan(
  tx: Prisma.TransactionClient,
  params: SubscriptionMutationParams & { planCode: string }
) {
  const { tenantId, planCode, changedById, changedByEmail, context } = params;

  const tenant = await tx.tenant.findUnique({ where: { tenantId } });
  if (!tenant) throw new Error(`Tenant '${tenantId}' not found.`);

  const plan = await resolvePlan(tx, planCode);

  const previous = await getTenantSubscription(tx, tenantId);
  const previousStatus = (previous?.status ?? "TRIALING") as string;
  const newStatus =
    previous && BLOCKED_SUBSCRIPTION_STATUSES.has(previous.status) ? previous.status : "ACTIVE";

  const subscription = await tx.tenantSubscription.upsert({
    where: { tenantId },
    create: {
      tenantId,
      planId: plan.id,
      status: newStatus,
      currentPeriodStart: new Date(),
      currentPeriodEnd: defaultEndDate(),
      subscriptionEndAt: defaultEndDate(),
      lastPlanChangeAt: new Date(),
      lastPlanChangeBy: changedByEmail,
    },
    update: {
      planId: plan.id,
      lastPlanChangeAt: new Date(),
      lastPlanChangeBy: changedByEmail,
    },
    include: { plan: true },
  });

  // Mirror denormalized fields onto Tenant.
  await tx.tenant.update({
    where: { tenantId },
    data: {
      subscriptionPlan: plan.code,
      subscriptionStatus: toTenantStatus(newStatus),
    },
  });

  await tx.subscriptionChangeLog.create({
    data: {
      tenantId,
      planId: plan.id,
      oldStatus: previousStatus as any,
      newStatus: newStatus as any,
      changeType: "PLAN_CHANGE",
      subscriptionEndAt: subscription.subscriptionEndAt,
      gracePeriodDays: subscription.gracePeriodDays,
      changedById,
      changedByEmail,
      details: {
        oldPlan: previous?.plan?.code ?? tenant.subscriptionPlan,
        newPlan: plan.code,
        planName: plan.name,
      },
    },
  });

  await logSuperAdminAction(tx, {
    context: (context ?? { adminUserId: changedById ?? "system", adminEmail: changedByEmail ?? "system@pathshala.pro" }) as SuperAdminContext,
    targetTenantId: tenantId,
    actionType: "PLAN_CHANGE",
    details: {
      oldPlan: previous?.plan?.code ?? tenant.subscriptionPlan,
      newPlan: plan.code,
      status: newStatus,
    },
  });

  await notifyTenantAboutSubscription(tx, {
    tenantId,
    marker: "[PLAN]",
    title: "Your subscription plan was updated",
    content: `Your plan has been changed to ${plan.name} (${plan.code}).`,
  });

  return subscription;
}

/**
 * Set an explicit subscription end date-time. Grace period recomputed from it.
 * Rejects past dates unless a grace period is explicitly provided.
 */
export async function setSubscriptionEndDateTime(
  tx: Prisma.TransactionClient,
  params: SubscriptionMutationParams & { subscriptionEndAt: Date; gracePeriodDays?: number }
) {
  const { tenantId, subscriptionEndAt, gracePeriodDays, changedById, changedByEmail, context } = params;

  const previous = await getTenantSubscription(tx, tenantId);
  if (!previous) {
    throw new Error(
      `Tenant '${tenantId}' has no active subscription. Assign a plan first.`
    );
  }

  const now = new Date();
  const isPast = subscriptionEndAt.getTime() <= now.getTime();
  const effectiveGrace = gracePeriodDays !== undefined ? gracePeriodDays : previous.gracePeriodDays;

  if (isPast && effectiveGrace <= 0) {
    throw new Error(
      "Subscription end date must be in the future, or a grace period must be set to allow a past end."
    );
  }

  const graceEndsAt = new Date(subscriptionEndAt.getTime() + effectiveGrace * 24 * 60 * 60 * 1000);
  const willBeBlocked = graceEndsAt.getTime() <= now.getTime();

  const newStatus = willBeBlocked
    ? "INACTIVE"
    : isPast
    ? "GRACE"
    : previous.status;

  const subscription = await tx.tenantSubscription.update({
    where: { tenantId },
    data: {
      currentPeriodEnd: subscriptionEndAt,
      subscriptionEndAt,
      gracePeriodDays: effectiveGrace,
      graceEndsAt,
      ...(willBeBlocked ? { expiredAt: now } : {}),
      status: newStatus,
    },
    include: { plan: true },
  });

  await tx.tenant.update({
    where: { tenantId },
    data: {
      subscriptionStatus: toTenantStatus(newStatus),
      subscriptionPlan: subscription.plan?.code ?? undefined,
    },
  });

  await tx.subscriptionChangeLog.create({
    data: {
      tenantId,
      planId: previous.planId,
      oldStatus: previous.status as any,
      newStatus: newStatus as any,
      changeType: "END_DATE_CHANGE",
      subscriptionEndAt,
      gracePeriodDays: effectiveGrace,
      changedById,
      changedByEmail,
      details: { previousEnd: previous.subscriptionEndAt ?? previous.currentPeriodEnd },
    },
  });

  await logSuperAdminAction(tx, {
    context: (context ?? { adminUserId: changedById ?? "system", adminEmail: changedByEmail ?? "system@pathshala.pro" }) as SuperAdminContext,
    targetTenantId: tenantId,
    actionType: "TENANT_STATUS_CHANGE",
    details: {
      subscriptionEndAt,
      gracePeriodDays: effectiveGrace,
      newStatus,
    },
  });

  if (isPast && !willBeBlocked) {
    await notifyTenantAboutSubscription(tx, {
      tenantId,
      marker: "[GRACE]",
      title: "Subscription period exceeded — grace period active",
      content: `Your subscription ended on ${subscriptionEndAt.toISOString()}. A ${effectiveGrace}-day grace period is now active and expires on ${graceEndsAt.toISOString()}.`,
      priority: "URGENT",
    });
  }

  return subscription;
}

/**
 * Configure the grace period (extra days after the subscription end before the
 * tenant is deactivated). Recomputes graceEndsAt and switches to GRACE state.
 */
export async function applyGracePeriod(
  tx: Prisma.TransactionClient,
  params: SubscriptionMutationParams & { gracePeriodDays: number }
) {
  const { tenantId, gracePeriodDays, changedById, changedByEmail, context } = params;

  if (!Number.isInteger(gracePeriodDays) || gracePeriodDays < 0) {
    throw new Error("Grace period must be a non-negative integer number of days.");
  }

  const previous = await getTenantSubscription(tx, tenantId);
  if (!previous) {
    throw new Error(`Tenant '${tenantId}' has no active subscription. Assign a plan first.`);
  }

  const endAt = previous.subscriptionEndAt ?? previous.currentPeriodEnd;
  const graceEndsAt = new Date(endAt.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  const isPast = endAt.getTime() <= now.getTime();
  const willBeBlocked = graceEndsAt.getTime() <= now.getTime();
  const newStatus = willBeBlocked ? "INACTIVE" : isPast && gracePeriodDays > 0 ? "GRACE" : previous.status;

  const subscription = await tx.tenantSubscription.update({
    where: { tenantId },
    data: {
      gracePeriodDays,
      graceEndsAt,
      graceNotifiedAt: willBeBlocked ? previous.graceNotifiedAt : new Date(),
      ...(willBeBlocked ? { expiredAt: now } : {}),
      status: newStatus,
    },
    include: { plan: true },
  });

  await tx.tenant.update({
    where: { tenantId },
    data: {
      subscriptionStatus: toTenantStatus(newStatus),
      subscriptionPlan: subscription.plan?.code ?? undefined,
    },
  });

  await tx.subscriptionChangeLog.create({
    data: {
      tenantId,
      planId: previous.planId,
      oldStatus: previous.status as any,
      newStatus: newStatus as any,
      changeType: "GRACE_CHANGE",
      subscriptionEndAt: endAt,
      gracePeriodDays,
      changedById,
      changedByEmail,
      details: { previousGraceDays: previous.gracePeriodDays },
    },
  });

  await logSuperAdminAction(tx, {
    context: (context ?? { adminUserId: changedById ?? "system", adminEmail: changedByEmail ?? "system@pathshala.pro" }) as SuperAdminContext,
    targetTenantId: tenantId,
    actionType: "TENANT_STATUS_CHANGE",
    details: { gracePeriodDays, graceEndsAt, newStatus },
  });

  if (isPast && gracePeriodDays > 0 && !willBeBlocked) {
    await notifyTenantAboutSubscription(tx, {
      tenantId,
      marker: "[GRACE]",
      title: "Subscription grace period extended",
      content: `A ${gracePeriodDays}-day grace period is now active and expires on ${graceEndsAt.toISOString()}.`,
      priority: "URGENT",
    });
  }

  return subscription;
}

/**
 * Evaluate subscription expiry for all tenants. Idempotent.
 *
 * - Tenants past graceEndsAt (or past end with 0 grace) are transitioned to
 *   EXPIRED/INACTIVE, mirrored onto Tenant, logged, and notified.
 * - Tenants inside the grace window that have not been notified yet receive a
 *   single grace warning and move to GRACE state.
 */
export async function evaluateSubscriptionExpiry(tx: Prisma.TransactionClient) {
  const now = new Date();
  const subs = await tx.tenantSubscription.findMany({
    where: {
      status: { in: ["ACTIVE", "GRACE", "TRIALING"] },
    },
    include: { plan: true, tenant: true },
  });

  const expired: string[] = [];
  const graceNotified: string[] = [];

  for (const sub of subs) {
    const endAt = sub.subscriptionEndAt ?? sub.currentPeriodEnd;
    if (!endAt) continue;

    const graceEndsAt = sub.graceEndsAt ?? endAt;
    const isPast = endAt.getTime() <= now.getTime();
    const graceExpired = graceEndsAt.getTime() <= now.getTime();

    // Expired (past grace window) -> deactivate.
    if (isPast && graceExpired) {
      await tx.tenantSubscription.update({
        where: { tenantId: sub.tenantId },
        data: { status: "INACTIVE", expiredAt: now },
      });
      await tx.tenant.update({
        where: { tenantId: sub.tenantId },
        data: { subscriptionStatus: "EXPIRED" },
      });
      await tx.subscriptionChangeLog.create({
        data: {
          tenantId: sub.tenantId,
          planId: sub.planId,
          oldStatus: sub.status as any,
          newStatus: "INACTIVE" as any,
          changeType: "EXPIRY",
          subscriptionEndAt: endAt,
          gracePeriodDays: sub.gracePeriodDays,
          details: { graceEndsAt },
        },
      });
      await notifyTenantAboutSubscription(tx, {
        tenantId: sub.tenantId,
        marker: "[EXPIRED]",
        title: "Your subscription has expired",
        content: `Your subscription ended on ${endAt.toISOString()} and the grace period has lapsed. The school account is now inactive. Contact your platform administrator to restore access.`,
        priority: "URGENT",
        category: "MAINTENANCE",
      });
      expired.push(sub.tenantId);
      continue;
    }

    // Inside grace window, not yet notified -> notify once + move to GRACE.
    if (isPast && sub.status !== "GRACE" && !sub.graceNotifiedAt) {
      const graceEnds = sub.graceEndsAt ?? endAt;
      await tx.tenantSubscription.update({
        where: { tenantId: sub.tenantId },
        data: {
          status: "GRACE",
          graceNotifiedAt: now,
        },
      });
      await tx.tenant.update({
        where: { tenantId: sub.tenantId },
        data: { subscriptionStatus: "ACTIVE" },
      });
      await notifyTenantAboutSubscription(tx, {
        tenantId: sub.tenantId,
        marker: "[GRACE]",
        title: "Subscription period exceeded — grace period active",
        content: `Your subscription ended on ${endAt.toISOString()}. A grace period is active and expires on ${graceEnds.toISOString()}. Please renew to avoid deactivation.`,
        priority: "URGENT",
      });
      graceNotified.push(sub.tenantId);
    }
  }

  return { scanned: subs.length, expired, graceNotified };
}

/**
 * Raw subscription history for the superadmin timeline.
 */
export async function getSubscriptionHistory(tx: Prisma.TransactionClient, tenantId: string, limit = 30) {
  return tx.subscriptionChangeLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { plan: true },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Opportunistic on-read expiry evaluation.
//
// Production relies on the Vercel cron to flip expired tenants to INACTIVE. For
// local development (no cron) and for cold paths that bypass the cron, we run a
// cheap, rate-limited sweep inside the API auth layer so expiry is still
// enforced. The in-memory marker prevents a DB sweep on every single request.
// ────────────────────────────────────────────────────────────────────────────

const globalForExpiry = globalThis as unknown as { __lastExpiryRunAt?: number };
const EXPIRY_SWEEP_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes max

let expirySweepInFlight: Promise<unknown> | null = null;

/**
 * Run the expiry sweep now if it is due (rate-limited). Safe to call from
 * request hot paths. Never throws.
 */
// ────────────────────────────────────────────────────────────────────────────
// Subscription enforcement state for the API auth layer.
//
// Returns whether a tenant is blocked (no access) and, if so, a user-facing
// reason. Optimized to a single indexed query per request; legacy tenants with
// no TenantSubscription row fall back to the Tenant free-text status.
// ────────────────────────────────────────────────────────────────────────────

export interface SubscriptionEnforcementResult {
  blocked: boolean;
  reason?: string;
  status?: string;
}

export async function getSubscriptionEnforcementState(
  tenantId: string
): Promise<SubscriptionEnforcementResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { tenantId },
    select: {
      subscriptionStatus: true,
      subscription: {
        select: {
          status: true,
          graceEndsAt: true,
          subscriptionEndAt: true,
          currentPeriodEnd: true,
        },
      },
    },
  });

  if (!tenant) {
    // Unknown tenant: fail closed for tenant APIs.
    return { blocked: true, reason: "Tenant not found.", status: "EXPIRED" };
  }

  const subscription = tenant.subscription;
  const status = (tenant.subscriptionStatus || "TRIAL").toUpperCase();
  if (["SUSPENDED", "ARCHIVED", "EXPIRED", "INACTIVE", "CANCELLED", "UNPAID", "PAST_DUE"].includes(status)) {
    return { blocked: true, reason: "Subscription is not active.", status };
  }

  // Evaluate dates on every request; access must not depend on the expiry sweep.
  if (subscription) {
    const now = Date.now();
    const end = subscription.subscriptionEndAt ?? subscription.currentPeriodEnd;
    const grace = subscription.graceEndsAt;
    const expired = subscription.status === "GRACE"
      ? !grace || grace.getTime() <= now
      : end && end.getTime() <= now && (!grace || grace.getTime() <= now);
    if (BLOCKED_SUBSCRIPTION_STATUSES.has(subscription.status) || expired) {
      return {
        blocked: true,
        reason: "Subscription is not active.",
        status: subscription.status,
      };
    }
    return { blocked: false, status: subscription.status };
  }

  return { blocked: false, status };
}

export async function evaluateExpiryIfDue(): Promise<void> {
  const now = Date.now();
  if (globalForExpiry.__lastExpiryRunAt && now - globalForExpiry.__lastExpiryRunAt < EXPIRY_SWEEP_INTERVAL_MS) {
    return;
  }

  if (expirySweepInFlight) {
    // A sweep is already running; let it finish instead of stacking requests.
    try {
      await expirySweepInFlight;
    } catch {
      /* best-effort */
    }
    return;
  }

  globalForExpiry.__lastExpiryRunAt = now;
  expirySweepInFlight = prisma
    .$transaction(
      (tx) => evaluateSubscriptionExpiry(tx as unknown as Prisma.TransactionClient),
      SUBSCRIPTION_TX_OPTIONS
    )
    .catch((err) => {
      // Non-blocking: auth must not fail because the sweep errored.
      console.error("[ExpirySweep] background evaluation failed:", err);
    })
    .finally(() => {
      expirySweepInFlight = null;
    });

  try {
    await expirySweepInFlight;
  } catch {
    /* already handled */
  }
}
