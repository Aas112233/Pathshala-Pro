import { describe, it, expect, beforeEach, vi } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * Exam-fee billing invariants.
 *
 * These tests exist to pin the money rules that a "quick" implementation would
 * get wrong: float drift, negative payables, double-billing, overpayment that
 * bypasses the wallet, and silently dropping a class from a charge.
 *
 * The service is exercised against a hand-rolled mock transaction client so
 * the assertions are about OUR branching and arithmetic, not about a live
 * database.
 */

// --- Mock plumbing ---------------------------------------------------------

const chartOfAccounts = [
  { code: "1010", id: "acc-bank" },
  { code: "1020", id: "acc-cash" },
  { code: "1030", id: "acc-ar" },
  { code: "2050", id: "acc-wallet" },
  { code: "4010", id: "acc-tuition" },
  { code: "4030", id: "acc-exam-revenue" },
  { code: "5060", id: "acc-concession" },
];

interface Scenario {
  examClasses: Array<{
    classId: string;
    feeAmount: string;
    isFeeApplicable: boolean;
  }>;
  students: Array<{ id: string; classId: string; sectionId?: string }>;
  concessions?: Array<Record<string, unknown>>;
  existingVouchers?: Array<Record<string, unknown>>;
  feeHeads?: Array<{ code: string; accountCode: string }>;
  accounts?: Array<{ code: string; id: string }>;
}

function makeTx(scenario: Scenario) {
  const state = {
    vouchers: [...(scenario.existingVouchers ?? [])] as any[],
    journals: [] as any[],
    walletLedger: [] as any[],
    created: [] as any[],
  };

  const tx: any = {
    exam: {
      findFirst: async () => ({
        id: "exam-1",
        examId: "EXAM-0001",
        name: "Final",
        academicYearId: "ay-1",
        startDate: new Date(),
      }),
    },
    examClass: {
      findMany: async () =>
        scenario.examClasses.map((c) => ({
          classId: c.classId,
          feeAmount: new Prisma.Decimal(c.feeAmount),
          isFeeApplicable: c.isFeeApplicable,
        })),
      createMany: async () => ({ count: 0 }),
      deleteMany: async () => ({ count: 0 }),
    },
    studentProfile: {
      findMany: async () => scenario.students.map((s) => ({ id: s.id, classId: s.classId })),
      findFirst: async ({ where }: any) => {
        const s = scenario.students.find((x) => x.id === where.id);
        return s ? { id: s.id, classId: s.classId } : null;
      },
    },
    studentFeeConcession: {
      findMany: async () => scenario.concessions ?? [],
    },
    feeHead: {
      findUnique: async ({ where }: any) => {
        const heads = scenario.feeHeads ?? [{ code: "EXAM", accountCode: "4030" }];
        // Prisma compound key: { tenantId_code: { tenantId, code } }
        const key = where?.tenantId_code ?? where;
        return heads.find((h) => h.code === key?.code) ?? null;
      },
    },
    chartOfAccount: {
      findMany: async () => (scenario.accounts ?? chartOfAccounts),
      findFirst: async ({ where }: any) =>
        (scenario.accounts ?? chartOfAccounts).find((a) => a.code === where.code) ?? null,
    },
    feeVoucher: {
      findMany: async () => scenario.existingVouchers ?? [],
      findFirst: async ({ where }: any) => {
        if (where?.studentProfileId && where?.examId) {
          return (
            state.vouchers.find(
              (v) =>
                v.studentProfileId === where.studentProfileId && v.examId === where.examId
            ) ?? null
          );
        }
        return state.vouchers.find((v) => v.id === where?.id) ?? null;
      },
      create: async ({ data }: any) => {
        const row = { id: `fv-${state.vouchers.length + 1}`, ...data };
        state.vouchers.push(row);
        state.created.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const idx = state.vouchers.findIndex((v) => v.id === where.id);
        const current = state.vouchers[idx];
        const next = { ...current };
        if (data.amountPaid?.increment) {
          next.amountPaid = new Prisma.Decimal(current.amountPaid).plus(data.amountPaid.increment);
        }
        if (data.balance !== undefined) next.balance = data.balance;
        if (data.status !== undefined) next.status = data.status;
        state.vouchers[idx] = next;
        return next;
      },
    },
    journalEntry: {
      create: async ({ data }: any) => {
        state.journals.push(data);
        return { id: `je-${state.journals.length}`, ...data };
      },
    },
    studentWalletLedger: {
      create: async ({ data }: any) => {
        state.walletLedger.push(data);
        return data;
      },
      findFirst: async () => null,
    },
    tenantVoucherSequence: { findFirst: async () => null },
    tenant: { findUnique: async () => ({ featureFlags: null }) },
    auditLog: { create: async () => ({}) },
    $queryRaw: async () => [],
    $state: state,
  };

  return tx;
}

