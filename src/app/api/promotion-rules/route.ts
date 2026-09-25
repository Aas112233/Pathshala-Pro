import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
  badRequest,
  validationError,
  handleApiError,
} from "@/lib/api-response";
import { createPromotionRuleSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { assertAcademicYearOpen, resolveRequestAcademicYearId } from "@/lib/academic-year-guards";

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
    const academicYearIdParam = searchParams.get("academicYearId");
    const classId = searchParams.get("classId");
    const isActive = searchParams.get("isActive");

    const where: any = { tenantId };

    // Explicit param wins; otherwise the header-selected year applies.
    const academicYearId =
      academicYearIdParam ||
      (await resolveRequestAcademicYearId(request, tenantId)) ||
      null;
    if (academicYearId && academicYearId !== "ALL") where.academicYearId = academicYearId;
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

    const nextClassIds = rules
      .map((r) => r.nextClassId)
      .filter((id): id is string => Boolean(id));

    let nextClassMap = new Map<string, { id: string; classId: string; name: string; classNumber: number }>();
    if (nextClassIds.length > 0) {
      const nextClasses = await prisma.class.findMany({
        where: {
          tenantId,
          id: { in: nextClassIds },
        },
        select: {
          id: true,
          classId: true,
          name: true,
          classNumber: true,
        },
      });
      nextClassMap = new Map(nextClasses.map((c) => [c.id, c]));
    }

    // Check historical promotions count for each rule's class + academicYear
    const historicalPromotions = await prisma.classPromotion.groupBy({
      by: ["fromClassId", "fromAcademicYearId"],
      where: {
        tenantId,
      },
      _count: {
        id: true,
      },
    });

    const promoMap = new Map<string, number>();
    historicalPromotions.forEach((hp) => {
      promoMap.set(`${hp.fromClassId}_${hp.fromAcademicYearId}`, hp._count.id);
    });

    const rulesWithNextClass = rules.map((r) => {
      const historicalCount = promoMap.get(`${r.classId}_${r.academicYearId}`) || 0;
      return {
        ...r,
        nextClass: r.nextClassId ? nextClassMap.get(r.nextClassId) || null : null,
        isLocked: historicalCount > 0,
        historicalPromotionCount: historicalCount,
      };
    });

    return successResponse(rulesWithNextClass, "Promotion rules retrieved successfully");
  } catch (error) {
    return handleApiError(error);
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

    // The year must exist, belong to this tenant, and be open. A promotion rule
    // in a closed year is the recorded basis on which students were retained or
    // advanced; rewriting it after the fact changes the reason without changing
    // the outcome, which is exactly the kind of retro-edit a frozen year forbids.
    await assertAcademicYearOpen(tenantId, data.academicYearId);

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

    let nextClassObj = null;
    if (rule.nextClassId) {
      nextClassObj = await prisma.class.findUnique({
        where: { id: rule.nextClassId, tenantId },
        select: {
          id: true,
          classId: true,
          name: true,
          classNumber: true,
        },
      });
    }

    return successResponse({ ...rule, nextClass: nextClassObj }, "Promotion rule created successfully", 201);
  } catch (error) {
    return handleApiError(error);
  }
}
