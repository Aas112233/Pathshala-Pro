import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, notFound, validationError, handleApiError } from "@/lib/api-response";
import { updateLeaveSchema } from "@/lib/schemas";
import { requireApiAccess } from "@/lib/api-auth";
import { assertAcademicYearOpen } from "@/lib/academic-year-guards";

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

    const effectiveFrom = d.fromDate !== undefined ? new Date(d.fromDate as string) : existing.fromDate;
    const effectiveTo = d.toDate !== undefined ? new Date(d.toDate as string) : existing.toDate;
    const willApprove = d.status === "APPROVED" && existing.status !== "APPROVED";

    /**
     * Resolve the years a leave approval would write attendance into.
     *
     * `Attendance` is a year-scoped model, and this route used to create its
     * rows with no `academicYearId` at all. The consequence was not "the year is
     * missing" but "one question, two answers": a leave approved here was
     * invisible to every year-scoped query — the promotion engine, the year-close
     * gate, `reports/attendance` — while the identical day entered as `LEAVE` on
     * the manual attendance form carried a year and counted as a day of absence.
     *
     * Resolved per day rather than once, because a leave can straddle a year
     * boundary, and ordered `startDate desc` to match `POST /api/attendance` so
     * that overlapping years resolve identically in both writers.
     */
    const yearsCoveringLeave = willApprove
      ? await prisma.academicYear.findMany({
          where: { tenantId, startDate: { lte: effectiveTo }, endDate: { gte: effectiveFrom } },
          select: { id: true, label: true, startDate: true, endDate: true, isClosed: true },
          orderBy: { startDate: "desc" },
        })
      : [];

    const yearForDay = (day: Date) =>
      yearsCoveringLeave.find((year) => year.startDate <= day && day <= year.endDate) ?? null;

    const leaveDays: Date[] = [];
    if (willApprove) {
      for (let cur = new Date(effectiveFrom); cur <= effectiveTo; cur.setDate(cur.getDate() + 1)) {
        leaveDays.push(new Date(cur));
      }
    }

    // Checked *before* the leave is updated, so a refusal cannot leave an
    // approval committed with none of its attendance rows. Writing into a closed
    // year is precisely the mutation the closed-year boundary exists to prevent,
    // and it is refused loudly rather than skipped — a silently dropped row is
    // the defect this route is being fixed for.
    const closedYearTouched = yearsCoveringLeave.find(
      (year) => year.isClosed && leaveDays.some((day) => yearForDay(day)?.id === year.id)
    );
    if (closedYearTouched) {
      await assertAcademicYearOpen(tenantId, closedYearTouched.id);
    }

    const { updated } = await prisma.$transaction(async (tx) => {
      const row = await tx.leaveApplication.update({
        where: { id },
        data: {
          ...(d.status !== undefined && { status: d.status, approvedById: isStatusChange ? user.id : existing.approvedById }),
          ...(d.leaveType !== undefined && { leaveType: d.leaveType }),
          ...(d.fromDate !== undefined && { fromDate: new Date(d.fromDate as string) }),
          ...(d.toDate !== undefined && { toDate: new Date(d.toDate as string) }),
          ...(d.reason !== undefined && { reason: d.reason }),
        },
      });

      if (willApprove) {
        for (const day of leaveDays) {
          const year = yearForDay(day);
          // A day outside every academic year is not a school day, so there is
          // nothing to record. Skipping is correct here rather than lossy: a
          // null-year row would be visible to date-scoped queries and invisible
          // to year-scoped ones, which is the inconsistency being removed.
          if (!year) continue;

          const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
          const exists = await tx.attendance.findFirst({
            where: {
              tenantId,
              date: { gte: dayStart, lte: dayEnd },
              academicYearId: year.id,
              ...(row.studentProfileId ? { studentProfileId: row.studentProfileId } : {}),
              ...(row.staffProfileId ? { staffProfileId: row.staffProfileId } : {}),
            },
          });
          if (!exists) {
            await tx.attendance.create({
              data: {
                tenantId,
                studentProfileId: row.studentProfileId || null,
                staffProfileId: row.staffProfileId || null,
                academicYearId: year.id,
                date: dayStart,
                status: "LEAVE",
                note: `Approved leave: ${row.reason}`,
                markedById: user.id,
              },
            });
          }
        }
      }

      return { updated: row };
    });

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
