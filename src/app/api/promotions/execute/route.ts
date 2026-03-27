import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
  badRequest,
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

      // Verify student exists
      const student = await prisma.studentProfile.findUnique({
        where: { id: data.studentProfileId, tenantId },
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

      // Verify from class matches student's current class
      if (student.classId !== data.fromClassId) {
        errors.push({
          field: `promotions[${index}].fromClassId`,
          code: "mismatch",
          message: `Student's current class does not match from class`,
        });
        continue;
      }

      // Verify from academic year exists
      const fromAcademicYear = await prisma.academicYear.findUnique({
        where: { id: data.fromAcademicYearId, tenantId },
      });

      if (!fromAcademicYear) {
        errors.push({
          field: `promotions[${index}].fromAcademicYearId`,
          code: "not_found",
          message: "From academic year not found",
        });
        continue;
      }

      // Verify to academic year exists
      const toAcademicYear = await prisma.academicYear.findUnique({
        where: { id: data.toAcademicYearId, tenantId },
      });

      if (!toAcademicYear) {
        errors.push({
          field: `promotions[${index}].toAcademicYearId`,
          code: "not_found",
          message: "To academic year not found",
        });
        continue;
      }

      // Verify to class exists
      const toClass = await prisma.class.findUnique({
        where: { id: data.toClassId, tenantId },
      });

      if (!toClass) {
        errors.push({
          field: `promotions[${index}].toClassId`,
          code: "not_found",
          message: "To class not found",
        });
        continue;
      }

      // Check if promotion already exists
      const existingPromotion = await prisma.classPromotion.findFirst({
        where: {
          tenantId,
          studentProfileId: data.studentProfileId,
          fromAcademicYearId: data.fromAcademicYearId,
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
          studentProfileId: data.studentProfileId,
          fromAcademicYearId: data.fromAcademicYearId,
          toAcademicYearId: data.toAcademicYearId,
          fromClassId: data.fromClassId,
          toClassId: data.toClassId,
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

      // If promoted, update student's class
      if (data.status === "PROMOTED" && data.toClassId !== data.fromClassId) {
        await prisma.studentProfile.update({
          where: { id: data.studentProfileId },
          data: {
            classId: data.toClassId,
            // Reset section/group if moving to new class (optional)
            // sectionId: null,
            // groupId: null,
          },
        });
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
    console.error("Execute promotions error:", error);
    return errorResponse("Internal server error", 500);
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
    console.error("Get promotions error:", error);
    return errorResponse("Internal server error", 500);
  }
}

function validationError(errors: Array<{ field?: string; code: string; message: string }>) {
  return badRequest("Validation failed", errors);
}
