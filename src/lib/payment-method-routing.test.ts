import { describe, it, expect } from "vitest";
import {
  resolveTenantMethod,
  activeTenantMethods,
  getMethodPostingRules,
  resolveMethodAccountCode,
  validateCollectionMethod,
  WALLET_CREDIT_METHOD,
} from "@/lib/payment-method-routing";
import { DEFAULT_PAYMENT_METHODS } from "@/lib/tenant-settings";

const custom = [
  ...DEFAULT_PAYMENT_METHODS,
  { id: "pm_stripe", name: "Stripe", code: "STRIPE", type: "DIGITAL", accountCode: "1011", isActive: true },
  { id: "pm_old", name: "Old Voucher", code: "OLDVOUCHER", type: "OTHER", accountCode: "1010", isActive: false },
] as const;

describe("payment-method-routing", () => {
  it("matches tenant methods by code or id and falls back to defaults", () => {
    expect(resolveTenantMethod(custom as any, "STRIPE")?.accountCode).toBe("1011");
    expect(resolveTenantMethod(custom as any, "pm_stripe")?.accountCode).toBe("1011");
    expect(resolveTenantMethod(undefined, "CASH")?.accountCode).toBe("1020");
    expect(resolveTenantMethod([], "POS_CARD")?.accountCode).toBe("1010");
    expect(resolveTenantMethod(custom as any, "NOPE")).toBeUndefined();
  });

  it("lists only active methods", () => {
    const codes = activeTenantMethods(custom as any).map((m) => m.code);
    expect(codes).toContain("STRIPE");
    expect(codes).not.toContain("OLDVOUCHER");
  });

  it("derives cheque/reference rules from type, legacy names as fallback", () => {
    expect(getMethodPostingRules({ type: "CHEQUE" } as any, "CHEQUE")).toEqual({
      isCheque: true,
      requiresReference: false,
    });
    expect(getMethodPostingRules({ type: "DIGITAL" } as any, "STRIPE")).toEqual({
      isCheque: false,
      requiresReference: true,
    });
    expect(getMethodPostingRules({ type: "CASH" } as any, "CASH")).toEqual({
      isCheque: false,
      requiresReference: false,
    });
    // Unknown method with a legacy online code keeps the legacy requirement.
    expect(getMethodPostingRules(undefined, "EASYPAISA").requiresReference).toBe(true);
    expect(getMethodPostingRules(undefined, "OTHER").requiresReference).toBe(false);
  });

  it("resolves the receipt debit code with tenant mapping winning", () => {
    expect(resolveMethodAccountCode(custom as any, "STRIPE")).toBe("1011");
    expect(resolveMethodAccountCode(custom as any, "CASH")).toBe("1020");
    expect(resolveMethodAccountCode(custom as any, "BANK_TRANSFER")).toBe("1010");
    expect(resolveMethodAccountCode(undefined, "ROCKET")).toBe("1010");
  });

  it("gates collection on known + active methods, wallet always passes", () => {
    expect(validateCollectionMethod(custom as any, WALLET_CREDIT_METHOD)).toEqual({});
    expect(validateCollectionMethod(custom as any, "STRIPE").error).toBeUndefined();
    expect(validateCollectionMethod(custom as any, "OLDVOUCHER").error).toBe("inactive");
    expect(validateCollectionMethod(custom as any, "NOPE").error).toBe("unknown");
  });
});
