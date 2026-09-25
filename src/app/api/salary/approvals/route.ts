import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { resolveRequestAcademicYearId } from "@/lib/academic-year-guards";
import { MAX_PAGE_SIZE } from "@/lib/constants";
import { Prisma } from "@prisma/client";

/**
 * GET /api/salary/approvals
 * Lists salary ledgers for the approval queue with summary KPIs
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { permission: "payroll:read" });
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), MAX_PAGE_SIZE);
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const status = searchParams.get("status") || "";
    const department = searchParams.get("department") || "";
    const search = searchParams.get("search")?.trim() || "";
    const academicYearIdParam = searchParams.get("academicYearId") || "";
    const academicYearId =
      academicYearIdParam ||
      (await resolveRequestAcademicYearId(request, tenantId)) ||
      "";

    const skip = (page - 1) * limit;

    const where: Prisma.SalaryLedgerWhereInput = { tenantId };

    if (academicYearId && academicYearId !== "ALL") where.academicYearId = academicYearId;
    if (month && month !== "all") where.month = parseInt(month);
    if (year && year !== "all") where.year = parseInt(year);

    if (status && status !== "ALL") {
      if (status === "PENDING" || status === "PENDING_APPROVAL") {
        where.status = { in: ["PENDING", "PENDING_APPROVAL"] };
      } else {
        where.status = status;
      }
    }

    const staffConditions: Prisma.StaffProfileWhereInput = {};
    if (department && department !== "all") {
      staffConditions.department = department;
    }
    if (search) {
      staffConditions.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { staffId: { contains: search, mode: "insensitive" } },
      ];
    }
    if (Object.keys(staffConditions).length > 0) {
      where.staffProfile = { is: staffConditions };
    }

    // 1. Fetch paginated ledgers with relations
    const [totalCount, salaryLedgers, allPeriodLedgers] = await Promise.all([
      prisma.salaryLedger.count({ where }),
      prisma.salaryLedger.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
        include: {
          staffProfile: {
            select: {
              staffId: true,
              firstName: true,
              lastName: true,
              designation: true,
              department: true,
              baseSalary: true,
            },
          },
          academicYear: {
            select: {
              yearId: true,
              label: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      // KPI summary calculation scoped to tenant and active month/year filters
      prisma.salaryLedger.findMany({
        where: {
          tenantId,
          ...(month && month !== "all" ? { month: parseInt(month) } : {}),
          ...(year && year !== "all" ? { year: parseInt(year) } : {}),
        },
        select: {
          status: true,
          netPayable: true,
          paidAmount: true,
        },
      }),
    ]);

    // 2. Compute KPIs
    let pendingCount = 0;
    let pendingAmount = new Prisma.Decimal(0);
    let approvedCount = 0;
    let approvedAmount = new Prisma.Decimal(0);
    let disbursedCount = 0;
    let disbursedAmount = new Prisma.Decimal(0);
    let rejectedCount = 0;

    for (const item of allPeriodLedgers) {
      const net = new Prisma.Decimal(item.netPayable);
      if (item.status === "PENDING" || item.status === "PENDING_APPROVAL") {
        pendingCount++;
        pendingAmount = pendingAmount.add(net);
      } else if (item.status === "APPROVED") {
        approvedCount++;
        approvedAmount = approvedAmount.add(net);
      } else if (item.status === "PAID" || item.status === "PARTIAL") {
        disbursedCount++;
        disbursedAmount = disbursedAmount.add(new Prisma.Decimal(item.paidAmount));
      } else if (item.status === "REJECTED") {
        rejectedCount++;
      }
    }

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      success: true,
      error: false,
      data: salaryLedgers,
      pagination: {
        totalCount,
        currentPage: page,
        pageSize: limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      metrics: {
        pendingCount,
        pendingAmount: pendingAmount.toNumber(),
        approvedCount,
        approvedAmount: approvedAmount.toNumber(),
        disbursedCount,
        disbursedAmount: disbursedAmount.toNumber(),
        rejectedCount,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
