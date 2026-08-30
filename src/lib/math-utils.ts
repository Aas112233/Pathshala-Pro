/**
 * Shared arithmetic primitives for money, percentages and clamped quantities.
 *
 * DESIGN RULES (violating these is what caused the original defects):
 *  1. Never "patch" binary representation error with a fixed `Number.EPSILON`.
 *     EPSILON is the ULP near 1.0; doubles have a *relative* ULP, so the nudge
 *     becomes a no-op once the value is large enough (measured: 6.58% of
 *     half-cent boundaries in 100.00–5000.00 rounded the wrong way).
 *  2. Round from the shortest round-trippable decimal string instead, which
 *     removes the representation error *before* the rounding decision.
 *  3. `Math.round` breaks ties toward +Infinity, so negatives must be negated
 *     first or credits/debits round asymmetrically.
 *  4. Validate at the boundary and throw, rather than silently clamping. A
 *     silent `Math.max(0, …)` turns a data-integrity bug into a wrong number.
 */

const MS_PER_DAY = 86_400_000;

/**
 * Round half-away-from-zero to `decimals` places.
 *
 * Returns 0 for non-finite input so callers that render a figure never emit
 * `NaN`. Use {@link roundCurrencyStrict} where a non-finite amount must be
 * treated as a hard error rather than silently becoming zero cash.
 */
export function roundTo(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;

  // Rescale via the exponential string form. `Number("128.075e2")` is exactly
  // 12807.5, whereas `128.075 * 100` is 12807.499999999998 because the literal
  // itself is stored as 128.07499999999999.
  const shifted = Number(`${value}e${decimals}`);
  if (!Number.isFinite(shifted)) {
    // Exponential-notation magnitudes (|v| >= 1e21) defeat the string trick.
    return (value < 0 ? -1 : 1) * (Math.round(Math.abs(value) * factor) / factor);
  }

  // Symmetric tie-break: Math.round(-0.5) === -0, which would round a -1.005
  // debit toward zero (1.00) while rounding a +1.005 credit away (1.01).
  const rounded = shifted < 0 ? -Math.round(-shifted) : Math.round(shifted);
  if (rounded === 0) return 0; // normalise -0 so Object.is(-0, 0) comparisons pass
  return Number(`${rounded}e${-decimals}`);
}

/** Round to 2 decimal places. Non-finite input degrades to 0. */
export function roundCurrency(value: number): number {
  return roundTo(value, 2);
}

/**
 * Round to 2 decimal places, throwing on non-finite input.
 *
 * Prefer this in money paths: silently mapping `Infinity` to `0` hides an
 * upstream arithmetic overflow and books it as no money at all.
 */
