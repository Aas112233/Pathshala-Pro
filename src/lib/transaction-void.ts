import { Prisma } from "@prisma/client";
import { getNextVoucherNumber } from "@/lib/accounting-sequence";
import { syncBankBalance, getWalletBalance } from "@/lib/fee-service";

/**
 * Shared reversal for voided / bounced fee receipts. Flips the original
 * journal, appends a negative wallet entry for any excess, and restores the
 * voucher's amountPaid/balance/status — all atomically.
 */
export async function reverseTransaction(
  tx: any,
  params: { tenantId: string; transactionId: string; userId: string; reason: string }
): Promise<{ voided: any; reversalId: string | null; voucherId: string; newStatus: string }> {
  const { tenantId, transactionId: id, userId, reason } = params;

  const trx = await tx.transaction.findUnique({ where: { id, tenantId } });
  if (!trx) throw new Error("Transaction not found in tx");
  if ((trx as any).isVoided) throw new Error("Already voided");

  const voucher = await tx.feeVoucher.findUnique({ where: { id: (trx as any).feeVoucherId, tenantId } });
  if (!voucher) throw new Error("Linked voucher not found");

  const amountPaid = new Prisma.Decimal((trx as any).amountPaid);
  const excess = (trx as any).excessToWallet !== undefined
    ? new Prisma.Decimal((trx as any).excessToWallet)
    : new Prisma.Decimal(0);

  let origJournal: any = null;
  if ((trx as any).journalEntryId) {
    origJournal = await tx.journalEntry.findUnique({
      where: { id: (trx as any).journalEntryId },
      include: { lineItems: true },
    });
  } else {
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
        createdById: userId,
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

    if (excess.greaterThan(0)) {
      const studentId = (voucher as any).studentProfileId;
      if (studentId) {
        if (typeof (tx as any).$queryRaw === "function") {
          await tx.$queryRaw`SELECT id FROM "StudentProfile" WHERE id = ${studentId} AND "tenantId" = ${tenantId} FOR UPDATE`;
        }
        const prevBal = await getWalletBalance(tx as any, { tenantId, studentProfileId: studentId });
        const newBal = prevBal.minus(excess);
        if (newBal.lessThan(0)) {
          // Deliberately not wrapped in a best-effort catch: the advance was
          // already spent on a later voucher, so this reversal cannot be
          // funded from the wallet. Writing a negative running balance would
          // silently corrupt the ledger; the shortfall is a real receivable
          // that must be settled in cash before the void is allowed.
          throw new Error(
            `Cannot void transaction ${trx.id}: wallet balance ${prevBal.toFixed(2)} is below the ${excess.toFixed(2)} excess being reversed. ` +
              `The advance was already applied to another voucher — recover that amount or write it off before voiding this receipt.`
          );
        }
        // Delegate-optional only (test/mocked transactions may not expose it);
        // a missing delegate is tolerated, a business failure is not.
        if (typeof (tx as any).studentWalletLedger?.create === "function") {
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
        }
      }
    }
  } else {
    reversalId = null;
  }

  try {
    if (reversalId && (trx as any).paymentMethod !== "WALLET_CREDIT" && origJournal?.lineItems?.length) {
      const debitLeg = origJournal.lineItems.find((l: any) => new Prisma.Decimal(l.debitAmount).greaterThan(0));
      if (debitLeg) {
        const bankAcc = await tx.chartOfAccount.findUnique({ where: { id: debitLeg.accountId } });
        if (bankAcc?.code) {
          await syncBankBalance(tx as any, { tenantId, accountCode: bankAcc.code, delta: amountPaid.mul(-1) });
        }
      }
    }
  } catch {}

  const currentPaid = new Prisma.Decimal((voucher as any).amountPaid);
  const totalDue = new Prisma.Decimal((voucher as any).totalDue);
  const newAmountPaid = Prisma.Decimal.max(new Prisma.Decimal(0), currentPaid.minus(amountPaid));
  const newBalance = totalDue.minus(newAmountPaid);
  let newStatus: string = "PENDING";
  if (newBalance.isZero() && !totalDue.isZero()) newStatus = "PAID";
  else if (newAmountPaid.greaterThan(0)) newStatus = "PARTIAL";
  else newStatus = "PENDING";

  await tx.feeVoucher.update({
    where: { id: voucher.id },
    data: {
      amountPaid: newAmountPaid.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
      balance: newBalance.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
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
}
