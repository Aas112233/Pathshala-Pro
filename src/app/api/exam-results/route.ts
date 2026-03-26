import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  unauthorized,
  notFound,
  badRequest,
  validationError,
} from "@/lib/api-response";
import { createExamResultNewSchema } from "@/lib/schemas";
import { getAuthContext } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

// Grading scale configuration
const GRADING_SCALE = [
  { minPercentage: 80, grade: "A+", point: 5.0, remark: "Excellent" },
  { minPercentage: 70, grade: "A", point: 4.5, remark: "Very Good" },
  { minPercentage: 60, grade: "A-", point: 4.0, remark: "Good" },
  { minPercentage: 50, grade: "B", point: 3.5, remark: "Average" },
  { minPercentage: 40, grade: "C", point: 3.0, remark: "Satisfactory" },
  { minPercentage: 33, grade: "D", point: 2.0, remark: "Pass" },
  { minPercentage: 0, grade: "F", point: 0.0, remark: "Fail" },
];

function calculateGrade(marks: number, maxMarks: number) {
  const percentage = (marks / maxMarks) * 100;
  const gradeInfo = GRADING_SCALE.find((g) => percentage >= g.minPercentage) || GRADING_SCALE[GRADING_SCALE.length - 1];
  return {
    grade: gradeInfo.grade,
    gradePoint: gradeInfo.point,
    percentage,
    status: percentage >= 33 ? "PASS" : "FAIL",
  };
}

/**
 * GET /api/exam-results
 * Get exam results with pagination, search, and filters
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;
    const { searchParams } = new URL(request.url);

    // Pagination params
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    // Filter params
    const examId = searchParams.get("examId");
    const subjectId = searchParams.get("subjectId");
    const studentProfileId = searchParams.get("studentProfileId");
    const academicYearId = searchParams.get("academicYearId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const where: any = { tenantId };

    if (examId) where.examId = examId;
    if (subjectId) where.subjectId = subjectId;
    if (studentProfileId) where.studentProfileId = studentProfileId;
    if (academicYearId) where.academicYearId = academicYearId;
    if (status) where.status = status;

    // Text search on student name / studentId
    if (search && search.trim()) {
      where.studentProfile = {
        OR: [
          { firstName: { contains: search.trim(), mode: "insensitive" } },
          { lastName: { contains: search.trim(), mode: "insensitive" } },
          { firstNameBn: { contains: search.trim(), mode: "insensitive" } },
          { lastNameBn: { contains: search.trim(), mode: "insensitive" } },
          { studentId: { contains: search.trim(), mode: "insensitive" } },
        ],
      };
    }

    const [results, totalCount] = await Promise.all([
      prisma.examResult.findMany({
        where,
        include: {
          studentProfile: {
            select: {
              studentId: true,
              firstName: true,
              lastName: true,
              firstNameBn: true,
              lastNameBn: true,
              rollNumber: true,
              classId: true,
            },
          },
          exam: {
            select: {
              id: true,
              examId: true,
              name: true,
              type: true,
            },
          },
          subject: {
            select: {
              id: true,
              subjectId: true,
              name: true,
              code: true,
            },
          },
          academicYear: {
            select: {
              yearId: true,
              label: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.examResult.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return paginatedResponse(results, {
      totalCount,
      currentPage: page,
      pageSize: limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    console.error("Get exam results error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * POST /api/exam-results
 * Create exam result(s) - supports bulk creation
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId, user } = authContext;
    const body = await request.json();

    // Support both single result and bulk results
    const resultsData = Array.isArray(body) ? body : [body];

    if (resultsData.length === 0) {
      return badRequest("No results provided");
    }

    const errors: Array<{ field?: string; code: string; message: string }> = [];
    const createdResults = [];

    for (const [index, resultData] of resultsData.entries()) {
      const validation = createExamResultNewSchema.safeParse(resultData);

      if (!validation.success) {
        const resultErrors = validation.error.errors.map((err) => ({
          field: `results[${index}].${err.path.join(".")}`,
          code: err.code,
          message: err.message,
        }));
        errors.push(...resultErrors);
        continue;
      }

      const data = validation.data;

      // Verify student exists
      const student = await prisma.studentProfile.findUnique({
        where: { id: data.studentProfileId, tenantId },
      });

      if (!student) {
        errors.push({
          field: `results[${index}].studentProfileId`,
          code: "not_found",
          message: "Student not found",
        });
        continue;
      }

      // Verify exam exists
      const exam = await prisma.exam.findUnique({
        where: { id: data.examId, tenantId },
      });

      if (!exam) {
        errors.push({
          field: `results[${index}].examId`,
          code: "not_found",
          message: "Exam not found",
        });
        continue;
      }

      // Verify subject exists
      const subject = await prisma.subject.findUnique({
        where: { id: data.subjectId, tenantId },
      });

      if (!subject) {
        errors.push({
          field: `results[${index}].subjectId`,
          code: "not_found",
          message: "Subject not found",
        });
        continue;
      }

      // Verify academic year exists
      const academicYear = await prisma.academicYear.findUnique({
        where: { id: data.academicYearId, tenantId },
      });

      if (!academicYear) {
        errors.push({
          field: `results[${index}].academicYearId`,
          code: "not_found",
          message: "Academic year not found",
        });
        continue;
      }

      // Check if result already exists
      const existingResult = await prisma.examResult.findFirst({
        where: {
          tenantId,
          studentProfileId: data.studentProfileId,
          examId: data.examId,
          subjectId: data.subjectId,
        },
      });

      if (existingResult) {
        errors.push({
          field: `results[${index}]`,
          code: "duplicate",
          message: "Result already exists for this student, exam, and subject combination",
        });
        continue;
      }

      // Calculate grade and status
      const { grade, gradePoint, percentage, status } = calculateGrade(
        data.obtainedMarks,
        data.maxMarks
      );

      const result = await prisma.examResult.create({
        data: {
          tenantId,
          ...data,
          percentage,
          grade,
          gradePoint,
          status,
          reExamAllowed: data.reExamAllowed && status === "FAIL",
        },
        include: {
          studentProfile: {
            select: {
              studentId: true,
              firstName: true,
              lastName: true,
              rollNumber: true,
            },
          },
          subject: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      });

      createdResults.push(result);
    }

    if (errors.length > 0) {
      return validationError(errors);
    }

    return successResponse(
      createdResults,
      `Successfully created ${createdResults.length} exam result(s)`,
      201
    );
  } catch (error) {
    console.error("Create exam results error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * PUT /api/exam-results
 * Bulk upsert exam results — create or update
 */
