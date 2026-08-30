import { describe, expect, it } from "vitest";
import { addCurrency, allocatePayment, calculateVoucherTotals, clamp, roundCurrency, safeDivide, safePercentage, calculateAttendancePercentage } from "@/lib/math-utils";

describe("math utilities", () => {
  it("avoids fractional penny drift", () => expect(addCurrency(0.1, 0.2)).toBe(0.3));
  it("handles zero denominators", () => expect(safeDivide(100, 0)).toBe(0));
  it("rounds currency and clamps negative values", () => {
    expect(roundCurrency(1.005)).toBe(1.01);
    expect(clamp(-100, 0)).toBe(0);
  });
  it("allocates overpayments without losing cents", () => {
    expect(allocatePayment(1500, 1200)).toEqual({ appliedToInvoice: 1200, excessToWallet: 300 });
  });

  it("clamps a full concession to a zero balance and rejects over-concession", () => {
    const totals = calculateVoucherTotals({ baseAmount: 400, discountAmount: 400 });
    expect(totals).toMatchObject({ concession: 400, totalDue: 0, balance: 0 });
    expect(totals.overpaid).toBe(false);
    expect(totals.excessToWallet).toBe(0);
    expect(() => calculateVoucherTotals({ baseAmount: 400, discountAmount: 500 })).toThrow();
  });

  it("returns safe academic percentages and attendance", () => {
    expect(safePercentage(10, 0)).toBe(0);
    expect(safePercentage(1, 3)).toBe(33.33);
    expect(calculateAttendancePercentage({ presentDays: 8, halfDays: 2, totalDays: 10 })).toBe(90);
    expect(calculateAttendancePercentage({ presentDays: 0, totalDays: 0 })).toBe(0);
  });
});
