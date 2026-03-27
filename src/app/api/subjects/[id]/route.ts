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
import { requireApiAccess } from "@/lib/api-auth";
import {
  buildLockedFieldsDetails,
  getSubjectUsageCounts,
  integrityViolation,
  lockedDeleteMessage,
  lockedUpdateMessage,
} from "@/lib/data-integrity";

/**
 * GET /api/subjects/[id]
 * Get a single subject by ID
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
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
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

    const usageCounts = await getSubjectUsageCounts(tenantId, id);
    const subjectLocked =
      usageCounts.examResults > 0 || usageCounts.examMappings > 0 || usageCounts.classMappings > 0;
    const attemptedCoreFields = [
      "subjectId",
      "name",
      "code",
      "category",
      "maxMarks",
      "passMarks",
    ].filter((field) => Object.prototype.hasOwnProperty.call(body, field));

    if (subjectLocked && attemptedCoreFields.length > 0) {
      return integrityViolation(
        lockedUpdateMessage(
          "Subject",
          "it is already linked to class mapping, exam setup, or exam results"
        ),
        buildLockedFieldsDetails(
          attemptedCoreFields,
          "the subject is already linked to class mapping, exam setup, or exam results"
        )
      );
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
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { tenantId } = access.authContext;
    const { id } = await params;

    const existingSubject = await prisma.subject.findUnique({
      where: { id, tenantId },
    });

    if (!existingSubject) {
      return notFound("Subject not found");
    }

    const usageCounts = await getSubjectUsageCounts(tenantId, id);
    if (Object.values(usageCounts).some((count) => count > 0)) {
      return integrityViolation(lockedDeleteMessage("Subject", usageCounts), [
        {
          field: "id",
          code: "in_use",
          message:
            "Subjects already used by class setup, exam setup, or results cannot be deleted. Mark the subject inactive instead.",
        },
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
