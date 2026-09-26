import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { reverseTransaction } from "@/lib/transaction-void";

describe("reverseTransaction (void / bounce shared helper)", () => {
  it("flips the original journal, restores the voucher, and flags the transaction", async () => {
    const journals: any[] = [];
    const vouchers: any[] = [];
    const txns: any[] = [];
    const mockTx: any = {
      transaction: {
        findUnique: async () => ({
          id: "txn-1", tenantId: "t1", feeVoucherId: "v-1", amountPaid: 1000,
          appliedToInvoice: 1000, excessToWallet: 0, paymentMethod: "CASH",
          receiptNumber: "REC-1", journalEntryId: "jv-1", isVoided: false, note: "Counter",
        }),
        update: async (payload: any) => { txns.push(payload); return payload; },
      },
      feeVoucher: {
        findUnique: async () => ({ id: "v-1", studentProfileId: "st-1", totalDue: 5000, amountPaid: 1000, balance: 4000 }),
        update: async (payload: any) => { vouchers.push(payload); return payload; },
      },
      journalEntry: {
        findUnique: async () => ({
          id: "jv-1", entryNumber: "REC-2026-000001", totalDebit: 1000, totalCredit: 1000,
          lineItems: [
            { accountId: "acc-bank", debitAmount: 1000, creditAmount: 0, narration: "Cash", studentId: null, staffId: null },
            { accountId: "acc-ar", debitAmount: 0, creditAmount: 1000, narration: "AR", studentId: "st-1", staffId: null },
          ],
        }),
        create: async (payload: any) => {
          journals.push(payload.data);
          return { id: "jv-rev-1", ...payload.data };
        },
      },
      chartOfAccount: {
        findUnique: async () => ({ id: "acc-bank", code: "1010" }),
      },
      bankAccount: { updateMany: async () => ({ count: 1 }) },
    };

    const result = await reverseTransaction(mockTx, {
      tenantId: "t1", transactionId: "txn-1", userId: "u-9", reason: "Cheque bounced",
    });

    expect(result.reversalId).toBe("jv-rev-1");
    expect(result.newStatus).toBe("PENDING");
    const revLegs = journals[0].lineItems.create;
    expect(revLegs.find((l: any) => l.accountId === "acc-bank").creditAmount).toBe(1000);
    expect(vouchers[0].data.amountPaid.toString()).toBe("0");
    expect(vouchers[0].data.balance.toString()).toBe("5000");
    expect(txns[0].data.isVoided).toBe(true);
  });

  const walletVoidTx = (walletSum: string) => {
    const ledgers: any[] = [];
    const tx: any = {
      transaction: {
        findUnique: async () => ({
          id: "txn-9", tenantId: "t1", feeVoucherId: "v-9", amountPaid: 1000,
          appliedToInvoice: 500, excessToWallet: 500, paymentMethod: "CASH",
          receiptNumber: "REC-9", journalEntryId: "jv-9", isVoided: false, note: "",
        }),
        update: async (p: any) => p,
      },
      feeVoucher: {
        findUnique: async () => ({ id: "v-9", studentProfileId: "st-1", totalDue: 5000, amountPaid: 1000, balance: 4000 }),
        update: async (p: any) => p,
      },
      journalEntry: {
        findUnique: async () => ({
          id: "jv-9", entryNumber: "REC-9", totalDebit: 1000, totalCredit: 1000,
          lineItems: [
            { accountId: "acc-bank", debitAmount: 1000, creditAmount: 0, narration: "Cash", studentId: null, staffId: null },
          ],
        }),
        create: async (p: any) => ({ id: "jv-rev-9", ...p.data }),
      },
      $queryRaw: async () => [{ id: "st-1" }],
      studentWalletLedger: {
        aggregate: async () => ({ _sum: { amount: new Prisma.Decimal(walletSum) } }),
        create: async (p: any) => { ledgers.push(p.data); return p.data; },
      },
    };
    return { tx, ledgers };
  };

  it("reverses the wallet credit when the advance is still unspent", async () => {
    const { tx, ledgers } = walletVoidTx("5000");
    await reverseTransaction(tx, {
      tenantId: "t1", transactionId: "txn-9", userId: "u-9", reason: "Cheque bounced",
    });
    expect(ledgers).toHaveLength(1);
    expect(ledgers[0].amount.toString()).toBe("-500");
    expect(ledgers[0].balanceAfter.toString()).toBe("4500");
  });

  it("refuses to void when the advance was already spent, instead of writing a negative balance", async () => {
    // The excess was applied to a later voucher, so the wallet cannot fund this
    // reversal. Writing balanceAfter = -300 would silently corrupt the ledger.
    const { tx, ledgers } = walletVoidTx("200");
    await expect(
      reverseTransaction(tx, {
        tenantId: "t1", transactionId: "txn-9", userId: "u-9", reason: "Cheque bounced",
      })
    ).rejects.toThrow(/Cannot void transaction txn-9/);
    expect(ledgers).toHaveLength(0);
  });
});
