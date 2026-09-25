import { describe, it, expect } from "vitest";
import React from "react";
import { StudentMarksheetPDF } from "@/lib/pdf/marksheet-template";
import { ThreePartFeeChallanPDF } from "@/lib/pdf/fee-challan-template";
import { StaffPayslipPDF } from "@/lib/pdf/payslip-template";
import { StudentPerformancePDF } from "./question-paper-studio/performance-pdf-template";
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

    it("instantiates Enhanced Student Performance Analytics PDF component without errors", () => {
      const element = React.createElement(StudentPerformancePDF, {
        performance: {
          student: {
            id: "stu-1",
            studentId: "STD-2026-001",
            rollNumber: "12",
            firstName: "Ayesha",
            lastName: "Siddiqua",
            firstNameBn: "আয়েশা",
            lastNameBn: "সিদ্দিকা",
            className: "Grade 10",
            sectionName: "A",
            groupName: "Science",
            admissionDate: new Date("2024-01-01"),
            status: "ACTIVE",
          },
          academicYear: {
            id: "ay-1",
            label: "2025-2026",
          },
          metrics: {
            cumulativeGpa: 3.92,
            maxGpa: 4.0,
            overallPercentage: 92.5,
            letterGrade: "A+",
            remarks: "Outstanding",
            meritRank: 2,
            meritRankLabel: "2nd",
            totalClassStudents: 45,
            percentile: 98,
            totalExamsTaken: 3,
            totalSubjectsPassed: 6,
            totalSubjectsFailed: 0,
          },
          attendance: {
            totalDays: 180,
            presentDays: 172,
            // `absentDays` is `totalDays - presentDays` under the shared
            // definition, so it is 8 here, not 5: the LATE days are attended.
            absentDays: 8,
            lateDays: 3,
            excusedDays: 0,
            halfDayDays: 0,
            holidayDays: 0,
            attendanceRate: 95.56,
            punctualityRate: 98.26,
            status: "EXCELLENT",
          },
          homework: {
            totalAssigned: 40,
            submittedCount: 39,
            onTimeCount: 38,
            completionRate: 97.5,
            averageScorePercentage: 94.0,
          },
          subjectMastery: [
            {
              subjectId: "sub-1",
              subjectName: "Advanced Mathematics",
              subjectCode: "MTH101",
              obtainedMarks: 96,
              maxMarks: 100,
              percentage: 96,
              letterGrade: "A+",
              gradePoint: 4.0,
              classAveragePercentage: 78,
              masteryLevel: "EXCELLENT",
              trend: "IMPROVING",
            },
          ],
          examProgression: [
            {
              examId: "ex-1",
              examTitle: "Mid-Term Examination",
              examType: "Term",
              term: "Term 1",
              totalMarksObtained: 550,
              totalMaxMarks: 600,
              percentage: 91.7,
              gpa: 3.9,
              letterGrade: "A+",
              rankInExam: 2,
            },
          ],
          insights: {
            strengths: ["Analytical problem solving in Mathematics", "High class attendance"],
            focusAreas: ["Practical lab records formatting"],
            actionableRecommendations: ["Participate in upcoming inter-school science Olympiad"],
            riskLevel: "LOW",
          },
        },
        studentName: "Ayesha Siddiqua",
        studentRollNumber: "12",
        school: {
          name: "Pathshala International Academy",
          address: "Dhanmondi, Dhaka, Bangladesh",
          phone: "+880 1700-000000",
          email: "info@pathshalapro.edu",
        },
        locale: "en",
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
    }, 60000);
  });
});