const baseScenario: Scenario = {
  examClasses: [
    { classId: "class-a", feeAmount: "500.00", isFeeApplicable: true },
    { classId: "class-b", feeAmount: "750.00", isFeeApplicable: true },
  ],
  students: [
    { id: "s1", classId: "class-a" },
    { id: "s2", classId: "class-b" },
  ],
};

// Import after the mocks are in place so the module picks up the mocked prisma
// singleton if the implementation ever reaches for it directly.
import {
  validateExamClassFees,
  resolveExamClassFees,
  computeExamFeeDue,
  generateExamFeeVoucher,
  collectExamFeePayment,
} from "@/lib/exam-fee-service";

describe("Exam fee validation", () => {
  it("treats a blank amount as 'listed, not charged', never as a zero charge", () => {
    const [row] = validateExamClassFees([{ classId: "class-a", feeAmount: "" }]);
    expect(row.feeAmount.toFixed(2)).toBe("0.00");
    expect(row.isFeeApplicable).toBe(false);
  });

  it("treats null and undefined the same as blank", () => {
    const [a] = validateExamClassFees([{ classId: "c", feeAmount: null }]);
    const [b] = validateExamClassFees([{ classId: "c" }]);
    expect(a.isFeeApplicable).toBe(false);
    expect(b.isFeeApplicable).toBe(false);
  });

  it("rejects a negative amount outright rather than clamping it", () => {
    expect(() => validateExamClassFees([{ classId: "c", feeAmount: -1 }])).toThrow(/negative/i);
  });

  it("rejects duplicate class rows", () => {
    expect(() =>
      validateExamClassFees([
        { classId: "c", feeAmount: 100 },
        { classId: "c", feeAmount: 200 },
      ])
    ).toThrow(/duplicate/i);
  });

  it("rounds to 2dp the way the ledger stores it", () => {
    const [row] = validateExamClassFees([{ classId: "c", feeAmount: "100.005" }]);
    expect(row.feeAmount.toFixed(2)).toBe("100.01");
  });

  it("preserves an explicit zero as applicable-but-free", () => {
    const [row] = validateExamClassFees([{ classId: "c", feeAmount: 0, isFeeApplicable: true }]);
    expect(row.isFeeApplicable).toBe(true);
    expect(row.feeAmount.toFixed(2)).toBe("0.00");
  });
});

describe("resolveExamClassFees", () => {
  it("only returns classes that are applicable AND carry a positive amount", async () => {
    const tx = makeTx({
      ...baseScenario,
      examClasses: [
        { classId: "chargeable", feeAmount: "500.00", isFeeApplicable: true },
        { classId: "listed-free", feeAmount: "0.00", isFeeApplicable: true },
        { classId: "flagged-off", feeAmount: "900.00", isFeeApplicable: false },
      ],
    });
    const map = await resolveExamClassFees(tx, { tenantId: "t1", examId: "exam-1" });
    expect([...map.keys()]).toEqual(["chargeable"]);
  });
});

