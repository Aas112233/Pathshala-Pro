import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, badRequest, notFound, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { approveSalarySchema } from "@/lib/schemas";
import { approveSalaryLedger } from "@/lib/salary-payslip";

/**
 * POST /api/salary/[id]/approve
 * Approves a salary ledger and posts double-entry accrual journal
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request, { permission: "payroll:approve" });
    if ("response" in access) return access.response;

    const { tenantId, user } = access.authContext;
    const { id } = await params;

    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is allowed
    }

    const validation = approveSalarySchema.safeParse(body);
    if (!validation.success) {
      return badRequest("Invalid approval parameters");
    }

    // Single interactive transaction: the read-check (ledger status) →
    // conditional accrual journal post → status update must be atomic, so a
    // concurrent double-submit cannot post the accrual twice or leave a
    // journal without its matching APPROVED status.
    const approved = await prisma.$transaction(
      (tx) =>
        approveSalaryLedger(tx, {
          tenantId,
          salaryLedgerId: id,
          approvedById: user?.id,
          notes: validation.data.notes,
        }),
      { maxWait: 10000, timeout: 30000 }
    );

    return successResponse(approved, "Salary record approved successfully");
  } catch (error: any) {
    if (error?.message?.includes("not found")) {
      return notFound(error.message);
    }
    return handleApiError(error);
  }
}
