import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  badRequest,
  unauthorized,
  forbidden,
  validationError,
} from "@/lib/api-response";
import { createStudentSchema, updateStudentSchema } from "@/lib/schemas";
import { getAuthContext } from "@/lib/auth";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/students
 * Get all students with pagination
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
    const status = searchParams.get("status") || "";
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { tenantId };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { studentId: { contains: search, mode: "insensitive" } },
        { rollNumber: { contains: search, mode: "insensitive" } },
        { guardianName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    // Get total count
    const totalCount = await prisma.studentProfile.count({ where });

    // Get students
    const students = await prisma.studentProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        studentId: true,
        rollNumber: true,
        firstName: true,
        lastName: true,
        guardianName: true,
        guardianContact: true,
        guardianEmail: true,
        gender: true,
        status: true,
        admissionDate: true,
        createdAt: true,
      },
    });

    const totalPages = Math.ceil(totalCount / limit);

    return paginatedResponse(students, {
      totalCount,
      currentPage: page,
      pageSize: limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  } catch (error) {
    console.error("Get students error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * POST /api/students
 * Create a new student
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;

    const body = await request.json();
    const validation = createStudentSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    // Check if student ID already exists
    const existingStudent = await prisma.studentProfile.findFirst({
      where: { tenantId, studentId: data.studentId },
    });

    if (existingStudent) {
      return badRequest("Student already exists", [
        { field: "studentId", code: "duplicate", message: "Student ID already exists" },
      ]);
    }

    // Check if roll number already exists
    const existingRoll = await prisma.studentProfile.findFirst({
      where: { tenantId, rollNumber: data.rollNumber },
    });

    if (existingRoll) {
      return badRequest("Student already exists", [
        { field: "rollNumber", code: "duplicate", message: "Roll number already exists" },
      ]);
    }

    const student = await prisma.studentProfile.create({
      data: {
        tenantId,
        ...data,
      },
      select: {
        id: true,
        studentId: true,
        rollNumber: true,
        firstName: true,
        lastName: true,
        guardianName: true,
        guardianContact: true,
        status: true,
        admissionDate: true,
        createdAt: true,
      },
    });

    return successResponse(student, "Student created successfully", 201);
  } catch (error) {
    console.error("Create student error:", error);
    return errorResponse("Internal server error", 500);
  }
}
