import { describe, it, expect } from "vitest";

describe("Accounting Statements & General Ledger Calculations", () => {
  describe("Student Fee Statement Ledger Logic", () => {
    it("computes net balance correctly from billed vouchers and payments", () => {
      const vouchers = [
        { id: "v-1", totalDue: 5000, paidAmount: 5000 },
        { id: "v-2", totalDue: 6000, paidAmount: 4000 },
      ];

      const totalBilled = vouchers.reduce((acc, v) => acc + v.totalDue, 0);
      const totalPaid = vouchers.reduce((acc, v) => acc + v.paidAmount, 0);
      const netReceivable = totalBilled - totalPaid;

      expect(totalBilled).toBe(11000);
      expect(totalPaid).toBe(9000);
      expect(netReceivable).toBe(2000);
    });

    it("calculates progressive running balance chronologically", () => {
      const entries = [
        { type: "DEBIT", amount: 5000 }, // Billed Tuition Fee: balance 5000
        { type: "CREDIT", amount: 3000 }, // Paid Partial: balance 2000
        { type: "DEBIT", amount: 2000 }, // Billed Exam Fee: balance 4000
        { type: "CREDIT", amount: 4000 }, // Paid Clear: balance 0
      ];

      let balance = 0;
      const computedBalances = entries.map((e) => {
        if (e.type === "DEBIT") balance += e.amount;
        else balance -= e.amount;
        return balance;
      });

      expect(computedBalances).toEqual([5000, 2000, 4000, 0]);
    });
  });

  describe("Staff Salary Ledger Calculations", () => {
    it("computes outstanding payable from monthly accruals and disbursements", () => {
      const salaryLedgers = [
        { month: 1, year: 2026, netPayable: 45000, paidAmount: 45000, status: "PAID" },
        { month: 2, year: 2026, netPayable: 45000, paidAmount: 20000, status: "PARTIAL" },
        { month: 3, year: 2026, netPayable: 45000, paidAmount: 0, status: "PENDING" },
      ];

      const totalEarned = salaryLedgers.reduce((acc, s) => acc + s.netPayable, 0);
      const totalDisbursed = salaryLedgers.reduce((acc, s) => acc + s.paidAmount, 0);
      const outstandingPayable = totalEarned - totalDisbursed;

      expect(totalEarned).toBe(135000);
      expect(totalDisbursed).toBe(65000);
      expect(outstandingPayable).toBe(70000);
    });
  });

  describe("Bank & Cash Account General Ledger", () => {
    it("calculates closing balance with opening anchor, collections, and expenses", () => {
      const openingBalance = 500000;
      const feeCollections = [25000, 35000, 40000]; // Inflow (+100,000)
      const expenses = [15000, 45000]; // Outflow (-60,000)
      const salaryPayouts = [70000]; // Outflow (-70,000)

      const totalInflow = feeCollections.reduce((a, b) => a + b, 0);
      const totalOutflow = expenses.reduce((a, b) => a + b, 0) + salaryPayouts.reduce((a, b) => a + b, 0);
      const closingBalance = openingBalance + totalInflow - totalOutflow;

      expect(totalInflow).toBe(100000);
      expect(totalOutflow).toBe(130000);
      expect(closingBalance).toBe(470000);
    });
  });
});