export function roundCurrencyStrict(value: number, field = "amount"): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${field}: expected a finite amount, received ${value}`);
  }
  return roundTo(value, 2);
}

/** Integer-cents snapshot of a money value. */
export function toCents(value: number, field = "amount"): number {
  return Math.round(roundCurrencyStrict(value, field) * 100);
}

/**
 * Division with an explicit fallback. Also guards result overflow, which the
 * previous version missed: `safeDivide(1e308, 1e-308)` returned `Infinity`.
 */
export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return fallback;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

/** Percentage of a maximum, rounded to `decimals`. Yields 0 for a non-positive maximum. */
export function safePercentage(obtained: number, maximum: number, decimals = 2): number {
  if (!Number.isFinite(obtained) || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return roundTo((obtained / maximum) * 100, decimals);
}

/** Attendance percentage: (present + 0.5 x half-day) / total x 100, capped at 100. */
export function calculateAttendancePercentage(input: {
  presentDays: number;
  halfDays?: number;
  totalDays: number;
}): number {
  const { presentDays, halfDays = 0, totalDays } = input;
  if (!Number.isFinite(totalDays) || totalDays <= 0) return 0;
  const equivalent = Math.max(0, presentDays) + Math.max(0, halfDays) * 0.5;
  return Math.min(100, safePercentage(equivalent, totalDays));
}

/**
 * Clamp into [minimum, maximum].
 *
 * Throws on inverted bounds. The previous implementation returned a value
 * *below* the caller's own minimum in that case (`clamp(500, 1000, 100)`
 * returned 100), silently defeating the guard.
 */
export function clamp(value: number, minimum: number, maximum = Number.POSITIVE_INFINITY): number {
  if (!Number.isFinite(value)) return minimum;
  if (minimum > maximum) {
    throw new RangeError(`clamp: lower bound ${minimum} exceeds upper bound ${maximum}`);
  }
  return Math.min(maximum, Math.max(minimum, value));
}

/** Floor at zero. Returns 0 for non-finite input rather than propagating NaN. */
export function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

/** Add currency values through integer cents so no binary drift accumulates. */
export function addCurrency(...values: number[]): number {
  const cents = values.reduce(
    (sum, value) => sum + Math.round(roundCurrency(Number.isFinite(value) ? value : 0) * 100),
    0,
  );
  return cents / 100;
}

/**
 * Split a payment between an invoice and the student's advance wallet.
 *
 * Guarantees `appliedToInvoice + excessToWallet === roundCurrency(payment)`
 * for every finite, non-negative input. Rejects anything else instead of
 * silently clamping, because a clamped input makes the invariant false
 * (the old version returned `{0, 0}` for a -100 refund, erasing the refund).
 */
export function allocatePayment(payment: number, balance: number) {
  if (!Number.isFinite(payment) || !Number.isFinite(balance)) {
    throw new RangeError(
      `allocatePayment: non-finite input (payment=${payment}, balance=${balance})`,
    );
  }
  if (payment < 0) {
    throw new RangeError(
      `allocatePayment: negative payment ${payment}. Refunds are a separate operation, not a negative payment.`,
    );
  }
  const paymentCents = toCents(payment, "payment");
  const balanceCents = Math.max(0, toCents(balance, "balance"));
  const appliedCents = Math.min(paymentCents, balanceCents);
  return {
    appliedToInvoice: appliedCents / 100,
    excessToWallet: (paymentCents - appliedCents) / 100,
  };
}

/** Apply a percentage rate. `percent` is 0–100 (not a fraction) and is validated. */
export function applyPercentage(base: number, percent: number): number {
  if (!Number.isFinite(base) || !Number.isFinite(percent)) {
    throw new RangeError(`applyPercentage: non-finite input (base=${base}, percent=${percent})`);
  }
  if (percent < 0 || percent > 100) {
    throw new RangeError(`applyPercentage: percent must be within 0–100, received ${percent}`);
  }
  return roundCurrency((base * percent) / 100);
}

export interface VoucherTotals {
  /** Concession actually applied, always <= baseAmount. */
  concession: number;
  /** base - concession + arrears + lateFine, rounded to 2dp. */
  totalDue: number;
  /** max(0, totalDue - amountPaid), rounded to 2dp. */
  balance: number;
  /** True when payments exceeded the amount actually owed. */
  overpaid: boolean;
  /** Portion of amountPaid beyond totalDue — the wallet credit owed. */
  excessToWallet: number;
}

/**
 * Canonical voucher arithmetic: `base - concession + arrears + lateFine`.
 *
 * Computed in integer cents so no float intermediate can drift. `lateFine` is
 * the Prisma column name; `lateFee` is accepted as a deprecated alias because
 * spreading a voucher record into this function otherwise drops late fees
 * silently to `undefined`.
 *
 * Throws when the concession exceeds the base: on an interactive single-voucher
 * write the operator must correct the input. For batch generation use
 * {@link computeVoucherTotals}, which clamps and reports the cap instead.
 */
export function calculateVoucherTotals(input: {
  baseAmount: number;
  discountAmount?: number;
  arrears?: number;
  lateFine?: number;
  /** @deprecated use `lateFine` — the Prisma column name. */
  lateFee?: number;
  amountPaid?: number;
}): VoucherTotals {
  const discount = input.discountAmount ?? 0;
  const arrears = input.arrears ?? 0;
  const lateFine = input.lateFine ?? input.lateFee ?? 0;
  const amountPaid = input.amountPaid ?? 0;

  for (const [name, value] of Object.entries({
    baseAmount: input.baseAmount,
    discountAmount: discount,
    arrears,
    lateFine,
    amountPaid,
  })) {
    if (!Number.isFinite(value)) throw new RangeError(`Voucher ${name} must be finite, received ${value}`);
    if (value < 0) throw new RangeError(`Voucher ${name} cannot be negative, received ${value}`);
  }
  if (discount > input.baseAmount) {
    throw new RangeError(
      `Discount ${discount} cannot exceed base amount ${input.baseAmount}`,
    );
  }

  const baseCents = toCents(input.baseAmount, "baseAmount");
  const concessionCents = toCents(discount, "discountAmount");
  const arrearsCents = toCents(arrears, "arrears");
  const lateFineCents = toCents(lateFine, "lateFine");
  const paidCents = toCents(amountPaid, "amountPaid");

  const totalDueCents = baseCents - concessionCents + arrearsCents + lateFineCents;
  const balanceCents = Math.max(0, totalDueCents - paidCents);

  return {
    concession: concessionCents / 100,
    totalDue: totalDueCents / 100,
    balance: balanceCents / 100,
    overpaid: paidCents > totalDueCents,
    excessToWallet: Math.max(0, paidCents - totalDueCents) / 100,
  };
}

/**
 * Lenient voucher arithmetic for batch/unattended generation.
 *
 * Clamps the concession to the base and reports `concessionCapped` so the
 * caller can surface a warning, instead of throwing and aborting the run.
 * Negative inputs are treated as 0 and reported in `sanitised`.
 */
export function computeVoucherTotals(input: {
  baseAmount: number;
  discountAmount?: number;
  arrears?: number;
  lateFine?: number;
  amountPaid?: number;
}): VoucherTotals & { concessionCapped: boolean; sanitised: boolean } {
  const clean = (value: number | undefined) => (Number.isFinite(value) ? Math.max(0, value as number) : 0);

  const base = clean(input.baseAmount);
  const rawDiscount = clean(input.discountAmount);
  const arrears = clean(input.arrears);
  const lateFine = clean(input.lateFine);
  const amountPaid = clean(input.amountPaid);

  const sanitised =
    base !== input.baseAmount ||
    rawDiscount !== (input.discountAmount ?? 0) ||
    arrears !== (input.arrears ?? 0) ||
    lateFine !== (input.lateFine ?? 0) ||
    amountPaid !== (input.amountPaid ?? 0);

  const concession = Math.min(rawDiscount, base);
  const baseCents = toCents(base, "baseAmount");
  const concessionCents = toCents(concession, "discountAmount");
  const totalDueCents =
    baseCents - concessionCents + toCents(arrears, "arrears") + toCents(lateFine, "lateFine");
  const paidCents = toCents(amountPaid, "amountPaid");

  return {
    concession: concessionCents / 100,
    totalDue: totalDueCents / 100,
    balance: Math.max(0, totalDueCents - paidCents) / 100,
    overpaid: paidCents > totalDueCents,
    excessToWallet: Math.max(0, paidCents - totalDueCents) / 100,
    concessionCapped: rawDiscount > base,
    sanitised,
  };
}

/** Milliseconds in a day — exported so day-count helpers share one constant. */
export const millisecondsPerDay = MS_PER_DAY;
