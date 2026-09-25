import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, handleApiError, safeParseBody } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { assertAcademicYearsOpen } from "@/lib/academic-year-guards";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit-logger";
import {
  WRITE_OFF_ELIGIBLE_STATUSES,
  applyWriteOffSweep,
  planWriteOffSweep,
  type WriteOffCandidate,
} from "@/lib/fee-write-off";

const sweepSchema = z.object({
  dryRun: z.boolean().optional(),
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/academic-years/[id]/write-off-sweep
 *
 * Roadmap item 23 — the outstanding-fee sweep as a pre-close step.
 *
 * `dryRun: true` returns the plan and writes nothing; both paths plan from the
 * same loader, so the preview cannot describe one sweep and the commit apply
 * another. A blocked dry run is 200, because a readiness check is a result the
 * caller needs and not a failure — only the committing path refuses.
 *
 * Authorisation is `fees:waiver:approve`, because a write-off is a decision to
 * give up money the school billed, and that gate already exists for the same
 * class of decision.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request, { permission: "fees:waiver:approve" });
    if ("response" in access) return access.response;
    const { user, tenantId } = access.authContext;
    const { id } = await params;

    const bodyResult = await safeParseBody(request, sweepSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const data = bodyResult.data;
    const dryRun = data.dryRun === true;

    // A closed year is read-only across every year-scoped model, and a sweep
    // writes to its vouchers — so the guard applies before anything is read.
    await assertAcademicYearsOpen(tenantId, [id]);

    const vouchers = await prisma.feeVoucher.findMany({
      where: {
        tenantId,
        academicYearId: id,
        status: { in: [...WRITE_OFF_ELIGIBLE_STATUSES] },
      },
      select: {
        id: true,
        voucherId: true,
        studentProfileId: true,
        feeType: true,
        billingMonth: true,
        status: true,
        balance: true,
        studentProfile: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ studentProfileId: "asc" }, { dueDate: "asc" }],
    });

    const candidates: WriteOffCandidate[] = vouchers.map((voucher) => ({
      voucherId: voucher.id,
      voucherNumber: voucher.voucherId,
      studentProfileId: voucher.studentProfileId,
      studentName: `${voucher.studentProfile.firstName} ${voucher.studentProfile.lastName}`.trim(),
      feeType: voucher.feeType,
      billingMonth: voucher.billingMonth,
      status: voucher.status,
      balance: Number(voucher.balance ?? 0),
    }));

    const plan = planWriteOffSweep({ candidates });

    if (dryRun) {
      return successResponse(
        { dryRun: true as const, plan },
        plan.canProceed
          ? `Preview: ${plan.counts.written} voucher(s) carrying ${plan.total} would be written off.`
          : `Preview: the sweep is blocked by ${plan.blockers.length} check(s).`
      );
    }

    if (!plan.canProceed) {
      return successResponse(
        { blocked: true as const, plan },
        `The sweep is blocked by ${plan.blockers.length} check(s). Nothing was written.`
      );
    }

    const writable = plan.rows
      .filter((row) => row.reason === null)
      .map((row) => ({
        voucherId: row.voucherId,
        studentProfileId: row.studentProfileId,
        balance: row.balance,
        label: row.label,
      }));

    const application = await prisma.$transaction(async (tx) => {
      const result = await applyWriteOffSweep(tx, {
        tenantId,
        executedById: user.id,
        reason: data.reason,
        rows: writable,
      });

      await logAuditEvent(
        {
          tenantId,
          userId: user.id,
          action: "WRITE_OFF",
          entity: "AcademicYear",
          entityId: id,
          details: {
            vouchers: result.writtenCount,
            total: result.total,
            students: plan.studentCount,
            reason: data.reason ?? null,
            accounts: plan.accounts,
          },
        },
        tx
      );

      return result;
    });

    return successResponse(
      { plan, application },
      `${application.writtenCount} voucher(s) written off, totalling ${application.total}.`
    );
  } catch (error) {
    return handleApiError(error);
  }
}
