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
import { requireApiAccess } from "@/lib/api-auth";
import { z } from "zod";
import {
  buildLockedFieldsDetails,
  getClassUsageCounts,
  integrityViolation,
  lockedDeleteMessage,
  lockedUpdateMessage,
} from "@/lib/data-integrity";

const updateClassSchema = z.object({
  name: z.string().min(2, "Class name must be at least 2 characters").optional(),
  classNumber: z.number().int().positive("Class number must be positive").optional(),
  isActive: z.boolean().default(true).optional(),
});

/**
 * GET /api/classes/[id]
 * Get a single class by ID
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

    const classData = await prisma.class.findUnique({
      where: { id, tenantId },
      include: {
        groups: {
          orderBy: { createdAt: "desc" },
        },
        sections: {
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            studentProfiles: true,
          },
        },
      },
    });

    if (!classData) {
      return notFound("Class not found");
    }

    return successResponse(classData);
  } catch (error) {
    console.error("Get class error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * PUT /api/classes/[id]
 * Update a class
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
    const validation = updateClassSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    // Check if class exists
    const existingClass = await prisma.class.findUnique({
      where: { id, tenantId },
    });

    if (!existingClass) {
      return notFound("Class not found");
    }

    const usageCounts = await getClassUsageCounts(tenantId, id);
    const lockedFields: string[] = [];

    if (
      usageCounts.promotions > 0 &&
      Object.prototype.hasOwnProperty.call(body, "name")
    ) {
      lockedFields.push("name");
    }

    if (
      (usageCounts.students > 0 ||
        usageCounts.promotions > 0 ||
        usageCounts.classSubjects > 0 ||
        usageCounts.promotionRules > 0) &&
      Object.prototype.hasOwnProperty.call(body, "classNumber")
    ) {
      lockedFields.push("classNumber");
    }

    if (lockedFields.length > 0) {
      return integrityViolation(
        lockedUpdateMessage(
          "Class",
          "it already has linked students, promotions, or academic setup"
        ),
        buildLockedFieldsDetails(
          lockedFields,
          "the class already has linked students, promotions, or academic setup"
        )
      );
    }

    const updatedClass = await prisma.class.update({
      where: { id },
      data,
      select: {
        id: true,
        classId: true,
        name: true,
        classNumber: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return successResponse(updatedClass, "Class updated successfully");
  } catch (error) {
    console.error("Update class error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * DELETE /api/classes/[id]
 * Delete a class
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

    // Check if class exists
    const existingClass = await prisma.class.findUnique({
      where: { id, tenantId },
    });

    if (!existingClass) {
      return notFound("Class not found");
    }

    const usageCounts = await getClassUsageCounts(tenantId, id);
    if (Object.values(usageCounts).some((count) => count > 0)) {
      return integrityViolation(lockedDeleteMessage("Class", usageCounts), [
        {
          field: "id",
          code: "in_use",
          message:
            "Classes with enrolled students, setup mappings, or promotion history cannot be deleted. Mark the class inactive instead.",
        },
      ]);
    }

    await prisma.class.delete({
      where: { id },
    });

    return successResponse(null, "Class deleted successfully");
  } catch (error) {
    console.error("Delete class error:", error);
    return errorResponse("Internal server error", 500);
  }
}
