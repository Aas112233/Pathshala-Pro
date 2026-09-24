import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, badRequest, notFound, validationError, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { rejectSalarySchema } from "@/lib/schemas";
import { rejectSalaryLedger } from "@/lib/salary-payslip";

/**
 * POST /api/salary/[id]/reject
 * Rejects a salary ledger with mandatory reason notes
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

    const body = await request.json();
    const validation = rejectSalarySchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const rejected = await rejectSalaryLedger(prisma, {
      tenantId,
      salaryLedgerId: id,
      rejectedById: user?.id,
      reason: validation.data.reason,
    });

    return successResponse(rejected, "Salary record rejected successfully");
  } catch (error: any) {
    if (error?.message?.includes("not found")) {
      return notFound(error.message);
    }
    return handleApiError(error);
  }
}
