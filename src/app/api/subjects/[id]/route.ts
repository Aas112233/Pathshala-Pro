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
import { updateSubjectSchema } from "@/lib/schemas";
import { getAuthContext } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

/**
 * GET /api/subjects/[id]
 * Get a single subject by ID
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

    const subject = await prisma.subject.findUnique({
      where: { id, tenantId },
    });

    if (!subject) {
      return notFound("Subject not found");
    }

    return successResponse(subject, "Subject retrieved successfully");
  } catch (error) {
    console.error("Get subject error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * PUT /api/subjects/[id]
 * Update a subject
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
    const validation = updateSubjectSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const data = validation.data;

    const existingSubject = await prisma.subject.findUnique({
      where: { id, tenantId },
    });

    if (!existingSubject) {
      return notFound("Subject not found");
    }

    // Check subject ID uniqueness if changing
    if (data.subjectId && data.subjectId !== existingSubject.subjectId) {
      const idExists = await prisma.subject.findFirst({
        where: { tenantId, subjectId: data.subjectId, id: { not: id } },
      });

      if (idExists) {
        return badRequest("Subject ID already in use", [
          { field: "subjectId", code: "duplicate", message: "Subject ID already exists" },
        ]);
      }
    }

    const updatedSubject = await prisma.subject.update({
      where: { id },
      data,
    });

    return successResponse(updatedSubject, "Subject updated successfully");
  } catch (error) {
    console.error("Update subject error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * DELETE /api/subjects/[id]
 * Delete a subject
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

    const existingSubject = await prisma.subject.findUnique({
      where: { id, tenantId },
    });

    if (!existingSubject) {
      return notFound("Subject not found");
    }

    // Check if subject is used in any exam results
    const resultsCount = await prisma.examResult.count({
      where: { subjectId: id },
    });

    if (resultsCount > 0) {
      return badRequest("Cannot delete subject with existing exam results", [
        { field: "subjectId", code: "in_use", message: "Subject is used in exam results" },
      ]);
    }

    await prisma.subject.delete({
      where: { id },
    });

    return successResponse(null, "Subject deleted successfully");
  } catch (error) {
    console.error("Delete subject error:", error);
    return errorResponse("Internal server error", 500);
  }
}
