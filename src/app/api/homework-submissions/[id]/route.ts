import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, validationError, handleApiError } from "@/lib/api-response";
import { gradeSubmissionSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.homeworkSubmission.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Submission not found");
    const body = await request.json();
    const parsed = gradeSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({ field: e.path.join("."), code: e.code, message: e.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    const updated = await prisma.homeworkSubmission.update({
      where: { id },
      data: {
        ...(d.grade !== undefined && { grade: d.grade }),
        ...(d.remarks !== undefined && { remarks: d.remarks || null }),
        ...(d.status !== undefined && { status: d.status }),
      },
    });
    return successResponse(updated, "Graded");
  } catch (e) { return handleApiError(e); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.homeworkSubmission.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Submission not found");
    await prisma.homeworkSubmission.delete({ where: { id } });
    return successResponse(null, "Submission deleted");
  } catch (e) { return handleApiError(e); }
}
