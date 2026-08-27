import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, validationError, handleApiError } from "@/lib/api-response";
import { updateHealthRecordSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.healthRecord.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Health record not found");
    const body = await request.json();
    const parsed = updateHealthRecordSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({ field: e.path.join("."), code: e.code, message: e.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    const updated = await prisma.healthRecord.update({
      where: { id },
      data: {
        ...(d.bloodGroup !== undefined && { bloodGroup: d.bloodGroup || null }),
        ...(d.allergies !== undefined && { allergies: d.allergies || null }),
        ...(d.chronicConditions !== undefined && { chronicConditions: d.chronicConditions || null }),
        ...(d.medications !== undefined && { medications: d.medications || null }),
        ...(d.vaccinationJson !== undefined && { vaccinationJson: d.vaccinationJson || null }),
        ...(d.heightCm !== undefined && { heightCm: d.heightCm ?? null }),
        ...(d.weightKg !== undefined && { weightKg: d.weightKg ?? null }),
        ...(d.visionLeft !== undefined && { visionLeft: d.visionLeft || null }),
        ...(d.visionRight !== undefined && { visionRight: d.visionRight || null }),
        ...(d.lastCheckupDate !== undefined && { lastCheckupDate: d.lastCheckupDate ? new Date(d.lastCheckupDate as string) : null }),
        ...(d.remarks !== undefined && { remarks: d.remarks || null }),
      },
    });
    return successResponse(updated, "Health record updated");
  } catch (e) { return handleApiError(e); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.healthRecord.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Health record not found");
    await prisma.healthRecord.delete({ where: { id } });
    return successResponse(null, "Health record deleted");
  } catch (e) { return handleApiError(e); }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const rec = await prisma.healthRecord.findFirst({ where: { id, tenantId }, include: { studentProfile: { select: { firstName: true, lastName: true, rollNumber: true } } } });
    if (!rec) return notFound("Health record not found");
    return successResponse(rec);
  } catch (e) { return handleApiError(e); }
}
