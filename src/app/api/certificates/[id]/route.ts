import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, validationError, handleApiError, badRequest } from "@/lib/api-response";
import { updateCertificateSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.certificate.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Certificate not found");
    const body = await request.json();
    const parsed = updateCertificateSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({ field: e.path.join("."), code: e.code, message: e.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    if (d.certificateNumber && d.certificateNumber !== existing.certificateNumber) {
      const dup = await prisma.certificate.findFirst({ where: { tenantId, certificateNumber: d.certificateNumber, id: { not: id } } });
      if (dup) return badRequest("Certificate number already exists");
    }
    const updated = await prisma.certificate.update({
      where: { id },
      data: {
        ...(d.certificateType !== undefined && { certificateType: d.certificateType }),
        ...(d.certificateNumber !== undefined && { certificateNumber: d.certificateNumber }),
        ...(d.issueDate !== undefined && { issueDate: new Date(d.issueDate as string) }),
        ...(d.validUntil !== undefined && { validUntil: d.validUntil ? new Date(d.validUntil as string) : null }),
        ...(d.purpose !== undefined && { purpose: d.purpose || null }),
        ...(d.remarks !== undefined && { remarks: d.remarks || null }),
        ...(d.status !== undefined && { status: d.status }),
        ...(d.studentProfileId !== undefined && { studentProfileId: d.studentProfileId }),
      },
    });
    return successResponse(updated, "Certificate updated");
  } catch (e: any) { if (e?.code === "P2002") return badRequest("Duplicate"); return handleApiError(e); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.certificate.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Certificate not found");
    await prisma.certificate.delete({ where: { id } });
    return successResponse(null, "Certificate deleted");
  } catch (e) { return handleApiError(e); }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const cert = await prisma.certificate.findFirst({
      where: { id, tenantId },
      include: { studentProfile: { select: { firstName: true, lastName: true, rollNumber: true, class: { select: { name: true } } } } },
    });
    if (!cert) return notFound("Certificate not found");
    return successResponse(cert);
  } catch (e) { return handleApiError(e); }
}
