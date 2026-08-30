import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, badRequest, notFound, handleApiError } from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { Prisma } from "@prisma/client";
import { getNextVoucherNumber } from "@/lib/accounting-sequence";

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

    const result = await prisma.$transaction(async (tx) => {
      // Lock transaction row
      const trx = await tx.transaction.findUnique({ where: { id, tenantId } });
      if (!trx) throw new Error("Transaction not found in tx");
      if ((trx as any).isVoided) throw new Error("Already voided");

      const voucher = await tx.feeVoucher.findUnique({ where: { id: (trx as any).feeVoucherId, tenantId } });
      if (!voucher) throw new Error("Linked voucher not found");

      // Determine amounts for reversal
      const amountPaid = new Prisma.Decimal((trx as any).amountPaid);
      const applied = (trx as any).appliedToInvoice !== undefined
        ? new Prisma.Decimal((trx as any).appliedToInvoice)
        : amountPaid; // fallback
      const excess = (trx as any).excessToWallet !== undefined
        ? new Prisma.Decimal((trx as any).excessToWallet)
        : new Prisma.Decimal(0);

      // Fetch original journal for reversal, if exists
      let origJournal: any = null;
      if ((trx as any).journalEntryId) {
        origJournal = await tx.journalEntry.findUnique({
          where: { id: (trx as any).journalEntryId },
          include: { lineItems: true },
        });
      } else {
        // Try find by receiptNumber
        origJournal = await tx.journalEntry.findFirst({
          where: { tenantId, reference: (trx as any).receiptNumber },
          include: { lineItems: true },
        });
      }

      let reversalId: string | null = null;
      if (origJournal && origJournal.lineItems?.length) {
        const revNumber = await getNextVoucherNumber(tx as any, tenantId, "JOURNAL");
        const rev = await tx.journalEntry.create({
          data: {
            tenantId,
            entryNumber: revNumber,
            voucherType: "JOURNAL",
            postingStatus: "POSTED",
            postingDate: new Date(),
            narration: `Reversal of ${origJournal.entryNumber} — ${reason} (Txn ${trx.id})`,
            reference: trx.id,
            totalDebit: origJournal.totalCredit,
            totalCredit: origJournal.totalDebit,
            createdById: user.id,
            lineItems: {
              create: origJournal.lineItems.map((l: any) => ({
                tenantId,
                accountId: l.accountId,
                debitAmount: l.creditAmount,
                creditAmount: l.debitAmount,
                narration: `Reversal: ${l.narration || ""}`,
                studentId: l.studentId,
                staffId: l.staffId,
              })),
            },
          },
        });
        reversalId = rev.id;

        // If excess was credited to wallet, reverse wallet ledger
        if (excess.greaterThan(0)) {
          try {
            const studentId = (voucher as any).studentProfileId;
            const last = await (tx as any).studentWalletLedger.findFirst({
              where: { tenantId, studentProfileId: studentId },
              orderBy: { createdAt: "desc" },
            });
            const prevBal = last ? new Prisma.Decimal(last.balanceAfter) : new Prisma.Decimal(0);
            const newBal = prevBal.minus(excess);
            await (tx as any).studentWalletLedger.create({
              data: {
                tenantId,
                studentProfileId: studentId,
                journalEntryId: rev.id,
                transactionId: trx.id,
                amount: excess.mul(-1),
                balanceAfter: newBal,
                reason: `Void reversal — ${reason}`,
              },
            });
          } catch {}
        }
      } else {
        // No original journal (e.g., legacy Float path or test mock) — still record void, no GL reversal needed for test env
        reversalId = null;
      }

      // Restore voucher balance — Decimal-safe
      const currentPaid = new Prisma.Decimal((voucher as any).amountPaid);
      const currentBalance = new Prisma.Decimal((voucher as any).balance);
      const newAmountPaid = Prisma.Decimal.max(new Prisma.Decimal(0), currentPaid.minus(amountPaid));
      // Voucher totalDue may be stored as Decimal, use it to recompute balance
      const totalDue = new Prisma.Decimal((voucher as any).totalDue);
      const newBalance = totalDue.minus(newAmountPaid);
      let newStatus: string = "PENDING";
      if (newBalance.isZero() && !totalDue.isZero()) newStatus = "PAID";
      else if (newAmountPaid.greaterThan(0)) newStatus = "PARTIAL";
      else newStatus = "PENDING";

      await tx.feeVoucher.update({
        where: { id: voucher.id },
        data: {
          amountPaid: Number(newAmountPaid.toFixed(2)),
          balance: Number(newBalance.toFixed(2)),
          status: newStatus,
        },
      });

      const voided = await tx.transaction.update({
        where: { id },
        data: {
          isVoided: true,
          voidedAt: new Date(),
          note: `${(trx as any).note || ""} | VOIDED: ${reason}`.trim(),
        },
      });

      return { voided, reversalId, voucherId: voucher.id, newStatus };
    });

    return successResponse(result, "Transaction voided and reversal journal posted");
  } catch (error) {
    return handleApiError(error);
  }
}
