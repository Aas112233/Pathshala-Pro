import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, paginatedResponse, validationError, handleApiError, badRequest } from "@/lib/api-response";
import { createHealthRecordSchema } from "@/lib/schemas";
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
    const where: any = { tenantId };
    if (search) {
      where.OR = [
        { studentProfile: { firstName: { contains: search, mode: "insensitive" } } },
        { studentProfile: { lastName: { contains: search, mode: "insensitive" } } },
        { allergies: { contains: search, mode: "insensitive" } },
      ];
    }
    const skip = (page - 1) * limit;
    const [totalCount, data] = await Promise.all([
      prisma.healthRecord.count({ where }),
      prisma.healthRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: { studentProfile: { select: { id: true, firstName: true, lastName: true, rollNumber: true, class: { select: { name: true } } } } },
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
    const parsed = createHealthRecordSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((er) => ({ field: er.path.join("."), code: er.code, message: er.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    const student = await prisma.studentProfile.findFirst({ where: { id: d.studentProfileId, tenantId } });
    if (!student) return badRequest("Student not found");
    const dup = await prisma.healthRecord.findFirst({ where: { tenantId, studentProfileId: d.studentProfileId } });
    if (dup) return badRequest("Health record already exists for this student", [{ field: "studentProfileId", code: "duplicate", message: "Already exists" }]);

    const rec = await prisma.healthRecord.create({
      data: {
        tenantId,
        studentProfileId: d.studentProfileId,
        bloodGroup: d.bloodGroup || null,
        allergies: d.allergies || null,
        chronicConditions: d.chronicConditions || null,
        medications: d.medications || null,
        vaccinationJson: d.vaccinationJson || null,
        heightCm: d.heightCm ?? null,
        weightKg: d.weightKg ?? null,
        visionLeft: d.visionLeft || null,
        visionRight: d.visionRight || null,
        lastCheckupDate: d.lastCheckupDate ? new Date(d.lastCheckupDate as string) : null,
        remarks: d.remarks || null,
      },
      include: { studentProfile: { select: { firstName: true, lastName: true } } },
    });
    return successResponse(rec, "Health record created", 201);
  } catch (e: any) { if (e?.code === "P2002") return badRequest("Duplicate record"); return handleApiError(e); }
}
