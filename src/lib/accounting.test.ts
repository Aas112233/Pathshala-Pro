import { describe, it, expect } from "vitest";
import {
  createExpenseSchema,
  createExpenseCategorySchema,
  createBankAccountSchema,
} from "@/lib/schemas";

describe("Dedicated Institutional Accounting Module", () => {
  describe("Expense Schemas", () => {
    it("validates a proper operational expense payload", () => {
      const payload = {
        title: "Campus Electricity Bill - August 2026",
        categoryId: "cat-utilities-123",
        amount: 85400,
        paymentMethod: "BANK",
        expenseDate: "2026-08-25",
        payeeName: "Lahore Electric Supply Company",
        receiptNumber: "BILL-849201",
        notes: "Approved by Principal",
      };

      const result = createExpenseSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("rejects non-positive expense amounts", () => {
      const invalid = {
        title: "Invalid Expense",
        categoryId: "cat-1",
        amount: -500,
        expenseDate: "2026-08-25",
      };

      const result = createExpenseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("validates custom expense category creation", () => {
      const categoryPayload = {
        name: "Campus Security & CCTV",
        code: "SECURITY_CCTV",
        description: "Security guard salaries and camera maintenance",
        isActive: true,
      };

      const result = createExpenseCategorySchema.safeParse(categoryPayload);
      expect(result.success).toBe(true);
    });
  });

  describe("Bank Accounts & Cash Registers", () => {
    it("validates bank account registration", () => {
      const accountPayload = {
        accountName: "Main Tuition Collection Account",
        accountNumber: "PK36HABB00012345678901",
        bankName: "Habib Bank Limited",
        branchName: "Gulberg Branch (#0421)",
        accountType: "CHECKING",
        openingBalance: 2500000,
        currency: "PKR",
      };

      const result = createBankAccountSchema.safeParse(accountPayload);
      expect(result.success).toBe(true);
    });

    it("validates petty cash register registration", () => {
      const pettyCashPayload = {
        accountName: "Admin Office Petty Cash",
        accountNumber: "CASH-REGISTER-01",
        bankName: "Internal Cash Vault",
        accountType: "PETTY_CASH",
        openingBalance: 50000,
        currency: "PKR",
      };

      const result = createBankAccountSchema.safeParse(pettyCashPayload);
      expect(result.success).toBe(true);
    });
  });
});
