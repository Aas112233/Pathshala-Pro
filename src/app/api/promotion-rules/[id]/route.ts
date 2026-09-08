import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFound,
  badRequest,
  validationError,
  handleApiError,
} from "@/lib/api-response";
import { updatePromotionRuleSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Helper to check historical promotion locks
 */
async function getRuleWithLockStatus(id: string, tenantId: string) {
  const rule = await prisma.promotionRule.findUnique({
    where: { id, tenantId },
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
  });

  if (!rule) return null;

  const historicalCount = await prisma.classPromotion.count({
    where: {
      tenantId,
      fromClassId: rule.classId,
      fromAcademicYearId: rule.academicYearId,
    },
  });

  let nextClass = null;
  if (rule.nextClassId) {
    nextClass = await prisma.class.findUnique({
      where: { id: rule.nextClassId, tenantId },
      select: {
        id: true,
        classId: true,
        name: true,
        classNumber: true,
      },
    });
  }

  return {
    ...rule,
    nextClass,
    isLocked: historicalCount > 0,
    historicalPromotionCount: historicalCount,
  };
}

/**
 * GET /api/promotion-rules/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { id } = await params;
    const { tenantId } = access.authContext;

    const rule = await getRuleWithLockStatus(id, tenantId);
    if (!rule) {
      return notFound("Promotion rule not found");
    }

    return successResponse(rule, "Promotion rule retrieved successfully");
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/promotion-rules/[id]
 * Update a promotion rule (locked if historical promotions exist)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { id } = await params;
    const { tenantId } = access.authContext;

    const existingRule = await getRuleWithLockStatus(id, tenantId);
    if (!existingRule) {
      return notFound("Promotion rule not found");
    }

    // Historical Lock Enforcement
    if (existingRule.isLocked) {
      return badRequest(
        `Cannot modify promotion rule. ${existingRule.historicalPromotionCount} historical student promotion records exist for this class & academic year.`,
        [
          {
            field: "id",
            code: "locked_by_historical_data",
            message: "Promotion rule is locked because promotion records have already been generated and processed.",
          },
        ]
      );
    }

    const body = await request.json();
    const validation = updatePromotionRuleSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    // Validate nextClassId if modified
    if (data.nextClassId) {
      const nextClass = await prisma.class.findUnique({
        where: { id: data.nextClassId, tenantId },
      });

      if (!nextClass) {
        return badRequest("Next class not found");
      }

      if (nextClass.classNumber <= existingRule.class.classNumber) {
        return badRequest("Next class must have a higher class number than current class", [
          {
            field: "nextClassId",
            code: "invalid",
            message: "Next class should be a higher grade than current class",
          },
        ]);
      }
    }

    const updated = await prisma.promotionRule.update({
      where: { id, tenantId },
      data: {
        ...(data.minimumAttendance !== undefined && { minimumAttendance: data.minimumAttendance }),
        ...(data.minimumOverallPercentage !== undefined && { minimumOverallPercentage: data.minimumOverallPercentage }),
        ...(data.minimumPerSubject !== undefined && { minimumPerSubject: data.minimumPerSubject }),
        ...(data.maxFailedSubjects !== undefined && { maxFailedSubjects: data.maxFailedSubjects }),
        ...(data.allowConditionalPromotion !== undefined && { allowConditionalPromotion: data.allowConditionalPromotion }),
        ...(data.autoPromote !== undefined && { autoPromote: data.autoPromote }),
        ...(data.nextClassId !== undefined && { nextClassId: data.nextClassId }),
        ...(data.academicYearId && { academicYearId: data.academicYearId }),
        ...(data.classId && { classId: data.classId }),
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
            classNumber: true,
          },
        },
      },
    });

    let nextClassObj = null;
    if (updated.nextClassId) {
      nextClassObj = await prisma.class.findUnique({
        where: { id: updated.nextClassId, tenantId },
        select: {
          id: true,
          classId: true,
          name: true,
          classNumber: true,
        },
      });
    }

    return successResponse(
      { ...updated, nextClass: nextClassObj, isLocked: false, historicalPromotionCount: 0 },
      "Promotion rule updated successfully"
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/promotion-rules/[id]
 * Delete a promotion rule (locked if historical promotions exist)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { id } = await params;
    const { tenantId } = access.authContext;

    const existingRule = await getRuleWithLockStatus(id, tenantId);
    if (!existingRule) {
      return notFound("Promotion rule not found");
    }

    // Historical Lock Enforcement
    if (existingRule.isLocked) {
      return badRequest(
        `Cannot delete promotion rule. ${existingRule.historicalPromotionCount} historical student promotion records exist for this class & academic year.`,
        [
          {
            field: "id",
            code: "locked_by_historical_data",
            message: "Promotion rule is locked because promotion records have already been processed and archived.",
          },
        ]
      );
    }

    await prisma.promotionRule.delete({
      where: { id, tenantId },
    });

    return successResponse(null, "Promotion rule deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
