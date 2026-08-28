import { describe, it, expect } from "vitest";

export function calculateOverdueFine(
  dueDate: Date | string,
  returnDate: Date | string = new Date(),
  dailyFineRate: number = 0.5
): { overdueDays: number; fineAmount: number } {
  const due = new Date(dueDate).getTime();
  const ret = new Date(returnDate).getTime();

  if (ret <= due) {
    return { overdueDays: 0, fineAmount: 0 };
  }

  const diffMs = ret - due;
  const overdueDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const fineAmount = Number((overdueDays * dailyFineRate).toFixed(2));

  return { overdueDays, fineAmount };
}

export function computeBookAvailability(totalCopies: number, issuedCount: number): {
  availableCopies: number;
  isAvailable: boolean;
  utilizationRate: number;
} {
  const safeTotal = Math.max(0, totalCopies);
  const safeIssued = Math.max(0, Math.min(safeTotal, issuedCount));
  const availableCopies = safeTotal - safeIssued;
  const utilizationRate = safeTotal > 0 ? Number(((safeIssued / safeTotal) * 100).toFixed(1)) : 0;

  return {
    availableCopies,
    isAvailable: availableCopies > 0,
    utilizationRate,
  };
}

describe("Library Circulation & Fine Engine", () => {
  it("calculates zero fine for on-time or early book returns", () => {
    const due = new Date("2026-09-15");
    const ret = new Date("2026-09-14");

    const result = calculateOverdueFine(due, ret, 1.0);
    expect(result.overdueDays).toBe(0);
    expect(result.fineAmount).toBe(0);
  });

  it("accurately computes overdue days and cumulative fines", () => {
    const due = new Date("2026-09-01");
    const ret = new Date("2026-09-06"); // 5 days overdue

    const result = calculateOverdueFine(due, ret, 2.5); // $2.50 / day
    expect(result.overdueDays).toBe(5);
    expect(result.fineAmount).toBe(12.5);
  });

  it("handles same-day returns without incurring fines", () => {
    const due = new Date("2026-09-10T12:00:00Z");
    const ret = new Date("2026-09-10T10:00:00Z");

    const result = calculateOverdueFine(due, ret, 0.5);
    expect(result.overdueDays).toBe(0);
    expect(result.fineAmount).toBe(0);
  });

  it("calculates book availability and utilization ratios accurately", () => {
    const stock = computeBookAvailability(10, 4);
    expect(stock.availableCopies).toBe(6);
    expect(stock.isAvailable).toBe(true);
    expect(stock.utilizationRate).toBe(40);

    const exhaustedStock = computeBookAvailability(5, 5);
    expect(exhaustedStock.availableCopies).toBe(0);
    expect(exhaustedStock.isAvailable).toBe(false);
    expect(exhaustedStock.utilizationRate).toBe(100);
  });
});
