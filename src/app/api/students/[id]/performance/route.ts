import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFound,
  badRequest,
  handleApiError,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { calculateStudentPerformanceInsights } from "@/lib/student-performance";
import { GradingSystemType } from "@/lib/grading";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/students/[id]/performance
 * Returns 360-degree academic performance and customized metrics for a student
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { id } = await params;
    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);
    const academicYearIdParam = searchParams.get("academicYearId");

    // 1. Fetch Student Profile
    const student = await prisma.studentProfile.findFirst({
      where: {
        tenantId,
        OR: [
          { id },
          { studentId: id },
        ],
      },
      include: {
        class: {
          select: {
            id: true,
            classId: true,
            name: true,
            classNumber: true,
          },
        },
        section: {
          select: {
            id: true,
            name: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!student) {
      return notFound("Student profile not found");
    }

    // 2. Resolve Academic Year
    let academicYear = null;
    if (academicYearIdParam) {
      academicYear = await prisma.academicYear.findFirst({
        where: { id: academicYearIdParam, tenantId },
      });
    }

    if (!academicYear) {
      // Pick active/latest academic year
      academicYear = await prisma.academicYear.findFirst({
        where: { tenantId, isClosed: false },
        orderBy: { startDate: "desc" },
      });
    }

    if (!academicYear) {
      academicYear = await prisma.academicYear.findFirst({
        where: { tenantId },
        orderBy: { startDate: "desc" },
      });
    }

    const academicYearId = academicYear?.id || "";
    const academicYearLabel = academicYear?.label || "Current Session";

    // 3. Fetch Tenant Settings for Grading System
    const tenant = await prisma.tenant.findUnique({
      where: { tenantId },
      select: { gradingSystem: true },
    });
    const gradingSystem = (tenant?.gradingSystem as GradingSystemType) || "GPA";

    // 4. Fetch Student's Exam Results
    const examResults = await prisma.examResult.findMany({
      where: {
        tenantId,
        studentProfileId: student.id,
        ...(academicYearId && { academicYearId }),
      },
      include: {
        exam: {
          select: {
            id: true,
            name: true,
            type: true,
            startDate: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // 5. Fetch Classmate Results for Cohort Rankings & Class Average Benchmarking
    let classmateResults: Array<{
      studentProfileId: string;
      studentName: string;
      rollNumber: string;
      results: Array<{
        subjectName: string;
        subjectCode: string;
        maxMarks: number;
        obtainedMarks: number;
      }>;
    }> = [];

    if (student.classId) {
      const classmates = await prisma.studentProfile.findMany({
        where: {
          tenantId,
          classId: student.classId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          rollNumber: true,
        },
      });

      const classmateIds = classmates.map((c) => c.id);
      const allClassResults = await prisma.examResult.findMany({
        where: {
          tenantId,
          studentProfileId: { in: classmateIds },
          ...(academicYearId && { academicYearId }),
        },
        include: {
          subject: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      });

      const mapByStudent = new Map<string, typeof classmateResults[0]>();
      classmates.forEach((c) => {
        mapByStudent.set(c.id, {
          studentProfileId: c.id,
          studentName: `${c.firstName} ${c.lastName}`.trim(),
          rollNumber: c.rollNumber,
          results: [],
        });
      });

      allClassResults.forEach((r) => {
        const cm = mapByStudent.get(r.studentProfileId);
        if (cm) {
          cm.results.push({
            subjectName: r.subject?.name || "Subject",
            subjectCode: r.subject?.code || "SUB",
            maxMarks: r.maxMarks,
            obtainedMarks: r.obtainedMarks,
          });
        }
      });

      classmateResults = Array.from(mapByStudent.values());
    }

    // 6. Fetch Student's Attendance
    const attendances = await prisma.attendance.findMany({
      where: {
        tenantId,
        studentProfileId: student.id,
        ...(academicYearId && { academicYearId }),
      },
      select: {
        status: true,
      },
    });

    // 7. Fetch Student's Homework Submissions
    const homeworkSubmissions = await prisma.homeworkSubmission.findMany({
      where: {
        tenantId,
        studentProfileId: student.id,
      },
      select: {
        status: true,
        grade: true,
        submittedAt: true,
      },
    });

    const formattedHomework = homeworkSubmissions.map((h) => ({
      status: h.status,
      isLate: h.status === "LATE",
      marksObtained: h.grade === "A+" || h.grade === "A" ? 95 : h.grade === "B" ? 80 : 70,
      maxMarks: 100,
    }));

    // 8. Transform and Calculate 360-Degree Insights
    const formattedExamResults = examResults.map((r) => ({
      id: r.id,
      examId: r.examId,
      examTitle: r.exam?.name || "Term Exam",
      examType: r.exam?.type || "EXAM",
      examDate: r.exam?.startDate,
      term: r.exam?.name || "Term 1",
      subjectId: r.subjectId,
      subjectName: r.subject?.name || "Subject",
      subjectCode: r.subject?.code || "SUB",
      obtainedMarks: r.obtainedMarks,
      maxMarks: r.maxMarks,
    }));

    const overview = calculateStudentPerformanceInsights({
      student: {
        id: student.id,
        studentId: student.studentId,
        rollNumber: student.rollNumber,
        firstName: student.firstName,
        lastName: student.lastName,
        firstNameBn: student.firstNameBn,
        lastNameBn: student.lastNameBn,
        gender: student.gender,
        avatarUrl: student.profilePictureUrl,
        class: student.class,
        section: student.section,
        group: student.group,
        admissionDate: student.admissionDate,
        status: student.status,
      },
      academicYear: {
        id: academicYearId,
        label: academicYearLabel,
      },
      examResults: formattedExamResults,
      classmateResults,
      attendances,
      homeworkSubmissions: formattedHomework,
      totalClassHomeworkCount: Math.max(formattedHomework.length, 5),
      gradingSystem,
    });

    return successResponse(overview, "Student performance retrieved successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
