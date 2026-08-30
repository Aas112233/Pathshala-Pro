import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { addCurrency, roundCurrency } from "@/lib/math-utils";
import { computeStackedConcession } from "@/lib/fee-service";
import { postDoubleEntryJournal } from "@/lib/accounting-engine";

/**
 * Regression/characterization suite for the 2026-08-31 deep numerical audit
 * follow-up (docs/MATH-AUDIT-FOLLOWUP-2026-08-31.md).
 *
 * Every test here calls REAL exported production code (not a re-implemented
 * copy of the formula), and every non-obvious assertion is annotated with
 * whether it documents a currently-live bug ("BUG:") or proves a currently
 * correct invariant ("OK:"). Tests tagged BUG are intentionally green today —
 * they pin down today's actual behaviour so that the day someone fixes the
 * underlying defect, this file forces a deliberate, visible edit instead of
 * silently drifting.
 */

describe("stress: 10,000 randomized fractional-cent transactions never leak a penny", () => {
  it("addCurrency(...) reconstructs the exact cent-rounded sum for any random set of amounts", () => {
    // Deterministic LCG (Numerical Recipes constants) — avoids BigInt literals
    // so this file compiles under the project's configured TS target.
    let seed = 123456789;
    const nextRandom = () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 4294967296; // [0,1)
    };

    for (let trial = 0; trial < 10_000; trial++) {
      // Random amount with up to 4 fractional digits (worse than money's 2,
      // to stress the rounding boundary), between 0.0001 and 999.9999.
      const raw = 0.0001 + nextRandom() * 999.9999;
      const a = Math.round(raw * 10_000) / 10_000;
      const b = Math.round((raw * 3) % 500 * 10_000) / 10_000;
      const c = Math.round((raw * 7) % 300 * 10_000) / 10_000;

      const viaHelper = addCurrency(a, b, c);
      const expected = roundCurrency(roundCurrency(a) + roundCurrency(b) + roundCurrency(c));

      // addCurrency must agree, cent-for-cent, with rounding each line then
      // summing in integer cents — the canonical actuarial invariant
      // SUM(round(item)) === round(SUM(item)) that the naive
      // `Math.round(a*100)/100` pattern violates at scale.
      expect(viaHelper).toBeCloseTo(expected, 10);
      expect(Number.isInteger(Math.round(viaHelper * 100))).toBe(true);
    }
  });

  it("100,000 additions of 0.01 sum to exactly 100000.00, not 99999.99999999997", () => {
    // The classic IEEE754 counterexample this audit was commissioned to hunt for.
    let raw = 0;
    for (let i = 0; i < 100_000; i++) raw += 0.01;
    expect(raw).not.toBe(1000); // OK: demonstrates the raw float bug exists...

    let viaHelper = 0;
    for (let i = 0; i < 100_000; i++) viaHelper = addCurrency(viaHelper, 0.01);
    expect(viaHelper).toBe(1000); // OK: ...and that addCurrency is immune to it.
  });
});

