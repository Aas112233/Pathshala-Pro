import type { AcceleratePrismaClient } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { signJwtToken } from "@/lib/jwt";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";

export type TenantStatusEnum = "TRIAL" | "ACTIVE" | "SUSPENDED" | "EXPIRED" | "ARCHIVED";
export type SuperAdminActionTypeEnum =
  | "TENANT_STATUS_CHANGE"
  | "QUOTA_UPDATE"
  | "IMPERSONATION_START"
  | "PLAN_CHANGE"
  | "FEATURE_FLAG_CHANGE"
  | "MAINTENANCE_TOGGLE";

export interface SuperAdminContext {
  adminUserId: string;
  adminEmail: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UpdateTenantStatusParams {
  tenantId: string;
  status: TenantStatusEnum;
  reason?: string;
  context: SuperAdminContext;
}

export interface UpdateTenantQuotaParams {
  tenantId: string;
  customMaxStudents?: number;
  customMaxStaff?: number;
  customMaxStorageMb?: number;
  context: SuperAdminContext;
}

export interface UpdateFeatureOverridesParams {
  tenantId: string;
  hasHostel?: boolean;
  hasTransport?: boolean;
  hasPayroll?: boolean;
  hasBiometric?: boolean;
  hasOnlinePay?: boolean;
  hasCustomReport?: boolean;
  customModules?: string[];
  context: SuperAdminContext;
}

export interface ImpersonationResult {
  token: string;
  targetTenantId: string;
  targetTenantName: string;
  impersonatedUserEmail: string;
  expiresIn: string;
}

export interface GlobalPlatformTelemetry {
  tenants: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
  };
  capacity: {
    totalStudents: number;
    totalStaff: number;
  };
  financials: {
    totalPlatformTransactions: number;
    totalRevenueProcessed: number;
  };
}

/**
 * 1. Log SuperAdmin Control Plane Actions
 */
export async function logSuperAdminAction(
  tx: Prisma.TransactionClient,
  params: {
    context: SuperAdminContext;
    targetTenantId?: string;
    actionType: SuperAdminActionTypeEnum;
    details: Record<string, any>;
  }
) {
  const { context, targetTenantId, actionType, details } = params;

  return tx.superAdminActionLog.create({
    data: {
      adminUserId: context.adminUserId,
      adminEmail: context.adminEmail,
      targetTenantId,
      actionType: actionType as any,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details,
    },
  });
}

/**
 * 2. Tenant Governance & Status Lifecycle
 */
export async function updateTenantStatus(
  tx: Prisma.TransactionClient,
  params: UpdateTenantStatusParams
) {
  const { tenantId, status, reason, context } = params;

  const tenant = await tx.tenant.findUnique({
    where: { tenantId },
  });

  if (!tenant) {
    throw new Error(`Tenant '${tenantId}' not found.`);
  }

  const updatedTenant = await tx.tenant.update({
    where: { tenantId },
    data: {
      // In case status is a custom field on tenant or subscription
    },
  });

  // Also update subscription status if applicable
  await tx.tenantSubscription.updateMany({
    where: { tenantId },
    data: {
      status: status === "ACTIVE" ? "ACTIVE" : status === "SUSPENDED" ? "PAST_DUE" : "TRIALING",
    },
  });

  await logSuperAdminAction(tx, {
    context,
    targetTenantId: tenantId,
    actionType: "TENANT_STATUS_CHANGE",
    details: {
      newStatus: status,
      reason,
      tenantName: tenant.name,
    },
  });

  return updatedTenant;
}

/**
 * 3. Quota & Custom Limits Management
 */
