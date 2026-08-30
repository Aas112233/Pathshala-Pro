import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireApiAccess } from "@/lib/api-auth";
import { handleApiError, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, {
      permission: "payroll:read",
    });
    if ("response" in access) return access.response;
    const { user } = access.authContext;
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const department = searchParams.get("department");
    const status = searchParams.get("status");

    const whereClause: Prisma.SalaryLedgerWhereInput = {
      tenantId: user.tenantId,
    };

    if (year && year !== "all") {
      whereClause.year = parseInt(year, 10);
    }
    if (month && month !== "all") {
      whereClause.month = parseInt(month, 10);
    }
    if (status && status !== "all") {
      whereClause.status = status;
    }
    if (department && department !== "all") {
      whereClause.staffProfile = {
        department,
      };
    }

    const ledgers = await prisma.salaryLedger.findMany({
      where: whereClause,
      orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
    });

    const staffProfiles = await prisma.staffProfile.findMany({
      where: {
        tenantId: user.tenantId,
        id: { in: ledgers.map((ledger) => ledger.staffProfileId) },
      },
      select: {
        id: true,
        staffId: true,
        firstName: true,
        lastName: true,
        department: true,
        designation: true,
        phone: true,
      },
    });
    const staffById = new Map(staffProfiles.map((staffProfile) => [staffProfile.id, staffProfile]));

    let totalGross = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let totalDeductions = 0;
    const deptMap = new Map<string, { total: number; count: number }>();

    const transformedRecords = ledgers.map((l) => {
      const gross = l.baseSalary;
      const deductions = l.deductions + l.advances;
      // l.netPayable is a Prisma.Decimal (schema: Decimal(15,2), non-nullable).
      // Convert to a plain number immediately — leaving it as a Decimal and
      // returning it directly in the JSON response below would serialize it
      // as a *string* (Decimal.prototype.toJSON), while every sibling field
      // here (paidAmount, baseSalary, etc.) serializes as a JSON number.
      const net = l.netPayable.toNumber();
      const paid = l.paidAmount;
      const pending = Math.max(0, net - paid);

      totalGross += gross;
      totalPaid += paid;
      totalPending += pending;
      totalDeductions += deductions;

      const staffProfile = staffById.get(l.staffProfileId);
      const dept = staffProfile?.department || "General";
      const existingDept = deptMap.get(dept) || { total: 0, count: 0 };
      deptMap.set(dept, {
        total: existingDept.total + net,
        count: existingDept.count + 1,
      });

      return {
        id: l.id,
        staffId: staffProfile?.staffId || "N/A",
        staffName: staffProfile
          ? `${staffProfile.firstName} ${staffProfile.lastName}`.trim()
          : "Unknown Staff",
        department: staffProfile?.department || "N/A",
        designation: staffProfile?.designation || "N/A",
        month: l.month,
        year: l.year,
        period: `${l.month}/${l.year}`,
        baseSalary: gross,
        deductions,
        netPayable: net,
        paidAmount: paid,
        pendingAmount: pending,
        status: l.status,
        paidAt: l.paidAt ? l.paidAt.toISOString() : null,
      };
    });

    const departmentBreakdown = Array.from(deptMap.entries()).map(([department, val]) => ({
      department,
      amount: val.total,
      staffCount: val.count,
    }));

    const disbursementRate =
      totalGross > 0 ? Math.round((totalPaid / (totalGross - totalDeductions || 1)) * 100) : 0;

    return successResponse({
      metrics: {
        totalGross,
        totalPaid,
        totalPending,
        totalDeductions,
        disbursementRate,
        staffCount: ledgers.length,
      },
      departmentBreakdown,
      records: transformedRecords,
    });
  } catch (error) {
    return handleApiError(error, "Failed to generate salary payroll report");
  }
}