describe("computeExamFeeDue", () => {
  it("computes per-student net payable from the class fee", async () => {
    const tx = makeTx(baseScenario);
    const rows = await computeExamFeeDue(tx, {
      tenantId: "t1",
      examId: "exam-1",
      academicYearId: "ay-1",
    });
    expect(rows).toHaveLength(2);
    const a = rows.find((r) => r.studentProfileId === "s1")!;
    expect(a.netPayable.toFixed(2)).toBe("500.00");
    const b = rows.find((r) => r.studentProfileId === "s2")!;
    expect(b.netPayable.toFixed(2)).toBe("750.00");
  });

  it("applies a stacked percentage concession against the exam fee", async () => {
    const tx = makeTx({
      ...baseScenario,
      concessions: [
        {
          studentProfileId: "s1",
          discountType: "PERCENTAGE",
          discountValue: 10,
          appliesToHead: "TUITION",
          priority: 10,
        },
      ],
    });
    const rows = await computeExamFeeDue(tx, {
      tenantId: "t1",
      examId: "exam-1",
      academicYearId: "ay-1",
    });
    const a = rows.find((r) => r.studentProfileId === "s1")!;
    expect(a.discountAmount.toFixed(2)).toBe("50.00");
    expect(a.netPayable.toFixed(2)).toBe("450.00");
  });

  it("never lets a stacked concession drive the payable negative", async () => {
    const tx = makeTx({
      ...baseScenario,
      examClasses: [{ classId: "class-a", feeAmount: "100.00", isFeeApplicable: true }],
      students: [{ id: "s1", classId: "class-a" }],
      concessions: [
        {
          studentProfileId: "s1",
          discountType: "FIXED_AMOUNT",
          discountValue: 9999,
          appliesToHead: "TUITION",
          priority: 10,
        },
      ],
    });
    const rows = await computeExamFeeDue(tx, {
      tenantId: "t1",
      examId: "exam-1",
      academicYearId: "ay-1",
    });
    expect(rows[0].netPayable.toFixed(2)).toBe("0.00");
    expect(rows[0].netPayable.isNegative()).toBe(false);
  });

  it("folds an existing voucher's remaining balance into 'outstanding'", async () => {
    const tx = makeTx({
      ...baseScenario,
      existingVouchers: [
        { id: "fv-1", studentProfileId: "s1", examId: "exam-1", status: "PARTIAL", balance: "200.00" },
      ],
    });
    const rows = await computeExamFeeDue(tx, {
      tenantId: "t1",
      examId: "exam-1",
      academicYearId: "ay-1",
    });
    const a = rows.find((r) => r.studentProfileId === "s1")!;
    expect(a.outstanding.toFixed(2)).toBe("200.00");
    expect(a.isPaid).toBe(false);
  });

  it("marks a fully settled voucher as paid so the desk cannot re-collect it", async () => {
    const tx = makeTx({
      ...baseScenario,
      existingVouchers: [
        { id: "fv-1", studentProfileId: "s1", examId: "exam-1", status: "PAID", balance: "0.00" },
      ],
    });
    const rows = await computeExamFeeDue(tx, {
      tenantId: "t1",
      examId: "exam-1",
      academicYearId: "ay-1",
    });
    expect(rows.find((r) => r.studentProfileId === "s1")!.isPaid).toBe(true);
  });

  it("returns nothing when the exam carries no chargeable class", async () => {
    const tx = makeTx({
      ...baseScenario,
      examClasses: [{ classId: "class-a", feeAmount: "0.00", isFeeApplicable: false }],
    });
    const rows = await computeExamFeeDue(tx, {
      tenantId: "t1",
      examId: "exam-1",
      academicYearId: "ay-1",
    });
    expect(rows).toEqual([]);
  });

  it("refuses a class that was never configured on the exam instead of showing an empty grid", async () => {
    const tx = makeTx(baseScenario);
    await expect(
      computeExamFeeDue(tx, {
        tenantId: "t1",
        examId: "exam-1",
        classId: "class-unknown",
        academicYearId: "ay-1",
      })
    ).rejects.toThrow(/not configured/i);
  });
});

describe("generateExamFeeVoucher", () => {
  it("books the charge as a Decimal against the EXAM revenue head", async () => {
    const tx = makeTx(baseScenario);
    const result = await generateExamFeeVoucher(tx, {
      tenantId: "t1",
      examId: "exam-1",
      studentProfileId: "s1",
      academicYearId: "ay-1",
      executedById: "u1",
    });
    expect(result.totalDue).toBe("500.00");
    const voucher = tx.$state.created[0];
    expect(voucher.feeType).toBe("EXAM");
    expect(voucher.examId).toBe("exam-1");
    // An exam charge is not tied to a calendar month.
    expect(voucher.billingMonth).toBeUndefined();
  });

  it("credits the EXAM fee head's mapped account, not tuition", async () => {
    const tx = makeTx(baseScenario);
    await generateExamFeeVoucher(tx, {
      tenantId: "t1",
      examId: "exam-1",
      studentProfileId: "s1",
      academicYearId: "ay-1",
      executedById: "u1",
    });
    const journal = tx.$state.journals[0];
    const revenueLeg = journal.lineItems.create.find((l: any) =>
      String(l.narration).includes("Fee Revenue")
    );
    expect(revenueLeg.accountId).toBe("acc-exam-revenue");
  });

  it("keeps the accrual journal balanced to the cent", async () => {
    const tx = makeTx(baseScenario);
    await generateExamFeeVoucher(tx, {
      tenantId: "t1",
      examId: "exam-1",
      studentProfileId: "s1",
      academicYearId: "ay-1",
      executedById: "u1",
    });
    const journal = tx.$state.journals[0];
    const debits = journal.lineItems.create.reduce(
      (s: Prisma.Decimal, l: any) => s.plus(l.debitAmount),
      new Prisma.Decimal(0)
    );
    const credits = journal.lineItems.create.reduce(
      (s: Prisma.Decimal, l: any) => s.plus(l.creditAmount),
      new Prisma.Decimal(0)
    );
    expect(debits.toFixed(2)).toBe(credits.toFixed(2));
  });

  it("refuses a student whose class has no fee, rather than silently billing zero", async () => {
    const tx = makeTx({
      ...baseScenario,
      examClasses: [{ classId: "class-a", feeAmount: "500.00", isFeeApplicable: true }],
      students: [{ id: "s9", classId: "class-z" }],
    });
    await expect(
      generateExamFeeVoucher(tx, {
        tenantId: "t1",
        examId: "exam-1",
        studentProfileId: "s9",
        academicYearId: "ay-1",
        executedById: "u1",
      })
    ).rejects.toThrow(/no exam fee configured/i);
  });
});