export async function PUT(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;
    const body = await request.json();

    const resultsData = Array.isArray(body) ? body : [body];

    if (resultsData.length === 0) {
      return badRequest("No results provided");
    }

    const errors: Array<{ field?: string; code: string; message: string }> = [];
    const upsertedResults = [];

    for (const [index, resultData] of resultsData.entries()) {
      const validation = createExamResultNewSchema.safeParse(resultData);

      if (!validation.success) {
        const resultErrors = validation.error.errors.map((err) => ({
          field: `results[${index}].${err.path.join(".")}`,
          code: err.code,
          message: err.message,
        }));
        errors.push(...resultErrors);
        continue;
      }

      const data = validation.data;

      // Calculate grade and status
      const { grade, gradePoint, percentage, status } = calculateGrade(
        data.obtainedMarks,
        data.maxMarks
      );

      // Check if result already exists
      const existingResult = await prisma.examResult.findFirst({
        where: {
          tenantId,
          studentProfileId: data.studentProfileId,
          examId: data.examId,
          subjectId: data.subjectId,
        },
      });

      if (existingResult) {
        // Update existing result
        const updated = await prisma.examResult.update({
          where: { id: existingResult.id },
          data: {
            obtainedMarks: data.obtainedMarks,
            maxMarks: data.maxMarks,
            percentage,
            grade,
            gradePoint,
            status,
            reExamAllowed: data.reExamAllowed && status === "FAIL",
          },
          include: {
            studentProfile: {
              select: {
                studentId: true,
                firstName: true,
                lastName: true,
                rollNumber: true,
                classId: true,
              },
            },
            subject: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        });
        upsertedResults.push(updated);
      } else {
        // Create new result
        const created = await prisma.examResult.create({
          data: {
            tenantId,
            ...data,
            percentage,
            grade,
            gradePoint,
            status,
            reExamAllowed: data.reExamAllowed && status === "FAIL",
          },
          include: {
            studentProfile: {
              select: {
                studentId: true,
                firstName: true,
                lastName: true,
                rollNumber: true,
                classId: true,
              },
            },
            subject: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        });
        upsertedResults.push(created);
      }
    }

    if (errors.length > 0) {
      return validationError(errors);
    }

    return successResponse(
      upsertedResults,
      `Successfully saved ${upsertedResults.length} exam result(s)`
    );
  } catch (error) {
    console.error("Upsert exam results error:", error);
    return errorResponse("Internal server error", 500);
  }
}
