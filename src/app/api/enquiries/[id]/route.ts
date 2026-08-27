import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFound,
  validationError,
  handleApiError,
  badRequest,
} from "@/lib/api-response";
import { updateEnquirySchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const enquiry = await prisma.enquiry.findFirst({
      where: { id, tenantId },
      include: { classApplied: { select: { id: true, name: true } } },
    });
    if (!enquiry) return notFound("Enquiry not found");
    return successResponse(enquiry);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;

    const existing = await prisma.enquiry.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Enquiry not found");
    if (existing.status === "ADMITTED" && existing.convertedStudentId) {
      // Allow editing notes but warn - still permit
    }

    const body = await request.json();
    const parsed = updateEnquirySchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({
        field: e.path.join("."),
        code: e.code,
        message: e.message,
      }));
      return validationError(errors);
    }
    const d = parsed.data;

    if (d.classAppliedId) {
      const cls = await prisma.class.findFirst({ where: { id: d.classAppliedId, tenantId } });
      if (!cls) return badRequest("Class not found");
    }

    const updated = await prisma.enquiry.update({
      where: { id },
      data: {
        ...(d.studentName !== undefined && { studentName: d.studentName }),
        ...(d.guardianName !== undefined && { guardianName: d.guardianName }),
        ...(d.phone !== undefined && { phone: d.phone }),
        ...(d.email !== undefined && { email: d.email || null }),
        ...(d.classAppliedId !== undefined && { classAppliedId: d.classAppliedId || null }),
        ...(d.source !== undefined && { source: d.source }),
        ...(d.status !== undefined && { status: d.status }),
        ...(d.followUpDate !== undefined && { followUpDate: d.followUpDate ? new Date(d.followUpDate as string) : null }),
        ...(d.notes !== undefined && { notes: d.notes || null }),
        ...(d.assignedToId !== undefined && { assignedToId: d.assignedToId || null }),
      },
      include: { classApplied: { select: { id: true, name: true } } },
    });

    return successResponse(updated, "Enquiry updated");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;

    const existing = await prisma.enquiry.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Enquiry not found");

    await prisma.enquiry.delete({ where: { id } });
    return successResponse(null, "Enquiry deleted");
  } catch (error) {
    return handleApiError(error);
  }
}