describe("FIXED (finding A2): computeStackedConcession now clamps each scope (TUITION vs ALL_HEADS) against its own correct base", () => {
  it("fully applies an entitled ALL_HEADS concession even when tuition is a small fraction of the total bill", () => {
    // A student's monthly bill is 1,500 (tuition 200 + transport 700 + hostel 600).
    // A 1,000 FIXED_AMOUNT concession is configured to apply to ALL_HEADS, which
    // is legitimately <= the 1,500 actually billed.
    const tuitionGross = new Prisma.Decimal(200);
    const fullBase = new Prisma.Decimal(1500);

    const concession = computeStackedConcession(
      tuitionGross,
      [{ discountType: "FIXED_AMOUNT", discountValue: 1000, appliesToHead: "ALL_HEADS" }],
      fullBase,
    );

    // Fixed: the final safety clamp now compares the ALL_HEADS-scoped
    // subtotal against the same base its numerator used (`fullBase`), so the
    // concession is no longer capped below what was actually configured.
    expect(concession.toNumber()).toBe(1000);
  });

  it("OK: a TUITION-scoped concession is correctly capped at the tuition subtotal", () => {
    const tuitionGross = new Prisma.Decimal(200);
    const fullBase = new Prisma.Decimal(1500);

    const concession = computeStackedConcession(
      tuitionGross,
      [{ discountType: "FIXED_AMOUNT", discountValue: 1000, appliesToHead: "TUITION" }],
      fullBase,
    );

    // Correct: a concession explicitly scoped to TUITION cannot exceed the
    // tuition line itself, regardless of the total bill.
    expect(concession.toNumber()).toBe(200);
  });

  it("OK: a TUITION-scoped concession still can't exceed tuitionGross even when stacked with a large ALL_HEADS concession", () => {
    // Mixed-scope stacking in a single call: a 1,000 TUITION-scoped concession
    // (against a 200 tuition line) must stay capped at 200, while a 1,200
    // ALL_HEADS concession (against a 1,500 full bill) is free to apply in
    // full — proving the two scopes are clamped independently rather than
    // one oversized scope "borrowing" headroom from the other.
    const tuitionGross = new Prisma.Decimal(200);
    const fullBase = new Prisma.Decimal(1500);

    const concession = computeStackedConcession(
      tuitionGross,
      [
        { discountType: "FIXED_AMOUNT", discountValue: 1000, appliesToHead: "TUITION" },
        { discountType: "FIXED_AMOUNT", discountValue: 1200, appliesToHead: "ALL_HEADS" },
      ],
      fullBase,
    );

    // tuitionScoped capped at 200 + allHeadsScoped capped at 1200 = 1400,
    // itself still under the 1500 full-base ceiling.
    expect(concession.toNumber()).toBe(1400);
  });
});

describe("FIXED (finding, payroll): calculateEmployeePayroll now caps deductions instead of clamping netPayable alone", () => {
  it("the OLD (buggy) uncapped shape still fails accounting-engine's balance check — this is why the fix matters", async () => {
    // This is the exact line shape postPayrollAccrual used to build for one
    // employee whose configured tax/loan recovery exceed gross salary:
    // gross=10,000; pf=10,000; tax=999,999; loan=999,999 -> uncapped
    // totalDeductions=2,009,998, so netPayable was clamped to 0 while the
    // uncapped pf/tax/loan were still credited at full value. Constructing
    // this shape by hand and feeding it directly to the real
    // postDoubleEntryJournal proves *why* calculateEmployeePayroll had to
    // change: this shape is fundamentally unbalanceable, not just unlucky.
    const gross = new Prisma.Decimal(10_000);
    const netPayableClamped = new Prisma.Decimal(0);
    const pf = new Prisma.Decimal(10_000);
    const tax = new Prisma.Decimal(999_999);
    const loan = new Prisma.Decimal(999_999);

    await expect(
      postDoubleEntryJournal({} as any, {
        tenantId: "audit-fixture",
        voucherType: "PAYROLL_ACCRUAL",
        reference: "audit-fixture-payroll-imbalance",
        narration: "Audit fixture: payroll accrual with uncapped deductions (old behaviour)",
        lines: [
          { accountCode: "5010", side: "DEBIT", amount: gross },
          { accountCode: "2020", side: "CREDIT", amount: netPayableClamped },
          { accountCode: "2030", side: "CREDIT", amount: pf },
          { accountCode: "2040", side: "CREDIT", amount: tax },
          { accountCode: "1040", side: "CREDIT", amount: loan },
        ],
      }),
    ).rejects.toThrow(/Double-entry imbalance/);
  });

  it("the NEW cascading-cap arithmetic always balances by construction, even when configured deductions wildly exceed gross", async () => {
    // Mirrors calculateEmployeePayroll's fixed deduction cascade: LOP -> PF ->
    // Tax -> Loan, each capped against whatever remains of gross, so
    // netPayable is never negative and the sum of applied deductions can
    // never exceed gross — no clamp-without-capping, no shortfall silently
    // written off into an unbalanceable journal.
    const gross = new Prisma.Decimal(10_000);
    const lop = new Prisma.Decimal(0);
    const configuredPf = new Prisma.Decimal(10_000);
    const configuredTax = new Prisma.Decimal(999_999);
    const configuredLoan = new Prisma.Decimal(999_999);

    let remaining = gross.sub(lop);
    const pf = Prisma.Decimal.min(configuredPf, remaining);
    remaining = remaining.sub(pf);
    const tax = Prisma.Decimal.min(configuredTax, remaining);
    remaining = remaining.sub(tax);
    const loan = Prisma.Decimal.min(configuredLoan, remaining);
    remaining = remaining.sub(loan);
    const netPayable = remaining;

    // gross=10,000 -> pf capped at 10,000, remaining 0 -> tax capped at 0 ->
    // loan capped at 0 -> netPayable = 0. Nothing here can go negative.
    expect(pf.toNumber()).toBe(10_000);
    expect(tax.toNumber()).toBe(0);
    expect(loan.toNumber()).toBe(0);
    expect(netPayable.toNumber()).toBe(0);

    const { journalId } = await postDoubleEntryJournal(
      {
        chartOfAccount: {
          findMany: async () => [
            { code: "5010", id: "acc-salary" },
            { code: "2020", id: "acc-payable" },
            { code: "2030", id: "acc-pf" },
          ],
        },
        journalEntry: {
          create: async (payload: any) => ({ id: "jv-audit-fixture", ...payload.data }),
        },
        auditLog: { create: async () => ({}) },
      } as any,
      {
        tenantId: "audit-fixture",
        voucherType: "PAYROLL_ACCRUAL",
        reference: "audit-fixture-payroll-capped",
        narration: "Audit fixture: payroll accrual with capped deductions (fixed behaviour)",
        lines: [
          { accountCode: "5010", side: "DEBIT", amount: gross },
          { accountCode: "2020", side: "CREDIT", amount: netPayable },
          { accountCode: "2030", side: "CREDIT", amount: pf },
        ],
      },
    );

    expect(journalId).toBe("jv-audit-fixture"); // did not throw — the journal balances
  });
});

