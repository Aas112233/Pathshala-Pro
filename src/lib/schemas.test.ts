import { describe, it, expect } from "vitest";
import {
  loginSchema,
  createUserSchema,
  createStudentSchema,
  createFeeVoucherSchema,
  batchFeeInvoicingSchema,
  createStaffSchema,
  createSalaryLedgerSchema,
} from "@/lib/schemas";

describe("Zod Validation Schemas", () => {
  describe("loginSchema", () => {
    it("accepts valid email and strong password", () => {
      const valid = { email: "admin@pathshalapro.com", password: "Password123" };
      const parsed = loginSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it("rejects invalid email addresses", () => {
      const invalid = { email: "not-an-email", password: "Password123" };
      const parsed = loginSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it("rejects short passwords under 6 characters", () => {
      const invalid = { email: "admin@pathshalapro.com", password: "123" };
      const parsed = loginSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe("createUserSchema", () => {
    it("validates user creation payload with valid role and required fields", () => {
      const valid = {
        name: "Admin User",
        email: "admin@school.com",
        password: "AdminPassword123",
        role: "ADMIN",
        isActive: true,
      };
      const parsed = createUserSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it("rejects invalid role enumeration", () => {
      const invalid = {
        name: "Invalid Role User",
        email: "user@school.com",
        password: "Password123",
        role: "INVALID_ROLE",
      };
      const parsed = createUserSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe("createStudentSchema", () => {
    it("accepts valid student registration payload", () => {
      const valid = {
        firstName: "Fatima",
        lastName: "Noor",
        guardianName: "Muhammad Noor",
        guardianContact: "+923001234567",
        rollNumber: "ROLL-001",
        gender: "FEMALE",
        status: "ACTIVE",
      };
      const parsed = createStudentSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it("requires firstName, lastName, guardianName, guardianContact, and rollNumber", () => {
      const empty = {};
      const parsed = createStudentSchema.safeParse(empty);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const fields = parsed.error.errors.map((e) => e.path[0]);
        expect(fields).toContain("firstName");
        expect(fields).toContain("lastName");
        expect(fields).toContain("guardianName");
        expect(fields).toContain("guardianContact");
        expect(fields).toContain("rollNumber");
      }
    });
  });

  describe("createFeeVoucherSchema & Batch Invoicing", () => {
    it("validates single fee voucher creation", () => {
      const valid = {
        studentProfileId: "st-123",
        academicYearId: "ay-2026",
        feeType: "TUITION",
        voucherId: "VCH-2026-001",
        baseAmount: 5000,
        discountAmount: 500,
        totalDue: 4500,
        dueDate: "2026-09-10",
      };
      const parsed = createFeeVoucherSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it("rejects negative totalDue values", () => {
      const invalid = {
        studentProfileId: "st-123",
        academicYearId: "ay-2026",
        feeType: "TUITION",
        voucherId: "VCH-2026-001",
        totalDue: -100,
        dueDate: "2026-09-10",
      };
      const parsed = createFeeVoucherSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it("validates batch invoicing schema parameters", () => {
      const validBatch = {
        academicYearId: "ay-2026",
        feeType: "TUITION",
        month: 9,
        baseAmount: 4500,
        dueDate: "2026-09-15",
      };
      const parsed = batchFeeInvoicingSchema.safeParse(validBatch);
      expect(parsed.success).toBe(true);
    });
  });

  describe("createStaffSchema & Payroll", () => {
    it("validates staff creation with required fields", () => {
      const validStaff = {
        firstName: "Tariq",
        lastName: "Mahmood",
        designation: "Senior Mathematics Teacher",
        department: "Science",
        hireDate: "2026-01-15",
        joiningDate: "2026-01-15",
        baseSalary: 65000,
      };
      const parsed = createStaffSchema.safeParse(validStaff);
      expect(parsed.success).toBe(true);
    });

    it("validates salary ledger entry creation", () => {
      const validSalary = {
        staffProfileId: "staff-1",
        academicYearId: "ay-2026",
        month: 8,
        year: 2026,
        baseSalary: 65000,
        totalPayable: 65000,
        paymentStatus: "PENDING",
      };
      const parsed = createSalaryLedgerSchema.safeParse(validSalary);
      expect(parsed.success).toBe(true);
    });
  });
});
