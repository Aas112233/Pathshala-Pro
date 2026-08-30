/**
 * Mathematical integrity suite.
 *
 * Each case reproduces a defect found in the audit against the *pure* helper
 * implementations. These helpers are the proposed fixes; the suites that remain
 * red are the production call sites that still compute the formula inline.
 */

import { describe, expect, it } from "vitest";
import {
  addCurrency,
  allocatePayment,
  applyPercentage,
  calculateVoucherTotals,
  clamp,
  clampNonNegative,
  computeVoucherTotals,
  roundCurrency,
  roundCurrencyStrict,
  roundTo,
  safeDivide,
  safePercentage,
} from "@/lib/math-utils";
import {
  applyStockDelta,
  assertJournalBalance,
  canAllocate,
  classifyAccountCode,
  computeAggregatePercentage,
  computeAttendancePercentage,
  computeBalanceSheet,
  computeLop,
  computeNetPayable,
  computeNetSurplus,
  computeOverdueFine,
  computePercentage,
  computeWeightedGpa,
  daysBetween,
  daysInMonth,
  inclusiveDays,
  needsReorder,
  occupancyRate,
  perDaySalary,
  prorate,
  rankStudents,
  reorderQuantity,
  resolveGradePoint,
  signedBalance,
  sumSides,
} from "@/lib/domain-math";

/* ================================================================== *
 * 1. Division by zero
 * ================================================================== */

describe("division by zero", () => {
  it("returns the fallback instead of NaN or Infinity", () => {
    expect(safeDivide(100, 0)).toBe(0);
    expect(safeDivide(100, 0, -1)).toBe(-1);
    expect(safeDivide(0, 0)).toBe(0);
    expect(safePercentage(10, 0)).toBe(0);
    expect(computePercentage(50, 0)).toBe(0);
    expect(computeAggregatePercentage([{ obtained: 10, max: 0 }])).toBe(0);
  });

  it("guards result overflow, not just a zero denominator", () => {
    // 1e308 / 1e-308 overflows to Infinity even though the denominator is valid.
    expect(safeDivide(1e308, 1e-308)).toBe(0);
  });

  it("treats an unknown attendance period as unknown, not as zero", () => {
    // 0% would auto-retain a student for a data-entry gap; a fabricated
    // 94% would print invented attendance on a signed report card.
    expect(computeAttendancePercentage({ present: 0, workingDays: 0 })).toBeNull();
  });

  it("returns 0% occupancy for a zero-capacity room instead of NaN", () => {
    expect(occupancyRate(0, 0)).toBe(0);
    expect(occupancyRate(5, 0)).toBe(0);
  });

  it("rejects proration and LOP against a zero-length period", () => {
    expect(prorate(60000, 10, 0)).toBe(0);
    expect(perDaySalary(60000, 0)).toBe(0);
    expect(computeLop(60000, 3, 0)).toBe(0);
  });
});

/* ================================================================== *
 * 2. Fractional penny drift
 * ================================================================== */

describe("fractional penny drift", () => {
  it("sums 0.1 + 0.2 exactly", () => {
    expect(0.1 + 0.2).not.toBe(0.3); // the raw float bug
    expect(addCurrency(0.1, 0.2)).toBe(0.3);
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
  });

  it("accumulates many small values without drift", () => {
    const values = Array.from({ length: 1000 }, () => 0.01);
    expect(addCurrency(...values)).toBe(10);
  });

  it("rounds half-cent boundaries away from zero at any magnitude", () => {
    // The previous epsilon nudge was a no-op above ~1.0 and failed 6.58% of
    // half-cent boundaries in 100.00-5000.00.
    expect(roundCurrency(128.075)).toBe(128.08);
    expect(roundCurrency(128.045)).toBe(128.05);
    expect(roundCurrency(100.075)).toBe(100.08);
    expect(roundCurrency(128.015)).toBe(128.02);
  });

  it("rounds negatives symmetrically with positives", () => {
    // Math.round breaks ties toward +Infinity, so a naive implementation
    // rounds -1.005 toward zero (1.00) while rounding +1.005 away (1.01).
    expect(roundCurrency(1.005)).toBe(1.01);
    expect(roundCurrency(-1.005)).toBe(-1.01);
    expect(roundCurrency(2.675)).toBe(2.68);
    expect(roundCurrency(-2.675)).toBe(-2.68);
    expect(roundCurrency(-0.145)).toBe(-0.15);
  });

  it("keeps addCurrency consistent with roundCurrency", () => {
    // The two helpers previously disagreed on the same input: 1.005 -> 1 vs 1.01.
    expect(addCurrency(1.005)).toBe(roundCurrency(1.005));
  });

  it("rounds to arbitrary precision", () => {
    expect(roundTo(1.2345, 3)).toBe(1.235);
    expect(roundTo(1.2345, 1)).toBe(1.2);
  });

  it("treats a non-finite amount as a hard error when asked to", () => {
    expect(roundCurrency(Number.POSITIVE_INFINITY)).toBe(0); // lenient legacy default
    expect(() => roundCurrencyStrict(Number.POSITIVE_INFINITY)).toThrow(/finite/);
  });

  it("applies percentages without drifting", () => {
    expect(applyPercentage(4000, 12.5)).toBe(500);
    expect(applyPercentage(3333.33, 10)).toBe(333.33);
    expect(() => applyPercentage(1000, 150)).toThrow(/0–100/);
    expect(() => applyPercentage(1000, -5)).toThrow(/0–100/);
  });
});

