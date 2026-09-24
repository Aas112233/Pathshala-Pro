import { NextRequest } from "next/server";
import { requireApiAccess } from "@/lib/api-auth";
import { handleApiError, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { hasDateBounds, normalizeDateRange } from "@/lib/date-range-filter";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const TOP_PERFORMER_THRESHOLD = 90;
const FAILED_STUDENTS_LIMIT = 200;
const GRADE_ORDER = ["A+", "A", "B", "C", "D", "F"] as const;

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, {
      permission: "exams:read",
    });
    if ("response" in access) return access.response;

    const { user } = access.authContext;

    const searchParams = request.nextUrl.searchParams;
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const examType = searchParams.get("examType");
    const classId = searchParams.get("classId");
    const sectionId = searchParams.get("sectionId");
    const page = parsePositiveInt(searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    // Inclusive end-of-day. `new Date(toDate)` is midnight and silently dropped
    // every result recorded on the final day of the selected range.
    const range = normalizeDateRange(fromDate, toDate);

    // Class and Section were rendered in the UI but never read here, so a
    // class-scoped report returned school-wide figures.
    const studentScope: { classId?: string; sectionId?: string } = {};
    if (classId && classId !== "all") studentScope.classId = classId;
    if (sectionId && sectionId !== "all") studentScope.sectionId = sectionId;

    const where = {
      tenantId: user.tenantId,
      ...(Object.keys(studentScope).length > 0 && { studentProfile: studentScope }),
      exam: {
        ...(hasDateBounds(range) && { startDate: range }),
        ...(examType && examType !== "all" && { type: examType }),
      },
    };

    // Rollups are computed in the database. The previous implementation pulled
    // every matching ExamResult with its student, exam and subject joined, then
    // reduced in JavaScript — for a school sitting a full exam season that is
    // tens of thousands of rows serialized on every "Generate".
    const [
      totalResults,
      passCount,
      failCount,
      averageAggregate,
      topPerformers,
      gradeGroups,
      subjectGroups,
      classGroups,
      examGroups,
      pageRows,
      failedRows,
    ] = await Promise.all([
      prisma.examResult.count({ where }),
      prisma.examResult.count({ where: { ...where, status: "PASS" } }),
      prisma.examResult.count({ where: { ...where, status: "FAIL" } }),
      prisma.examResult.aggregate({ where, _avg: { percentage: true } }),
      prisma.examResult.count({
        where: { ...where, percentage: { gte: TOP_PERFORMER_THRESHOLD } },
      }),
      prisma.examResult.groupBy({ by: ["grade"], where, _count: { _all: true } }),
      prisma.examResult.groupBy({
        by: ["subjectId"],
        where,
        _count: { _all: true },
        _avg: { percentage: true },
      }),
      prisma.examResult.groupBy({
        by: ["studentProfileId"],
        where,
        _count: { _all: true },
        _avg: { percentage: true },
      }),
      prisma.examResult.groupBy({ by: ["examId"], where }),
      prisma.examResult.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          obtainedMarks: true,
          maxMarks: true,
          percentage: true,
          grade: true,
          status: true,
          studentProfile: {
            select: {
              firstName: true,
              lastName: true,
              rollNumber: true,
              class: { select: { name: true } },
              section: { select: { name: true } },
            },
          },
          exam: { select: { name: true, type: true } },
          subject: { select: { name: true } },
        },
      }),
      prisma.examResult.findMany({
        where: { ...where, status: "FAIL" },
        take: FAILED_STUDENTS_LIMIT,
        orderBy: [{ percentage: "asc" }],
        select: {
          id: true,
          obtainedMarks: true,
          maxMarks: true,
          percentage: true,
          grade: true,
          status: true,
          studentProfile: {
            select: {
              firstName: true,
              lastName: true,
              rollNumber: true,
              class: { select: { name: true } },
              section: { select: { name: true } },
            },
          },
          exam: { select: { name: true, type: true } },
          subject: { select: { name: true } },
        },
      }),
    ]);

    type ResultRow = (typeof pageRows)[number];

    const transform = (row: ResultRow) => ({
      id: row.id,
      studentName: `${row.studentProfile.firstName} ${row.studentProfile.lastName}`,
      className: row.studentProfile.class?.name || "N/A",
      section: row.studentProfile.section?.name || "N/A",
      rollNumber: row.studentProfile.rollNumber,
      examName: row.exam.name,
      examType: row.exam.type,
      subject: row.subject.name,
      marksObtained: row.obtainedMarks,
      maxMarks: row.maxMarks,
      percentage: Math.round(row.percentage),
      grade: row.grade,
      status: row.status,
    });

    const results = pageRows.map(transform);

    // Subject names are resolved in one extra query rather than by joining
    // every result row.
    const subjectIds = subjectGroups.map((g) => g.subjectId);
    const subjects = subjectIds.length
      ? await prisma.subject.findMany({
          where: { id: { in: subjectIds } },
          select: { id: true, name: true },
        })
      : [];
    const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));
    const subjectWise = subjectGroups
      .map((group) => ({
        subject: subjectNameById.get(group.subjectId) ?? "Unknown",
        averagePercentage: Math.round(group._avg.percentage ?? 0),
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject));

    // Class rollup: per-student averages are already grouped, so this reduces
    // over students rather than over individual results.
    const classStudentIds = classGroups.map((g) => g.studentProfileId);
    const classProfiles = classStudentIds.length
      ? await prisma.studentProfile.findMany({
          where: { tenantId: user.tenantId, id: { in: classStudentIds } },
          select: { id: true, class: { select: { name: true } } },
        })
      : [];
    const classById = new Map(classProfiles.map((p) => [p.id, p.class?.name || "N/A"]));

    const classWiseMap = new Map<string, { total: number; sum: number }>();
    for (const group of classGroups) {
      const className = classById.get(group.studentProfileId) ?? "N/A";
      const entry = classWiseMap.get(className) ?? { total: 0, sum: 0 };
      entry.total += 1;
      entry.sum += group._avg.percentage ?? 0;
      classWiseMap.set(className, entry);
    }
    const classWise = Array.from(classWiseMap.entries())
      .map(([className, data]) => ({
        className,
        averagePercentage: data.total > 0 ? Math.round(data.sum / data.total) : 0,
      }))
      .sort((a, b) => a.className.localeCompare(b.className));

    const gradeCounts = Object.fromEntries(GRADE_ORDER.map((grade) => [grade, 0])) as Record<
      (typeof GRADE_ORDER)[number],
      number
    >;
    for (const group of gradeGroups) {
      if (group.grade in gradeCounts) {
        gradeCounts[group.grade as (typeof GRADE_ORDER)[number]] = group._count._all;
      }
    }

    return successResponse({
      metrics: {
        totalExams: examGroups.length,
        passPercentage: totalResults > 0 ? Math.round((passCount / totalResults) * 100) : 0,
        averageMarks: Math.round(averageAggregate._avg.percentage ?? 0),
        topPerformers,
        totalResults,
        passCount,
        failCount,
      },
      gradeDistribution: gradeCounts,
      subjectWise,
      classWise,
      failedStudents: failedRows.map(transform),
      failedStudentsTruncated: failCount > failedRows.length,
      results,
      pagination: { page, pageSize, totalCount: totalResults },
      appliedScope: {
        classId: studentScope.classId ?? null,
        sectionId: studentScope.sectionId ?? null,
        examType: examType && examType !== "all" ? examType : null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
