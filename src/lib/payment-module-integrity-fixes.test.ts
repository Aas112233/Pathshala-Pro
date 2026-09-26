import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  collectFeePayment,
  postFeeReceipt,
  postCollectionJournal,
  postLegacyFeeInvoiceAccrual,
} from "@/lib/fee-service";
import { collectExamFeePayment } from "@/lib/exam-fee-service";
import { resolveMethodAccountCode } from "@/lib/payment-method-routing";
import { getNextVoucherNumber } from "@/lib/accounting-sequence";
import { reverseTransaction } from "@/lib/transaction-void";
import { postDoubleEntryJournal } from "@/lib/accounting-engine";
import { GL_CODES } from "@/lib/constants";

describe("Payment Module Audit Fixes & Concurrency Integrity", () => {
  describe("Bug 2 & 13: collectExamFeePayment rounding, cheque validation, receipt sequence", () => {
    it("rejects CHEQUE payment without chequeNumber", async () => {
      const mockTx: any = {
        feeVoucher: { findFirst: async () => null },
      };
      await expect(
        collectExamFeePayment(mockTx, {
          tenantId: "t1",
          examId: "exam-1",
          studentProfileId: "s1",
          academicYearId: "ay-1",
          amountPaid: 500,
          paymentMethod: "CHEQUE",
          executedById: "u1",
        })
      ).rejects.toThrow(/Cheque number is required/i);
    });

    it("ensures unrounded payment input is strictly rounded to 2 decimal places", async () => {
      const journals: any[] = [];
      const mockTx: any = {
        $queryRaw: async () => [
          { id: "v1", voucherId: "EXAM-V1", balance: new Prisma.Decimal("1000.00"), status: "PENDING" },
        ],
        feeVoucher: {
          findFirst: async () => ({ id: "v1", voucherId: "EXAM-V1", balance: "1000.00", status: "PENDING" }),
          update: async () => ({}),
        },
        chartOfAccount: {
          findMany: async () => [
            { id: "a-cash", code: GL_CODES.CASH, isActive: true },
            { id: "a-ar", code: GL_CODES.RECEIVABLE, isActive: true },
          ],
        },
        journalEntry: {
          create: async (payload: any) => {
            journals.push(payload.data);
            return { id: "jv-1", entryNumber: "REC-1" };
          },
        },
        tenant: { findUnique: async () => null },
        fiscalYear: { findFirst: async () => null },
        financialPeriod: { findFirst: async () => null },
        $executeRaw: async () => 1,
      };

      const result = await collectExamFeePayment(mockTx, {
        tenantId: "t1",
        examId: "exam-1",
        studentProfileId: "s1",
        academicYearId: "ay-1",
        amountPaid: 450.555, // 3 decimal places -> rounds to 450.56
        paymentMethod: "CASH",
        executedById: "u1",
      });

      expect(result.amountPaid).toBe("450.56");
      expect(result.appliedToInvoice).toBe("450.56");
    });
  });

  describe("Bug 3 & 12: Fee payment studentProfileId verification and cross-validation", () => {
    it("refuses to apply payment when voucher belongs to a different student", async () => {
      const mockTx: any = {
        feeVoucher: {
          findUnique: async () => ({ id: "v-diff", studentProfileId: "student-actual" }),
        },
        chartOfAccount: { findMany: async () => [] },
      };

      await expect(
        postFeeReceipt(mockTx, {
          tenantId: "t1",
          studentProfileId: "student-impostor",
          feeVoucherId: "v-diff",
          amount: 500,
          appliedToInvoice: 500,
          paymentMethod: "CASH",
          receiptNumber: "REC-1",
          executedById: "u1",
        })
      ).rejects.toThrow(/belongs to student student-actual/i);
    });

    it("throws if fee voucher has no associated student profile instead of corrupting studentId", async () => {
      const mockTx: any = {
        $queryRaw: async () => [
          { id: "v-orphan", totalDue: new Prisma.Decimal(500), amountPaid: new Prisma.Decimal(0) }, // no studentProfileId
        ],
        feeVoucher: { findUnique: async () => null },
      };

      await expect(
        collectFeePayment(mockTx, {
          tenantId: "t1",
          feeVoucherId: "v-orphan",
          paymentAmount: 500,
          paymentMethod: "CASH",
          executedById: "u1",
        })
      ).rejects.toThrow(/has no associated student profile/i);
    });
  });

  describe("Bug 9: postCollectionJournal WALLET_CREDIT strict amount matching", () => {
    it("throws if WALLET_CREDIT payment amount does not match appliedToInvoice", async () => {
      const mockTx: any = {};
      await expect(
        postCollectionJournal(mockTx, {
          tenantId: "t1",
          studentProfileId: "s1",
          feeVoucherId: "v1",
          amount: 1000,
          appliedToInvoice: 600, // mismatch
          excessToWallet: 0,
          paymentMethod: "WALLET_CREDIT",
          receiptNumber: "REC-1",
          executedById: "u1",
        })
      ).rejects.toThrow(/cannot exceed the voucher balance due or leave unallocated funds/i);
    });
  });

  describe("Bug 16: resolveMethodAccountCode type-based routing", () => {
    it("routes custom method with type: CASH to GL_CODES.CASH even if code is custom", () => {
      const customMethods = [
        { id: "m1", code: "CAMPUS_CASH_COUNTER", type: "CASH", label: "Campus Cash" },
        { id: "m2", code: "ONLINE_PORTAL", type: "DIGITAL", label: "Online" },
      ];

      const cashAccount = resolveMethodAccountCode(customMethods, "CAMPUS_CASH_COUNTER");
      expect(cashAccount).toBe(GL_CODES.CASH);

      const digitalAccount = resolveMethodAccountCode(customMethods, "ONLINE_PORTAL");
      expect(digitalAccount).toBe(GL_CODES.BANK);
    });
  });

  describe("Bug 7: postLegacyFeeInvoiceAccrual fiscal period verification", () => {
    it("attaches fiscalYearId and financialPeriodId when open period exists", async () => {
      const createdJournals: any[] = [];
      const mockTx: any = {
        feeHead: { findUnique: async () => ({ accountCode: "4010" }) },
        chartOfAccount: {
          findMany: async () => [
            { id: "a-ar", code: GL_CODES.RECEIVABLE, isActive: true },
          ],
          findFirst: async () => ({ id: "a-rev", code: "4010", isActive: true }),
        },
        fiscalYear: {
          findFirst: async () => ({ id: "fy-2026", isClosed: false }),
        },
        financialPeriod: {
          findFirst: async () => ({ id: "fp-q1", isClosed: false }),
        },
        journalEntry: {
          create: async (payload: any) => {
            createdJournals.push(payload.data);
            return { id: "jv-accrual-1" };
          },
        },
        $queryRaw: async () => [],
      };

      await postLegacyFeeInvoiceAccrual(mockTx, {
        tenantId: "t1",
        studentProfileId: "s1",
        feeHeadCode: "TUITION",
        amount: 5000,
        executedById: "u1",
        reference: "INV-2026-001",
      });

      expect(createdJournals.length).toBe(1);
      expect(createdJournals[0].fiscalYearId).toBe("fy-2026");
      expect(createdJournals[0].financialPeriodId).toBe("fp-q1");
    });

    it("rejects accrual when fiscal period is closed", async () => {
      const mockTx: any = {
        feeHead: { findUnique: async () => ({ accountCode: "4010" }) },
        chartOfAccount: {
          findMany: async () => [{ id: "a-ar", code: GL_CODES.RECEIVABLE, isActive: true }],
          findFirst: async () => ({ id: "a-rev", code: "4010", isActive: true }),
        },
        fiscalYear: {
          findFirst: async () => ({ id: "fy-2025", isClosed: true }),
        },
      };

      await expect(
        postLegacyFeeInvoiceAccrual(mockTx, {
          tenantId: "t1",
          studentProfileId: "s1",
          feeHeadCode: "TUITION",
          amount: 5000,
          executedById: "u1",
          reference: "INV-2025-001",
        })
      ).rejects.toThrow(/Fiscal year is closed/i);
    });
  });

  describe("Bug 28: postDoubleEntryJournal filtering of zero-amount lines", () => {
    it("filters out zero amount lines and does not create zero lineItems in journal", async () => {
      let createdJournal: any = null;
      const mockTx: any = {
        chartOfAccount: {
          findMany: async () => [
            { id: "a-5010", code: "5010" },
            { id: "a-2030", code: "2030" },
          ],
        },
        journalEntry: {
          create: async (payload: any) => {
            createdJournal = payload.data;
            return { id: "jv-1", entryNumber: "JV-001" };
          },
        },
      };

      await postDoubleEntryJournal(mockTx, {
        tenantId: "t1",
        voucherType: "PAYROLL_ACCRUAL",
        reference: "REF-001",
        narration: "Payroll with zero tax and zero loan",
        lines: [
          { accountCode: "5010", side: "DEBIT", amount: new Prisma.Decimal(5000) },
          { accountCode: "2030", side: "CREDIT", amount: new Prisma.Decimal(5000) },
          { accountCode: "2040", side: "CREDIT", amount: new Prisma.Decimal(0) }, // zero line
        ],
      });

      expect(createdJournal).not.toBeNull();
      // Only 2 non-zero lines are created; the zero line is filtered out
      expect(createdJournal.lineItems.create.length).toBe(2);
      expect(createdJournal.lineItems.create.some((l: any) => l.debitAmount.isZero() && l.creditAmount.isZero())).toBe(false);
    });
  });
});
