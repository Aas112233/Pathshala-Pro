import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFound,
  badRequest,
  handleApiError,
  safeParseBody,
} from "@/lib/api-response";
import { updateClassFeeStructureSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { assertAcademicYearOpen } from "@/lib/academic-year-guards";
import { integrityViolation, lockedUpdateMessage, buildLockedFieldsDetails } from "@/lib/data-integrity";
import { addCurrency } from "@/lib/math-utils";

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

    // Checked before the voucher lock: "this year is frozen" is the stronger
    // statement, and it holds even for a year with no vouchers issued yet.
    await assertAcademicYearOpen(tenantId, existing.academicYearId);

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

    // The update schema is a partial of the create schema and the write below
    // spreads it, so `academicYearId` is writable — meaning a structure can be
    // *moved* to another year. That is the one remaining route by which a frozen
    // year could gain a structure, so the destination is resolved and checked the
    // same way the create path resolves it (which accepts an internal id or a
    // `yearId` code).
    let destinationAcademicYearId: string | undefined;
    if (data.academicYearId && data.academicYearId !== existing.academicYearId) {
      const destination = await prisma.academicYear.findFirst({
        where: { tenantId, OR: [{ id: data.academicYearId }, { yearId: data.academicYearId }] },
        select: { id: true },
      });
      if (!destination) {
        return badRequest(`Selected academic year (${data.academicYearId}) not found.`);
      }
      await assertAcademicYearOpen(tenantId, destination.id);
      // Write the resolved internal id, never the raw value: a `yearId` code
      // landing in the `academicYearId` column would corrupt the year reference.
      destinationAcademicYearId = destination.id;
    }

    const tuitionFee = data.tuitionFee !== undefined ? data.tuitionFee : existing.tuitionFee;
    const labFee = data.labFee !== undefined ? data.labFee : existing.labFee;
    const computerFee = data.computerFee !== undefined ? data.computerFee : existing.computerFee;
    const examFee = data.examFee !== undefined ? data.examFee : existing.examFee;
    const sportsFee = data.sportsFee !== undefined ? data.sportsFee : existing.sportsFee;
    const libraryFee = data.libraryFee !== undefined ? data.libraryFee : existing.libraryFee;
    const otherFee = data.otherFee !== undefined ? data.otherFee : existing.otherFee;
    const totalMonthlyFee = addCurrency(
      tuitionFee, labFee, computerFee, examFee, sportsFee, libraryFee, otherFee,
    );

    const updated = await prisma.classFeeStructure.update({
      where: { id },
      data: {
        ...data,
        ...(destinationAcademicYearId && { academicYearId: destinationAcademicYearId }),
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

    await assertAcademicYearOpen(tenantId, existing.academicYearId);

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
