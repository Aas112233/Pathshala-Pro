import { NextRequest } from "next/server";
import { successResponse, badRequest, validationError, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { bulkApproveSalarySchema } from "@/lib/schemas";
import { bulkApproveSalaryLedgers } from "@/lib/salary-payslip";

/**
 * POST /api/salary/bulk-approve
 * Batch approves multiple salary records
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, { permission: "payroll:approve" });
    if ("response" in access) return access.response;

    const { tenantId, user } = access.authContext;

    const body = await request.json();
    const validation = bulkApproveSalarySchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        code: err.code,
        message: err.message,
      }));
      return validationError(errors);
    }

    const { salaryIds, notes } = validation.data;

    const approvedSalaries = await bulkApproveSalaryLedgers({
      tenantId,
      salaryIds,
      approvedById: user?.id,
      notes,
    });

    return successResponse(
      {
        count: approvedSalaries.length,
        salaries: approvedSalaries,
      },
      `Successfully approved ${approvedSalaries.length} salary record(s)`
    );
  } catch (error) {
    return handleApiError(error);
  }
}