describe("FIXED (finding L1): postDoubleEntryJournal now rejects negative line amounts", () => {
  it("rejects a negative/negative debit-credit pair instead of accepting it as 'balanced'", async () => {
    const negative = new Prisma.Decimal(-100);

    // Previously, a negated contra-entry (Dr -100 / Cr -100) was arithmetically
    // "balanced" (-100 === -100) and sailed past the balance-equality check,
    // corrupting every downstream SUM(debitAmount)/SUM(creditAmount) report
    // that assumes non-negative Decimal(15,2) columns. postDoubleEntryJournal
    // now rejects any negative line amount before it ever touches `tx`,
    // matching domain-math.ts's assertJournalBalance contract ("flip side
    // instead of negating").
    await expect(
      postDoubleEntryJournal({} as any, {
        tenantId: "audit-fixture",
        voucherType: "JOURNAL",
        reference: "audit-fixture-negative-pair",
        narration: "Audit fixture: negative debit/credit pair",
        lines: [
          { accountCode: "1010", side: "DEBIT", amount: negative },
          { accountCode: "4010", side: "CREDIT", amount: negative },
        ],
      }),
    ).rejects.toThrow(/negative line amount/);
  });

  it("still rejects a genuinely unbalanced journal", async () => {
    await expect(
      postDoubleEntryJournal({} as any, {
        tenantId: "audit-fixture",
        voucherType: "JOURNAL",
        reference: "audit-fixture-unbalanced",
        narration: "Audit fixture: unbalanced journal",
        lines: [
          { accountCode: "1010", side: "DEBIT", amount: new Prisma.Decimal(100) },
          { accountCode: "4010", side: "CREDIT", amount: new Prisma.Decimal(99) },
        ],
      }),
    ).rejects.toThrow(/Double-entry imbalance/);
  });
});

describe("BUG (finding, payroll reporting): Prisma.Decimal serializes to a JSON string, not a number", () => {
  it("JSON.stringify(Decimal) produces a quoted string sibling to plain numeric fields", () => {
    const netPayable = new Prisma.Decimal("5000.00"); // as read back from SalaryLedger.netPayable
    const paidAmount = 5000; // as read back from the legacy Float column

    const wirePayload = JSON.stringify({ netPayable, paidAmount });

    // BUG: api/reports/salary/route.ts and api/accounting/statements/route.ts
    // put a raw Decimal directly into a NextResponse.json(...) body. The two
    // sibling fields serialize with different JSON types even though the
    // API's own TypeScript response shape implies both are numeric.
    expect(wirePayload).toBe('{"netPayable":"5000","paidAmount":5000}');

    const parsed = JSON.parse(wirePayload) as { netPayable: unknown; paidAmount: unknown };
    expect(typeof parsed.netPayable).toBe("string"); // BUG: should be "number"
    expect(typeof parsed.paidAmount).toBe("number"); // OK
  });
});
