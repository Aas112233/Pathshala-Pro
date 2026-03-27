import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  unauthorized,
  notFound,
  badRequest,
} from "@/lib/api-response";
import { updateStaffSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import {
  buildLockedFieldsDetails,
  getStaffUsageCounts,
  integrityViolation,
  lockedDeleteMessage,
  lockedUpdateMessage,
} from "@/lib/data-integrity";

/**
 * GET /api/staff/[id]
 * Get a single staff member by ID
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

    const staff = await prisma.staffProfile.findUnique({
      where: { id, tenantId },
      include: {
        salaryLedgers: {
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            month: true,
            year: true,
            baseSalary: true,
            deductions: true,
            advances: true,
            netPayable: true,
            paidAmount: true,
            status: true,
          },
        },
        attendances: {
          take: 5,
          orderBy: { date: "desc" },
          select: {
            date: true,
            status: true,
            note: true,
          },
        },
      },
    });

    if (!staff) {
      return notFound("Staff member not found");
    }

    return successResponse(staff);
  } catch (error) {
    console.error("Get staff error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * PUT /api/staff/[id]
 * Update a staff member
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
    const validation = updateStaffSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return badRequest("Invalid input", errors);
    }

    const data = validation.data;

    const existingStaff = await prisma.staffProfile.findUnique({
      where: { id, tenantId },
    });

    if (!existingStaff) {
      return notFound("Staff member not found");
    }

    const usageCounts = await getStaffUsageCounts(tenantId, id);
    const lockedFields: string[] = [];

    if (
      (usageCounts.salaryLedgers > 0 || usageCounts.attendances > 0) &&
      Object.prototype.hasOwnProperty.call(body, "staffId")
    ) {
      lockedFields.push("staffId");
    }

    if (
      usageCounts.salaryLedgers > 0 &&
      Object.prototype.hasOwnProperty.call(body, "hireDate")
    ) {
      lockedFields.push("hireDate");
    }

    if (lockedFields.length > 0) {
      return integrityViolation(
        lockedUpdateMessage("Staff member", "salary or attendance history already exists"),
        buildLockedFieldsDetails(
          lockedFields,
          "salary or attendance history already exists for this staff member"
        )
      );
    }

    // Check staff ID uniqueness if changing
    if (data.staffId && data.staffId !== existingStaff.staffId) {
      const idExists = await prisma.staffProfile.findFirst({
        where: { tenantId, staffId: data.staffId, id: { not: id } },
      });

      if (idExists) {
        return badRequest("Staff ID already in use", [
          { field: "staffId", code: "duplicate", message: "Staff ID already exists" },
        ]);
      }
    }

    const updatedStaff = await prisma.staffProfile.update({
      where: { id },
      data,
      select: {
        id: true,
        staffId: true,
        firstName: true,
        lastName: true,
        firstNameBn: true,
        lastNameBn: true,
        department: true,
        designation: true,
        baseSalary: true,
        email: true,
        phone: true,
        isActive: true,
        hireDate: true,
        joiningDate: true,
        qualification: true,
        gender: true,
        dateOfBirth: true,
        address: true,
        profilePictureUrl: true,
        driveFileId: true,
        userId: true,
        updatedAt: true,
      },
    });

    return successResponse(updatedStaff, "Staff member updated successfully");
  } catch (error) {
    console.error("Update staff error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * DELETE /api/staff/[id]
 * Delete a staff member
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

    const existingStaff = await prisma.staffProfile.findUnique({
      where: { id, tenantId },
    });

    if (!existingStaff) {
      return notFound("Staff member not found");
    }

    const usageCounts = await getStaffUsageCounts(tenantId, id);
    if (Object.values(usageCounts).some((count) => count > 0)) {
      return integrityViolation(lockedDeleteMessage("Staff member", usageCounts), [
        {
          field: "id",
          code: "in_use",
          message:
            "Staff members with salary, attendance, or linked user history cannot be deleted. Mark the profile inactive instead.",
        },
      ]);
    }

    await prisma.staffProfile.delete({
      where: { id },
    });

    return successResponse(null, "Staff member deleted successfully");
  } catch (error) {
    console.error("Delete staff error:", error);
    return errorResponse("Internal server error", 500);
  }
}
