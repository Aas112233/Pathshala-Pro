import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, validationError, handleApiError } from "@/lib/api-response";
import { updateHomeworkSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

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
