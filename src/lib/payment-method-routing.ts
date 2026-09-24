import { GL_CODES } from "./constants";
import { DEFAULT_PAYMENT_METHODS, type CustomPaymentMethod } from "./tenant-settings";

/**
 * Tenant-aware payment-method → GL routing. Single source of truth for every
 * collection path (POS, bulk, salary memo): resolve the method from the
 * tenant's configured `featureFlags.paymentMethods`, derive posting rules
 * from its `type`, and fall back to the seeded system accounts.
 */

export const WALLET_CREDIT_METHOD = "WALLET_CREDIT";

/** Legacy online codes that always required an external reference (UTR). */
const LEGACY_REFERENCE_METHODS = new Set([
  "DIGITAL",
  "ONLINE",
  "BANK",
  "BANK_TRANSFER",
  "POS_CARD",
  "CARD",
  "EASYPAISA",
  "JAZZCASH",
  "BKASH",
  "NAGAD",
  "UPI",
]);

export interface MethodPostingRules {
  isCheque: boolean;
  requiresReference: boolean;
}

function methodList(methods: unknown): CustomPaymentMethod[] {
  return Array.isArray(methods) && methods.length > 0
    ? (methods as CustomPaymentMethod[])
    : DEFAULT_PAYMENT_METHODS;
}

/** Match by code or id (ids survive renames; codes survive re-seeds). */
export function resolveTenantMethod(
  methods: unknown,
  code: string
): CustomPaymentMethod | undefined {
  return methodList(methods).find((m) => m.code === code || m.id === code);
}

export function activeTenantMethods(methods: unknown): CustomPaymentMethod[] {
  return methodList(methods).filter((m) => m.isActive);
}

export function getMethodPostingRules(
  method: CustomPaymentMethod | undefined,
  code: string
): MethodPostingRules {
  const type = method?.type;
  return {
    isCheque: type === "CHEQUE" || code === "CHEQUE",
    requiresReference:
      type === "BANK" ||
      type === "DIGITAL" ||
      (!type && LEGACY_REFERENCE_METHODS.has(code)),
  };
}

/** GL code a receipt debits for this method (tenant mapping wins). */
export function resolveMethodAccountCode(methods: unknown, code: string): string {
  const method = resolveTenantMethod(methods, code);
  return method?.accountCode || (code === "CASH" ? GL_CODES.CASH : GL_CODES.BANK);
}

export type MethodValidationError = "unknown" | "inactive";

/**
 * Collection gate: WALLET_CREDIT always passes (settled from the advance
 * wallet, not a tenant method); anything else must be a known, active
 * tenant method — including tenant-custom codes the transport schema
 * cannot enumerate.
 */
export function validateCollectionMethod(
  methods: unknown,
  code: string
): { method?: CustomPaymentMethod; error?: MethodValidationError } {
  if (code === WALLET_CREDIT_METHOD) return {};
  const method = resolveTenantMethod(methods, code);
  if (!method) return { error: "unknown" };
  if (!method.isActive) return { error: "inactive" };
  return { method };
}
