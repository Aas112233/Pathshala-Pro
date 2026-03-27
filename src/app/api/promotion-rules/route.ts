import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
  badRequest,
  validationError,
} from "@/lib/api-response";
import { createPromotionRuleSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

/**
 * GET /api/promotion-rules
 * Get all promotion rules
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get("academicYearId");
    const classId = searchParams.get("classId");
    const isActive = searchParams.get("isActive");

    const where: any = { tenantId };

    if (academicYearId) where.academicYearId = academicYearId;
    if (classId) where.classId = classId;
    if (isActive !== null) where.isActive = isActive === "true";

    const rules = await prisma.promotionRule.findMany({
      where,
      include: {
        academicYear: {
          select: {
            yearId: true,
            label: true,
          },
        },
        class: {
          select: {
            classId: true,
            name: true,
            classNumber: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(rules, "Promotion rules retrieved successfully");
  } catch (error) {
    console.error("Get promotion rules error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * POST /api/promotion-rules
 * Create a new promotion rule
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const body = await request.json();
    const validation = createPromotionRuleSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    // Verify academic year exists
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: data.academicYearId, tenantId },
    });

    if (!academicYear) {
      return badRequest("Academic year not found");
    }

    // Verify class exists
    const classObj = await prisma.class.findUnique({
      where: { id: data.classId, tenantId },
    });

    if (!classObj) {
      return badRequest("Class not found");
    }

    // Verify next class exists if provided
    if (data.nextClassId) {
      const nextClass = await prisma.class.findUnique({
        where: { id: data.nextClassId, tenantId },
      });

      if (!nextClass) {
        return badRequest("Next class not found");
      }

      // Ensure next class is actually "next" (higher class number)
      if (nextClass.classNumber <= classObj.classNumber) {
        return badRequest("Next class must have a higher class number", [
          {
            field: "nextClassId",
            code: "invalid",
            message: "Next class should be a higher grade than current class",
          },
        ]);
      }
    }

    // Check if rule already exists for this class and academic year
    const existingRule = await prisma.promotionRule.findFirst({
      where: {
        tenantId,
        academicYearId: data.academicYearId,
        classId: data.classId,
      },
    });

    if (existingRule) {
      return badRequest("Promotion rule already exists for this class and academic year", [
        {
          field: "classId",
          code: "duplicate",
          message: "Rule already exists",
        },
      ]);
    }

    const rule = await prisma.promotionRule.create({
      data: {
        tenantId,
        ...data,
      },
      include: {
        academicYear: {
          select: {
            yearId: true,
            label: true,
          },
        },
        class: {
          select: {
            classId: true,
            name: true,
          },
        },
      },
    });

    return successResponse(rule, "Promotion rule created successfully", 201);
  } catch (error) {
    console.error("Create promotion rule error:", error);
    return errorResponse("Internal server error", 500);
  }
}
