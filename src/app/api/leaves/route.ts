import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, paginatedResponse, validationError, handleApiError } from "@/lib/api-response";
import { createLeaveSchema } from "@/lib/schemas";
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
    const status = searchParams.get("status") || "";
    const applicantType = searchParams.get("applicantType") || "";
    const where: any = { tenantId };
    if (status) where.status = status;
    if (applicantType) where.applicantType = applicantType;
    if (search) {
      where.OR = [
        { studentProfile: { firstName: { contains: search, mode: "insensitive" } } },
        { studentProfile: { lastName: { contains: search, mode: "insensitive" } } },
        { staffProfile: { firstName: { contains: search, mode: "insensitive" } } },
        { reason: { contains: search, mode: "insensitive" } },
      ];
    }
    const skip = (page - 1) * limit;
    const [totalCount, data] = await Promise.all([
      prisma.leaveApplication.count({ where }),
      prisma.leaveApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          studentProfile: { select: { id: true, firstName: true, lastName: true, rollNumber: true } },
          staffProfile: { select: { id: true, firstName: true, lastName: true, staffId: true } },
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
    const parsed = createLeaveSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((er) => ({ field: er.path.join("."), code: er.code, message: er.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    if (d.applicantType === "STUDENT" && d.studentProfileId) {
      const s = await prisma.studentProfile.findFirst({ where: { id: d.studentProfileId, tenantId } });
      if (!s) return validationError([{ field: "studentProfileId", code: "not_found", message: "Student not found" }]);
    }
    if (d.applicantType === "STAFF" && d.staffProfileId) {
      const s = await prisma.staffProfile.findFirst({ where: { id: d.staffProfileId, tenantId } });
      if (!s) return validationError([{ field: "staffProfileId", code: "not_found", message: "Staff not found" }]);
    }
    const leave = await prisma.leaveApplication.create({
      data: {
        tenantId,
        applicantType: d.applicantType ?? "STUDENT",
        studentProfileId: d.studentProfileId || null,
        staffProfileId: d.staffProfileId || null,
        leaveType: d.leaveType ?? "SICK",
        fromDate: new Date(d.fromDate),
        toDate: new Date(d.toDate),
        reason: d.reason,
        status: "PENDING",
      },
    });
    return successResponse(leave, "Leave request created", 201);
  } catch (e) { return handleApiError(e); }
}
