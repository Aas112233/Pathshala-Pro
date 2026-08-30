// @ts-nocheck
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFound,
  handleApiError,
  safeParseBody,
} from "@/lib/api-response";
import { updateClassFeeStructureSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { integrityViolation, lockedUpdateMessage, buildLockedFieldsDetails } from "@/lib/data-integrity";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/fees/structures/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    const structure = await prisma.classFeeStructure.findFirst({
      where: { id, tenantId },
      include: {
        class: { select: { id: true, name: true, classNumber: true } },
        academicYear: { select: { id: true, label: true } },
      },
    });

    if (!structure) return notFound("Class fee structure not found.");

    return successResponse(structure);
  } catch (error) {
    return handleApiError(error, "Failed to get class fee structure");
  }
}

/**
 * PUT /api/fees/structures/[id]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    const existing = await prisma.classFeeStructure.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return notFound("Class fee structure not found.");

    const issuedVouchers = await prisma.feeVoucher.count({
      where: { tenantId, academicYearId: existing.academicYearId },
    });
    if (issuedVouchers > 0) {
      return integrityViolation(
        lockedUpdateMessage("Class fee structure", "fee vouchers have already been issued for this academic year"),
        buildLockedFieldsDetails(
          ["tuitionFee", "labFee", "computerFee", "examFee", "sportsFee", "libraryFee", "otherFee"],
          "fee vouchers already exist for this academic year"
        )
      );
    }

    const bodyResult = await safeParseBody(request, updateClassFeeStructureSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;

    const data = bodyResult.data;

    const tuitionFee = data.tuitionFee !== undefined ? data.tuitionFee : existing.tuitionFee;
    const labFee = data.labFee !== undefined ? data.labFee : existing.labFee;
    const computerFee = data.computerFee !== undefined ? data.computerFee : existing.computerFee;
    const examFee = data.examFee !== undefined ? data.examFee : existing.examFee;
    const sportsFee = data.sportsFee !== undefined ? data.sportsFee : existing.sportsFee;
    const libraryFee = data.libraryFee !== undefined ? data.libraryFee : existing.libraryFee;
    const otherFee = data.otherFee !== undefined ? data.otherFee : existing.otherFee;
    const totalMonthlyFee =
      tuitionFee + labFee + computerFee + examFee + sportsFee + libraryFee + otherFee;

    const updated = await prisma.classFeeStructure.update({
      where: { id },
      data: {
        ...data,
        tuitionFee,
        labFee,
        computerFee,
        examFee,
        sportsFee,
        libraryFee,
        otherFee,
        totalMonthlyFee,
      },
      include: {
        class: { select: { id: true, name: true, classNumber: true } },
        academicYear: { select: { id: true, label: true } },
      },
    });

    return successResponse(updated, "Fee structure updated successfully!");
  } catch (error) {
    return handleApiError(error, "Failed to update class fee structure");
  }
}

/**
 * DELETE /api/fees/structures/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    const existing = await prisma.classFeeStructure.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return notFound("Class fee structure not found.");

    const issuedVouchers = await prisma.feeVoucher.count({
      where: { tenantId, academicYearId: existing.academicYearId },
    });
    if (issuedVouchers > 0) {
      return integrityViolation(
        "Class fee structure cannot be deleted because fee vouchers already exist for this academic year",
        buildLockedFieldsDetails(["id"], "historical fee vouchers depend on this academic-year structure")
      );
    }

    await prisma.classFeeStructure.delete({
      where: { id },
    });

    return successResponse(null, "Fee structure deleted successfully!");
  } catch (error) {
    return handleApiError(error, "Failed to delete class fee structure");
  }
}
