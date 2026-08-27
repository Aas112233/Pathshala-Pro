import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, validationError, handleApiError, badRequest } from "@/lib/api-response";
import { updateHostelRoomSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.hostelRoom.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Room not found");
    const body = await request.json();
    const parsed = updateHostelRoomSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({ field: e.path.join("."), code: e.code, message: e.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    if (d.roomNumber && d.roomNumber !== existing.roomNumber) {
      const dup = await prisma.hostelRoom.findFirst({ where: { tenantId, hostelId: existing.hostelId, roomNumber: d.roomNumber, id: { not: id } } });
      if (dup) return badRequest("Room number already exists");
    }
    if (d.capacity !== undefined) {
      const allocCount = await prisma.hostelAllocation.count({ where: { roomId: id, tenantId, status: "ACTIVE" } });
      if (d.capacity < allocCount) return badRequest(`Cannot reduce capacity below current occupancy (${allocCount})`);
    }
    const updated = await prisma.hostelRoom.update({
      where: { id },
      data: {
        ...(d.roomNumber !== undefined && { roomNumber: d.roomNumber }),
        ...(d.floor !== undefined && { floor: d.floor }),
        ...(d.capacity !== undefined && { capacity: d.capacity }),
        ...(d.roomType !== undefined && { roomType: d.roomType }),
        ...(d.isActive !== undefined && { isActive: d.isActive }),
        ...(d.hostelId !== undefined && { hostelId: d.hostelId }),
      },
    });
    return successResponse(updated, "Room updated");
  } catch (e: any) { if (e?.code === "P2002") return badRequest("Duplicate"); return handleApiError(e); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.hostelRoom.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Room not found");
    await prisma.hostelAllocation.deleteMany({ where: { roomId: id, tenantId } });
    await prisma.hostelRoom.delete({ where: { id } });
    return successResponse(null, "Room deleted");
  } catch (e) { return handleApiError(e); }
}
