import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, paginatedResponse, badRequest, validationError, handleApiError } from "@/lib/api-response";
import { createAllocationSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { MAX_PAGE_SIZE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const search = searchParams.get("search")?.trim() || "";
    const routeId = searchParams.get("routeId") || "";
    const where: any = { tenantId };
    if (routeId) where.routeId = routeId;
    if (search) {
      where.OR = [
        { studentProfile: { firstName: { contains: search, mode: "insensitive" } } },
        { studentProfile: { lastName: { contains: search, mode: "insensitive" } } },
        { stopName: { contains: search, mode: "insensitive" } },
      ];
    }
    const skip = (page - 1) * limit;
    const [totalCount, data] = await Promise.all([
      prisma.transportAllocation.count({ where }),
      prisma.transportAllocation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          studentProfile: { select: { id: true, firstName: true, lastName: true, rollNumber: true } },
          route: { select: { id: true, name: true, stops: true } },
          vehicle: { select: { vehicleNo: true } },
        },
      }),
    ]);
    const totalPages = Math.ceil(totalCount / limit);
    return paginatedResponse(data, { totalCount, currentPage: page, pageSize: limit, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 });
  } catch (e) { return handleApiError(e); }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const body = await request.json();
    const parsed = createAllocationSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((er) => ({ field: er.path.join("."), code: er.code, message: er.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    const student = await prisma.studentProfile.findFirst({ where: { id: d.studentProfileId, tenantId } });
    if (!student) return badRequest("Student not found");
    const dup = await prisma.transportAllocation.findFirst({ where: { tenantId, studentProfileId: d.studentProfileId } });
    if (dup) return badRequest("Student already allocated to a route", [{ field: "studentProfileId", code: "already_allocated", message: "Already allocated" }]);
    const route = await prisma.transportRoute.findFirst({ where: { id: d.routeId, tenantId } });
    if (!route) return badRequest("Route not found");
    if (!route.stops.includes(d.stopName)) return badRequest("Stop not on route", [{ field: "stopName", code: "invalid_stop", message: "Stop not on selected route" }]);
    const allocation = await prisma.transportAllocation.create({
      data: {
        tenantId,
        studentProfileId: d.studentProfileId,
        routeId: d.routeId,
        vehicleId: route.vehicleId || null,
        stopName: d.stopName,
        monthlyFee: d.monthlyFee ?? route.monthlyFee ?? 0,
      },
      include: { studentProfile: { select: { firstName: true, lastName: true } }, route: { select: { name: true } } },
    });
    return successResponse(allocation, "Student allocated", 201);
  } catch (e: any) { if (e?.code === "P2002") return badRequest("Already allocated"); return handleApiError(e); }
}
