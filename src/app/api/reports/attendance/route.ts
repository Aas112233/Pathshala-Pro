import { NextRequest } from "next/server";
import { requireApiAccess } from "@/lib/api-auth";
import { handleApiError, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { hasDateBounds, normalizeDateRange } from "@/lib/date-range-filter";
import { attendanceRateFromCounts } from "@/lib/attendance-rate";

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

    // Aggregate in the database: one grouped count per student per status,
    // rather than one row per attendance record joined to its student.
    //
    // Grouping by status rather than counting PRESENT separately is what lets
    // this report use the shared definition in `@/lib/attendance-rate`. The old
    // form could only see "present" and "everything else", which is precisely
    // why it counted holidays as absences.
    const statusRows = await prisma.attendance.groupBy({
      by: ["studentProfileId", "status"],
      where,
      _count: { _all: true },
    });

    const countsByStudent = new Map<string, Record<string, number>>();
    for (const row of statusRows) {
      if (!row.studentProfileId) continue;
      const counts = countsByStudent.get(row.studentProfileId) ?? {};
      counts[row.status] = (counts[row.status] ?? 0) + row._count._all;
      countsByStudent.set(row.studentProfileId, counts);
    }

    const aggregated = Array.from(countsByStudent.entries()).map(([studentId, counts]) => {
      const { rate, presentDays, totalDays, tracked } = attendanceRateFromCounts(counts);
      return {
        studentId,
        presentDays,
        // Days that were counted and not attended — holidays are in neither.
        absentDays: totalDays - presentDays,
        totalDays,
        tracked,
        attendancePercentage: rate,
        status: tracked ? statusFor(rate as number) : null,
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
          tracked: row.tracked,
          attendancePercentage: row.attendancePercentage,
          status: row.status,
        };
      })
      // Defaulters first — that is the reason an attendance report gets opened.
      // Students with nothing on file sort last: an unmarked class is not a
      // failing one, and listing them first would say that it is.
      .sort((a, b) => {
        if (a.attendancePercentage === null) {
          return b.attendancePercentage === null
            ? a.studentName.localeCompare(b.studentName)
            : 1;
        }
        if (b.attendancePercentage === null) return -1;
        return (
          a.attendancePercentage - b.attendancePercentage ||
          a.studentName.localeCompare(b.studentName)
        );
      });

    const totalCount = allRecords.length;
    const scored = allRecords.filter(
      (record): record is typeof record & { attendancePercentage: number } =>
        record.attendancePercentage !== null
    );
    const totalPresent = allRecords.reduce((sum, r) => sum + r.presentDays, 0);
    const totalAbsent = allRecords.reduce((sum, r) => sum + r.absentDays, 0);
    const defaulterCount = allRecords.filter((r) => r.status === "DEFICIT").length;
    // Averaged over the students who have attendance on file. Counting an
    // unmarked student as a zero would drag the school's figure down because a
    // class nobody has recorded yet.
    const averageAttendance =
      scored.length > 0
        ? Math.round(scored.reduce((sum, r) => sum + r.attendancePercentage, 0) / scored.length)
        : 0;

    // Class-wise rollup is computed over the whole filtered set, not the page —
    // a summary that changed as the user paged would be misleading.
    const classWiseMap = new Map<string, { total: number; sum: number }>();
    for (const record of scored) {
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
    //
    // A student with no attendance on file has `status: null` and is therefore
    // not a defaulter. Accusing them of poor attendance because nobody has
    // marked their class yet is the one mistake this list must not make.
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
