import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, paginatedResponse, badRequest, validationError, handleApiError } from "@/lib/api-response";
import { createCertificateSchema } from "@/lib/schemas";
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
    const certificateType = searchParams.get("certificateType") || "";
    const status = searchParams.get("status") || "";
    const where: any = { tenantId };
    if (certificateType) where.certificateType = certificateType;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { certificateNumber: { contains: search, mode: "insensitive" } },
        { studentProfile: { firstName: { contains: search, mode: "insensitive" } } },
        { studentProfile: { lastName: { contains: search, mode: "insensitive" } } },
      ];
    }
    const skip = (page - 1) * limit;
    const [totalCount, data] = await Promise.all([
      prisma.certificate.count({ where }),
      prisma.certificate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          studentProfile: { select: { id: true, firstName: true, lastName: true, rollNumber: true, class: { select: { name: true } } } },
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
    const { tenantId, user } = access.authContext as any;
    const body = await request.json();
    const parsed = createCertificateSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((er) => ({ field: er.path.join("."), code: er.code, message: er.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    const student = await prisma.studentProfile.findFirst({ where: { id: d.studentProfileId, tenantId } });
    if (!student) return badRequest("Student not found");

    let certificateNumber = d.certificateNumber?.trim();
    if (!certificateNumber) {
      const year = new Date().getFullYear();
      const prefix = `CERT-${d.certificateType}-${year}-`;
      const latest = await prisma.certificate.findFirst({
        where: { tenantId, certificateNumber: { startsWith: prefix } },
        orderBy: { createdAt: "desc" },
      });
      let seq = 1;
      if (latest) {
        const parts = latest.certificateNumber.split("-");
        const last = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(last)) seq = last + 1;
      }
      certificateNumber = `${prefix}${String(seq).padStart(5, "0")}`;
    } else {
      const dup = await prisma.certificate.findFirst({ where: { tenantId, certificateNumber } });
      if (dup) return badRequest("Certificate number already exists", [{ field: "certificateNumber", code: "duplicate", message: "Already exists" }]);
    }

    const cert = await prisma.certificate.create({
      data: {
        tenantId,
        studentProfileId: d.studentProfileId,
        certificateType: d.certificateType ?? "BONAFIDE",
        certificateNumber,
        issueDate: d.issueDate ? new Date(d.issueDate) : new Date(),
        validUntil: d.validUntil ? new Date(d.validUntil as string) : null,
        purpose: d.purpose || null,
        remarks: d.remarks || null,
        issuedById: user.id,
        status: "ISSUED",
      },
      include: { studentProfile: { select: { firstName: true, lastName: true } } },
    });
    return successResponse(cert, "Certificate issued", 201);
  } catch (e: any) { if (e?.code === "P2002") return badRequest("Duplicate certificate number"); return handleApiError(e); }
}
