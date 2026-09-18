import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, handleApiError } from "@/lib/api-response";
import { requireApiAccess, getSelfScopedStudentProfileIds } from "@/lib/api-auth";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";
import { roundCurrency, safePercentage } from "@/lib/math-utils";
import { resolveRequestAcademicYearId } from "@/lib/academic-year-guards";
import { fastCache } from "@/lib/fast-memory-cache";

/**
 * GET /api/dashboard/summary
 * One cached aggregate for the dashboard KPI cards scoped to the active academic year.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { allowUnmapped: true });
    if ("response" in access) return access.response;

    const { user, tenantId } = access.authContext;
    const perms = getEffectivePermissions(
      user.role as string,
      user.permissions as any,
      (user as any).accessLevel ?? null
    );

    const canReadStudents =
      user.role === "SUPER_ADMIN" ||
      user.role === "ADMIN" ||
      hasPermission(perms, "students", "read");
    const canReadStaff =
      user.role === "SUPER_ADMIN" ||
      user.role === "ADMIN" ||
      hasPermission(perms, "staff", "read");
    const canReadFees =
      user.role === "SUPER_ADMIN" ||
      user.role === "ADMIN" ||
      hasPermission(perms, "fees", "read");

    // STUDENT/PARENT tokens only ever see their own (or linked children's) rows.
    const selfScope = await getSelfScopedStudentProfileIds(access.authContext);

    const academicYearIdParam = request.nextUrl.searchParams.get("academicYearId");
    const resolvedAcademicYearId = academicYearIdParam
      ? academicYearIdParam.trim()
      : await resolveRequestAcademicYearId(request, tenantId);

    const studentWhere: any = { tenantId };
    if (selfScope) studentWhere.id = { in: selfScope };
    const feeWhere: any = { tenantId };
    if (selfScope) feeWhere.studentProfileId = { in: selfScope };
    if (resolvedAcademicYearId && resolvedAcademicYearId !== "ALL") {
      feeWhere.academicYearId = resolvedAcademicYearId;
    }
    const attendanceWhere: any = { tenantId };
    if (selfScope) attendanceWhere.studentProfileId = { in: selfScope };

    const cacheKey = `dash_summary:${tenantId}:${user.id}:${resolvedAcademicYearId || "def"}:${canReadStudents}:${canReadStaff}:${canReadFees}:${selfScope?.join(",") || "all"}`;
    const cached = fastCache.get<any>(cacheKey);
    if (cached) {
      return successResponse(cached);
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const [rawTotalStudents, totalStaff, feeAgg, attendanceGroups, yearSessionCount] = await Promise.all([
      canReadStudents
        ? prisma.studentProfile.count({ where: studentWhere })
        : Promise.resolve(0),
      canReadStaff
        ? prisma.staffProfile.count({ where: { tenantId } })
        : Promise.resolve(0),
      canReadFees
        ? prisma.feeVoucher.aggregate({
            where: feeWhere,
            _count: true,
            _sum: { totalDue: true, amountPaid: true, balance: true },
          })
        : Promise.resolve({ _count: 0, _sum: { totalDue: 0, amountPaid: 0, balance: 0 } }),
      prisma.attendance.groupBy({
        by: ["status"],
        where: { ...attendanceWhere, date: { gte: startOfToday, lt: startOfTomorrow } },
        _count: true,
      }),
      canReadStudents && resolvedAcademicYearId && !selfScope
        ? prisma.studentAcademicSession.count({
            where: { tenantId, academicYearId: resolvedAcademicYearId },
          })
        : Promise.resolve(0),
    ]);

    const totalStudents = yearSessionCount > 0 ? yearSessionCount : rawTotalStudents;

    let present = 0;
    let absent = 0;
    let attendanceTotal = 0;
    for (const g of attendanceGroups) {
      attendanceTotal += g._count;
      if (g.status === "PRESENT") present += g._count;
      else if (g.status === "ABSENT") absent += g._count;
    }

    const summaryData = {
      totalStudents,
      totalStaff,
      fees: {
        totalCount: feeAgg._count,
        totalDue: roundCurrency(feeAgg._sum.totalDue ?? 0),
        amountPaid: roundCurrency(feeAgg._sum.amountPaid ?? 0),
        balance: roundCurrency(feeAgg._sum.balance ?? 0),
      },
      attendance: {
        present,
        absent,
        total: attendanceTotal,
        rate: safePercentage(present, attendanceTotal, 1),
      },
    };

    fastCache.set(cacheKey, summaryData, 30); // 30s cache

    return successResponse(summaryData);
  } catch (error) {
    return handleApiError(error, "Failed to load dashboard summary");
  }
}