describe("collectExamFeePayment", () => {
  const base = {
    tenantId: "t1",
    examId: "exam-1",
    academicYearId: "ay-1",
    executedById: "u1",
  };

  it("creates the voucher on first collection, then applies the payment", async () => {
    const tx = makeTx(baseScenario);
    const result = await collectExamFeePayment(tx, {
      ...base,
      studentProfileId: "s1",
      amountPaid: 500,
      paymentMethod: "CASH",
    });
    expect(result.voucherCreated).toBe(true);
    expect(result.appliedToInvoice).toBe("500.00");
    expect(result.newBalance).toBe("0.00");
    expect(result.status).toBe("PAID");
  });

  it("records a partial payment as PARTIAL and leaves the remainder due", async () => {
    const tx = makeTx(baseScenario);
    const result = await collectExamFeePayment(tx, {
      ...base,
      studentProfileId: "s1",
      amountPaid: 200,
      paymentMethod: "CASH",
    });
    expect(result.appliedToInvoice).toBe("200.00");
    expect(result.newBalance).toBe("300.00");
    expect(result.status).toBe("PARTIAL");
  });

  it("rejects a payment larger than the amount due unless advance is enabled", async () => {
    const tx = makeTx(baseScenario);
    await expect(
      collectExamFeePayment(tx, {
        ...base,
        studentProfileId: "s1",
        amountPaid: 900,
        paymentMethod: "CASH",
      })
    ).rejects.toThrow(/exceeds the outstanding exam fee/i);
  });

  it("routes the excess to the advance wallet when advance is enabled", async () => {
    const tx = makeTx(baseScenario);
    const result = await collectExamFeePayment(tx, {
      ...base,
      studentProfileId: "s1",
      amountPaid: 700,
      paymentMethod: "CASH",
      allowAdvanceToWallet: true,
    });
    expect(result.appliedToInvoice).toBe("500.00");
    expect(result.excessToWallet).toBe("200.00");
    expect(result.newBalance).toBe("0.00");
  });

  it("keeps payment === applied + excess so the receipt journal balances", async () => {
    const tx = makeTx(baseScenario);
    const result = await collectExamFeePayment(tx, {
      ...base,
      studentProfileId: "s1",
      amountPaid: 700.55,
      paymentMethod: "CASH",
      allowAdvanceToWallet: true,
    });
    const applied = new Prisma.Decimal(result.appliedToInvoice);
    const excess = new Prisma.Decimal(result.excessToWallet);
    const total = new Prisma.Decimal(result.amountPaid);
    expect(applied.plus(excess).toFixed(2)).toBe(total.toFixed(2));
  });

  it("refuses a second collection against a fully settled exam fee", async () => {
    const tx = makeTx({
      ...baseScenario,
      existingVouchers: [
        { id: "fv-1", studentProfileId: "s1", examId: "exam-1", status: "PAID", balance: "0.00" },
      ],
    });
    await expect(
      collectExamFeePayment(tx, {
        ...base,
        studentProfileId: "s1",
        amountPaid: 500,
        paymentMethod: "CASH",
      })
    ).rejects.toThrow(/already fully paid/i);
  });

  it("rejects a non-positive payment", async () => {
    const tx = makeTx(baseScenario);
    await expect(
      collectExamFeePayment(tx, {
        ...base,
        studentProfileId: "s1",
        amountPaid: 0,
        paymentMethod: "CASH",
      })
    ).rejects.toThrow(/greater than 0/i);
  });

  it("reuses an existing voucher instead of raising a duplicate one", async () => {
    const tx = makeTx({
      ...baseScenario,
      existingVouchers: [
        {
          id: "fv-1",
          studentProfileId: "s1",
          examId: "exam-1",
          status: "PARTIAL",
          balance: "300.00",
          amountPaid: "200.00",
        },
      ],
    });
    const result = await collectExamFeePayment(tx, {
      ...base,
      studentProfileId: "s1",
      amountPaid: 300,
      paymentMethod: "CASH",
    });
    expect(result.voucherCreated).toBe(false);
    expect(result.feeVoucherId).toBe("fv-1");
    // No new voucher row was written.
    expect(tx.$state.created).toHaveLength(0);
  });
});
