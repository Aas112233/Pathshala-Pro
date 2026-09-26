import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  badRequest,
  notFound,
  handleApiError,
  safeParseBody,
  ApiError,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { waiveLateFine } from "@/lib/fee-service";
import { z } from "zod";

const waiveSchema = z.object({
  amount: z.number().positive("Waiver amount must be greater than 0").optional(),
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/fees/[id]/waive-fine
 * Reverses a late-fine surcharge (full or partial): Dr 4060 / Cr 1030 and
 * decrements the voucher's lateFine/totalDue/balance. Waiver approval stays
 * with management — same gate as concessions.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(request, { permission: "fees:invoice:create" });
    if ("response" in access) return access.response;
    const { user, tenantId } = access.authContext;
    const { id } = await params;

    const bodyResult = await safeParseBody(request, waiveSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const data = bodyResult.data;

    const voucher = await prisma.feeVoucher.findFirst({
      where: { id, tenantId },
      select: { id: true, studentProfileId: true },
    });
    if (!voucher) return notFound("Fee voucher not found");

    const result = await prisma.$transaction(async (tx) =>
      waiveLateFine(tx as any, {
        tenantId,
        feeVoucherId: id,
        studentProfileId: (voucher as any).studentProfileId,
        amount: data.amount,
        executedById: user.id,
        reason: data.reason,
      })
    );

    return successResponse(result, "Late fine waived successfully");
  } catch (error) {
    if (error instanceof ApiError) {
      return badRequest(error.message);
    }
    if (error instanceof Error && /outstanding|Waiver|closed|configured|not found/i.test(error.message)) {
      return badRequest(error.message);
    }
    return handleApiError(error);
  }
}
