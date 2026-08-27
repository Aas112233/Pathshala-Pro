import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, validationError, handleApiError } from "@/lib/api-response";
import { updateLeaveSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId, user } = access.authContext as any;
    const { id } = await params;
    const existing = await prisma.leaveApplication.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Leave not found");
    const body = await request.json();
    const parsed = updateLeaveSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({ field: e.path.join("."), code: e.code, message: e.message }));
      return validationError(errors);
    }
    const d = parsed.data;
    const isStatusChange = d.status && d.status !== existing.status;
    const updated = await prisma.leaveApplication.update({
      where: { id },
      data: {
        ...(d.status !== undefined && { status: d.status, approvedById: isStatusChange ? user.id : existing.approvedById }),
        ...(d.leaveType !== undefined && { leaveType: d.leaveType }),
        ...(d.fromDate !== undefined && { fromDate: new Date(d.fromDate as string) }),
        ...(d.toDate !== undefined && { toDate: new Date(d.toDate as string) }),
        ...(d.reason !== undefined && { reason: d.reason }),
      },
    });

    // Auto-create attendance LEAVE records if approved
    if (d.status === "APPROVED" && existing.status !== "APPROVED") {
      const from = new Date(updated.fromDate);
      const to = new Date(updated.toDate);
      const days: Date[] = [];
      for (let cur = new Date(from); cur <= to; cur.setDate(cur.getDate() + 1)) {
        days.push(new Date(cur));
      }
      // Create attendance entries for each day (skip if already exists)
      for (const day of days) {
        const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
        const exists = await prisma.attendance.findFirst({
          where: {
            tenantId,
            date: { gte: dayStart, lte: dayEnd },
            ...(updated.studentProfileId ? { studentProfileId: updated.studentProfileId } : {}),
            ...(updated.staffProfileId ? { staffProfileId: updated.staffProfileId } : {}),
          },
        });
        if (!exists) {
          await prisma.attendance.create({
            data: {
              tenantId,
              studentProfileId: updated.studentProfileId || null,
              staffProfileId: updated.staffProfileId || null,
              date: dayStart,
              status: "LEAVE",
              note: `Approved leave: ${updated.reason}`,
              markedById: user.id,
            },
          });
        }
      }
    }

    return successResponse(updated, d.status ? `Leave ${d.status.toLowerCase()}` : "Leave updated");
  } catch (e) { return handleApiError(e); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId } = access.authContext;
    const { id } = await params;
    const existing = await prisma.leaveApplication.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Leave not found");
    await prisma.leaveApplication.delete({ where: { id } });
    return successResponse(null, "Leave deleted");
  } catch (e) { return handleApiError(e); }
}
