import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, badRequest, notFound, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { reverseTransaction } from "@/lib/transaction-void";
import { z } from "zod";

const clearSchema = z.object({
  status: z.enum(["CLEARED", "BOUNCED"]),
  chequeNumber: z.string().max(50).optional(),
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/transactions/[id]/clear
 * Settles a pending cheque. CLEARED marks it settled; BOUNCED reverses the
 * receipt (same GL reversal as a void) so bounced money never stays collected.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request, { permission: "fees:payment:collect" });
    if ("response" in access) return access.response;
    const { tenantId, user } = access.authContext;
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const parsed = clearSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.errors[0]?.message || "Invalid payload");
    const data = parsed.data;

    const existing = await prisma.transaction.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Transaction not found");
    if ((existing as any).paymentMethod !== "CHEQUE") {
      return badRequest("Only CHEQUE payments go through clearing.");
    }
    if ((existing as any).isVoided) return badRequest("Transaction already voided");
    if ((existing as any).chequeStatus === "CLEARED") return badRequest("Cheque already cleared");
    if ((existing as any).chequeStatus === "BOUNCED") return badRequest("Cheque already bounced");

    if (data.status === "CLEARED") {
      const updated = await prisma.transaction.update({
        where: { id },
        data: {
          chequeStatus: "CLEARED",
          clearedAt: new Date(),
          ...(data.chequeNumber ? { chequeNumber: data.chequeNumber } : {}),
        },
      });
      return successResponse({ transaction: updated }, "Cheque marked as cleared");
    }

    const result = await prisma.$transaction(async (tx) => {
      const reversed = await reverseTransaction(tx as any, {
        tenantId,
        transactionId: id,
        userId: user.id,
        reason: data.reason || "Cheque bounced",
      });
      const updated = await tx.transaction.update({
        where: { id },
        data: { chequeStatus: "BOUNCED", clearedAt: new Date() },
      });
      return { ...reversed, transaction: updated };
    });

    return successResponse(result, "Cheque bounced — receipt reversed");
  } catch (error) {
    return handleApiError(error);
  }
}
