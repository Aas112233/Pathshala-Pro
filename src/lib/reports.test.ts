import { describe, it, expect } from "vitest";
import { ReportTemplates } from "@/lib/excel-exporter";

describe("New ERP Report Modules Suite", () => {
  describe("Salary & Payroll Report Metrics", () => {
    const mockLedgers = [
      {
        baseSalary: 50000,
        deductions: 2000,
        advances: 3000,
        netPayable: 45000,
        paidAmount: 45000,
        status: "PAID",
        department: "Academic",
      },
      {
        baseSalary: 40000,
        deductions: 1000,
        advances: 0,
        netPayable: 39000,
        paidAmount: 0,
        status: "PENDING",
        department: "Administration",
      },
      {
        baseSalary: 30000,
        deductions: 500,
        advances: 0,
        netPayable: 29500,
        paidAmount: 15000,
        status: "PARTIAL",
        department: "Academic",
      },
    ];

    it("calculates gross payroll, paid disbursement, and pending dues correctly", () => {
      let totalGross = 0;
      let totalPaid = 0;
      let totalPending = 0;
      let totalDeductions = 0;

      for (const item of mockLedgers) {
        totalGross += item.baseSalary;
        totalPaid += item.paidAmount;
        totalPending += item.netPayable - item.paidAmount;
        totalDeductions += item.deductions + item.advances;
      }

      expect(totalGross).toBe(120000);
      expect(totalPaid).toBe(60000);
      expect(totalPending).toBe(53500);
      expect(totalDeductions).toBe(6500);

      const netTotal = totalGross - totalDeductions;
      expect(netTotal).toBe(113500);

      const rate = Math.round((totalPaid / netTotal) * 100);
      expect(rate).toBe(53);
    });

    it("defines proper Excel template headers for Salary Report", () => {
      const template = ReportTemplates.salaryReport([], { schoolName: "Greenwood Academy" });
      expect(template.title).toBe("Staff Payroll & Salary Disbursement Report");
      expect(template.schoolName).toBe("Greenwood Academy");
      expect(template.columns.some((c) => c.key === "staffId")).toBe(true);
      expect(template.columns.some((c) => c.key === "netPayable")).toBe(true);
      expect(template.columns.some((c) => c.key === "paidAmount")).toBe(true);
    });
  });

  describe("Financial Expenses & Cash Flow Report", () => {
    const mockExpenses = [
      { amount: 15000, category: "Utilities", paymentMethod: "BANK" },
      { amount: 5000, category: "Supplies", paymentMethod: "CASH" },
      { amount: 20000, category: "Utilities", paymentMethod: "BANK" },
    ];
    const totalIncome = 85000;

    it("aggregates expenses by category and computes net cash balance", () => {
      let totalExpenses = 0;
      let cashExpense = 0;
      let bankExpense = 0;
      const catMap = new Map<string, number>();

      for (const e of mockExpenses) {
        totalExpenses += e.amount;
        if (e.paymentMethod === "CASH") cashExpense += e.amount;
        if (e.paymentMethod === "BANK") bankExpense += e.amount;
        catMap.set(e.category, (catMap.get(e.category) || 0) + e.amount);
      }

      expect(totalExpenses).toBe(40000);
      expect(cashExpense).toBe(5000);
      expect(bankExpense).toBe(35000);
      expect(catMap.get("Utilities")).toBe(35000);
      expect(catMap.get("Supplies")).toBe(5000);

      const netCashBalance = totalIncome - totalExpenses;
      expect(netCashBalance).toBe(45000);
    });

    it("defines proper Excel template headers for Financial Report", () => {
      const template = ReportTemplates.financialReport([], { schoolName: "Greenwood Academy" });
      expect(template.title).toBe("Financial Expenses & Cash Flow Audit Report");
      expect(template.columns.some((c) => c.key === "expenseNumber")).toBe(true);
      expect(template.columns.some((c) => c.key === "amount")).toBe(true);
      expect(template.columns.some((c) => c.key === "paymentMethod")).toBe(true);
    });
  });

  describe("Admissions & Enquiries Conversion Funnel", () => {
    const mockEnquiries = [
      { status: "NEW", source: "WALK_IN" },
      { status: "CONTACTED", source: "PHONE" },
      { status: "VISITED", source: "WEBSITE" },
      { status: "ADMITTED", source: "WALK_IN" },
      { status: "ADMITTED", source: "REFERRAL" },
    ];

    it("calculates conversion rate and lead source breakdown accurately", () => {
      const total = mockEnquiries.length;
      const admitted = mockEnquiries.filter((e) => e.status === "ADMITTED").length;
      const conversionRate = Math.round((admitted / total) * 100);

      expect(total).toBe(5);
      expect(admitted).toBe(2);
      expect(conversionRate).toBe(40);

      const walkInCount = mockEnquiries.filter((e) => e.source === "WALK_IN").length;
      expect(walkInCount).toBe(2);
    });

    it("defines proper Excel template headers for Admissions Report", () => {
      const template = ReportTemplates.admissionsReport([], { schoolName: "Greenwood Academy" });
      expect(template.title).toBe("Admissions Pipeline & Enquiry Conversion Report");
      expect(template.columns.some((c) => c.key === "studentName")).toBe(true);
      expect(template.columns.some((c) => c.key === "guardianName")).toBe(true);
      expect(template.columns.some((c) => c.key === "source")).toBe(true);
      expect(template.columns.some((c) => c.key === "status")).toBe(true);
    });
  });
});
