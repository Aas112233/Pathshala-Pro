import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  badRequest,
  unauthorized,
  validationError,
} from "@/lib/api-response";
import { createExamResultSchema, updateExamResultSchema } from "@/lib/schemas";
import { getAuthContext } from "@/lib/auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/exams
 * Get all exam results with pagination
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), MAX_PAGE_SIZE);
    const search = searchParams.get("search") || "";
    const examName = searchParams.get("examName") || "";
    const subject = searchParams.get("subject") || "";
    const studentId = searchParams.get("studentId") || "";
    const academicYearId = searchParams.get("academicYearId") || "";

    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { examName: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } },
      ];
    }

    if (examName) {
      where.examName = examName;
    }

    if (subject) {
      where.subject = subject;
    }

    if (studentId) {
      where.studentProfileId = studentId;
    }

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    const totalCount = await prisma.examResult.count({ where });

    const examResults = await prisma.examResult.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        studentProfile: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
            rollNumber: true,
          },
        },
        academicYear: {
          select: {
            yearId: true,
            label: true,
          },
        },
      },
    });

    const totalPages = Math.ceil(totalCount / limit);

    return paginatedResponse(examResults, {
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
 * POST /api/exams
 * Create a new exam result
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;

    const body = await request.json();
    const validation = createExamResultSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    // Verify student exists
    const student = await prisma.studentProfile.findUnique({
      where: { id: data.studentProfileId, tenantId },
    });

    if (!student) {
      return badRequest("Student not found");
    }

    // Verify academic year exists
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: data.academicYearId, tenantId },
    });

    if (!academicYear) {
      return badRequest("Academic year not found");
    }

    // Auto-calculate grade if not provided
    const percentage = (data.obtainedMarks / data.maxMarks) * 100;
    let grade = data.grade;
    
    if (!grade) {
      if (percentage >= 80) grade = "A+";
      else if (percentage >= 70) grade = "A";
      else if (percentage >= 60) grade = "B";
      else if (percentage >= 50) grade = "C";
      else if (percentage >= 40) grade = "D";
      else grade = "F";
    }

    // Auto-generate remarks if not provided
    let remarks = data.remarks;
    if (!remarks) {
      if (percentage >= 80) remarks = "Excellent";
      else if (percentage >= 60) remarks = "Good";
      else if (percentage >= 40) remarks = "Satisfactory";
      else remarks = "Needs Improvement";
    }

    const examResult = await prisma.examResult.create({
      data: {
        tenantId,
        ...data,
        grade,
        remarks,
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
        academicYear: {
          select: {
            yearId: true,
            label: true,
          },
        },
      },
    });

    return successResponse(examResult, "Exam result created successfully", 201);
  } catch (error) {
    console.error("Create exam result error:", error);
    return errorResponse("Internal server error", 500);
  }
}
