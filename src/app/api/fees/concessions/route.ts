import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  badRequest,
  handleApiError,
  safeParseBody,
} from "@/lib/api-response";
import { createStudentFeeConcessionSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

/**
 * GET /api/fees/concessions
 * Get student fee concessions.
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);
    const studentProfileId = searchParams.get("studentProfileId");
    const concessionType = searchParams.get("concessionType");

    const where: any = { tenantId };
    if (studentProfileId) where.studentProfileId = studentProfileId;
    if (concessionType) where.concessionType = concessionType;

    const concessions = await prisma.studentFeeConcession.findMany({
      where,
      include: {
        studentProfile: {
          select: {
            id: true,
            studentId: true,
            rollNumber: true,
            firstName: true,
            lastName: true,
            firstNameBn: true,
            lastNameBn: true,
            class: { select: { id: true, name: true } },
            section: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(concessions, "Student concessions retrieved successfully");
  } catch (error) {
    return handleApiError(error, "Failed to retrieve student concessions");
  }
}

/**
 * POST /api/fees/concessions
 * Create or update a student fee concession.
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const bodyResult = await safeParseBody(request, createStudentFeeConcessionSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;

    const data = bodyResult.data;

    const student = await prisma.studentProfile.findFirst({
      where: { id: data.studentProfileId, tenantId },
    });
    if (!student) return badRequest("Student profile not found.");

    const concession = await prisma.studentFeeConcession.upsert({
      where: {
        tenantId_studentProfileId_concessionType: {
          tenantId,
          studentProfileId: data.studentProfileId,
          concessionType: data.concessionType || "CUSTOM",
        },
      },
      create: {
        tenantId,
        studentProfileId: data.studentProfileId,
        concessionType: data.concessionType || "CUSTOM",
        discountType: data.discountType || "PERCENTAGE",
        discountValue: data.discountValue,
        appliesToHead: (data as any).appliesToHead || "TUITION",
        priority: (data as any).priority ?? 10,
        validFrom: (data as any).validFrom ? new Date((data as any).validFrom) : null,
        validUntil: (data as any).validUntil ? new Date((data as any).validUntil) : null,
        reason: data.reason,
        isActive: data.isActive ?? true,
      },
      update: {
        concessionType: data.concessionType || "CUSTOM",
        discountType: data.discountType || "PERCENTAGE",
        discountValue: data.discountValue,
        appliesToHead: (data as any).appliesToHead || "TUITION",
        priority: (data as any).priority ?? 10,
        validFrom: (data as any).validFrom ? new Date((data as any).validFrom) : null,
        validUntil: (data as any).validUntil ? new Date((data as any).validUntil) : null,
        reason: data.reason,
        isActive: data.isActive ?? true,
      },
      include: {
        studentProfile: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return successResponse(
      concession,
      `Concession for ${student.firstName || ""} ${student.lastName || ""} saved successfully!`.trim(),
      201
    );
  } catch (error) {
    return handleApiError(error, "Failed to save student concession");
  }
}
