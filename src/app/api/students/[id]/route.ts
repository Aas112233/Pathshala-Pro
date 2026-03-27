import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
} from "@/lib/api-response";
import { updateStudentSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import {
  buildLockedFieldsDetails,
  getStudentUsageCounts,
  integrityViolation,
  lockedDeleteMessage,
} from "@/lib/data-integrity";

/**
 * GET /api/students/[id]
 * Get a single student by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    const student = await prisma.studentProfile.findUnique({
      where: { id, tenantId },
      include: {
        feeVouchers: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            voucherId: true,
            feeType: true,
            totalDue: true,
            amountPaid: true,
            balance: true,
            status: true,
            dueDate: true,
          },
        },
        attendances: {
          take: 5,
          orderBy: { date: "desc" },
          select: {
            date: true,
            status: true,
            note: true,
          },
        },
        examResults: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            exam: {
              select: {
                name: true,
                type: true,
              },
            },
            subject: {
              select: {
                name: true,
                code: true,
              },
            },
            maxMarks: true,
            obtainedMarks: true,
            grade: true,
            status: true,
          },
        },
      },
    });

    if (!student) {
      return notFound("Student not found");
    }

    return successResponse(student);
  } catch (error) {
    console.error("Get student error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * PUT /api/students/[id]
 * Update a student
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    const body = await request.json();

    // Log the request body for debugging
    console.log('[PUT /api/students/:id] Request body:', body);

    // For updates, we don't require studentId in the body
    const updateDataSchema = updateStudentSchema.omit({ studentId: true });
    const validation = updateDataSchema.safeParse(body);

    if (!validation.success) {
      console.error('[PUT /api/students/:id] Validation error:', validation.error.errors);
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return badRequest("Invalid input", errors);
    }

    const data = validation.data;
    console.log('[PUT /api/students/:id] Validated data:', data);

    // Convert date strings to Date objects if present
    const prismaData: any = { ...data };

    // Only include dateOfBirth if it has a valid value
    if (prismaData.dateOfBirth && prismaData.dateOfBirth.trim() !== '') {
      prismaData.dateOfBirth = new Date(prismaData.dateOfBirth);
    } else {
      delete prismaData.dateOfBirth; // Remove empty date
    }

    if (prismaData.admissionDate) {
      prismaData.admissionDate = new Date(prismaData.admissionDate);
    }

    // Remove fields that shouldn't be updated or don't exist in DB
    delete prismaData.admissionDate; // Don't allow changing admission date
    delete prismaData.driveFileId; // This is not a DB field, only used for temp file tracking

    // Check if student exists
    const existingStudent = await prisma.studentProfile.findUnique({
      where: { id, tenantId },
    });

    if (!existingStudent) {
      return notFound("Student not found");
    }

    const usageCounts = await getStudentUsageCounts(tenantId, id);
    const hasHistory =
      usageCounts.feeVouchers > 0 ||
      usageCounts.attendances > 0 ||
      usageCounts.examResults > 0 ||
      usageCounts.promotions > 0;

    const lockedFields: string[] = [];

    if (
      hasHistory &&
      Object.prototype.hasOwnProperty.call(data, "rollNumber") &&
      data.rollNumber !== existingStudent.rollNumber
    ) {
      lockedFields.push("rollNumber");
    }

    const classHistoryExists = usageCounts.examResults > 0 || usageCounts.promotions > 0;

    if (
      classHistoryExists &&
      Object.prototype.hasOwnProperty.call(data, "classId") &&
      (data as any).classId !== (existingStudent as any).classId
    ) {
      lockedFields.push("classId");
    }

    if (
      classHistoryExists &&
      Object.prototype.hasOwnProperty.call(data, "groupId") &&
      (data as any).groupId !== (existingStudent as any).groupId
    ) {
      lockedFields.push("groupId");
    }

    if (
      classHistoryExists &&
      Object.prototype.hasOwnProperty.call(data, "sectionId") &&
      (data as any).sectionId !== (existingStudent as any).sectionId
    ) {
      lockedFields.push("sectionId");
    }

    if (lockedFields.length > 0) {
      return integrityViolation(
        "Student record cannot be changed in a way that would rewrite historical academic or financial data.",
        buildLockedFieldsDetails(
          lockedFields,
          "the student already has linked fee, attendance, exam, or promotion history"
        )
      );
    }

    // Check student ID uniqueness if changing
    if ((data as any).studentId && (data as any).studentId !== existingStudent.studentId) {
      const idExists = await prisma.studentProfile.findFirst({
        where: { tenantId, studentId: (data as any).studentId, id: { not: id } },
      });

      if (idExists) {
        return badRequest("Student ID already in use", [
          { field: "studentId", code: "duplicate", message: "Student ID already exists" },
        ]);
      }
    }

    // Check roll number uniqueness if changing
    if (data.rollNumber && data.rollNumber !== existingStudent.rollNumber) {
      const rollExists = await prisma.studentProfile.findFirst({
        where: { tenantId, rollNumber: data.rollNumber, id: { not: id } },
      });

      if (rollExists) {
        return badRequest("Roll number already in use", [
          { field: "rollNumber", code: "duplicate", message: "Roll number already exists" },
        ]);
      }
    }

    const updatedStudent = await prisma.studentProfile.update({
      where: { id },
      data: prismaData,
      select: {
        id: true,
        studentId: true,
        rollNumber: true,
        firstName: true,
        lastName: true,
        firstNameBn: true,
        lastNameBn: true,
        guardianName: true,
        guardianContact: true,
        guardianEmail: true,
        gender: true,
        address: true,
        profilePictureUrl: true,
        status: true,
        updatedAt: true,
      },
    });

    return successResponse(updatedStudent, "Student updated successfully");
  } catch (error) {
    console.error("Update student error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * DELETE /api/students/[id]
 * Delete a student
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    // Check if student exists
    const existingStudent = await prisma.studentProfile.findUnique({
      where: { id, tenantId },
    });

    if (!existingStudent) {
      return notFound("Student not found");
    }

    const usageCounts = await getStudentUsageCounts(tenantId, id);
    if (Object.values(usageCounts).some((count) => count > 0)) {
      return integrityViolation(lockedDeleteMessage("Student", usageCounts), [
        {
          field: "id",
          code: "in_use",
          message:
            "Students with fee, attendance, exam, or promotion history must be kept for audit consistency. Mark the student inactive, transferred, or graduated instead.",
        },
      ]);
    }

    await prisma.studentProfile.delete({
      where: { id },
    });

    return successResponse(null, "Student deleted successfully");
  } catch (error) {
    console.error("Delete student error:", error);
    return errorResponse("Internal server error", 500);
  }
}
