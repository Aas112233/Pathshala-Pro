import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, paginatedResponse, badRequest, validationError, errorResponse, handleApiError } from "@/lib/api-response";
import { createCertificateSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/audit-logger";
import { MAX_PAGE_SIZE } from "@/lib/constants";
import {
  ACTIVE_CERTIFICATE_STATUSES,
  isSingleActiveCertificateType,
  allocateCertificateNumbers,
} from "@/lib/certificate-numbering";

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

    const certificateType = d.certificateType ?? "BONAFIDE";

    // A transfer certificate is a one-way event: at most one may be in force at
    // a time. Without this, the exit workflow and the certificates page could
    // each mint a TC for the same student and the school would hold two
    // documents describing one departure.
    if (isSingleActiveCertificateType(certificateType)) {
      const active = await prisma.certificate.findFirst({
        where: {
          tenantId,
          studentProfileId: d.studentProfileId,
          certificateType,
          status: { in: [...ACTIVE_CERTIFICATE_STATUSES] },
        },
        select: { id: true, certificateNumber: true, issueDate: true },
      });
      if (active) {
        return errorResponse(
          `A ${certificateType} certificate is already active for this student. Revoke certificate ${active.certificateNumber} first if this is a replacement.`,
          409,
          [
            {
              field: "studentProfileId",
              code: "CERTIFICATE_ALREADY_ACTIVE",
              message: `Active certificate ${active.certificateNumber} already exists.`,
            },
          ]
        );
      }
    }

    let certificateNumber = d.certificateNumber?.trim();
    if (!certificateNumber) {
      const [allocated] = await allocateCertificateNumbers(
        prisma,
        tenantId,
        certificateType,
        1
      );
      certificateNumber = allocated;
    } else {
      const dup = await prisma.certificate.findFirst({ where: { tenantId, certificateNumber } });
      if (dup) return badRequest("Certificate number already exists", [{ field: "certificateNumber", code: "duplicate", message: "Already exists" }]);
    }

    const cert = await prisma.certificate.create({
      data: {
        tenantId,
        studentProfileId: d.studentProfileId,
        certificateType,
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

    await logAuditEvent({
      tenantId,
      userId: user.id,
      userEmail: user.email,
      action: "ISSUE",
      entity: "Certificate",
      entityId: cert.id,
      details: {
        certificateNumber: cert.certificateNumber,
        certificateType: cert.certificateType,
        studentProfileId: cert.studentProfileId,
        issueDate: cert.issueDate,
      },
    });

    return successResponse(cert, "Certificate issued", 201);
  } catch (e: any) { if (e?.code === "P2002") return badRequest("Duplicate certificate number"); return handleApiError(e); }
}
