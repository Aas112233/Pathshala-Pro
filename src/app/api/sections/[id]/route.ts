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
  getSectionUsageCounts,
  integrityViolation,
  lockedDeleteMessage,
  lockedUpdateMessage,
} from "@/lib/data-integrity";

const updateSectionSchema = z.object({
  classId: z.string().min(1, "Class is required").optional(),
  groupId: z.string().optional(),
  name: z.string().min(2, "Section name must be at least 2 characters").optional(),
  shortName: z.string().min(1, "Short name is required").optional(),
  capacity: z.number().int().positive().optional(),
  roomNumber: z.string().optional(),
  isActive: z.boolean().default(true).optional(),
});

/**
 * GET /api/sections/[id]
 * Get a single section by ID
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

    const section = await prisma.section.findFirst({
      where: { id, tenantId },
      include: {
        class: true,
        group: true,
      },
    });

    if (!section) {
      return notFound("Section not found");
    }

    return successResponse(section);
  } catch (error) {
    console.error("Get section error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * PUT /api/sections/[id]
 * Update a section
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
    const validation = updateSectionSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    // Check if section exists
    const existingSection = await prisma.section.findFirst({
      where: { id, tenantId },
    });

    if (!existingSection) {
      return notFound("Section not found");
    }

    const usageCounts = await getSectionUsageCounts(tenantId, id);
    const lockedFields = ["classId", "groupId"].filter(
      (field) =>
        usageCounts.students > 0 && Object.prototype.hasOwnProperty.call(body, field)
    );

    if (lockedFields.length > 0) {
      return integrityViolation(
        lockedUpdateMessage("Section", "students are already assigned to it"),
        buildLockedFieldsDetails(lockedFields, "students are already assigned to this section")
      );
    }

    // If changing class, verify it exists
    if (data.classId && data.classId !== existingSection.classId) {
      const classExists = await prisma.class.findFirst({
        where: { id: data.classId, tenantId },
      });
      if (!classExists) {
        return notFound("Class not found");
      }
    }

    // If changing/adding group, verify it exists
    if (data.groupId && data.groupId !== existingSection.groupId) {
      const groupExists = await prisma.group.findFirst({
        where: { id: data.groupId, tenantId },
      });
      if (!groupExists) {
        return notFound("Group not found");
      }
    }

    const updatedSection = await prisma.section.update({
      where: { id },
      data,
      select: {
        id: true,
        sectionId: true,
        name: true,
        shortName: true,
        capacity: true,
        roomNumber: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return successResponse(updatedSection, "Section updated successfully");
  } catch (error) {
    console.error("Update section error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * DELETE /api/sections/[id]
 * Delete a section
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

    // Check if section exists
    const existingSection = await prisma.section.findFirst({
      where: { id, tenantId },
    });

    if (!existingSection) {
      return notFound("Section not found");
    }

    const usageCounts = await getSectionUsageCounts(tenantId, id);
    if (usageCounts.students > 0) {
      return integrityViolation(lockedDeleteMessage("Section", usageCounts), [
        {
          field: "id",
          code: "in_use",
          message:
            "Sections with assigned students cannot be deleted. Move the students or mark the section inactive instead.",
        },
      ]);
    }

    await prisma.section.delete({ where: { id } });

    return successResponse(null, "Section deleted successfully");
  } catch (error) {
    console.error("Delete section error:", error);
    return errorResponse("Internal server error", 500);
  }
}
