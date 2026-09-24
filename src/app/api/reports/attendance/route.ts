import { NextRequest } from "next/server";
import { requireApiAccess } from "@/lib/api-auth";
import { handleApiError, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { hasDateBounds, normalizeDateRange } from "@/lib/date-range-filter";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFICIT_THRESHOLD = 75;
const AVERAGE_THRESHOLD = 85;
const DEFAULTER_LIST_LIMIT = 100;

type AttendanceStatus = "GOOD" | "AVERAGE" | "DEFICIT";

function statusFor(percentage: number): AttendanceStatus {
  if (percentage < DEFICIT_THRESHOLD) return "DEFICIT";
  if (percentage < AVERAGE_THRESHOLD) return "AVERAGE";
  return "GOOD";
}

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, {
      permission: "attendance:read",
    });
    if ("response" in access) return access.response;

    const { user } = access.authContext;

    const searchParams = request.nextUrl.searchParams;
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const classId = searchParams.get("classId");
    const sectionId = searchParams.get("sectionId");
    const page = parsePositiveInt(searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    // Inclusive end-of-day: `new Date(toDate)` alone is midnight and would drop
    // the whole final day of the selected range.
    const range = normalizeDateRange(fromDate, toDate);

    // Class / section were previously accepted by the UI but never applied, so a
    // "Class 9 Section B" report returned whole-school figures. Scope the rows by
    // the student's placement instead.
    const studentScope: { classId?: string; sectionId?: string } = {};
    if (classId && classId !== "all") studentScope.classId = classId;
    if (sectionId && sectionId !== "all") studentScope.sectionId = sectionId;

    const where = {
      tenantId: user.tenantId,
      studentProfileId: { not: null },
      ...(hasDateBounds(range) && { date: range }),
      ...(Object.keys(studentScope).length > 0 && { studentProfile: studentScope }),
    };

    // Aggregate in the database: two grouped counts return one row per student
    // rather than one row per attendance record joined to its student.
    const [totals, presents] = await Promise.all([
      prisma.attendance.groupBy({
        by: ["studentProfileId"],
        where,
        _count: { _all: true },
      }),
      prisma.attendance.groupBy({
        by: ["studentProfileId"],
        where: { ...where, status: "PRESENT" },
        _count: { _all: true },
      }),
    ]);

    const presentByStudent = new Map<string, number>();
    for (const row of presents) {
      if (row.studentProfileId) presentByStudent.set(row.studentProfileId, row._count._all);
    }

    const aggregated = totals
      .filter((row): row is typeof row & { studentProfileId: string } => Boolean(row.studentProfileId))
      .map((row) => {
        const totalDays = row._count._all;
        const presentDays = presentByStudent.get(row.studentProfileId) ?? 0;
        const absentDays = totalDays - presentDays;
        const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
        return {
          studentId: row.studentProfileId,
          presentDays,
          absentDays,
          totalDays,
          attendancePercentage,
          status: statusFor(attendancePercentage),
        };
      });

    // Profiles are needed for names and class-wise rollup, so fetch them for the
    // aggregated students only (one small row per student, not per attendance).
    const profiles = await prisma.studentProfile.findMany({
      where: { tenantId: user.tenantId, id: { in: aggregated.map((r) => r.studentId) } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        rollNumber: true,
        class: { select: { name: true } },
        section: { select: { name: true } },
      },
    });
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const allRecords = aggregated
      .map((row) => {
        const profile = profileById.get(row.studentId);
        return {
          id: row.studentId,
          studentId: row.studentId,
          studentName: profile ? `${profile.firstName} ${profile.lastName}` : "Unknown",
          className: profile?.class?.name || "N/A",
          section: profile?.section?.name || "N/A",
          rollNumber: profile?.rollNumber ?? "",
          presentDays: row.presentDays,
          absentDays: row.absentDays,
          totalDays: row.totalDays,
          attendancePercentage: row.attendancePercentage,
          status: row.status,
        };
      })
      // Defaulters first — that is the reason an attendance report gets opened.
      .sort(
        (a, b) =>
          a.attendancePercentage - b.attendancePercentage ||
          a.studentName.localeCompare(b.studentName)
      );

    const totalCount = allRecords.length;
    const totalPresent = allRecords.reduce((sum, r) => sum + r.presentDays, 0);
    const totalAbsent = allRecords.reduce((sum, r) => sum + r.absentDays, 0);
    const defaulterCount = allRecords.filter((r) => r.status === "DEFICIT").length;
    const averageAttendance =
      totalCount > 0
        ? Math.round(allRecords.reduce((sum, r) => sum + r.attendancePercentage, 0) / totalCount)
        : 0;

    // Class-wise rollup is computed over the whole filtered set, not the page —
    // a summary that changed as the user paged would be misleading.
    const classWiseMap = new Map<string, { total: number; sum: number }>();
    for (const record of allRecords) {
      const entry = classWiseMap.get(record.className) ?? { total: 0, sum: 0 };
      entry.total += 1;
      entry.sum += record.attendancePercentage;
      classWiseMap.set(record.className, entry);
    }
    const classWise = Array.from(classWiseMap.entries())
      .map(([className, data]) => ({
        className,
        averagePercentage: data.total > 0 ? Math.round(data.sum / data.total) : 0,
      }))
      .sort((a, b) => a.className.localeCompare(b.className));

    const start = (page - 1) * pageSize;
    const records = allRecords.slice(start, start + pageSize);

    // The defaulter panel is derived from the whole filtered set, not the page —
    // otherwise it would change as the user paged, and a page of well-attending
    // students would show an empty panel while defaulters existed elsewhere.
    const defaulterList = allRecords.filter((r) => r.status === "DEFICIT");

    return successResponse({
      metrics: {
        averageAttendance,
        totalPresent,
        totalAbsent,
        defaulterCount,
        totalStudents: totalCount,
      },
      records,
      classWise,
      defaulters: defaulterList.slice(0, DEFAULTER_LIST_LIMIT),
      defaultersTruncated: defaulterList.length > DEFAULTER_LIST_LIMIT,
      pagination: { page, pageSize, totalCount },
      appliedScope: {
        classId: studentScope.classId ?? null,
        sectionId: studentScope.sectionId ?? null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
