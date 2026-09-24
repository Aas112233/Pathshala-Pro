import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccess } from "@/lib/api-auth";
import {
  successResponse,
  handleApiError,
} from "@/lib/api-response";
import {
  hasDateBounds,
  isWithinDateRange,
  normalizeDateRange,
} from "@/lib/date-range-filter";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, {
      // Declared explicitly rather than relying solely on the path map in
      // api-auth.ts. The path map still supplies the module gate, but an
      // undeclared guard is invisible to readers and disappears silently if
      // that map is ever edited. Verified behaviour-preserving: every role that
      // passes the `students` module gate also holds `students:read`.
      permission: "students:read",
    });
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;

    const searchParams = request.nextUrl.searchParams;
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const classId = searchParams.get("classId");
    const sectionId = searchParams.get("sectionId");
    const status = searchParams.get("status");
    const page = parsePositiveInt(searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER);
    const pageSize = parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    // Build date filter for admission date. Inclusive end bound — a bare
    // `new Date(toDate)` is UTC midnight and drops the whole final day.
    const admissionRange = normalizeDateRange(fromDate, toDate);

    // Build class/section filter
    const classFilter: any = {};
    if (classId && classId !== "all") {
      classFilter.classId = classId;
    }
    if (sectionId && sectionId !== "all") {
      classFilter.sectionId = sectionId;
    }

    // Build status filter
    const statusFilter: any = {};
    if (status && status !== "all") {
      statusFilter.status = status;
    }

    // Fetch students with related data
    const students = await prisma.studentProfile.findMany({
      where: {
        tenantId,
        ...(hasDateBounds(admissionRange) && {
          admissionDate: admissionRange,
        }),
        ...(Object.keys(classFilter).length > 0 && classFilter),
        ...(Object.keys(statusFilter).length > 0 && statusFilter),
      },
      include: {
        class: {
          select: {
            name: true,
          },
        },
        section: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate metrics
    const totalStudents = students.length;
    const activeStudents = students.filter((s: any) => s.status === "ACTIVE").length;
    // Uses the same inclusive end bound as the Prisma filter above, so the
    // headline metric and the row list can never disagree about the final day.
    const newAdmissions = students.filter((s: any) =>
      isWithinDateRange(s.admissionDate, fromDate, toDate)
    ).length;
    const transferredOut = students.filter((s: any) => s.status === "TRANSFERRED").length;
    const graduated = students.filter((s: any) => s.status === "GRADUATED").length;

    // Gender distribution
    const maleCount = students.filter((s: any) => s.gender === "MALE").length;
    const femaleCount = students.filter((s: any) => s.gender === "FEMALE").length;
    const otherCount = students.filter((s: any) => s.gender === "OTHER" || !s.gender).length;

    // Class-wise strength
    const classWiseMap = new Map<string, number>();
    students.forEach((student: any) => {
      const className = student.class?.name || "N/A";
      classWiseMap.set(className, (classWiseMap.get(className) || 0) + 1);
    });

    const classWiseData = Array.from(classWiseMap.entries()).map(([className, count]) => ({
      className,
      count,
    }));

    // Admission trend (monthly)
    const monthlyMap = new Map<string, number>();
    students.forEach((student: any) => {
      const month = student.admissionDate.toLocaleString("default", { month: "short" });
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + 1);
    });

    const admissionTrendData = Array.from(monthlyMap.entries()).map(([month, count]) => ({
      month,
      count,
    }));

    // Transform students for response
    const transformedStudents = students.map((student: any) => ({
      id: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      className: student.class?.name || "N/A",
      section: student.section?.name || "N/A",
      rollNumber: student.rollNumber,
      admissionNumber: student.studentId,
      gender: student.gender || "OTHER",
      status: student.status as "ACTIVE" | "INACTIVE" | "GRADUATED" | "TRANSFERRED",
      admissionDate: student.admissionDate.toISOString().split("T")[0],
      dateOfBirth: student.dateOfBirth?.toISOString().split("T")[0] || null,
      guardianName: student.guardianName,
      contactNumber: student.guardianContact,
    }));

    // The rows here are students, not transactional records, so the query is
    // already bounded by the size of the student body. Metrics and rollups are
    // therefore computed over the full filtered set (a summary that shifted as
    // the user paged would be misleading), while the response payload is
    // bounded by pageSize.
    const totalCount = transformedStudents.length;
    const start = (page - 1) * pageSize;
    const studentsPage = transformedStudents.slice(start, start + pageSize);

    return successResponse({
      metrics: {
        totalStudents,
        activeStudents,
        newAdmissions,
        transferredOut,
        graduated,
      },
      genderDistribution: {
        male: maleCount,
        female: femaleCount,
        other: otherCount,
      },
      classWise: classWiseData,
      admissionTrend: admissionTrendData,
      students: studentsPage,
      pagination: { page, pageSize, totalCount },
      appliedScope: {
        classId: classFilter.classId ?? null,
        sectionId: classFilter.sectionId ?? null,
        status: statusFilter.status ?? null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
