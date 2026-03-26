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
import { hasPermission } from "@/lib/permissions";

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
    const gender = searchParams.get("gender") || "";
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

    if (gender) {
      where.gender = gender;
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
        profilePictureUrl: true,
        admissionDate: true,
        createdAt: true,
        class: {
          select: {
            id: true,
            name: true,
          }
        },
        section: {
          select: {
            id: true,
            name: true,
          }
        },
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
    if (error instanceof Error) {
      console.error("Error details:", error.message, error.stack);
    }
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

    let studentId = data.studentId;

    if (!studentId) {
      // Auto-generate student ID uniquely with 5-digit sequence number
      const latestStudent = await prisma.studentProfile.findFirst({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
      });

      const currentYear = new Date().getFullYear();
      let nextNumber = 1;

      if (latestStudent && latestStudent.studentId.startsWith(`STU-${currentYear}-`)) {
        const parts = latestStudent.studentId.split("-");
        const lastNum = parseInt(parts[2], 10);
        if (!isNaN(lastNum)) {
          nextNumber = lastNum + 1;
        }
      }

      // Keep incrementing if it randomly collides due to race conditions or manual entry
      let isUnique = false;
      while (!isUnique) {
        studentId = `STU-${currentYear}-${nextNumber.toString().padStart(5, "0")}`; // 5-digit padding
        const collision = await prisma.studentProfile.findFirst({ where: { tenantId, studentId } });
        if (!collision) isUnique = true;
        else nextNumber++;
      }
    } else {
      // Check if provided student ID already exists
      const existingStudent = await prisma.studentProfile.findFirst({
        where: { tenantId, studentId },
      });

      if (existingStudent) {
        return badRequest("Student already exists", [
          { field: "studentId", code: "duplicate", message: "Student ID already exists" },
        ]);
      }
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

    // If the frontend passed a driveFileId, rename the R2 object to match the newly generated studentId
    let profilePictureUrl: string | undefined = undefined;

    if (data.driveFileId) {
      try {
        const { renameR2Object } = await import("@/lib/r2-storage");

        // R2 keys are like "Tenant_123/student_profiles/temp_12345.jpg"
        // We want to extract the extension to keep it, and replace the name with the studentId
        const oldKey = data.driveFileId;
        const extension = oldKey.split(".").pop();
        const parts = oldKey.split("/");
        parts.pop(); // Remove the old temp filename
        const newKey = `${parts.join("/")}/${studentId}.${extension}`;

        await renameR2Object(oldKey, newKey);

        // Build the profile picture URL
        const publicDomain = process.env.R2_PUBLIC_DOMAIN;
        if (publicDomain) {
          const cleanDomain = publicDomain.endsWith("/") ? publicDomain.slice(0, -1) : publicDomain;
          profilePictureUrl = `${cleanDomain}/${newKey}`;
        } else {
          profilePictureUrl = `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev/${newKey}`;
        }
      } catch (renameErr) {
        console.error("Failed to rename object on Cloudflare R2:", renameErr);
        // Continue anyway so the database record is not lost, but keep the old temp URL
      }
    }

    // Strip driveFileId and admissionDate before passing to Prisma
    // admissionDate should not be set manually - createdAt is auto-set by DB
    const { driveFileId, admissionDate, ...prismaData } = data as any;

    // Convert dateOfBirth string to Date object if present
    const prismaDataWithDates: any = { ...prismaData };
    if (prismaData.dateOfBirth && prismaData.dateOfBirth.trim() !== '') {
      prismaDataWithDates.dateOfBirth = new Date(prismaData.dateOfBirth);
    } else {
      delete prismaDataWithDates.dateOfBirth; // Remove empty date
    }

    const student = await prisma.studentProfile.create({
      data: {
        tenantId,
        ...prismaDataWithDates,
        studentId: studentId as string,
        ...(profilePictureUrl && { profilePictureUrl }),
        // admissionDate defaults to now() in schema if not provided
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
