import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
  badRequest,
  handleApiError,
} from "@/lib/api-response";
import { createClassPromotionSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

/**
 * POST /api/promotions/execute
 * Execute promotions for students (bulk or individual)
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId, user } = access.authContext;
    const body = await request.json();

    // Support both single promotion and bulk promotions
    const promotionsData = Array.isArray(body) ? body : [body];

    if (promotionsData.length === 0) {
      return badRequest("No promotions provided");
    }

    const errors: Array<{ field?: string; code: string; message: string }> = [];
    const createdPromotions = [];

    for (const [index, promoData] of promotionsData.entries()) {
      const validation = createClassPromotionSchema.safeParse(promoData);

      if (!validation.success) {
        const resultErrors = validation.error.errors.map((err) => ({
          field: `promotions[${index}].${err.path.join(".")}`,
          code: err.code,
          message: err.message,
        }));
        errors.push(...resultErrors);
        continue;
      }

      const data = validation.data;

      // Verify student exists by ID or studentId
      const student = await prisma.studentProfile.findFirst({
        where: {
          tenantId,
          OR: [
            { id: data.studentProfileId },
            { studentId: data.studentProfileId },
          ],
        },
        include: {
          class: true,
        },
      });

      if (!student) {
        errors.push({
          field: `promotions[${index}].studentProfileId`,
          code: "not_found",
          message: "Student not found",
        });
        continue;
      }

      // Re-assign resolved canonical database studentProfileId
      const resolvedStudentProfileId = student.id;

      // Verify from class matches student's current class
      const fromClass = await prisma.class.findFirst({
        where: {
          tenantId,
          OR: [{ id: data.fromClassId }, { classId: data.fromClassId }],
        },
      });

      if (!fromClass) {
        errors.push({
          field: `promotions[${index}].fromClassId`,
          code: "not_found",
          message: "From class not found",
        });
        continue;
      }

      if (student.classId && student.classId !== fromClass.id) {
        errors.push({
          field: `promotions[${index}].fromClassId`,
          code: "mismatch",
          message: `Student's current class does not match from class`,
        });
        continue;
      }

      const resolvedFromClassId = fromClass.id;

      // Verify from academic year exists
      const fromAcademicYear = await prisma.academicYear.findFirst({
        where: {
          tenantId,
          OR: [{ id: data.fromAcademicYearId }, { yearId: data.fromAcademicYearId }],
        },
      });

      if (!fromAcademicYear) {
        errors.push({
          field: `promotions[${index}].fromAcademicYearId`,
          code: "not_found",
          message: "From academic year not found",
        });
        continue;
      }
      const resolvedFromAcademicYearId = fromAcademicYear.id;

      // Verify to academic year exists
      const toAcademicYear = await prisma.academicYear.findFirst({
        where: {
          tenantId,
          OR: [{ id: data.toAcademicYearId }, { yearId: data.toAcademicYearId }],
        },
      });

      if (!toAcademicYear) {
        errors.push({
          field: `promotions[${index}].toAcademicYearId`,
          code: "not_found",
          message: "To academic year not found",
        });
        continue;
      }
      const resolvedToAcademicYearId = toAcademicYear.id;

      // Verify to class exists
      const toClass = await prisma.class.findFirst({
        where: {
          tenantId,
          OR: [{ id: data.toClassId }, { classId: data.toClassId }],
        },
      });

      if (!toClass) {
        errors.push({
          field: `promotions[${index}].toClassId`,
          code: "not_found",
          message: "To class not found",
        });
        continue;
      }
      const resolvedToClassId = toClass.id;

      // Check if promotion already exists
      const existingPromotion = await prisma.classPromotion.findFirst({
        where: {
          tenantId,
          studentProfileId: resolvedStudentProfileId,
          fromAcademicYearId: resolvedFromAcademicYearId,
        },
      });

      if (existingPromotion) {
        errors.push({
          field: `promotions[${index}]`,
          code: "duplicate",
          message: "Promotion already exists for this student in this academic year",
        });
        continue;
      }

      // Create the promotion record
      const promotion = await prisma.classPromotion.create({
        data: {
          tenantId,
          studentProfileId: resolvedStudentProfileId,
          fromAcademicYearId: resolvedFromAcademicYearId,
          toAcademicYearId: resolvedToAcademicYearId,
          fromClassId: resolvedFromClassId,
          toClassId: resolvedToClassId,
          status: data.status,
          reason: data.reason,
          reExamRequired: data.reExamRequired,
          decidedBy: user.id,
          decidedAt: new Date(),
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
          fromClass: {
            select: {
              classId: true,
              name: true,
            },
          },
          toClass: {
            select: {
              classId: true,
              name: true,
            },
          },
        },
      });

      // If promoted, lock all historical subject exam results for this academic year & update student's class
      if (data.status === "PROMOTED") {
        // Lock all subject exam marks for this student in the fromAcademicYear
        await prisma.examResult.updateMany({
          where: {
            tenantId,
            studentProfileId: resolvedStudentProfileId,
            academicYearId: resolvedFromAcademicYearId,
          },
          data: {
            isLocked: true,
          },
        });

        // Update student's active class
        if (resolvedToClassId !== resolvedFromClassId) {
          await prisma.studentProfile.update({
            where: { id: resolvedStudentProfileId },
            data: {
              classId: resolvedToClassId,
            },
          });
        }
      }

      createdPromotions.push(promotion);
    }

    if (errors.length > 0) {
      return validationError(errors);
    }

    return successResponse(
      createdPromotions,
      `Successfully processed ${createdPromotions.length} promotion(s)`,
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/promotions/execute
 * Get promotion history
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);
    const studentProfileId = searchParams.get("studentProfileId");
    const academicYearId = searchParams.get("academicYearId");

    const where: any = { tenantId };

    if (studentProfileId) {
      where.studentProfileId = studentProfileId;
    }

    if (academicYearId) {
      where.fromAcademicYearId = academicYearId;
    }

    const promotions = await prisma.classPromotion.findMany({
      where,
      include: {
        studentProfile: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
            rollNumber: true,
          },
        },
        fromClass: {
          select: {
            classId: true,
            name: true,
          },
        },
        toClass: {
          select: {
            classId: true,
            name: true,
          },
        },
        fromAcademicYear: {
          select: {
            yearId: true,
            label: true,
          },
        },
        decidedByUser: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: { decidedAt: "desc" },
    });

    return successResponse(promotions, "Promotion history retrieved successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

function validationError(errors: Array<{ field?: string; code: string; message: string }>) {
  return badRequest("Validation failed", errors);
}
