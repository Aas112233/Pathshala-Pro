import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, badRequest, notFound, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { z } from "zod";

const verifySchema = z.object({
  reference: z.string().max(100).optional(),
  reason: z.string().max(500).optional(),
});

const ONLINE_METHODS = ["DIGITAL", "ONLINE", "BANK", "BANK_TRANSFER", "POS_CARD", "CARD", "EASYPAISA", "JAZZCASH", "BKASH", "NAGAD", "UPI"];

/**
 * POST /api/transactions/[id]/verify
 * Verifies an online-method receipt against the external reference (UTR /
 * gateway id): stamps verifiedAt/verifiedById so unverified online money is
 * visible in reports until a second pair of eyes confirms it. Webhook
 * auto-verification can call this same stamp when a gateway is integrated.
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
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.errors[0]?.message || "Invalid payload");

    const existing = await prisma.transaction.findFirst({ where: { id, tenantId } });
    if (!existing) return notFound("Transaction not found");
    if ((existing as any).isVoided) return badRequest("Transaction is voided");
    if (!ONLINE_METHODS.includes((existing as any).paymentMethod)) {
      return badRequest("Only online-method receipts require verification.");
    }
    if ((existing as any).verifiedAt) return badRequest("Transaction already verified");

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        verifiedAt: new Date(),
        verifiedById: user.id,
        ...(parsed.data.reference ? { reference: parsed.data.reference } : {}),
        note: `${(existing as any).note || ""} | VERIFIED by ${user.id}${parsed.data.reason ? `: ${parsed.data.reason}` : ""}`.trim(),
      },
    });

    return successResponse({ transaction: updated }, "Online receipt verified");
  } catch (error) {
    return handleApiError(error);
  }
}
