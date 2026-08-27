import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, validationError, handleApiError, badRequest } from "@/lib/api-response";
import { updateVehicleSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.transportVehicle.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Vehicle not found");
    const body = await request.json();
    const parsed = updateVehicleSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({ field: e.path.join("."), code: e.code, message: e.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    if (d.vehicleNo && d.vehicleNo !== existing.vehicleNo) {
      const dup = await prisma.transportVehicle.findFirst({ where: { tenantId, vehicleNo: d.vehicleNo, id: { not: id } } });
      if (dup) return badRequest("Vehicle number already exists");
    }
    const updated = await prisma.transportVehicle.update({
      where: { id },
      data: {
        ...(d.vehicleNo !== undefined && { vehicleNo: d.vehicleNo }),
        ...(d.type !== undefined && { type: d.type }),
        ...(d.capacity !== undefined && { capacity: d.capacity }),
        ...(d.driverName !== undefined && { driverName: d.driverName || null }),
        ...(d.driverPhone !== undefined && { driverPhone: d.driverPhone || null }),
        ...(d.isActive !== undefined && { isActive: d.isActive }),
      },
    });
    return successResponse(updated, "Vehicle updated");
  } catch (e: any) { if (e?.code === "P2002") return badRequest("Duplicate"); return handleApiError(e); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.transportVehicle.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Vehicle not found");
    const used = await prisma.transportAllocation.count({ where: { vehicleId: id, tenantId } });
    if (used > 0) {
      // Unlink instead of block? Keep allocations but nullify vehicle
      await prisma.transportAllocation.updateMany({ where: { vehicleId: id, tenantId }, data: { vehicleId: null } });
      await prisma.transportRoute.updateMany({ where: { vehicleId: id, tenantId }, data: { vehicleId: null } });
    }
    await prisma.transportVehicle.delete({ where: { id } });
    return successResponse(null, "Vehicle deleted");
  } catch (e) { return handleApiError(e); }
}
