import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  unauthorized,
  notFound,
  badRequest,
  handleApiError,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/audit-logger";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";

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
    });

    if (!tenant) {
      return notFound("School tenant was not found.");
    }

    const [users, activeAcademicYear, studentCount, staffCount, feeVoucherCount, transactionCount, attendanceCount, examResultCount, classCount, expenseCount, bankAccountCount] = await Promise.all([
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
      prisma.academicYear.findFirst({
        where: { tenantId: tenant.tenantId, isClosed: false },
        orderBy: { startDate: "desc" },
      }),
      prisma.studentProfile.count({ where: { tenantId: tenant.tenantId } }),
      prisma.staffProfile.count({ where: { tenantId: tenant.tenantId } }),
      prisma.feeVoucher.count({ where: { tenantId: tenant.tenantId } }),
      prisma.transaction.count({ where: { tenantId: tenant.tenantId } }),
      prisma.attendance.count({ where: { tenantId: tenant.tenantId } }),
      prisma.examResult.count({ where: { tenantId: tenant.tenantId } }),
      prisma.class.count({ where: { tenantId: tenant.tenantId } }),
      prisma.expense.count({ where: { tenantId: tenant.tenantId } }),
      prisma.bankAccount.count({ where: { tenantId: tenant.tenantId } }),
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
      },
    });

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
 * Suspend or purge a tenant (Strictly Platform SuperAdmin only)
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
