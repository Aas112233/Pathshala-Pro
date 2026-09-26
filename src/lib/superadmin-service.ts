import type { AcceleratePrismaClient } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { signJwtToken } from "@/lib/jwt";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";
import { invalidateTenantModulesCache } from "@/lib/api-auth";

export type TenantStatusEnum = "TRIAL" | "ACTIVE" | "SUSPENDED" | "EXPIRED" | "ARCHIVED";
export type SuperAdminActionTypeEnum =
  | "TENANT_STATUS_CHANGE"
  | "QUOTA_UPDATE"
  | "IMPERSONATION_START"
  | "PLAN_CHANGE"
  | "FEATURE_FLAG_CHANGE"
  | "MAINTENANCE_TOGGLE"
  | "TENANT_FORCE_DELETE";

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
      subscriptionStatus: status,
    },
  });

  // Also update subscription status if applicable
  await tx.tenantSubscription.updateMany({
    where: { tenantId },
    data: {
      status: status === "ACTIVE" ? "ACTIVE"
        : status === "SUSPENDED" ? "PAST_DUE"
        : status === "EXPIRED" ? "EXPIRED"
        : status === "ARCHIVED" ? "INACTIVE" : "TRIALING",
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

  invalidateTenantModulesCache(tenantId);
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

  invalidateTenantModulesCache(tenantId);
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
      isActive: true,
      role: { in: ["ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "SUPER_ADMIN"] },
    },
  });

  if (!targetUser) {
    throw new Error(`Target tenant '${targetTenantId}' has no active administrator account.`);
  }

  const impersonatedEmail = targetUser.email;
  const impersonatedUserId = targetUser.id;
  const role = targetUser.role;

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

  // 5. Record tenant-visible audit log for school leadership transparency
  try {
    await (tx as any).auditLog?.create?.({
      data: {
        tenantId: targetTenantId,
        userId: context.adminUserId,
        userEmail: context.adminEmail,
        action: "IMPERSONATION_SESSION_STARTED",
        entity: "Tenant",
        entityId: targetTenantId,
        ipAddress: context.ipAddress ?? null,
        details: {
          platformAdminEmail: context.adminEmail,
          impersonatedEmail,
          role,
          sessionDuration: "2h",
          note: "Platform staff initiated customer support impersonation session",
        },
      },
    });
  } catch (auditErr) {
    console.warn("[generateTenantImpersonationToken] Failed to record tenant audit log:", auditErr);
  }

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
      totalRevenueProcessed: Number(transactionSum._sum?.amountPaid || 0),
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

/**
 * 8. Irreversible Tenant Force-Delete (complete data wipe)
 *
 * Platform SuperAdmin only. Deletes EVERY row owned by the tenant in
 * leaf-to-root FK order inside the caller's transaction, then deletes the
 * tenant itself and writes a platform-level audit record (tenant-scoped
 * AuditLog rows are wiped with the tenant, so the SuperAdminActionLog entry
 * is the surviving forensic trail).
 *
 * Guards (also enforced by the API route — defense in depth):
 * - The platform SYSTEM tenant can never be deleted.
 * - Tenant must exist.
 */
export const PROTECTED_TENANT_IDS = ["SYSTEM", "SYSTEM-PLATFORM", "PLATFORM"];

export function isProtectedTenantId(tenantId: string | null | undefined): boolean {
  if (!tenantId || typeof tenantId !== "string") return true;
  return PROTECTED_TENANT_IDS.includes(tenantId.trim().toUpperCase());
}

export interface ForceDeleteTenantParams {
  tenantId: string;
  reason: string;
  context: SuperAdminContext;
}

export interface ForceDeleteTenantResult {
  deletedTenantId: string;
  deletedName: string;
  counts: {
    users: number;
    studentProfiles: number;
    staffProfiles: number;
    feeVouchers: number;
    transactions: number;
  };
}

export async function forceDeleteTenant(
  tx: Prisma.TransactionClient,
  params: ForceDeleteTenantParams
): Promise<ForceDeleteTenantResult> {
  const { tenantId, reason, context } = params;

  if (isProtectedTenantId(tenantId)) {
    throw new Error("The platform SYSTEM tenant can never be deleted.");
  }

  const tenant = await tx.tenant.findUnique({
    where: { tenantId },
  });

  if (!tenant) {
    throw new Error(`Tenant '${tenantId}' not found.`);
  }

  if (isProtectedTenantId(tenant.tenantId)) {
    throw new Error("The platform SYSTEM tenant can never be deleted.");
  }

  // Pre-delete snapshot for the surviving audit trail.
  const [users, studentProfiles, staffProfiles, feeVouchers, transactions] = await Promise.all([
    tx.user.count({ where: { tenantId } }).catch(() => 0),
    tx.studentProfile.count({ where: { tenantId } }).catch(() => 0),
    tx.staffProfile.count({ where: { tenantId } }).catch(() => 0),
    tx.feeVoucher.count({ where: { tenantId } }).catch(() => 0),
    tx.transaction.count({ where: { tenantId } }).catch(() => 0),
  ]);

  // Leaf-to-root FK order: dependents before the rows they reference.
  // (StudentProfile before Class; StaffProfile before User before StudentProfile
  // is handled by deleting StaffProfile -> User -> StudentProfile in sequence;
  // AcademicYear/FiscalYear/Class/Subject after their dependents.)
  await tx.graceMarkLedger.deleteMany({ where: { tenantId } });
  await tx.examComponentResult.deleteMany({ where: { tenantId } });
  await tx.studentWalletLedger.deleteMany({ where: { tenantId } });
  await tx.healthRecord.deleteMany({ where: { tenantId } });
  await tx.parentStudentLink.deleteMany({ where: { tenantId } });
  await tx.studentAcademicSession.deleteMany({ where: { tenantId } });
  await tx.classPromotion.deleteMany({ where: { tenantId } });
  await tx.feeInvoiceItem.deleteMany({ where: { tenantId } });
  await tx.journalLineItem.deleteMany({ where: { tenantId } });
  await tx.transaction.deleteMany({ where: { tenantId } });
  await tx.feeVoucher.deleteMany({ where: { tenantId } });
  await tx.studentFeeConcession.deleteMany({ where: { tenantId } });
  await tx.salaryLedger.deleteMany({ where: { tenantId } });
  await tx.attendance.deleteMany({ where: { tenantId } });
  await tx.homeworkSubmission.deleteMany({ where: { tenantId } });
  await tx.leaveApplication.deleteMany({ where: { tenantId } });
  await tx.bookIssue.deleteMany({ where: { tenantId } });
  await tx.transportAllocation.deleteMany({ where: { tenantId } });
  await tx.hostelAllocation.deleteMany({ where: { tenantId } });
  await tx.certificate.deleteMany({ where: { tenantId } });
  await tx.examResult.deleteMany({ where: { tenantId } });
  await tx.inventoryTransaction.deleteMany({ where: { tenantId } });
  await tx.teacherSubstitution.deleteMany({ where: { tenantId } });
  await tx.homework.deleteMany({ where: { tenantId } });
  await tx.calendarEvent.deleteMany({ where: { tenantId } });
  await tx.enquiry.deleteMany({ where: { tenantId } });
  await tx.question.deleteMany({ where: { tenantId } });
  await tx.questionPaperSet.deleteMany({ where: { tenantId } });
  await tx.questionPaperVersion.deleteMany({ where: { tenantId } });
  await tx.questionPaper.deleteMany({ where: { tenantId } });
  await tx.syllabusWeight.deleteMany({ where: { tenantId } });
  await tx.classSubject.deleteMany({ where: { tenantId } });
  await tx.subjectAssessmentComponent.deleteMany({ where: { tenantId } });
  await tx.examSubject.deleteMany({ where: { tenantId } });
  await tx.promotionRule.deleteMany({ where: { tenantId } });
  await tx.classFeeStructure.deleteMany({ where: { tenantId } });
  await tx.academicHoliday.deleteMany({ where: { tenantId } });
  await tx.applicantDocument.deleteMany({ where: { tenantId } });
  await tx.admissionApplication.deleteMany({ where: { tenantId } });
  await tx.expense.deleteMany({ where: { tenantId } });
  await tx.vehicleExpenseLog.deleteMany({ where: { tenantId } });
  await tx.transportRoute.deleteMany({ where: { tenantId } });
  await tx.journalEntry.deleteMany({ where: { tenantId } });
  await tx.financialPeriod.deleteMany({ where: { tenantId } });
  await tx.feeHead.deleteMany({ where: { tenantId } });
  // Self-referencing hierarchy: detach parents before deleting accounts.
  await tx.chartOfAccount.updateMany({ where: { tenantId }, data: { parentAccountId: null } });
  await tx.chartOfAccount.deleteMany({ where: { tenantId } });
  await tx.tenantVoucherSequence.deleteMany({ where: { tenantId } });
  await tx.timetable.deleteMany({ where: { tenantId } });
  await tx.expenseCategory.deleteMany({ where: { tenantId } });
  await tx.inventoryItem.deleteMany({ where: { tenantId } });
  await tx.book.deleteMany({ where: { tenantId } });
  await tx.hostelRoom.deleteMany({ where: { tenantId } });
  await tx.hostel.deleteMany({ where: { tenantId } });
  await tx.transportVehicle.deleteMany({ where: { tenantId } });
  await tx.exam.deleteMany({ where: { tenantId } });
  await tx.subject.deleteMany({ where: { tenantId } });
  await tx.section.deleteMany({ where: { tenantId } });
  await tx.group.deleteMany({ where: { tenantId } });
  await tx.class.deleteMany({ where: { tenantId } });
  await tx.staffProfile.deleteMany({ where: { tenantId } });
  await tx.user.deleteMany({ where: { tenantId } });
  await tx.studentProfile.deleteMany({ where: { tenantId } });
  await tx.academicYear.deleteMany({ where: { tenantId } });
  await tx.fiscalYear.deleteMany({ where: { tenantId } });
  await tx.auditLog.deleteMany({ where: { tenantId } });
  await tx.notice.deleteMany({ where: { tenantId } });
  await tx.bankAccount.deleteMany({ where: { tenantId } });
  await tx.subscriptionChangeLog.deleteMany({ where: { tenantId } });
  await tx.tenantSubscription.deleteMany({ where: { tenantId } });
  await tx.tenantFeatureOverride.deleteMany({ where: { tenantId } });

  await tx.tenant.delete({ where: { tenantId } });

  await logSuperAdminAction(tx, {
    context,
    targetTenantId: tenantId,
    actionType: "TENANT_FORCE_DELETE",
    details: {
      deletedTenantName: tenant.name,
      reason,
      counts: { users, studentProfiles, staffProfiles, feeVouchers, transactions },
    },
  });

  return {
    deletedTenantId: tenantId,
    deletedName: tenant.name,
    counts: { users, studentProfiles, staffProfiles, feeVouchers, transactions },
  };
}
