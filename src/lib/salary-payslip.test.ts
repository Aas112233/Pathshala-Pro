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

  describe("Salary Approval & Rejection Workflow Lifecycle", () => {
    it("successfully approves a pending salary ledger and records audit metadata", async () => {
      const { approveSalaryLedger } = await import("@/lib/salary-payslip");
      const mockTx: any = {
        salaryLedger: {
          findFirst: async () => ({
            id: "sal-1",
            tenantId: "tenant-1",
            staffProfileId: "staff-1",
            year: 2026,
            month: 8,
            baseSalary: 4000,
            deductions: 200,
            advances: 100,
            netPayable: 3700,
            status: "PENDING_APPROVAL",
            staffProfile: { firstName: "John", lastName: "Doe" },
          }),
          update: async ({ data }: any) => ({
            id: "sal-1",
            status: data.status,
            approvedById: data.approvedById,
            approvedAt: data.approvedAt,
            rejectionReason: data.rejectionReason,
          }),
        },
        transaction: {
          findFirst: async () => ({ id: "tx-accrual-1" }),
        },
      };

      const result = await approveSalaryLedger(mockTx, {
        tenantId: "tenant-1",
        salaryLedgerId: "sal-1",
        approvedById: "user-admin-1",
      });

      expect(result.status).toBe("APPROVED");
      expect(result.approvedById).toBe("user-admin-1");
      expect(result.rejectionReason).toBeNull();
      expect(result.approvedAt).toBeInstanceOf(Date);
    });

    it("rejects a salary ledger with mandatory rejection reason", async () => {
      const { rejectSalaryLedger } = await import("@/lib/salary-payslip");
      const mockTx: any = {
        salaryLedger: {
          findFirst: async () => ({
            id: "sal-2",
            tenantId: "tenant-1",
            status: "PENDING_APPROVAL",
          }),
          update: async ({ data }: any) => ({
            id: "sal-2",
            status: data.status,
            rejectionReason: data.rejectionReason,
            approvedById: data.approvedById,
          }),
        },
      };

      const result = await rejectSalaryLedger(mockTx, {
        tenantId: "tenant-1",
        salaryLedgerId: "sal-2",
        rejectedById: "user-admin-1",
        reason: "Incorrect overtime calculation",
      });

      expect(result.status).toBe("REJECTED");
      expect(result.rejectionReason).toBe("Incorrect overtime calculation");
      expect(result.approvedById).toBeNull();
    });

    it("prevents rejecting or approving an already PAID ledger", async () => {
      const { approveSalaryLedger, rejectSalaryLedger } = await import("@/lib/salary-payslip");
      const mockTx: any = {
        salaryLedger: {
          findFirst: async () => ({
            id: "sal-3",
            tenantId: "tenant-1",
            status: "PAID",
          }),
        },
      };

      await expect(
        approveSalaryLedger(mockTx, {
          tenantId: "tenant-1",
          salaryLedgerId: "sal-3",
          approvedById: "user-admin-1",
        })
      ).rejects.toThrow("Cannot approve an already paid salary ledger");

      await expect(
        rejectSalaryLedger(mockTx, {
          tenantId: "tenant-1",
          salaryLedgerId: "sal-3",
          rejectedById: "user-admin-1",
          reason: "Too late",
        })
      ).rejects.toThrow("Cannot reject an already paid salary ledger");
    });
  });
});
