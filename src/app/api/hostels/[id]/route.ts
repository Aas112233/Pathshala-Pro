import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, validationError, handleApiError, badRequest } from "@/lib/api-response";
import { updateHostelSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.hostel.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Hostel not found");
    const body = await request.json();
    const parsed = updateHostelSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({ field: e.path.join("."), code: e.code, message: e.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    if (d.name && d.name !== existing.name) {
      const dup = await prisma.hostel.findFirst({ where: { tenantId, name: d.name, id: { not: id } } });
      if (dup) return badRequest("Hostel name already exists");
    }
    const updated = await prisma.hostel.update({
      where: { id },
      data: {
        ...(d.name !== undefined && { name: d.name }),
        ...(d.type !== undefined && { type: d.type }),
        ...(d.wardenName !== undefined && { wardenName: d.wardenName || null }),
        ...(d.wardenPhone !== undefined && { wardenPhone: d.wardenPhone || null }),
        ...(d.address !== undefined && { address: d.address || null }),
        ...(d.capacity !== undefined && { capacity: d.capacity }),
        ...(d.isActive !== undefined && { isActive: d.isActive }),
      },
    });
    return successResponse(updated, "Hostel updated");
  } catch (e: any) { if (e?.code === "P2002") return badRequest("Duplicate"); return handleApiError(e); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.hostel.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Hostel not found");
    await prisma.hostelAllocation.deleteMany({ where: { hostelId: id, tenantId } });
    await prisma.hostelRoom.deleteMany({ where: { hostelId: id, tenantId } });
    await prisma.hostel.delete({ where: { id } });
    return successResponse(null, "Hostel deleted");
  } catch (e) { return handleApiError(e); }
}
