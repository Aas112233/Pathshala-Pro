import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, validationError, handleApiError, badRequest } from "@/lib/api-response";
import { updateRouteSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.transportRoute.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Route not found");
    const body = await request.json();
    const parsed = updateRouteSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({ field: e.path.join("."), code: e.code, message: e.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    if (d.name && d.name !== existing.name) {
      const dup = await prisma.transportRoute.findFirst({ where: { tenantId, name: d.name, id: { not: id } } });
      if (dup) return badRequest("Route name already exists");
    }
    if (d.vehicleId) {
      const v = await prisma.transportVehicle.findFirst({ where: { id: d.vehicleId, tenantId } });
      if (!v) return badRequest("Vehicle not found");
    }
    const updated = await prisma.transportRoute.update({
      where: { id },
      data: {
        ...(d.name !== undefined && { name: d.name }),
        ...(d.stops !== undefined && { stops: d.stops }),
        ...(d.vehicleId !== undefined && { vehicleId: d.vehicleId || null }),
        ...(d.monthlyFee !== undefined && { monthlyFee: d.monthlyFee }),
        ...(d.isActive !== undefined && { isActive: d.isActive }),
      },
    });
    return successResponse(updated, "Route updated");
  } catch (e: any) { if (e?.code === "P2002") return badRequest("Duplicate"); return handleApiError(e); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.transportRoute.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Route not found");
    await prisma.transportAllocation.deleteMany({ where: { routeId: id, tenantId } });
    await prisma.transportRoute.delete({ where: { id } });
    return successResponse(null, "Route deleted");
  } catch (e) { return handleApiError(e); }
}
