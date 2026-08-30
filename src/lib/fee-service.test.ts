import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  generateFeeInvoice,
  applyLateFineSurcharge,
  collectFeePayment,
} from "@/lib/fee-service";

describe("Student Fee Invoicing & Double-Entry Collection Engine", () => {
  describe("generateFeeInvoice", () => {
    it("generates itemized invoice and creates balanced double-entry accrual", async () => {
      const createdJournals: any[] = [];
      const mockTx: any = {
        $queryRaw: async () => [{ id: "seq-1", current_number: 101 }],
        $executeRaw: async () => 1,
        chartOfAccount: {
          findMany: async () => [
            { id: "acc-ar", code: "1030", name: "Student Accounts Receivable", isActive: true },
            { id: "acc-tuition", code: "4010", name: "Tuition Fee Income", isActive: true },
            { id: "acc-transport", code: "4040", name: "Transport Fee Income", isActive: true },
            { id: "acc-concession", code: "5060", name: "Fee Concession Expense", isActive: true },
          ],
        },
        journalEntry: {
          create: async (payload: any) => {
            createdJournals.push(payload.data);
            return { id: "jv-inv-1", ...payload.data };
          },
        },
      };

      const result = await generateFeeInvoice(mockTx, {
        tenantId: "school-lahore-01",
        studentProfileId: "st-101",
        academicYearId: "ay-2026",
        classId: "cls-9",
        billingMonth: 9,
        billingYear: 2026,
        dueDate: new Date("2026-09-10"),
        items: [
          { feeHeadCode: "TUITION", title: "Monthly Tuition Fee", amount: 8000, revenueAccountCode: "4010" },
          { feeHeadCode: "TRANSPORT", title: "Bus Transport Fee", amount: 2000, revenueAccountCode: "4040" },
        ],
        concessionAmount: 1500, // Sibling waiver
        concessionReason: "SIBLING",
        executedById: "user-accountant-1",
      });

      expect(result.grossAmount).toBe("10000.00");
      expect(result.discountAmount).toBe("1500.00");
      expect(result.netPayable).toBe("8500.00");
      expect(result.balance).toBe("8500.00");
      expect(result.status).toBe("UNPAID");

      // Verify GL Posting Balance
      expect(createdJournals.length).toBe(1);
      const jv = createdJournals[0];
      const debitSum = jv.lineItems.create.reduce(
        (sum: Prisma.Decimal, l: any) => sum.plus(l.debitAmount),
        new Prisma.Decimal(0)
      );
      const creditSum = jv.lineItems.create.reduce(
        (sum: Prisma.Decimal, l: any) => sum.plus(l.creditAmount),
        new Prisma.Decimal(0)
      );

      expect(debitSum.equals(creditSum)).toBe(true);
      expect(debitSum.toString()).toBe("10000");
    });

    it("uses the configured FeeHead revenue account when the item has no explicit override", async () => {
      const createdJournals: any[] = [];
      const mockTx: any = {
        $queryRaw: async () => [{ id: "seq-mapped", current_number: 1 }],
        $executeRaw: async () => 1,
        feeHead: {
          findMany: async () => [{ code: "TUITION", accountCode: "4090" }],
        },
        chartOfAccount: {
          findMany: async () => [
            { id: "acc-ar", code: "1030", name: "Student Accounts Receivable", isActive: true },
            { id: "acc-custom", code: "4090", name: "Configured Tuition Revenue", isActive: true },
          ],
        },
        journalEntry: {
          create: async (payload: any) => {
            createdJournals.push(payload.data);
            return { id: "jv-mapped-1", ...payload.data };
          },
        },
      };

      await generateFeeInvoice(mockTx, {
        tenantId: "school-lahore-01",
        studentProfileId: "st-mapped",
        academicYearId: "ay-2026",
        classId: "cls-9",
        billingMonth: 9,
        billingYear: 2026,
        dueDate: new Date("2026-09-10"),
        items: [{ feeHeadCode: "TUITION", title: "Monthly Tuition Fee", amount: 8000 }],
        executedById: "user-accountant-1",
      });

      expect(createdJournals[0].lineItems.create).toContainEqual(
        expect.objectContaining({ accountId: "acc-custom", creditAmount: new Prisma.Decimal(8000) })
      );
    });
  });

  describe("applyLateFineSurcharge", () => {
    it("posts late fine surcharge against accounts receivable and updates the voucher's balance", async () => {
      const createdJournals: any[] = [];
      const voucherUpdates: any[] = [];
      const mockTx: any = {
        $queryRaw: async () => [{ id: "seq-2", current_number: 102 }],
        $executeRaw: async () => 1,
        chartOfAccount: {
          findMany: async () => [
            { id: "acc-ar", code: "1030", name: "Student Accounts Receivable", isActive: true },
            { id: "acc-late", code: "4060", name: "Late Fee Surcharge Income", isActive: true },
          ],
        },
        journalEntry: {
          create: async (payload: any) => {
            createdJournals.push(payload.data);
            return { id: "jv-fine-1", ...payload.data };
          },
        },
        feeVoucher: {
          update: async (payload: any) => {
            voucherUpdates.push(payload);
            return { id: payload.where.id, ...payload.data };
          },
        },
      };

      const result = await applyLateFineSurcharge(mockTx, {
        tenantId: "school-dhaka-01",
        feeVoucherId: "INV-2026-0099",
        studentProfileId: "st-202",
        fineAmount: 500,
        executedById: "user-admin-1",
      });

      expect(result.fineAmount).toBe("500.00");
      expect(result.status).toBe("OVERDUE");

      const jv = createdJournals[0];
      expect(jv.totalDebit.toString()).toBe("500");
      expect(jv.totalCredit.toString()).toBe("500");

      // The voucher itself must be incremented by the same fine amount that
      // was posted to the GL, so its balance stays in sync with the ledger.
      expect(voucherUpdates.length).toBe(1);
      expect(voucherUpdates[0].where.id).toBe("INV-2026-0099");
      expect(voucherUpdates[0].data.lateFine.increment).toBe(500);
      expect(voucherUpdates[0].data.totalDue.increment).toBe(500);
      expect(voucherUpdates[0].data.balance.increment).toBe(500);
      expect(voucherUpdates[0].data.status).toBe("OVERDUE");
    });
  });

  describe("collectFeePayment", () => {
    it("processes fee payment and routes excess to Student Wallet (2050)", async () => {
      const createdJournals: any[] = [];
      // Post-fix, collectFeePayment locks the real FeeVoucher row (there is
      // no FeeInvoice table), so the mock must return totalDue/amountPaid
      // instead of the old (nonexistent) netAmount/paidAmount shape.
      const mockTx: any = {
        $queryRaw: async () => [
          { id: "INV-101", totalDue: 5000, amountPaid: 0 },
        ],
        $executeRaw: async () => 1,
        chartOfAccount: {
          findMany: async () => [
            { id: "acc-bank", code: "1010", name: "Main Bank Account", isActive: true },
            { id: "acc-ar", code: "1030", name: "Student Accounts Receivable", isActive: true },
            { id: "acc-wallet", code: "2050", name: "Unearned Fee Liability / Wallet", isActive: true },
          ],
        },
        journalEntry: {
          create: async (payload: any) => {
            createdJournals.push(payload.data);
            return { id: "jv-pay-1", ...payload.data };
          },
        },
      };

      // Pay 6,000 against a 5,000 invoice (1,000 excess to wallet)
      const result = await collectFeePayment(mockTx, {
        tenantId: "school-delhi-01",
        feeVoucherId: "INV-101",
        paymentAmount: 6000,
        paymentMethod: "BANK_TRANSFER",
        executedById: "user-cashier-1",
      });

      expect(result.appliedToInvoice).toBe("5000.00");
      expect(result.excessToWallet).toBe("1000.00");
      expect(result.status).toBe("PAID");

      // Verify 3-Leg Balanced GL Entry
      const jv = createdJournals[0];
      expect(jv.lineItems.create.length).toBe(3);
      const debitSum = jv.lineItems.create.reduce(
        (sum: Prisma.Decimal, l: any) => sum.plus(l.debitAmount),
        new Prisma.Decimal(0)
      );
      const creditSum = jv.lineItems.create.reduce(
        (sum: Prisma.Decimal, l: any) => sum.plus(l.creditAmount),
        new Prisma.Decimal(0)
      );

      expect(debitSum.equals(creditSum)).toBe(true);
      expect(debitSum.toString()).toBe("6000");
    });
  });
});
