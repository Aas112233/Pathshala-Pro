import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, badRequest, notFound, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { reverseTransaction } from "@/lib/transaction-void";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request);
    if ("response" in access) return access.response;
    const { tenantId, user } = access.authContext;
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const reason: string = body?.reason || body?.note || "Void requested by clerk";

    const existing = await prisma.transaction.findFirst({
      where: { id, tenantId },
      include: { feeVoucher: true },
    });
    if (!existing) return notFound("Transaction not found");
    if ((existing as any).isVoided) return badRequest("Transaction already voided");

    const result = await prisma.$transaction(async (tx) =>
      reverseTransaction(tx as any, { tenantId, transactionId: id, userId: user.id, reason })
    );

    return successResponse(result, "Transaction voided and reversal journal posted");
  } catch (error) {
    return handleApiError(error);
  }
}