/* ================================================================== *
 * 3. Concessions, clamping and voucher totals
 * ================================================================== */

describe("concessions and voucher totals", () => {
  it("settles a 100% concession to a zero balance, never negative", () => {
    const totals = calculateVoucherTotals({ baseAmount: 400, discountAmount: 400 });
    expect(totals.totalDue).toBe(0);
    expect(totals.balance).toBe(0);
    expect(totals.overpaid).toBe(false);
  });

  it("rejects a concession larger than the base on an interactive write", () => {
    expect(() => calculateVoucherTotals({ baseAmount: 400, discountAmount: 500 })).toThrow(/exceed/);
  });

  it("clamps and reports the cap during unattended batch generation", () => {
    const totals = computeVoucherTotals({ baseAmount: 400, discountAmount: 500 });
    expect(totals.concession).toBe(400);
    expect(totals.totalDue).toBe(0);
    expect(totals.concessionCapped).toBe(true);
  });

  it("includes late fines in the amount due", () => {
    const totals = calculateVoucherTotals({
      baseAmount: 1000,
      arrears: 200,
      lateFine: 50,
    });
    expect(totals.totalDue).toBe(1250);
  });

  it("accepts the deprecated lateFee alias without dropping the fine", () => {
    expect(calculateVoucherTotals({ baseAmount: 1000, lateFee: 50 }).totalDue).toBe(1050);
  });

  it("routes an overpayment to the wallet and flags the voucher", () => {
    const totals = calculateVoucherTotals({ baseAmount: 1200, amountPaid: 1500 });
    expect(totals.balance).toBe(0);
    expect(totals.overpaid).toBe(true);
    expect(totals.excessToWallet).toBe(300);
  });

  it("computes voucher totals in integer cents, immune to float drift", () => {
    expect(calculateVoucherTotals({ baseAmount: 0.1, arrears: 0.2 }).totalDue).toBe(0.3);
    expect(calculateVoucherTotals({ baseAmount: 0.07, arrears: 0.01 }).totalDue).toBe(0.08);
  });

  it("rejects negative and non-finite voucher inputs", () => {
    expect(() => calculateVoucherTotals({ baseAmount: -100 })).toThrow(/negative/);
    expect(() => calculateVoucherTotals({ baseAmount: Number.NaN })).toThrow(/finite/);
  });

  it("allocates payments so applied + excess always equals the payment", () => {
    expect(allocatePayment(1500, 1200)).toEqual({ appliedToInvoice: 1200, excessToWallet: 300 });
    expect(allocatePayment(1200, 1500)).toEqual({ appliedToInvoice: 1200, excessToWallet: 0 });
    expect(allocatePayment(500, 1200)).toEqual({ appliedToInvoice: 500, excessToWallet: 0 });
    expect(allocatePayment(0, 1200)).toEqual({ appliedToInvoice: 0, excessToWallet: 0 });

    for (const [payment, balance] of [
      [1500, 1200],
      [1200.004, 1200],
      [0.01, 0.02],
      [9999.99, 0.01],
    ]) {
      const { appliedToInvoice, excessToWallet } = allocatePayment(payment!, balance!);
      expect(appliedToInvoice + excessToWallet).toBe(roundCurrency(payment!));
    }
  });

  it("refuses to silently erase an invalid allocation", () => {
    // A clamped negative payment previously returned {0,0}, losing the refund.
    expect(() => allocatePayment(-100, 1200)).toThrow(/negative payment/);
    expect(() => allocatePayment(Number.NaN, 1200)).toThrow(/non-finite/);
    expect(() => allocatePayment(Number.POSITIVE_INFINITY, 1200)).toThrow(/non-finite/);
  });

  it("clamps into range and refuses inverted bounds", () => {
    expect(clamp(-100, 0)).toBe(0);
    expect(clamp(150, 0, 100)).toBe(100);
    expect(() => clamp(500, 1000, 100)).toThrow(/exceeds upper bound/);
    expect(clampNonNegative(-3.5)).toBe(0);
  });
});

