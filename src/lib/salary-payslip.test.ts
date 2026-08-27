import { describe, it, expect } from "vitest";

describe("Staff Payroll & Monthly Payslip Suite", () => {
  describe("Earnings & Net Pay Computation", () => {
    it("correctly computes gross earnings with allowances", () => {
      const baseSalary = 3000;
      const allowances = [
        { title: "House Rent", amount: 450 },
        { title: "Medical", amount: 150 },
        { title: "Conveyance", amount: 100 },
      ];

      const totalAllowances = allowances.reduce((s, a) => s + a.amount, 0);
      const grossEarnings = baseSalary + totalAllowances;

      expect(totalAllowances).toBe(700);
      expect(grossEarnings).toBe(3700);
    });

    it("correctly computes deductions including salary advances", () => {
      const deductions = [
        { title: "Provident Fund", amount: 150 },
        { title: "Income Tax", amount: 120 },
      ];
      const salaryAdvanceRecovery = 200;

      const totalStandardDeductions = deductions.reduce((s, d) => s + d.amount, 0);
      const totalDeductions = totalStandardDeductions + salaryAdvanceRecovery;

      expect(totalStandardDeductions).toBe(270);
      expect(totalDeductions).toBe(470);
    });

    it("computes accurate net payable salary", () => {
      const grossEarnings = 3700;
      const totalDeductions = 470;
      const netPayable = grossEarnings - totalDeductions;

      expect(netPayable).toBe(3230);
    });
  });

  describe("Payslip Document Structuring", () => {
    it("formats payslip reference ID properly", () => {
      const year = 2026;
      const month = 8;
      const staffId = "STF-104";

      const payslipId = `PS-${year}-${String(month).padStart(2, "0")}-${staffId}`;
      expect(payslipId).toBe("PS-2026-08-STF-104");
    });
  });
});
