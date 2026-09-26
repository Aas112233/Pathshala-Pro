import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  generateFeeInvoice,
  applyLateFineSurcharge,
  collectFeePayment,
  postFeeReceipt,
  applyWalletDebit,
  getWalletBalance,
  postCashDeposit,
  resolveOpenPeriod,
  waiveLateFine,
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
      expect(voucherUpdates[0].data.lateFine.increment.toString()).toBe("500");
      expect(voucherUpdates[0].data.totalDue.increment.toString()).toBe("500");
      expect(voucherUpdates[0].data.balance.increment.toString()).toBe("500");
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
          { id: "INV-101", studentProfileId: "student-101", totalDue: 5000, amountPaid: 0 },
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

  describe("postFeeReceipt", () => {
    it("routes via tenant paymentMethods, writes AuditLog, links wallet with transactionId", async () => {
      const createdJournals: any[] = [];
      const auditCreates: any[] = [];
      const walletCreates: any[] = [];
      const mockTx: any = {
        tenant: {
          findUnique: async () => ({
            featureFlags: { paymentMethods: [{ id: "easypaisa", code: "EASYPAISA", accountCode: "1031" }] },
          }),
        },
        chartOfAccount: {
          findMany: async () => [
            { id: "acc-ep", code: "1031", name: "EasyPaisa Merchant", isActive: true },
            { id: "acc-ar", code: "1030", name: "Student Accounts Receivable", isActive: true },
            { id: "acc-wallet", code: "2050", name: "Unearned Fee Liability / Wallet", isActive: true },
          ],
        },
        journalEntry: {
          create: async (payload: any) => {
            createdJournals.push(payload.data);
            return { id: "jv-rcpt-1", ...payload.data };
          },
        },
        auditLog: { create: async (payload: any) => { auditCreates.push(payload.data); return payload.data; } },
        $queryRaw: async () => [{ id: "st-303" }],
        // getWalletBalance reads SUM(amount) (order-independent), not the last
        // row's balanceAfter, so the mock exposes the aggregate lane.
        studentWalletLedger: { aggregate: async () => ({ _sum: { amount: null } }), create: async (payload: any) => { walletCreates.push(payload.data); return payload.data; } },
      };

      const result = await postFeeReceipt(mockTx, {
        tenantId: "school-karachi-01",
        studentProfileId: "st-303",
        feeVoucherId: "INV-303",
        amount: 6000,
        appliedToInvoice: 5000,
        excessToWallet: 1000,
        paymentMethod: "EASYPAISA",
        receiptNumber: "REC-303",
        executedById: "user-cashier-9",
        transactionId: "txn-303",
      });

      expect(result.journalEntryId).toBe("jv-rcpt-1");
      // Custom accountCode routing, not the 1010 default
      expect(createdJournals[0].lineItems.create[0].accountId).toBe("acc-ep");
      expect(auditCreates.length).toBe(1);
      expect(auditCreates[0].action).toBe("JOURNAL_POST");
      expect(walletCreates.length).toBe(1);
      expect(walletCreates[0].transactionId).toBe("txn-303");
      expect(walletCreates[0].balanceAfter.toString()).toBe("1000");
    });
  });

  describe("applyWalletDebit", () => {
    const walletTx = (balance: number) => {
      const journals: any[] = [];
      const ledgers: any[] = [];
      return {
        journals,
        ledgers,
        tx: {
          $queryRaw: async () => [{ id: "st-404" }],
          chartOfAccount: {
            findMany: async () => [
              { id: "acc-wallet", code: "2050", name: "Unearned Fee Liability / Wallet", isActive: true },
              { id: "acc-ar", code: "1030", name: "Student Accounts Receivable", isActive: true },
            ],
          },
          journalEntry: {
            create: async (payload: any) => {
              journals.push(payload.data);
              return { id: "jv-wallet-1", ...payload.data };
            },
          },
          studentWalletLedger: {
            aggregate: async () => ({ _sum: { amount: balance } }),
            create: async (payload: any) => { ledgers.push(payload.data); return payload.data; },
          },
        } as any,
      };
    };

    it("settles from wallet with Dr 2050 / Cr 1030 and a negative ledger entry", async () => {
      const { journals, ledgers, tx } = walletTx(1000);
      const result = await applyWalletDebit(tx, {
        tenantId: "school-quetta-01",
        studentProfileId: "st-404",
        feeVoucherId: "INV-404",
        amount: 600,
        executedById: "user-cashier-2",
        receiptNumber: "REC-404",
        transactionId: "txn-404",
      });
      expect(result.journalEntryId).toBe("jv-wallet-1");
      const legs = journals[0].lineItems.create;
      expect(legs.find((l: any) => l.accountId === "acc-wallet").debitAmount.toString()).toBe("600");
      expect(legs.find((l: any) => l.accountId === "acc-ar").creditAmount.toString()).toBe("600");
      expect(ledgers[0].amount.toString()).toBe("-600");
      expect(ledgers[0].balanceAfter.toString()).toBe("400");
      expect(await getWalletBalance(tx, { tenantId: "school-quetta-01", studentProfileId: "st-404" })).toBeDefined();
    });

    it("rejects debits above the wallet balance", async () => {
      const { tx } = walletTx(200);
      await expect(
        applyWalletDebit(tx, {
          tenantId: "school-quetta-01",
          studentProfileId: "st-404",
          feeVoucherId: "INV-404",
          amount: 500,
          executedById: "user-cashier-2",
          receiptNumber: "REC-405",
        })
      ).rejects.toThrow(/Insufficient wallet balance/);
    });
  });

  describe("postCashDeposit + resolveOpenPeriod", () => {
    it("posts a balanced CONTRA journal and syncs both linked bank balances", async () => {
      const journals: any[] = [];
      const synced: any[] = [];
      const mockTx: any = {
        chartOfAccount: {
          findMany: async () => [
            { id: "acc-cash", code: "1020", name: "Cash Register", isActive: true },
            { id: "acc-bank", code: "1010", name: "Main Bank Account", isActive: true },
          ],
        },
        fiscalYear: { findFirst: async () => null },
        journalEntry: {
          create: async (payload: any) => {
            journals.push(payload.data);
            return { id: "jv-contra-1", ...payload.data };
          },
        },
        bankAccount: {
          // Single active linked account per code → mirror sync proceeds.
          findMany: async () => [{ id: "b1" }],
          updateMany: async (payload: any) => { synced.push(payload); return { count: 1 }; },
        },
        $queryRaw: async () => [{ id: "seq-1", current_number: 7 }],
        $executeRaw: async () => 1,
      };

      const result = await postCashDeposit(mockTx, {
        tenantId: "school-hyd-01",
        fromCode: "1020",
        toCode: "1010",
        amount: 25000,
        executedById: "user-cashier-3",
        note: "Evening counter deposit",
      });
      expect(result.journalEntryId).toBe("jv-contra-1");
      expect(journals[0].voucherType).toBe("CONTRA");
      expect(journals[0].totalDebit.toString()).toBe("25000");
      const deltas = Object.fromEntries(synced.map((s: any) => [s.where.accountCode, s.data.currentBalance.increment]));
      expect(deltas["1010"]).toBe(25000);
      expect(deltas["1020"]).toBe(-25000);
    });

    it("rejects same-account deposits", async () => {
      const mockTx: any = { chartOfAccount: { findMany: async () => [] } };
      await expect(
        postCashDeposit(mockTx, {
          tenantId: "t1", toCode: "1010", fromCode: "1010", amount: 100, executedById: "u1",
        })
      ).rejects.toThrow(/must differ/);
    });

    it("stores bank slip reference and linked receipts on the CONTRA narration", async () => {
      const journals: any[] = [];
      const mockTx: any = {
        chartOfAccount: {
          findMany: async () => [
            { id: "acc-cash", code: "1020", name: "Cash Register", isActive: true },
            { id: "acc-bank", code: "1010", name: "Main Bank Account", isActive: true },
          ],
        },
        fiscalYear: { findFirst: async () => null },
        journalEntry: {
          create: async (payload: any) => {
            journals.push(payload.data);
            return { id: "jv-contra-2", ...payload.data };
          },
        },
        bankAccount: { updateMany: async () => ({ count: 1 }) },
        $queryRaw: async () => [{ id: "seq-1", current_number: 8 }],
        $executeRaw: async () => 1,
      };

      await postCashDeposit(mockTx, {
        tenantId: "school-hyd-01",
        fromCode: "1020",
        toCode: "1010",
        amount: 15000,
        executedById: "user-acc-1",
        bankReference: "UTR123456",
        receiptRefs: "REC-2026-0001, REC-2026-0002",
      });
      expect(journals[0].reference).toBe("UTR123456");
      expect(journals[0].narration).toContain("Bank ref: UTR123456");
      expect(journals[0].narration).toContain("REC-2026-0001");
    });

    it("throws when the posting date falls in a closed period", async () => {
      const mockTx: any = {
        fiscalYear: { findFirst: async () => ({ id: "fy-1", isClosed: false }) },
        financialPeriod: { findFirst: async () => ({ id: "fp-3", isClosed: true }) },
      };
      await expect(resolveOpenPeriod(mockTx, { tenantId: "t1" })).rejects.toThrow(/closed/);
    });

    it("returns empty when the tenant has no fiscal setup", async () => {
      const mockTx: any = { fiscalYear: { findFirst: async () => null } };
      await expect(resolveOpenPeriod(mockTx, { tenantId: "t1" })).resolves.toEqual({});
    });
  });

  describe("waiveLateFine", () => {
    it("reverses Dr 4060 / Cr 1030 and decrements the voucher fine balances", async () => {
      const journals: any[] = [];
      const updates: any[] = [];
      const mockTx: any = {
        $queryRaw: async () => [{ id: "INV-505", lateFine: 500, totalDue: 5500, amountPaid: 0 }],
        $executeRaw: async () => 1,
        chartOfAccount: {
          findMany: async () => [
            { id: "acc-ar", code: "1030", name: "Student Accounts Receivable", isActive: true },
            { id: "acc-late", code: "4060", name: "Late Fee Surcharge Income", isActive: true },
          ],
        },
        fiscalYear: { findFirst: async () => null },
        journalEntry: {
          create: async (payload: any) => {
            journals.push(payload.data);
            return { id: "jv-waive-1", ...payload.data };
          },
        },
        feeVoucher: {
          update: async (payload: any) => { updates.push(payload); return payload; },
        },
      };

      const result = await waiveLateFine(mockTx, {
        tenantId: "school-lhr-01",
        feeVoucherId: "INV-505",
        studentProfileId: "st-505",
        amount: 200,
        executedById: "user-principal-1",
        reason: "Good attendance waiver",
      });
      expect(result.waivedAmount).toBe("200.00");
      const legs = journals[0].lineItems.create;
      expect(legs.find((l: any) => l.accountId === "acc-late").debitAmount.toString()).toBe("200");
      expect(legs.find((l: any) => l.accountId === "acc-ar").creditAmount.toString()).toBe("200");
      expect(updates[0].data.lateFine.decrement.toString()).toBe("200");
      expect(updates[0].data.totalDue.decrement.toString()).toBe("200");
    });

    it("rejects waivers above the outstanding fine", async () => {
      const mockTx: any = {
        $queryRaw: async () => [{ id: "INV-506", lateFine: 100, totalDue: 5100, amountPaid: 0 }],
        chartOfAccount: { findMany: async () => [] },
      };
      await expect(
        waiveLateFine(mockTx, {
          tenantId: "t1", feeVoucherId: "INV-506", studentProfileId: "st-506",
          amount: 500, executedById: "u1",
        })
      ).rejects.toThrow(/within 0 and outstanding fine/);
    });
  });

  describe("wallet invariants", () => {
    const walletGuardTx = (voucherStudentId: string | null) => {
      const ledgers: any[] = [];
      const journals: any[] = [];
      return {
        ledgers,
        journals,
        tx: {
          $queryRaw: async () => [{ id: "st-1" }],
          feeVoucher: {
            findUnique: async () =>
              voucherStudentId === null ? null : { studentProfileId: voucherStudentId },
          },
          chartOfAccount: {
            findMany: async () => [
              { id: "acc-wallet", code: "2050", isActive: true },
              { id: "acc-ar", code: "1030", isActive: true },
            ],
          },
          journalEntry: {
            create: async (payload: any) => {
              journals.push(payload.data);
              return { id: "jv-1", ...payload.data };
            },
          },
          studentWalletLedger: {
            aggregate: async () => ({ _sum: { amount: 5000 } }),
            create: async (payload: any) => { ledgers.push(payload.data); return payload.data; },
          },
          auditLog: { create: async () => ({}) },
        } as any,
      };
    };

    it("rejects a wallet debit paired with another student's voucher", async () => {
      // Without this guard the wallet of st-attacker was debited while
      // Accounts Receivable was credited against st-victim's invoice.
      const { tx, ledgers, journals } = walletGuardTx("st-victim");
      await expect(
        applyWalletDebit(tx, {
          tenantId: "t1",
          studentProfileId: "st-attacker",
          feeVoucherId: "INV-victim",
          amount: 1000,
          executedById: "u1",
          receiptNumber: "REC-1",
        })
      ).rejects.toThrow(/belongs to student st-victim/);
      expect(ledgers).toHaveLength(0);
      expect(journals).toHaveLength(0);
    });

    it("allows the debit when the voucher belongs to the same student", async () => {
      const { tx, ledgers } = walletGuardTx("st-1");
      await applyWalletDebit(tx, {
        tenantId: "t1",
        studentProfileId: "st-1",
        feeVoucherId: "INV-1",
        amount: 1000,
        executedById: "u1",
        receiptNumber: "REC-2",
      });
      expect(ledgers).toHaveLength(1);
      expect(ledgers[0].amount.toString()).toBe("-1000");
      expect(ledgers[0].balanceAfter.toString()).toBe("4000");
    });

    it("derives balance by summing the ledger, ignoring row order", async () => {
      // Regression: the wallet once read the newest row's balanceAfter ordered
      // by createdAt alone. Rows written in one transaction share a
      // createdAt (CURRENT_TIMESTAMP = transaction start), so that ordering was
      // undefined. SUM is order-independent.
      const tx: any = {
        studentWalletLedger: {
          aggregate: async (args: any) => {
            expect(args.where).toEqual({ tenantId: "t1", studentProfileId: "st-1" });
            return { _sum: { amount: new Prisma.Decimal("1234.56") } };
          },
        },
      };
      const bal = await getWalletBalance(tx, { tenantId: "t1", studentProfileId: "st-1" });
      expect(bal.toFixed(2)).toBe("1234.56");
    });

    it("returns a zero balance for a student with no wallet rows", async () => {
      const tx: any = { studentWalletLedger: { aggregate: async () => ({ _sum: { amount: null } }) } };
      const bal = await getWalletBalance(tx, { tenantId: "t1", studentProfileId: "st-none" });
      expect(bal.toFixed(2)).toBe("0.00");
    });
  });
});
