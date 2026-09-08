import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, validationError, handleApiError, badRequest } from "@/lib/api-response";
import { requireApiAccess, isTenantOwned } from "@/lib/api-auth";
import { updateHomeworkSchema } from "@/lib/schemas";
import { verifyInternalFileUrl } from "@/lib/upload-security";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.homework.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Homework not found");
    const body = await request.json();
    const parsed = updateHomeworkSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({ field: e.path.join("."), code: e.code, message: e.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    if (d.attachmentUrl && !(await verifyInternalFileUrl(d.attachmentUrl, tenantId))) {
      return validationError([{ field: "attachmentUrl", code: "invalid_file", message: "Attachment must belong to this tenant" }]);
    }
    // FK-confusion guard: class/section/subject must belong to this tenant.
    if (d.classId && !(await isTenantOwned(prisma.class, d.classId, tenantId))) {
      return badRequest("Selected class does not exist in your institution.");
    }
    if (d.sectionId && !(await isTenantOwned(prisma.section, d.sectionId, tenantId))) {
      return badRequest("Selected section does not exist in your institution.");
    }
    if (d.subjectId && !(await isTenantOwned(prisma.subject, d.subjectId, tenantId))) {
      return badRequest("Selected subject does not exist in your institution.");
    }
    const updated = await prisma.homework.update({
      where: { id },
      data: {
        ...(d.title !== undefined && { title: d.title }),
        ...(d.description !== undefined && { description: d.description }),
        ...(d.attachmentUrl !== undefined && { attachmentUrl: d.attachmentUrl || null }),
        ...(d.dueDate !== undefined && { dueDate: new Date(d.dueDate as string) }),
        ...(d.classId !== undefined && { classId: d.classId }),
        ...(d.sectionId !== undefined && { sectionId: d.sectionId || null }),
        ...(d.subjectId !== undefined && { subjectId: d.subjectId || null }),
      },
    });
    return successResponse(updated, "Homework updated");
  } catch (e) { return handleApiError(e); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.homework.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Homework not found");
    await prisma.homework.delete({ where: { id } });
    return successResponse(null, "Homework deleted");
  } catch (e) { return handleApiError(e); }
}