export async function updateTenantQuota(
  tx: Prisma.TransactionClient,
  params: UpdateTenantQuotaParams
) {
  const { tenantId, customMaxStudents, customMaxStaff, customMaxStorageMb, context } = params;

  const subscription = await tx.tenantSubscription.upsert({
    where: { tenantId },
    create: {
      tenantId,
      planId: "default-starter", // fallback plan ID
      customMaxStudents,
      customMaxStaff,
      customMaxStorageMb,
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    update: {
      ...(customMaxStudents !== undefined ? { customMaxStudents } : {}),
      ...(customMaxStaff !== undefined ? { customMaxStaff } : {}),
      ...(customMaxStorageMb !== undefined ? { customMaxStorageMb } : {}),
    },
  });

  await logSuperAdminAction(tx, {
    context,
    targetTenantId: tenantId,
    actionType: "QUOTA_UPDATE",
    details: {
      customMaxStudents,
      customMaxStaff,
      customMaxStorageMb,
    },
  });

  return subscription;
}

/**
 * 4. Feature Flag & Module Overrides
 */
export async function updateTenantFeatureOverrides(
  tx: Prisma.TransactionClient,
  params: UpdateFeatureOverridesParams
) {
  const {
    tenantId,
    hasHostel,
    hasTransport,
    hasPayroll,
    hasBiometric,
    hasOnlinePay,
    hasCustomReport,
    customModules,
    context,
  } = params;

  const override = await tx.tenantFeatureOverride.upsert({
    where: { tenantId },
    create: {
      tenantId,
      hasHostel: hasHostel ?? true,
      hasTransport: hasTransport ?? true,
      hasPayroll: hasPayroll ?? true,
      hasBiometric: hasBiometric ?? false,
      hasOnlinePay: hasOnlinePay ?? true,
      hasCustomReport: hasCustomReport ?? true,
      customModules: customModules ? (customModules as any) : undefined,
    },
    update: {
      ...(hasHostel !== undefined ? { hasHostel } : {}),
      ...(hasTransport !== undefined ? { hasTransport } : {}),
      ...(hasPayroll !== undefined ? { hasPayroll } : {}),
      ...(hasBiometric !== undefined ? { hasBiometric } : {}),
      ...(hasOnlinePay !== undefined ? { hasOnlinePay } : {}),
      ...(hasCustomReport !== undefined ? { hasCustomReport } : {}),
      ...(customModules !== undefined ? { customModules: customModules as any } : {}),
    },
  });

  await logSuperAdminAction(tx, {
    context,
    targetTenantId: tenantId,
    actionType: "FEATURE_FLAG_CHANGE",
    details: {
      hasHostel,
      hasTransport,
      hasPayroll,
      hasBiometric,
      hasOnlinePay,
      hasCustomReport,
      customModules,
    },
  });

  return override;
}

/**
 * 5. Impersonation Engine
 */
export async function generateTenantImpersonationToken(
  tx: AcceleratePrismaClient,
  params: {
    targetTenantId: string;
    context: SuperAdminContext;
  }
): Promise<ImpersonationResult> {
  const { targetTenantId, context } = params;

  // 1. Verify SuperAdmin permissions
  if (!isPlatformOwnerEmail(context.adminEmail)) {
    const adminUser = await tx.user.findUnique({
      where: { id: context.adminUserId },
    });
    if (adminUser?.role !== "SUPER_ADMIN" && adminUser?.role !== "SYSTEM_ADMIN") {
      throw new Error("Unauthorized: Only SuperAdmin / Platform Owner can impersonate tenants.");
    }
  }

  // 2. Fetch Target Tenant and Admin User
  const targetTenant = await tx.tenant.findUnique({
    where: { tenantId: targetTenantId },
  });

  if (!targetTenant) {
    throw new Error(`Target tenant '${targetTenantId}' not found.`);
  }

  // Find school admin in target tenant
  const targetUser = await tx.user.findFirst({
    where: {
      tenantId: targetTenantId,
      role: { in: ["ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "SUPER_ADMIN"] },
    },
  });

  const impersonatedEmail = targetUser?.email || `admin@${targetTenantId}.pathshala.pro`;
  const impersonatedUserId = targetUser?.id || "temp-impersonated-admin";
  const role = targetUser?.role || "ADMIN";

  // 3. Issue Signed Impersonation JWT (Valid for 2 hours)
  const token = await signJwtToken({
    userId: impersonatedUserId,
    email: impersonatedEmail,
    name: targetUser?.name || `${targetTenant.name} Administrator`,
    tenantId: targetTenantId,
    role,
    impersonatedBy: context.adminEmail,
    isImpersonated: true,
  });

  // 4. Log Audit Event
  await logSuperAdminAction(tx as unknown as Prisma.TransactionClient, {
    context,
    targetTenantId,
    actionType: "IMPERSONATION_START",
    details: {
      targetTenantName: targetTenant.name,
      impersonatedEmail,
      role,
    },
  });

  return {
    token,
    targetTenantId,
    targetTenantName: targetTenant.name,
    impersonatedUserEmail: impersonatedEmail,
    expiresIn: "2h",
  };
}

/**
 * 6. Global Platform Telemetry
 */
export async function getGlobalPlatformTelemetry(
  tx: Prisma.TransactionClient
): Promise<GlobalPlatformTelemetry> {
  const [
    totalTenants,
    activeTenants,
    trialTenants,
    suspendedTenants,
    totalStudents,
    totalStaff,
    totalTransactions,
    transactionSum,
  ] = await Promise.all([
    tx.tenant.count().catch(() => 0),
    tx.tenantSubscription?.count({ where: { status: "ACTIVE" } }).catch(() => 0) ?? 0,
    tx.tenantSubscription?.count({ where: { status: "TRIALING" } }).catch(() => 0) ?? 0,
    tx.tenantSubscription?.count({ where: { status: "PAST_DUE" } }).catch(() => 0) ?? 0,
    tx.studentProfile.count().catch(() => 0),
    tx.staffProfile.count().catch(() => 0),
    tx.transaction.count().catch(() => 0),
    tx.transaction.aggregate({ _sum: { amountPaid: true } }).catch(() => ({ _sum: { amountPaid: 0 } })),
  ]);

  return {
    tenants: {
      total: totalTenants,
      active: activeTenants,
      trial: trialTenants,
      suspended: suspendedTenants,
    },
    capacity: {
      totalStudents,
      totalStaff,
    },
    financials: {
      totalPlatformTransactions: totalTransactions,
      totalRevenueProcessed: transactionSum._sum?.amountPaid || 0,
    },
  };
}

/**
 * 7. Platform Settings Management
 */
export async function setPlatformSetting(
  tx: Prisma.TransactionClient,
  key: string,
  value: any,
  adminUserId: string,
  description?: string
) {
  return tx.platformSetting.upsert({
    where: { key },
    create: {
      key,
      value,
      description,
      lastUpdatedById: adminUserId,
    },
    update: {
      value,
      description: description || undefined,
      lastUpdatedById: adminUserId,
    },
  });
}

export async function getPlatformSetting(
  tx: Prisma.TransactionClient,
  key: string
) {
  const setting = await tx.platformSetting.findUnique({
    where: { key },
  });
  return setting ? setting.value : null;
}
