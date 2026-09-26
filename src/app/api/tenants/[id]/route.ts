import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  handleApiError,
  safeParseBody,
} from "@/lib/api-response";
import { requireApiAccess, invalidateTenantModulesCache } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/audit-logger";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";
import { getTenantSubscription } from "@/lib/subscription-service";
import { resolveTenantModules } from "@/lib/tenant-modules";
import { forceDeleteTenantSchema } from "@/lib/schemas";
import { forceDeleteTenant, isProtectedTenantId } from "@/lib/superadmin-service";
import { resolveActiveAcademicYear } from "@/lib/academic-year-guards";

/**
 * GET /api/tenants/[id]
 * Get 360-degree telemetry and details of a school tenant
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request, {
      allowSystemAdmin: true,
    });
    if ("response" in access) return access.response;

    const { user } = access.authContext;
    const isPlatformAdmin = user.role === "SYSTEM_ADMIN" || isPlatformOwnerEmail(user.email) || access.authContext.isImpersonated;

    const { id } = await params;
    if (!isPlatformAdmin && id !== user.tenantId) {
      return unauthorized("Only platform system administrators can access other tenant telemetry.");
    }

    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ id }, { tenantId: id }],
      },
      include: {
        featureOverride: true,
      },
    });

    if (!tenant) {
      return notFound("School tenant was not found.");
    }

    const [users, activeAcademicYear, studentCount, staffCount, feeVoucherCount, transactionCount, attendanceCount, examResultCount, classCount, expenseCount, bankAccountCount, subscription] = await Promise.all([
      prisma.user.findMany({
        where: { tenantId: tenant.tenantId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      // Resolved through the same hierarchy every other surface uses
      // (`isCurrent` first), not "newest open year by startDate": during a
      // normal rollover the next year is opened before the current one closes,
      // and both cover today — the newest-open guess names a different year
      // than the one the institute is actually operating in.
      (async () => {
        const resolution = await resolveActiveAcademicYear(tenant.tenantId);
        if (!resolution.id) return null;
        return prisma.academicYear.findFirst({
          where: { tenantId: tenant.tenantId, id: resolution.id },
        });
      })(),
      prisma.studentProfile.count({ where: { tenantId: tenant.tenantId } }),
      prisma.staffProfile.count({ where: { tenantId: tenant.tenantId } }),
      prisma.feeVoucher.count({ where: { tenantId: tenant.tenantId } }),
      prisma.transaction.count({ where: { tenantId: tenant.tenantId } }),
      prisma.attendance.count({ where: { tenantId: tenant.tenantId } }),
      prisma.examResult.count({ where: { tenantId: tenant.tenantId } }),
      prisma.class.count({ where: { tenantId: tenant.tenantId } }),
      prisma.expense.count({ where: { tenantId: tenant.tenantId } }),
      prisma.bankAccount.count({ where: { tenantId: tenant.tenantId } }),
      getTenantSubscription(prisma as any, tenant.tenantId),
    ]);

    const counts = {
      studentProfiles: studentCount,
      staffProfiles: staffCount,
      feeVouchers: feeVoucherCount,
      transactions: transactionCount,
      attendances: attendanceCount,
      examResults: examResultCount,
      classes: classCount,
      expenses: expenseCount,
      bankAccounts: bankAccountCount,
    };

    // Financial volume calculation
    const feeSummary = await prisma.feeVoucher.aggregate({
      where: { tenantId: tenant.tenantId },
      _sum: { totalDue: true, amountPaid: true, balance: true },
    });

    return successResponse({
      ...tenant,
      users,
      _count: counts,
      financials: {
        totalInvoiced: feeSummary._sum.totalDue || 0,
        totalCollected: feeSummary._sum.amountPaid || 0,
        totalBalanceDue: feeSummary._sum.balance || 0,
      },
      activeAcademicYear: activeAcademicYear || null,
      subscription: subscription
        ? {
            planCode: subscription.plan?.code ?? null,
            planName: subscription.plan?.name ?? null,
            status: subscription.status,
            subscriptionEndAt: subscription.subscriptionEndAt,
            currentPeriodEnd: subscription.currentPeriodEnd,
            gracePeriodDays: subscription.gracePeriodDays,
            graceEndsAt: subscription.graceEndsAt,
          }
        : null,
      moduleAccess: resolveTenantModules(tenant.featureFlags, tenant.featureOverride),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/tenants/[id]
 * Update school tenant configuration, subscription status, or plan
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request, {
      allowSystemAdmin: true,
    });
    if ("response" in access) return access.response;

    const { user } = access.authContext;
    const isPlatformAdmin = user.role === "SYSTEM_ADMIN" || isPlatformOwnerEmail(user.email) || access.authContext.isImpersonated;

    const { id } = await params;
    if (!isPlatformAdmin && id !== user.tenantId) {
      return unauthorized("Only platform system administrators can modify other tenant configurations.");
    }

    const body = await request.json();

    const existingTenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ id }, { tenantId: id }],
      },
    });

    if (!existingTenant) {
      return notFound("Tenant was not found.");
    }

    if (isProtectedTenantId(existingTenant.tenantId) && !isPlatformOwnerEmail(user.email)) {
      return forbidden("Protected system tenant presets can only be modified by the platform owner.");
    }

    let updatedFeatureFlags = undefined;
    if (isPlatformAdmin && body.featureFlags && typeof body.featureFlags === "object") {
      updatedFeatureFlags = {
        ...resolveTenantModules(existingTenant.featureFlags, null),
        ...body.featureFlags,
      };
    }

    const updated = await prisma.tenant.update({
      where: { id: existingTenant.id },
      data: {
        name: body.name ?? undefined,
        subscriptionStatus: isPlatformAdmin ? body.subscriptionStatus ?? undefined : undefined,
        currency: body.currency ?? undefined,
        currencySymbol: body.currencySymbol ?? undefined,
        taxRate: body.taxRate !== undefined ? Number(body.taxRate) : undefined,
        dateFormat: body.dateFormat ?? undefined,
        timezone: body.timezone ?? undefined,
        gradingSystem: body.gradingSystem ?? undefined,
        curriculum: body.curriculum ?? undefined,
        maxGracePerSubject: body.maxGracePerSubject !== undefined ? Number(body.maxGracePerSubject) : undefined,
        maxGracePerStudent: body.maxGracePerStudent !== undefined ? Number(body.maxGracePerStudent) : undefined,
        featureFlags: updatedFeatureFlags ?? undefined,
        // Session policy is platform-admin-only like subscriptionStatus.
        allowConcurrentSessions:
          isPlatformAdmin && typeof body.allowConcurrentSessions === "boolean"
            ? body.allowConcurrentSessions
            : undefined,
      } as any,
    });

    if (updatedFeatureFlags) {
      await prisma.tenantFeatureOverride.upsert({
        where: { tenantId: existingTenant.tenantId },
        create: {
          tenantId: existingTenant.tenantId,
          hasHostel: updatedFeatureFlags.hostel ?? true,
          hasTransport: updatedFeatureFlags.transport ?? true,
          hasPayroll: updatedFeatureFlags.payroll ?? true,
        },
        update: {
          hasHostel: updatedFeatureFlags.hostel ?? true,
          hasTransport: updatedFeatureFlags.transport ?? true,
          hasPayroll: updatedFeatureFlags.payroll ?? true,
        },
      });
    }

    invalidateTenantModulesCache(existingTenant.tenantId);

    await logAuditEvent({
      tenantId: existingTenant.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: "UPDATE",
      entity: "Tenant",
      entityId: existingTenant.id,
      details: {
        updatedFields: body,
        updatedBy: user.email,
      },
    });

    return successResponse(updated, "School configuration updated successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/tenants/[id]
 * Default: suspend the tenant (Strictly Platform SuperAdmin only).
 * Hard wipe: DELETE /api/tenants/[id]?mode=hard with a validated
 * forceDeleteTenantSchema body (typed tenant ID + name confirmations,
 * explicit acknowledgement, and reason). Irreversible.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request, {
      allowSystemAdmin: true,
    });
    if ("response" in access) return access.response;

    const { user } = access.authContext;
    const isPlatformAdmin = user.role === "SYSTEM_ADMIN" || isPlatformOwnerEmail(user.email) || access.authContext.isImpersonated;
    if (!isPlatformAdmin) {
      return unauthorized("Only platform system administrators can delete or suspend tenants.");
    }

    const { id } = await params;

    const existingTenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ id }, { tenantId: id }],
      },
    });

    if (!existingTenant) {
      return notFound("Tenant was not found.");
    }

    // Irreversible full wipe — triple-confirmed by the 3-step UI.
    if (request.nextUrl.searchParams.get("mode") === "hard") {
      if (isProtectedTenantId(existingTenant.tenantId) || isProtectedTenantId(id)) {
        return badRequest("The platform SYSTEM tenant can never be deleted.", [
          {
            field: "confirmTenantId",
            code: "protected",
            message: "The platform SYSTEM tenant is protected from deletion.",
          },
        ]);
      }

      const bodyResult = await safeParseBody(request, forceDeleteTenantSchema);
      if (!bodyResult.success) return bodyResult.errorResponse;
      const { confirmTenantId, confirmName, reason } = bodyResult.data;

      if (confirmTenantId.trim() !== existingTenant.tenantId) {
        return badRequest(
          `[Field 'confirmTenantId', Code: mismatch] Typed tenant ID does not match '${existingTenant.tenantId}'.`,
          [
            {
              field: "confirmTenantId",
              code: "mismatch",
              message: `Typed tenant ID does not match '${existingTenant.tenantId}'.`,
            },
          ]
        );
      }

      if (confirmName.trim() !== existingTenant.name) {
        return badRequest(
          `[Field 'confirmName', Code: mismatch] Typed school name does not match '${existingTenant.name}'.`,
          [
            {
              field: "confirmName",
              code: "mismatch",
              message: `Typed school name does not match '${existingTenant.name}'.`,
            },
          ]
        );
      }

      const forwarded = request.headers.get("x-forwarded-for");
      const ipAddress = forwarded?.split(",")[0]?.trim() || undefined;

      const result = await prisma.$transaction(
        async (tx) =>
          forceDeleteTenant(tx as any, {
            tenantId: existingTenant.tenantId,
            reason: reason.trim(),
            context: {
              adminUserId: user.id,
              adminEmail: user.email,
              ipAddress,
              userAgent: request.headers.get("user-agent") || undefined,
            },
          }),
        { maxWait: 20000, timeout: 120000 }
      );

      return successResponse(
        result,
        `School ${existingTenant.name} and all of its data have been permanently deleted.`
      );
    }

    // Safety guard: Mark as SUSPENDED rather than hard delete if records exist
    const updated = await prisma.tenant.update({
      where: { id: existingTenant.id },
      data: { subscriptionStatus: "SUSPENDED" },
    });

    await logAuditEvent({
      tenantId: existingTenant.tenantId,
      userId: user.id,
      userEmail: user.email,
      action: "UPDATE",
      entity: "Tenant",
      entityId: existingTenant.id,
      details: { status: "SUSPENDED", note: "School suspended by System Admin" },
    });

    return successResponse(updated, `School ${existingTenant.name} has been suspended.`);
  } catch (error) {
    return handleApiError(error);
  }
}
