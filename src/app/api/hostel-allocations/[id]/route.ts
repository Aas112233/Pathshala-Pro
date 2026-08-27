import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, handleApiError, validationError } from "@/lib/api-response";
import { updateHostelAllocationSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.hostelAllocation.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Allocation not found");
    const body = await request.json();
    const parsed = updateHostelAllocationSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({ field: e.path.join("."), code: e.code, message: e.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    // If moving to different room, check capacity
    const targetRoomId = d.roomId || existing.roomId;
    if (d.roomId && d.roomId !== existing.roomId) {
      const room = await prisma.hostelRoom.findFirst({ where: { id: targetRoomId, tenantId } });
      if (!room) return handleApiError(new Error("Room not found"));
      const occ = await prisma.hostelAllocation.count({ where: { roomId: targetRoomId, tenantId, status: "ACTIVE", id: { not: id } } });
      if (occ >= room.capacity) return validationError([{ field: "roomId", code: "room_full", message: "Room is full" }]);
    }
    const updated = await prisma.hostelAllocation.update({
      where: { id },
      data: {
        ...(d.hostelId !== undefined && { hostelId: d.hostelId }),
        ...(d.roomId !== undefined && { roomId: d.roomId }),
        ...(d.bedNumber !== undefined && { bedNumber: d.bedNumber || null }),
        ...(d.studentProfileId !== undefined && { studentProfileId: d.studentProfileId }),
      },
    });
    return successResponse(updated, "Allocation updated");
  } catch (e) { return handleApiError(e); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.hostelAllocation.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Allocation not found");
    // Soft vacate: mark VACATED instead of hard delete to keep history
    await prisma.hostelAllocation.update({ where: { id }, data: { status: "VACATED", vacatedAt: new Date() } });
    return successResponse(null, "Allocation vacated");
  } catch (e) { return handleApiError(e); }
}
