import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, handleApiError, validationError } from "@/lib/api-response";
import { updateAllocationSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.transportAllocation.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Allocation not found");
    const body = await request.json();
    const parsed = updateAllocationSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({ field: e.path.join("."), code: e.code, message: e.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    if (d.routeId) {
      const route = await prisma.transportRoute.findFirst({ where: { id: d.routeId, tenantId } });
      if (!route) return handleApiError(new Error("Route not found"));
      if (d.stopName && !route.stops.includes(d.stopName)) {
        return validationError([{ field: "stopName", code: "invalid", message: "Stop not on route" }]);
      }
    }
    const updated = await prisma.transportAllocation.update({
      where: { id },
      data: {
        ...(d.routeId !== undefined && { routeId: d.routeId }),
        ...(d.stopName !== undefined && { stopName: d.stopName }),
        ...(d.monthlyFee !== undefined && { monthlyFee: d.monthlyFee }),
        ...(d.routeId !== undefined && { vehicleId: (await prisma.transportRoute.findFirst({ where: { id: d.routeId! } }))?.vehicleId || null }),
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
    const existing = await prisma.transportAllocation.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Allocation not found");
    await prisma.transportAllocation.delete({ where: { id } });
    return successResponse(null, "Allocation removed");
  } catch (e) { return handleApiError(e); }
}