/* ================================================================== *
 * 4. Payroll proration across month lengths
 * ================================================================== */

describe("payroll proration across month lengths", () => {
  it("returns the true calendar length of every month", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29); // leap year
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it("pro-rates a mid-month joinee to the day", () => {
    expect(prorate(60000, 16, 30)).toBe(32000); // joined on the 15th of a 30-day month
    expect(prorate(60000, 30, 30)).toBe(60000);
    expect(prorate(60000, 0, 30)).toBe(0);
  });

  it("clamps payable days so they can never exceed the period", () => {
    expect(prorate(60000, 45, 30)).toBe(60000);
    expect(prorate(60000, -5, 30)).toBe(0);
  });

  it("deducts LOP for 28, 30 and 31 day months at 2dp", () => {
    const feb = computeLop(60000, 2, 28);
    const apr = computeLop(60000, 2, 30);
    const jan = computeLop(60000, 2, 31);

    expect(feb).toBe(4285.71);
    expect(apr).toBe(4000);
    expect(jan).toBe(3870.97);

    // Every value is exactly 2dp — no 4285.714285714286 leaking into a payslip.
    for (const value of [feb, apr, jan]) {
      expect(Math.round(value * 100)).toBe(value * 100);
    }
  });

  it("derives LOP as the proration residual so money is conserved", () => {
    const gross = 100000;
    const totalDays = 31;
    const unpaid = 3;

    const lop = computeLop(gross, unpaid, totalDays);
    const earned = prorate(gross, totalDays - unpaid, totalDays);

    // Conservation is the property that matters: gross === earned + lop exactly.
    expect(roundCurrency(earned + lop)).toBe(gross);
    expect(lop).toBe(9677.42);
  });

  it("documents the residual-vs-per-day paisa, which cannot be eliminated", () => {
    // rate x days (3,225.81 x 3 = 9,677.43) and the proration residual
    // (100,000 - 90,322.58 = 9,677.42) differ by one paisa. Both roundings
    // cannot hold simultaneously, so the payslip must choose one authority:
    // the residual is authoritative because it conserves money, and the
    // printed daily rate is therefore informational.
    expect(roundCurrency(perDaySalary(100000, 31) * 3)).toBe(9677.43);
    expect(computeLop(100000, 3, 31)).toBe(9677.42);
  });

  it("clamps net pay at zero and reports the discarded shortfall", () => {
    const result = computeNetPayable({ gross: 60000, pf: 4998, tax: 0, loan: 70000 });
    expect(result.totalDeductions).toBe(74998);
    expect(result.netPayable).toBe(0);
    expect(result.shortfall).toBe(14998);
  });

  it("computes net pay normally when deductions are affordable", () => {
    const result = computeNetPayable({
      gross: 100000,
      lop: 46666.67,
      pf: 4998,
      tax: 5000,
      loan: 10000,
    });
    expect(result.netPayable).toBe(33335.33);
    expect(result.shortfall).toBe(0);
  });

  it("counts inclusive leave spans by calendar day, not elapsed milliseconds", () => {
    const sameDayNineToFive = inclusiveDays(
      new Date("2026-04-10T09:00:00Z"),
      new Date("2026-04-10T17:00:00Z"),
    );
    const threeNights = inclusiveDays(
      new Date("2026-04-10T00:00:00Z"),
      new Date("2026-04-13T00:00:00Z"),
    );
    expect(sameDayNineToFive).toBe(1);
    expect(threeNights).toBe(4);
  });
});

