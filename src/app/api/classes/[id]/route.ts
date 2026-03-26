import { hasPermission } from "@/lib/permissions";
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
import { getAuthContext } from "@/lib/auth";
import { z } from "zod";

export const runtime = 'edge';

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
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;
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
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;
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
    const authContext = await getAuthContext(request);
    if (!authContext) {
      return unauthorized("Authentication required");
    }

    const { tenantId } = authContext;
    const { id } = await params;

    // Check if class exists
    const existingClass = await prisma.class.findUnique({
      where: { id, tenantId },
    });

    if (!existingClass) {
      return notFound("Class not found");
    }

    // Check for related records
    const studentCount = await prisma.studentProfile.count({
      where: { classId: id },
    });

    if (studentCount > 0) {
      return badRequest("Cannot delete class with enrolled students");
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
