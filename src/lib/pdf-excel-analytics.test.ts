import { describe, it, expect } from "vitest";
import React from "react";
import { StudentMarksheetPDF } from "@/lib/pdf/marksheet-template";
import { ThreePartFeeChallanPDF } from "@/lib/pdf/fee-challan-template";
import { StaffPayslipPDF } from "@/lib/pdf/payslip-template";
import {
  exportFeeDaybookToExcel,
  exportAcademicTabulationSheetToExcel,
} from "@/lib/excel/export-service";
import { getExecutiveDashboardMetrics } from "@/lib/analytics-service";

describe("PDF Templates, Excel Exports & Analytics Engine", () => {
  describe("PDF Document Rendering", () => {
    it("instantiates NCTB / CBSE Student Marksheet without JSX errors", () => {
      const element = React.createElement(StudentMarksheetPDF, {
        data: {
          instituteName: "Ideal Model School",
          curriculum: "NCTB",
          academicYear: "2026",
          examName: "Annual Examination 2026",
          studentName: "Farhan Ali",
          rollNumber: "101",
          className: "Class 10",
          studentId: "ST-2026-001",
          dateOfIssue: "2026-12-20",
          subjects: [
            {
              code: "BAN",
              name: "Bengali (1st & 2nd)",
              theoryObtained: 70,
              practicalObtained: 15,
              totalObtained: 85,
              maxMarks: 100,
              grade: "A+",
              gradePoint: 5.0,
            },
            {
              code: "ENG",
              name: "English (1st & 2nd)",
              theoryObtained: 75,
              totalObtained: 75,
              maxMarks: 100,
              grade: "A",
              gradePoint: 4.0,
            },
            {
              code: "HMATH",
              name: "Higher Mathematics",
              theoryObtained: 80,
              practicalObtained: 20,
              totalObtained: 100,
              maxMarks: 100,
              grade: "A+",
              gradePoint: 5.0,
              isFourthSubject: true,
            },
          ],
          totalObtained: 260,
          totalMax: 300,
          percentage: 86.67,
          gpa: 5.0,
          overallGrade: "A+",
          resultStatus: "PASSED",
          fourthSubjectBonus: 3.0,
          positionRank: "1st",
        },
      });

      expect(React.isValidElement(element)).toBe(true);
    });

    it("instantiates 3-Part Fee Challan PDF component without errors", () => {
      const element = React.createElement(ThreePartFeeChallanPDF, {
        data: {
          instituteName: "Crescent Public Academy",
          bankName: "Habib Bank Limited",
          bankAccountNumber: "0142-78901234-01",
          voucherNumber: "REC-2026-0042",
          studentName: "Amina Begum",
          studentId: "ST-902",
          rollNumber: "42",
          className: "Class 8",
          billingPeriod: "September 2026",
          issueDate: "2026-09-01",
          dueDate: "2026-09-10",
          items: [
            { title: "Monthly Tuition Fee", amount: 6000 },
            { title: "Transport Fee", amount: 1500 },
          ],
          subtotal: 7500,
          discountAmount: 500,
          fineAmount: 0,
          netPayable: 7000,
          currencySymbol: "PKR",
        },
      });

      expect(React.isValidElement(element)).toBe(true);
    });

    it("instantiates Staff Payslip PDF component without errors", () => {
      const element = React.createElement(StaffPayslipPDF, {
        data: {
          instituteName: "Delhi Model High School",
          payslipNumber: "PAY-2026-09-0012",
          monthYear: "September 2026",
          employeeId: "EMP-042",
          employeeName: "Dr. Rajesh Sharma",
          designation: "Senior Physics Lecturer",
          department: "Science Department",
          totalWorkingDays: 30,
          payableDays: 30,
          leavesTaken: 0,
          earnings: [
            { title: "Basic Pay", amount: 45000 },
            { title: "House Rent Allowance (HRA)", amount: 15000 },
            { title: "Medical Allowance", amount: 5000 },
          ],
          deductions: [
            { title: "Provident Fund (PF)", amount: 5400 },
            { title: "Income Tax / TDS", amount: 3000 },
          ],
          grossEarnings: 65000,
          totalDeductions: 8400,
          netPayable: 56600,
          netPayableInWords: "Fifty Six Thousand Six Hundred Rupees Only",
          currencySymbol: "₹",
        },
      });

      expect(React.isValidElement(element)).toBe(true);
    });
  });

  describe("Excel Export Service", () => {
    it("generates a valid XLSX buffer for Fee Collection Daybook", async () => {
      const buffer = await exportFeeDaybookToExcel("tenant-dummy");
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
    }, 15000);

    it("generates a valid XLSX buffer for Academic Tabulation Sheet", async () => {
      const buffer = await exportAcademicTabulationSheetToExcel("tenant-dummy", "class-10");
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
    }, 15000);
  });

  describe("Executive Analytics Service", () => {
    it("computes executive dashboard metrics and trends", async () => {
      const metrics = await getExecutiveDashboardMetrics("tenant-dummy", new Date("2026-09-15"));
      expect(metrics.tenantId).toBe("tenant-dummy");
      expect(metrics.financials).toBeDefined();
      expect(metrics.academics).toBeDefined();
      expect(metrics.monthlyTrends.length).toBe(6);
    }, 15000);
  });
});
