import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  notFound,
  handleApiError,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/audit-logger";

/**
 * DELETE /api/accounting/expenses/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;

    const { user, tenantId } = access.authContext;
    const { id } = await params;

    const expense = await prisma.expense.findUnique({
      where: { id, tenantId },
    });

    if (!expense) {
      return notFound("Expense not found");
    }

    await prisma.expense.delete({
      where: { id },
    });

    await logAuditEvent({
      tenantId,
      userId: user.id,
      userEmail: user.email,
      action: "DELETE",
      entity: "Settings" as any,
      entityId: id,
      details: { expenseNumber: expense.expenseNumber, amount: expense.amount },
    });

    return successResponse(null, "Expense deleted successfully");
  } catch (error) {
    return handleApiError(error);
  }
}
