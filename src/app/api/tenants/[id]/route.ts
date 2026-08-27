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
    if (user.role !== "SYSTEM_ADMIN" && user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
      return unauthorized("Only system administrators can access tenant telemetry.");
    }

    const { id } = await params;

    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ id }, { tenantId: id }],
      },
      include: {
        users: {
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
        },
        academicYears: {
          where: { isClosed: false },
          take: 1,
        },
        _count: {
          select: {
            studentProfiles: true,
            staffProfiles: true,
            feeVouchers: true,
            transactions: true,
            attendances: true,
            examResults: true,
            classes: true,
            expenses: true,
            bankAccounts: true,
          },
        },
      },
    });

    if (!tenant) {
      return notFound("School tenant was not found.");
    }

    // Financial volume calculation
    const feeSummary = await prisma.feeVoucher.aggregate({
      where: { tenantId: tenant.tenantId },
      _sum: { totalDue: true, amountPaid: true, balance: true },
    });

    return successResponse({
      ...tenant,
      financials: {
        totalInvoiced: feeSummary._sum.totalDue || 0,
        totalCollected: feeSummary._sum.amountPaid || 0,
        totalBalanceDue: feeSummary._sum.balance || 0,
      },
      activeAcademicYear: tenant.academicYears[0] || null,
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
    if (user.role !== "SYSTEM_ADMIN" && user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
      return unauthorized("Only system administrators can modify tenant configurations.");
    }

    const { id } = await params;
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
        subscriptionStatus: body.subscriptionStatus ?? undefined,
        currency: body.currency ?? undefined,
        currencySymbol: body.currencySymbol ?? undefined,
        taxRate: body.taxRate !== undefined ? Number(body.taxRate) : undefined,
        dateFormat: body.dateFormat ?? undefined,
        timezone: body.timezone ?? undefined,
        gradingSystem: body.gradingSystem ?? undefined,
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
 * Suspend or purge a tenant
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
    if (user.role !== "SYSTEM_ADMIN" && user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
      return unauthorized("Only system administrators can delete or suspend tenants.");
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
