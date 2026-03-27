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
import { updateAcademicYearSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import {
  buildLockedFieldsDetails,
  getAcademicYearUsageCounts,
  integrityViolation,
  lockedDeleteMessage,
  lockedUpdateMessage,
} from "@/lib/data-integrity";

/**
 * GET /api/academic-years/[id]
 * Get a single academic year by ID
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

    const academicYear = await prisma.academicYear.findUnique({
      where: { id, tenantId },
      include: {
        feeVouchers: {
          take: 5,
          select: {
            voucherId: true,
            feeType: true,
            totalDue: true,
            status: true,
          },
        },
        salaryLedgers: {
          take: 5,
          select: {
            month: true,
            year: true,
            netPayable: true,
            status: true,
          },
        },
        examResults: {
          take: 5,
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
            studentProfile: {
              select: {
                firstName: true,
                lastName: true,
                studentId: true,
              },
            },
            grade: true,
            status: true,
          },
        },
      },
    });

    if (!academicYear) {
      return notFound("Academic year not found");
    }

    return successResponse(academicYear);
  } catch (error) {
    console.error("Get academic year error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * PUT /api/academic-years/[id]
 * Update an academic year
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
    const validation = updateAcademicYearSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err: any) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return badRequest("Invalid input", errors);
    }

    const data = validation.data;

    // Check if academic year exists
    const existingYear = await prisma.academicYear.findUnique({
      where: { id, tenantId },
    });

    if (!existingYear) {
      return notFound("Academic year not found");
    }

    if (existingYear.isClosed) {
      return integrityViolation(
        lockedUpdateMessage("Academic year", "it has already been closed"),
        [
          {
            field: "isClosed",
            code: "locked",
            message:
              "Closed academic years are read-only. Reopen support should be a separate controlled workflow if needed.",
          },
        ]
      );
    }

    const usageCounts = await getAcademicYearUsageCounts(tenantId, id);
    const hasUsage = Object.values(usageCounts).some((count) => count > 0);
    const attemptedFrozenFields = ["yearId", "label", "startDate", "endDate"].filter((field) =>
      Object.prototype.hasOwnProperty.call(body, field)
    );

    if (hasUsage && attemptedFrozenFields.length > 0) {
      return integrityViolation(
        lockedUpdateMessage(
          "Academic year",
          "operational records already exist in this academic year"
        ),
        buildLockedFieldsDetails(
          attemptedFrozenFields,
          "operational records already exist in this academic year"
        )
      );
    }

    // Check year ID uniqueness if changing
    if (data.yearId && data.yearId !== existingYear.yearId) {
      const idExists = await prisma.academicYear.findFirst({
        where: { tenantId, yearId: data.yearId, id: { not: id } },
      });

      if (idExists) {
        return badRequest("Year ID already in use", [
          { field: "yearId", code: "duplicate", message: "Year ID already exists" },
        ]);
      }
    }

    // Validate dates if both are provided
    if (data.startDate && data.endDate) {
      if (new Date(data.startDate) >= new Date(data.endDate)) {
        return badRequest("Invalid dates", [
          {
            field: "startDate",
            code: "invalid",
            message: "Start date must be before end date",
          },
        ]);
      }
    }

    const updatedAcademicYear = await prisma.academicYear.update({
      where: { id },
      data,
      select: {
        id: true,
        yearId: true,
        label: true,
        startDate: true,
        endDate: true,
        isClosed: true,
        updatedAt: true,
      },
    });

    return successResponse(updatedAcademicYear, "Academic year updated successfully");
  } catch (error) {
    console.error("Update academic year error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * DELETE /api/academic-years/[id]
 * Delete an academic year
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

    // Check if academic year exists
    const existingYear = await prisma.academicYear.findUnique({
      where: { id, tenantId },
    });

    if (!existingYear) {
      return notFound("Academic year not found");
    }

    const usageCounts = await getAcademicYearUsageCounts(tenantId, id);
    if (Object.values(usageCounts).some((count) => count > 0)) {
      return integrityViolation(lockedDeleteMessage("Academic year", usageCounts), [
        {
          field: "id",
          code: "in_use",
          message:
            "Academic years with linked finance, exam, or promotion records cannot be deleted.",
        },
      ]);
    }

    await prisma.academicYear.delete({
      where: { id },
    });

    return successResponse(null, "Academic year deleted successfully");
  } catch (error) {
    console.error("Delete academic year error:", error);
    return errorResponse("Internal server error", 500);
  }
}
