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
  getGroupUsageCounts,
  integrityViolation,
  lockedDeleteMessage,
  lockedUpdateMessage,
} from "@/lib/data-integrity";

const updateGroupSchema = z.object({
  classId: z.string().min(1, "Class is required").optional(),
  name: z.string().min(2, "Group name must be at least 2 characters").optional(),
  shortName: z.string().min(1, "Short name is required").optional(),
  subjects: z.array(z.string()).default([]).optional(),
  isActive: z.boolean().default(true).optional(),
});

/**
 * GET /api/groups/[id]
 * Get a single group by ID
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

    const group = await prisma.group.findFirst({
      where: { id, tenantId },
      include: {
        class: true,
        sections: true,
      },
    });

    if (!group) {
      return notFound("Group not found");
    }

    return successResponse(group);
  } catch (error) {
    console.error("Get group error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * PUT /api/groups/[id]
 * Update a group
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
    const validation = updateGroupSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    // Check if group exists
    const existingGroup = await prisma.group.findFirst({
      where: { id, tenantId },
    });

    if (!existingGroup) {
      return notFound("Group not found");
    }

    const usageCounts = await getGroupUsageCounts(tenantId, id);
    if (
      (usageCounts.students > 0 || usageCounts.sections > 0) &&
      Object.prototype.hasOwnProperty.call(body, "classId")
    ) {
      return integrityViolation(
        lockedUpdateMessage("Group", "it already has linked students or sections"),
        buildLockedFieldsDetails(
          ["classId"],
          "the group already has linked students or sections"
        )
      );
    }

    // If changing class, verify it exists
    if (data.classId && data.classId !== existingGroup.classId) {
      const classExists = await prisma.class.findFirst({
        where: { id: data.classId, tenantId },
      });
      if (!classExists) {
        return notFound("Class not found");
      }
    }

    const updatedGroup = await prisma.group.update({
      where: { id },
      data,
      select: {
        id: true,
        groupId: true,
        name: true,
        shortName: true,
        subjects: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return successResponse(updatedGroup, "Group updated successfully");
  } catch (error) {
    console.error("Update group error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * DELETE /api/groups/[id]
 * Delete a group
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

    // Check if group exists
    const existingGroup = await prisma.group.findFirst({
      where: { id, tenantId },
    });

    if (!existingGroup) {
      return notFound("Group not found");
    }

    const usageCounts = await getGroupUsageCounts(tenantId, id);
    if (Object.values(usageCounts).some((count) => count > 0)) {
      return integrityViolation(lockedDeleteMessage("Group", usageCounts), [
        {
          field: "id",
          code: "in_use",
          message:
            "Groups with linked students or sections cannot be deleted. Mark the group inactive instead.",
        },
      ]);
    }

    await prisma.group.delete({
      where: { id },
    });

    return successResponse(null, "Group deleted successfully");
  } catch (error) {
    console.error("Delete group error:", error);
    return errorResponse("Internal server error", 500);
  }
}