/* ================================================================== *
 * 5. Examination percentages, GPA and ranking
 * ================================================================== */

describe("examination percentages and GPA", () => {
  it("clamps obtained marks into the maximum by default", () => {
    expect(computePercentage(75, 100)).toBe(75);
    expect(computePercentage(150, 100)).toBe(100);
    expect(computePercentage(150, 100, { clamp: false })).toBe(150);
    expect(computePercentage(-10, 100)).toBe(0);
  });

  it("aggregates as the ratio of sums, not the mean of percentages", () => {
    const rows = [
      { obtained: 5, max: 50 }, // 10%
      { obtained: 400, max: 500 }, // 80%
    ];
    // Mean of percentages would be 45; the true aggregate is 405/550.
    expect(computeAggregatePercentage(rows)).toBe(73.64);
    expect(computeAggregatePercentage(rows)).not.toBe(45);
  });

  it("weights GPA by credit hours and falls back to the mean", () => {
    expect(computeWeightedGpa([{ gradePoint: 4, creditHours: 10 }, { gradePoint: 2, creditHours: 1 }])).toBe(3.82);
    expect(computeWeightedGpa([{ gradePoint: 4 }, { gradePoint: 3 }])).toBe(3.5);
    expect(computeWeightedGpa([{ gradePoint: 4, creditHours: 0 }])).toBe(4);
    expect(computeWeightedGpa([])).toBe(0);
  });

  it("resolves grades identically for ascending and descending band tables", () => {
    const descending = [
      { min: 90, grade: "A+", point: 4 },
      { min: 80, grade: "A", point: 3.6 },
      { min: 0, grade: "F", point: 0 },
    ];
    const ascending = [...descending].reverse();
    expect(resolveGradePoint(85, descending).grade).toBe("A");
    expect(resolveGradePoint(85, ascending).grade).toBe("A");
  });

  it("throws instead of falling through to the last band on a gap", () => {
    expect(() => resolveGradePoint(50, [{ min: 80, grade: "A", point: 4 }])).toThrow(/no configured band/);
    expect(() => resolveGradePoint(50, [])).toThrow(/empty band table/);
  });

  it("credits half-days at 0.5 when computing attendance", () => {
    const result = computeAttendancePercentage({ present: 30, halfDay: 5, workingDays: 40 });
    expect(result).toBe(81.25);
    expect(result).not.toBe(75); // counting half-days as full absences
  });
});

