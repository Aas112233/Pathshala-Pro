// @ts-nocheck
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  badRequest,
  handleApiError,
  safeParseBody,
} from "@/lib/api-response";
import { createClassFeeStructureSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

/**
 * GET /api/fees/structures
 * Get all class tuition fee structures for an academic year.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get("academicYearId");
    const classId = searchParams.get("classId");

    const where: any = { tenantId };
    if (academicYearId) where.academicYearId = academicYearId;
    if (classId) where.classId = classId;

    const structures = await prisma.classFeeStructure.findMany({
      where,
      include: {
        class: {
          select: {
            id: true,
            name: true,
            classNumber: true,
            _count: {
              select: {
                studentProfiles: {
                  where: { status: "ACTIVE", tenantId },
                },
              },
            },
          },
        },
        academicYear: {
          select: {
            id: true,
            label: true,
            isClosed: true,
          },
        },
      },
      orderBy: [
        { class: { classNumber: "asc" } },
        { createdAt: "desc" },
      ],
    });

    const enriched = structures.map((item) => {
      const cls = (item as any).class;
      const studentCount = cls?._count?.studentProfiles ?? 0;
      const projectedRevenue = (item.totalMonthlyFee || 0) * studentCount;
      return {
        ...item,
        studentCount,
        projectedRevenue,
      };
    });

    return successResponse(enriched, "Class fee structures retrieved successfully");
  } catch (error) {
    return handleApiError(error, "Failed to retrieve class fee structures");
  }
}

/**
 * POST /api/fees/structures
 * Create or update a class fee structure.
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const bodyResult = await safeParseBody(request, createClassFeeStructureSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;

    const data = bodyResult.data;

    // Verify class and academic year exist under this tenant (supports both id and code)
    const [cls, ay] = await Promise.all([
      prisma.class.findFirst({
        where: {
          tenantId,
          OR: [{ id: data.classId }, { classId: data.classId }],
        },
      }),
      prisma.academicYear.findFirst({
        where: {
          tenantId,
          OR: [{ id: data.academicYearId }, { yearId: data.academicYearId }],
        },
      }),
    ]);

    if (!cls) return badRequest(`Selected class (${data.classId}) not found.`);
    if (!ay) return badRequest(`Selected academic year (${data.academicYearId}) not found.`);

    const tuitionFee = data.tuitionFee || 0;
    const labFee = data.labFee || 0;
    const computerFee = data.computerFee || 0;
    const examFee = data.examFee || 0;
    const sportsFee = data.sportsFee || 0;
    const libraryFee = data.libraryFee || 0;
    const otherFee = data.otherFee || 0;
    const totalMonthlyFee =
      tuitionFee + labFee + computerFee + examFee + sportsFee + libraryFee + otherFee;

    const structure = await prisma.classFeeStructure.upsert({
      where: {
        tenantId_academicYearId_classId: {
          tenantId,
          academicYearId: ay.id,
          classId: cls.id,
        },
      },
      create: {
        tenantId,
        academicYearId: ay.id,
        classId: cls.id,
        tuitionFee,
        labFee,
        computerFee,
        examFee,
        sportsFee,
        libraryFee,
        otherFee,
        totalMonthlyFee,
        billingCycle: data.billingCycle || "MONTHLY",
        notes: data.notes,
        isActive: data.isActive ?? true,
      },
      update: {
        tuitionFee,
        labFee,
        computerFee,
        examFee,
        sportsFee,
        libraryFee,
        otherFee,
        totalMonthlyFee,
        billingCycle: data.billingCycle || "MONTHLY",
        notes: data.notes,
        isActive: data.isActive ?? true,
      },
      include: {
        class: { select: { id: true, name: true, classNumber: true } },
        academicYear: { select: { id: true, label: true } },
      },
    });

    return successResponse(
      structure,
      `Tuition fee structure for ${cls.name} saved successfully!`,
      201
    );
  } catch (error) {
    console.error("[POST /api/fees/structures] Error:", error);
    return handleApiError(error, "Failed to save class fee structure");
  }
}