describe("class ranking and ties", () => {
  const cohort = [
    { id: "A", name: "Asha", percentage: 92.4 },
    { id: "B", name: "Bilal", percentage: 92.4 },
    { id: "C", name: "Chandra", percentage: 91.0 },
    { id: "D", name: "Dinesh", percentage: 88.0 },
  ];
  const scoreOf = (row: { percentage: number }) => row.percentage;

  it("gives tied students an identical rank", () => {
    const ranked = rankStudents(cohort, scoreOf);
    expect(ranked.find((r) => r.id === "A")!.rank).toBe(1);
    expect(ranked.find((r) => r.id === "B")!.rank).toBe(1);
  });

  it("applies standard competition ranking by default (1, 1, 3)", () => {
    expect(rankStudents(cohort, scoreOf).map((r) => r.rank)).toEqual([1, 1, 3, 4]);
  });

  it("supports dense ranking (1, 1, 2)", () => {
    expect(rankStudents(cohort, scoreOf, { policy: "dense" }).map((r) => r.rank)).toEqual([1, 1, 2, 3]);
  });

  it("supports legacy ordinal ranking only when explicitly requested", () => {
    expect(rankStudents(cohort, scoreOf, { policy: "ordinal" }).map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it("does not split a tie over floating-point noise", () => {
    const noisy = [
      { id: "X", percentage: 92.4 },
      { id: "Y", percentage: 92.40000000000001 },
    ];
    const ranked = rankStudents(noisy, scoreOf);
    expect(ranked[0].rank).toBe(ranked[1].rank);
  });

  it("reports the size of each tied group", () => {
    const ranked = rankStudents(cohort, scoreOf);
    expect(ranked[0].tieCount).toBe(1);
    expect(ranked[1].tieCount).toBe(2);
    expect(ranked[2].tieCount).toBe(1);
  });

  it("is deterministic regardless of input ordering", () => {
    const reversed = [...cohort].reverse();
    const a = rankStudents(cohort, scoreOf, { tieBreak: (x, y) => x.name.localeCompare(y.name) });
    const b = rankStudents(reversed, scoreOf, { tieBreak: (x, y) => x.name.localeCompare(y.name) });
    expect(a.map((r) => `${r.id}:${r.rank}`)).toEqual(b.map((r) => `${r.id}:${r.rank}`));
    // Alphabetical tie-break puts Asha ahead of Bilal in both orderings.
    expect(a[0].name).toBe("Asha");
    expect(b[0].name).toBe("Asha");
  });

  it("formats rank labels and handles empty cohorts", () => {
    expect(rankStudents(cohort, scoreOf)[0].rankLabel).toBe("1st");
    expect(rankStudents([], scoreOf)).toEqual([]);
    expect(rankStudents([{ id: "S", percentage: 50 }], scoreOf)[0].rank).toBe(1);
  });
});

/* ================================================================== *
 * 6. Campus operations
 * ================================================================== */

describe("library overdue fines", () => {
  it("counts calendar days so a DST transition cannot add a day", () => {
    // Due Oct 31 00:00 EDT, returned Nov 2 00:00 EST: two calendar days,
    // but the elapsed time is 2 days 1 hour, which ceil()s to 3.
    const due = new Date("2026-10-31T04:00:00Z");
    const returned = new Date("2026-11-02T05:00:00Z");
    expect(daysBetween(due, returned)).toBe(2);
    expect(computeOverdueFine(due, returned, { dailyRate: 5 }).fine).toBe(10);
  });

  it("charges nothing for a return on the due date", () => {
    const due = new Date("2026-09-10T00:00:00Z");
    const returned = new Date("2026-09-10T09:00:00Z"); // same day, 9 hours late
    expect(daysBetween(due, returned)).toBe(0);
    expect(computeOverdueFine(due, returned, { dailyRate: 5 })).toEqual({ daysLate: 0, fine: 0 });
  });

  it("never produces a negative fine for an early return", () => {
    const due = new Date("2026-09-15T00:00:00Z");
    const returned = new Date("2026-09-14T00:00:00Z");
    expect(daysBetween(due, returned)).toBe(-1);
    expect(computeOverdueFine(due, returned, { dailyRate: 5 })).toEqual({ daysLate: 0, fine: 0 });
  });

  it("honours the grace period and the maximum fine", () => {
    const due = new Date("2026-09-01T00:00:00Z");
    const returned = new Date("2026-09-11T00:00:00Z"); // 10 days
    expect(computeOverdueFine(due, returned, { dailyRate: 5, graceDays: 3 }).fine).toBe(35);
    expect(computeOverdueFine(due, returned, { dailyRate: 5, maxFine: 20 }).fine).toBe(20);
  });

  it("rounds fractional daily rates to 2dp", () => {
    const due = new Date("2026-09-01T00:00:00Z");
    const returned = new Date("2026-09-04T00:00:00Z"); // 3 days
    expect(computeOverdueFine(due, returned, { dailyRate: 0.1 }).fine).toBe(0.3);
  });
});

describe("capacity and inventory", () => {
  it("computes occupancy safely", () => {
    expect(occupancyRate(6, 10)).toBe(60);
    expect(occupancyRate(4, 4)).toBe(100);
    expect(occupancyRate(12, 8)).toBe(100); // over-occupancy is clamped for display
  });

  it("refuses allocation into a full or non-existent container", () => {
    expect(canAllocate(3, 4)).toBe(true);
    expect(canAllocate(4, 4)).toBe(false);
    expect(canAllocate(5, 4)).toBe(false);
    expect(canAllocate(0, 0)).toBe(false);
  });

  it("rejects stock movements that would go negative instead of clamping", () => {
    expect(applyStockDelta(10, -8)).toBe(2);
    expect(applyStockDelta(10, -10)).toBe(0);
    expect(applyStockDelta(10, -11)).toBeNull();
    expect(applyStockDelta(10, 5, 12)).toBeNull(); // exceeds the maximum
  });

  it("uses one inclusive reorder threshold", () => {
    expect(needsReorder(0, 10)).toBe(true); // out of stock must alert
    expect(needsReorder(10, 10)).toBe(true);
    expect(needsReorder(11, 10)).toBe(false);
    expect(reorderQuantity(0, 10, 50)).toBe(50);
    expect(reorderQuantity(20, 10, 50)).toBe(0);
  });
});

/* ================================================================== *
 * 7. General ledger
 * ================================================================== */

describe("general ledger equilibrium", () => {
  it("accepts a balanced journal", () => {
    expect(
      assertJournalBalance([
        { side: "DEBIT", amount: 5000 },
        { side: "CREDIT", amount: 3000 },
        { side: "CREDIT", amount: 2000 },
      ]),
    ).toEqual({ totalDebit: 5000, totalCredit: 5000 });
  });

  it("rejects an unbalanced journal instead of persisting it", () => {
    expect(() =>
      assertJournalBalance([
        { side: "DEBIT", amount: 100 },
        { side: "CREDIT", amount: 99.99 },
      ]),
    ).toThrow(/Unbalanced journal/);
  });

  it("rounds each line before asserting, matching the stored precision", () => {
    // Dr 0.005 + Dr 0.005 vs Cr 0.01 is balanced in memory, but the database
    // stores Decimal(15,2) per line: 0.01 + 0.01 = 0.02 against 0.01.
    expect(() =>
      assertJournalBalance([
        { side: "DEBIT", amount: 0.005 },
        { side: "DEBIT", amount: 0.005 },
        { side: "CREDIT", amount: 0.01 },
      ]),
    ).toThrow(/Unbalanced journal/);
    expect(sumSides([{ side: "DEBIT", amount: 0.005 }, { side: "DEBIT", amount: 0.005 }]).totalDebit).toBe(0.02);
  });

  it("balances fractional currency without penny drift", () => {
    expect(() =>
      assertJournalBalance([
        { side: "DEBIT", amount: 0.1 },
        { side: "DEBIT", amount: 0.2 },
        { side: "CREDIT", amount: 0.3 },
      ]),
    ).not.toThrow();
  });

  it("rejects negative line amounts and single-line journals", () => {
    expect(() =>
      assertJournalBalance([
        { side: "DEBIT", amount: -5000 },
        { side: "CREDIT", amount: -5000 },
      ]),
    ).toThrow(/flip "side"/);
    expect(() => assertJournalBalance([{ side: "DEBIT", amount: 100 }])).toThrow(/at least two lines/);
  });

  it("classifies account codes on exhaustive, non-overlapping numeric ranges", () => {
    expect(classifyAccountCode(1000)).toBe("ASSET");
    expect(classifyAccountCode(1999)).toBe("ASSET");
    expect(classifyAccountCode(2000)).toBe("LIABILITY");
    expect(classifyAccountCode(4010)).toBe("REVENUE");
    expect(classifyAccountCode(5010)).toBe("EXPENSE");
    expect(() => classifyAccountCode(999)).toThrow(/no configured range/);
    expect(() => classifyAccountCode(6000)).toThrow(/no configured range/);
  });

  it("signs contra-account balances by their normal balance", () => {
    expect(signedBalance(0, 240000, "CREDIT")).toBe(240000); // accumulated depreciation
    expect(signedBalance(100000, 0, "DEBIT")).toBe(100000);
  });

  it("closes the balance sheet equation and reports any difference", () => {
    expect(
      computeBalanceSheet({
        totalAssets: 100000,
        totalLiabilities: 0,
        totalEquity: 70000,
        currentPeriodSurplus: 30000,
      }),
    ).toEqual({ totalLiabilitiesAndEquity: 100000, isBalanced: true, difference: 0 });

    const broken = computeBalanceSheet({
      totalAssets: 500000,
      totalLiabilities: 0,
      totalEquity: 0,
      currentPeriodSurplus: 0,
    });
    expect(broken.isBalanced).toBe(false);
    expect(broken.difference).toBe(500000);
  });

  it("reports a net loss as a negative surplus, never zero", () => {
    expect(computeNetSurplus(60000, 30000)).toBe(30000);
    expect(computeNetSurplus(30000, 50000)).toBe(-20000);
  });
});
