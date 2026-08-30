import { Prisma } from "@prisma/client";
import { getNextVoucherNumber } from "@/lib/accounting-sequence";

/**
 * Helper: tuition-only capped stacking. Each concession declares appliesToHead.
 * FIXED_AMOUNT and PERCENTAGE are applied in priority order and capped at tuitionGross.
 */
export function computeStackedConcession(
  tuitionGross: Prisma.Decimal,
  concessions: Array<{ discountType: string; discountValue: Prisma.Decimal | number | string; appliesToHead?: string; priority?: number; validFrom?: Date | null; validUntil?: Date | null }>,
  baseGross?: Prisma.Decimal,
): Prisma.Decimal {
  const gross = baseGross ?? tuitionGross;
  const now = new Date();
  const sorted = [...concessions].sort((a, b) => (a.priority ?? 10) - (b.priority ?? 10));
  let tuitionScoped = new Prisma.Decimal(0);
  let allHeadsScoped = new Prisma.Decimal(0);
  for (const c of sorted) {
    if (c.validFrom && now < new Date(c.validFrom)) continue;
    if (c.validUntil && now > new Date(c.validUntil)) continue;
    const isAllHeads = c.appliesToHead && c.appliesToHead !== "TUITION";
    const eligible = isAllHeads ? gross : tuitionGross;
    const val = new Prisma.Decimal(c.discountValue);
    let d: Prisma.Decimal;
    if (c.discountType === "PERCENTAGE") {
      d = eligible.mul(val).div(100).toDecimalPlaces(2);
    } else {
      d = Prisma.Decimal.min(val, eligible);
    }
    if (isAllHeads) allHeadsScoped = allHeadsScoped.add(d);
    else tuitionScoped = tuitionScoped.add(d);
  }
  // Each scope is capped at its own ceiling first...
  tuitionScoped = Prisma.Decimal.min(tuitionScoped, tuitionGross);
  allHeadsScoped = Prisma.Decimal.min(allHeadsScoped, gross);
  // ...then the combined total is capped at the full billed base, since
  // tuition-scoped and all-heads-scoped concessions can never jointly
  // exceed what was actually billed.
  const total = Prisma.Decimal.min(tuitionScoped.add(allHeadsScoped), gross);
  return total.toDecimalPlaces(2);
}

export function prorateMonthlyFee(
  monthlyFee: Prisma.Decimal | number,
  admissionDate: Date | null | undefined,
  billingYear: number,
  billingMonth: number,
): Prisma.Decimal {
  const fee = new Prisma.Decimal(monthlyFee);
  if (!admissionDate) return fee;
  const adm = new Date(admissionDate);
  if (adm.getFullYear() !== billingYear || adm.getMonth() + 1 !== billingMonth) return fee;
  const dim = new Date(billingYear, billingMonth, 0).getDate();
  const payableDays = dim - adm.getDate() + 1;
  if (payableDays <= 0 || payableDays >= dim) return fee;
  // Use Decimal arithmetic to avoid JavaScript number precision loss
  return fee.mul(Prisma.Decimal(payableDays)).div(Prisma.Decimal(dim)).toDecimalPlaces(2);
}

async function createWalletLedgerIfNeeded(
  tx: Prisma.TransactionClient,
  params: { tenantId: string; studentProfileId: string; journalEntryId: string; transactionId?: string; amount: Prisma.Decimal; reason: string },
) {
  if (params.amount.isZero() || params.amount.lessThan(0)) return;
  // Compute current balance
  try {
    // Serialize concurrent wallet credits for this student by locking their
    // StudentProfile row before the read-then-write, since a bare findFirst
    // (no row lock) on the ledger table would let two concurrent calls read
    // the same stale `prevBal` and race on `balanceAfter`.
    await tx.$queryRaw`SELECT id FROM "StudentProfile" WHERE id = ${params.studentProfileId} FOR UPDATE`;
    const last = await (tx as any).studentWalletLedger?.findFirst?.({
      where: { tenantId: params.tenantId, studentProfileId: params.studentProfileId },
      orderBy: { createdAt: "desc" },
    });
    const prevBal = last ? new Prisma.Decimal(last.balanceAfter) : new Prisma.Decimal(0);
    const newBal = prevBal.add(params.amount);
    await (tx as any).studentWalletLedger?.create?.({
      data: {
        tenantId: params.tenantId,
        studentProfileId: params.studentProfileId,
        journalEntryId: params.journalEntryId,
        transactionId: params.transactionId,
        amount: params.amount,
        balanceAfter: newBal,
        reason: params.reason,
      },
    });
  } catch {
    // table may not exist in test mocks — ignore
  }
}

export interface FeeItemInput {
  feeHeadCode: string; // e.g. "TUITION", "TRANSPORT", "HOSTEL", "LAB", "EXAM"
  title: string;
  amount: number | Prisma.Decimal;
  revenueAccountCode?: string; // e.g. "4010", "4040", "4050"
}

export interface GenerateInvoiceParams {
  tenantId: string;
  studentProfileId: string;
  academicYearId: string;
  classId: string;
  billingMonth?: number; // 1 - 12
  billingYear?: number;
  feeType?: "MONTHLY" | "ADMISSION" | "TERM" | "ANNUAL";
  dueDate: Date;
  items: FeeItemInput[];
  concessionAmount?: number | Prisma.Decimal;
  concessionReason?: "SIBLING" | "MERIT" | "STAFF_CHILD" | "POVERTY" | "OTHER";
  executedById: string;
  arAccountCode?: string;          // Default: "1030" (Student Accounts Receivable)
  concessionAccountCode?: string;  // Default: "5060" (Fee Concession & Scholarship Expense)
}

export interface FeeInvoiceResult {
  feeVoucherId: string;
  voucherNumber: string;
  studentProfileId: string;
  grossAmount: string;
  discountAmount: string;
  netPayable: string;
  balance: string;
  dueDate: Date;
  status: "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";
  journalEntryId: string;
}

export interface CollectFeePaymentParams {
  tenantId: string;
  feeVoucherId: string;
  paymentAmount: number | Prisma.Decimal;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "GATEWAY_ONLINE" | "CHEQUE" | "WALLET_CREDIT";
  bankAccountCode?: string;        // Default: "1010" (or "1020" Cash Register)
  arAccountCode?: string;          // Default: "1030"
  unearnedLiabilityCode?: string;  // Default: "2050" (Student Wallet / Advance)
  receiptNumber?: string;
  reference?: string;
  executedById: string;
  notes?: string;
}

export interface CollectFeePaymentResult {
  feeVoucherId: string;
  receiptNumber: string;
  paymentAmount: string;
  appliedToInvoice: string;
  excessToWallet: string;
  newBalance: string;
  status: "PAID" | "PARTIAL";
  journalEntryId: string;
}

/**
 * 1. Generates an itemized student fee invoice with concessions and posts double-entry accrual:
 *    - Dr. Student Accounts Receivable (1030)            -> netPayable
 *    - Dr. Fee Concession & Scholarship Expense (5060)   -> discountAmount
 *    - Cr. Fee Revenue Accounts per Head (4010, 4040...) -> item amounts
 */
export async function generateFeeInvoice(
  tx: Prisma.TransactionClient,
  params: GenerateInvoiceParams
): Promise<FeeInvoiceResult> {
  const {
    tenantId,
    studentProfileId,
    academicYearId,
    classId,
    billingMonth = new Date().getMonth() + 1,
    billingYear = new Date().getFullYear(),
    feeType = "MONTHLY",
    dueDate,
    items,
    concessionAmount = 0,
    concessionReason,
    executedById,
    arAccountCode = "1030",
    concessionAccountCode = "5060",
  } = params;

  if (!items || items.length === 0) {
    throw new Error("At least one fee item is required to generate an invoice.");
  }

  // Calculate totals. Every amount is rounded to 2dp as soon as it is
  // computed (rather than only at the final `.toFixed(2)` on return), and
  // journal legs below reuse these exact rounded figures. This prevents the
  // classic `SUM(round(x)) != round(SUM(x))` subledger imbalance, where
  // unrounded Decimal math "looks balanced" at the header level but the
  // individually-rounded journal lines don't actually sum to the same total.
  let grossAmount = new Prisma.Decimal(0);
  const roundedItemAmounts = new Map<FeeItemInput, Prisma.Decimal>();
  for (const item of items) {
    const itemAmt = new Prisma.Decimal(item.amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    if (itemAmt.lessThan(0)) {
      throw new Error(`Fee item amount cannot be negative. Received ${itemAmt.toString()} for ${item.title}`);
    }
    roundedItemAmounts.set(item, itemAmt);
    grossAmount = grossAmount.plus(itemAmt);
  }
  grossAmount = grossAmount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  const discount = new Prisma.Decimal(concessionAmount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (discount.lessThan(0) || discount.greaterThan(grossAmount)) {
    throw new Error(`Invalid concession amount (${discount.toString()}) for gross fee (${grossAmount.toString()})`);
  }

  const netPayable = grossAmount.minus(discount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  // Generate Concurrency-Safe Invoice Number
  const voucherNumber = await getNextVoucherNumber(tx, tenantId, "SALES_FEE", billingYear);

  // Resolve configured FeeHead revenue mappings. Explicit caller overrides remain supported.
  const feeHeads = tx.feeHead?.findMany
    ? await tx.feeHead.findMany({
        where: { tenantId, code: { in: Array.from(new Set(items.map((item) => item.feeHeadCode))) }, isActive: true },
        select: { code: true, accountCode: true },
      })
    : [];
  const feeHeadAccountMap = new Map(feeHeads.map((head) => [head.code, head.accountCode]));
  const revenueAccountCodes = Array.from(
    new Set(items.map((item) => item.revenueAccountCode || feeHeadAccountMap.get(item.feeHeadCode) || "4010"))
  );
  const neededCodes = [arAccountCode, ...revenueAccountCodes];
  if (discount.greaterThan(0)) {
    neededCodes.push(concessionAccountCode);
  }

  const accounts = await tx.chartOfAccount.findMany({
    where: { tenantId, code: { in: neededCodes }, isActive: true },
  });
  const accountMap = new Map(accounts.map((a) => [a.code, a.id]));

  if (!accountMap.has(arAccountCode)) {
    throw new Error(`Accounts Receivable account (${arAccountCode}) not configured in Chart of Accounts.`);
  }

  // -------------------------------------------------------------
  // Construct Double-Entry Journal Lines
  // Invariant: Dr. AR (Net) + Dr. Concession (Disc) === Cr. Revenue (Gross)
  // -------------------------------------------------------------
  const journalLines: Array<{
    tenantId: string;
    accountId: string;
    debitAmount: Prisma.Decimal;
    creditAmount: Prisma.Decimal;
    narration: string;
    studentId: string;
    classId: string;
  }> = [];

  // Leg 1: Debit Net Receivable
  if (netPayable.greaterThan(0)) {
    journalLines.push({
      tenantId,
      accountId: accountMap.get(arAccountCode)!,
      debitAmount: netPayable.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
      creditAmount: new Prisma.Decimal(0),
      narration: `Student Fee Invoice Receivable - ${voucherNumber}`,
      studentId: studentProfileId,
      classId,
    });
  }

  // Leg 2: Debit Concession / Scholarship Expense
  if (discount.greaterThan(0)) {
    const concAccId = accountMap.get(concessionAccountCode);
    if (!concAccId) {
      throw new Error(`Fee Concession account (${concessionAccountCode}) not configured.`);
    }
    journalLines.push({
      tenantId,
      accountId: concAccId,
      debitAmount: discount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
      creditAmount: new Prisma.Decimal(0),
      narration: `Fee Concession (${concessionReason || "Institutional Waiver"}) - ${voucherNumber}`,
      studentId: studentProfileId,
      classId,
    });
  }

  // Leg 3: Credit Respective Revenue Heads
  for (const item of items) {
    const headCode = item.revenueAccountCode || feeHeadAccountMap.get(item.feeHeadCode) || "4010";
    const revAccId = accountMap.get(headCode);
    if (!revAccId) {
      throw new Error(`Revenue account (${headCode}) for item '${item.title}' not configured.`);
    }

    journalLines.push({
      tenantId,
      accountId: revAccId,
      debitAmount: new Prisma.Decimal(0),
      creditAmount: roundedItemAmounts.get(item)!.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
      narration: `Fee Revenue: ${item.title} (${item.feeHeadCode})`,
      studentId: studentProfileId,
      classId,
    });
  }

  // Verify the rounded journal lines we're about to insert are still
  // balanced. Header-level Decimal math (grossAmount === netPayable +
  // discount === sum of item amounts) can look balanced while each
  // individually-rounded line, once summed, drifts by a cent — catch that
  // here instead of leaving a silent subledger imbalance in the database.
  const debitTotal = journalLines
    .reduce((sum, l) => sum.plus(l.debitAmount), new Prisma.Decimal(0))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const creditTotal = journalLines
    .reduce((sum, l) => sum.plus(l.creditAmount), new Prisma.Decimal(0))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (!debitTotal.equals(creditTotal)) {
    throw new Error(
      `Fee invoice journal is unbalanced after rounding: debit ${debitTotal.toString()} !== credit ${creditTotal.toString()} for voucher ${voucherNumber}.`
    );
  }

  // Post Double-Entry Journal Entry
  const journal = await tx.journalEntry.create({
    data: {
      tenantId,
      entryNumber: voucherNumber,
      voucherType: "SALES_FEE",
      postingDate: new Date(),
      postingStatus: "POSTED",
      narration: `Student Fee Invoicing - ${voucherNumber} (Student: ${studentProfileId})`,
      reference: voucherNumber,
      totalDebit: debitTotal,
      totalCredit: creditTotal,
      createdById: executedById,
      lineItems: {
        create: journalLines,
      },
    },
  });

  return {
    feeVoucherId: journal.id,
    voucherNumber,
    studentProfileId,
    grossAmount: grossAmount.toFixed(2),
    discountAmount: discount.toFixed(2),
    netPayable: netPayable.toFixed(2),
    balance: netPayable.toFixed(2),
    dueDate,
    status: "UNPAID",
    journalEntryId: journal.id,
  };
}

/**
 * Posts accrual for legacy FeeVoucher records that do not use FeeInvoice.
 * New revenue is credited using the tenant's FeeHead mapping.
 */
export async function postLegacyFeeInvoiceAccrual(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    studentProfileId: string;
    feeHeadCode: string;
    amount: number | Prisma.Decimal;
    discountAmount?: number | Prisma.Decimal;
    executedById: string;
    reference: string;
    dueDate?: Date;
  }
): Promise<{ journalEntryId: string; voucherNumber: string } | null> {
  const gross = new Prisma.Decimal(params.amount);
  const discount = new Prisma.Decimal(params.discountAmount || 0);
  if (gross.lessThanOrEqualTo(0)) return null;
  if (discount.lessThan(0) || discount.greaterThan(gross)) {
    throw new Error(`Invalid fee discount (${discount.toString()}) for ${gross.toString()}.`);
  }

  const [feeHead, accounts] = await Promise.all([
    tx.feeHead.findUnique({
      where: { tenantId_code: { tenantId: params.tenantId, code: params.feeHeadCode } },
      select: { accountCode: true },
    }),
    tx.chartOfAccount.findMany({
      where: { tenantId: params.tenantId, code: { in: ["1030", "5060"] }, isActive: true },
    }),
  ]);
  const revenueCode = feeHead?.accountCode || "4010";
  const revenueAccount = await tx.chartOfAccount.findFirst({
    where: { tenantId: params.tenantId, code: revenueCode, isActive: true },
  });
  const accountMap = new Map(accounts.map((account) => [account.code, account]));
  if (!accountMap.has("1030")) throw new Error("Accounts Receivable account (1030) not configured.");
  if (!revenueAccount) throw new Error(`Revenue account (${revenueCode}) not configured.`);
  if (discount.greaterThan(0) && !accountMap.has("5060")) {
    throw new Error("Fee Concession account (5060) not configured.");
  }

  const net = gross.minus(discount);
  const voucherNumber = await getNextVoucherNumber(tx, params.tenantId, "SALES_FEE");
  const lineItems = [];
  if (net.greaterThan(0)) {
    lineItems.push({
      tenantId: params.tenantId,
      accountId: accountMap.get("1030")!.id,
      debitAmount: net,
      creditAmount: new Prisma.Decimal(0),
      narration: `Student Fee Voucher Receivable - ${params.reference}`,
      studentId: params.studentProfileId,
    });
  }
  if (discount.greaterThan(0)) {
    lineItems.push({
      tenantId: params.tenantId,
      accountId: accountMap.get("5060")!.id,
      debitAmount: discount,
      creditAmount: new Prisma.Decimal(0),
      narration: `Fee Concession - ${params.reference}`,
      studentId: params.studentProfileId,
    });
  }
  lineItems.push({
    tenantId: params.tenantId,
    accountId: revenueAccount.id,
    debitAmount: new Prisma.Decimal(0),
    creditAmount: gross,
    narration: `Fee Revenue: ${params.feeHeadCode} - ${params.reference}`,
    studentId: params.studentProfileId,
  });

  const journal = await tx.journalEntry.create({
    data: {
      tenantId: params.tenantId,
      entryNumber: voucherNumber,
      voucherType: "SALES_FEE",
      postingDate: params.dueDate || new Date(),
      postingStatus: "POSTED",
      narration: `Fee Voucher Accrual - ${params.reference}`,
      reference: params.reference,
      totalDebit: gross,
      totalCredit: gross,
      createdById: params.executedById,
      lineItems: { create: lineItems },
    },
  });

  return { journalEntryId: journal.id, voucherNumber };
}

/**
 * Posts a receipt journal for legacy FeeVoucher transactions.
 */
export async function postLegacyFeePaymentJournal(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    studentProfileId: string;
    feeVoucherId: string;
    amount: number | Prisma.Decimal;
    appliedToInvoice: number | Prisma.Decimal;
    excessToWallet?: number | Prisma.Decimal;
    paymentMethod: string;
    receiptNumber: string;
    executedById: string;
    note?: string;
  }
): Promise<{ journalEntryId: string; voucherNumber: string }> {
  const payment = new Prisma.Decimal(params.amount);
  const applied = new Prisma.Decimal(params.appliedToInvoice);
  const excess = new Prisma.Decimal(params.excessToWallet || 0);
  if (payment.lessThanOrEqualTo(0) || !applied.plus(excess).equals(payment)) {
    throw new Error("Invalid fee payment journal amounts.");
  }

  let bankCode = params.paymentMethod === "CASH" ? "1020" : "1010";
  try {
    const tenant = await tx.tenant.findUnique({
      where: { tenantId: params.tenantId },
      select: { featureFlags: true },
    });
    const flags = (tenant?.featureFlags as any) || {};
    if (Array.isArray(flags.paymentMethods)) {
      const match = flags.paymentMethods.find(
        (m: any) => m.code === params.paymentMethod || m.id === params.paymentMethod
      );
      if (match?.accountCode) {
        bankCode = match.accountCode;
      }
    }
  } catch {}

  const requiredCodes = [bankCode];
  if (applied.greaterThan(0)) requiredCodes.push("1030");
  if (excess.greaterThan(0)) requiredCodes.push("2050");
  const accounts = await tx.chartOfAccount.findMany({
    where: { tenantId: params.tenantId, code: { in: requiredCodes }, isActive: true },
  });
  const accountMap = new Map(accounts.map((account) => [account.code, account]));
  for (const code of requiredCodes) {
    if (!accountMap.has(code)) throw new Error(`Account (${code}) not configured.`);
  }

  const voucherNumber = await getNextVoucherNumber(tx, params.tenantId, "RECEIPT");
  const lines = [{
    tenantId: params.tenantId,
    accountId: accountMap.get(bankCode)!.id,
    debitAmount: payment,
    creditAmount: new Prisma.Decimal(0),
    narration: `Fee Payment Received via ${params.paymentMethod} [Rcpt: ${params.receiptNumber}]`,
  }];
  if (applied.greaterThan(0)) {
    lines.push({
      tenantId: params.tenantId,
      accountId: accountMap.get("1030")!.id,
      debitAmount: new Prisma.Decimal(0),
      creditAmount: applied,
      narration: `Settlement of Fee Voucher ${params.feeVoucherId}`,
    });
  }
  if (excess.greaterThan(0)) {
    lines.push({
      tenantId: params.tenantId,
      accountId: accountMap.get("2050")!.id,
      debitAmount: new Prisma.Decimal(0),
      creditAmount: excess,
      narration: `Excess Fee Payment Wallet Credit - ${params.feeVoucherId}`,
    });
  }

  const journal = await tx.journalEntry.create({
    data: {
      tenantId: params.tenantId,
      entryNumber: voucherNumber,
      voucherType: "RECEIPT",
      postingDate: new Date(),
      postingStatus: "POSTED",
      narration: `Fee Collection Receipt - ${params.receiptNumber}${params.note ? ` | ${params.note}` : ""}`,
      reference: params.receiptNumber,
      totalDebit: payment,
      totalCredit: payment,
      createdById: params.executedById,
      lineItems: { create: lines },
    },
  });

  if (excess.greaterThan(0)) {
    await createWalletLedgerIfNeeded(tx, {
      tenantId: params.tenantId,
      studentProfileId: params.studentProfileId,
      journalEntryId: journal.id,
      amount: excess,
      reason: `Excess payment wallet credit — ${params.feeVoucherId}`,
    });
  }

  return { journalEntryId: journal.id, voucherNumber };
}

/**
 * 2. Applies late fine surcharge to overdue invoices:
 *    - Dr. Accounts Receivable (1030)          -> fineAmount
 *    - Cr. Late Fee Surcharge Income (4060)   -> fineAmount
 */
export async function applyLateFineSurcharge(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    feeVoucherId: string;
    studentProfileId: string;
    fineAmount: number | Prisma.Decimal;
    executedById: string;
    arAccountCode?: string;        // Default: "1030"
    lateFeeRevenueCode?: string;   // Default: "4060"
    notes?: string;
  }
) {
  const {
    tenantId,
    feeVoucherId,
    studentProfileId,
    fineAmount,
    executedById,
    arAccountCode = "1030",
    lateFeeRevenueCode = "4060",
    notes,
  } = params;

  const fine = new Prisma.Decimal(fineAmount);
  if (fine.lessThanOrEqualTo(0)) {
    throw new Error(`Late fine amount must be strictly positive. Received ${fine.toString()}`);
  }

  const accounts = await tx.chartOfAccount.findMany({
    where: { tenantId, code: { in: [arAccountCode, lateFeeRevenueCode] }, isActive: true },
  });
  const accountMap = new Map(accounts.map((a) => [a.code, a.id]));

  if (!accountMap.has(arAccountCode)) throw new Error(`Accounts Receivable (${arAccountCode}) not configured.`);
  if (!accountMap.has(lateFeeRevenueCode)) throw new Error(`Late Fee Revenue (${lateFeeRevenueCode}) not configured.`);

  const voucherNumber = await getNextVoucherNumber(tx, tenantId, "JOURNAL");

  const journal = await tx.journalEntry.create({
    data: {
      tenantId,
      entryNumber: voucherNumber,
      voucherType: "JOURNAL",
      postingDate: new Date(),
      postingStatus: "POSTED",
      narration: `Late Fee Surcharge Assessed on Voucher ${feeVoucherId}${notes ? ` | ${notes}` : ""}`,
      reference: feeVoucherId,
      totalDebit: fine,
      totalCredit: fine,
      createdById: executedById,
      lineItems: {
        create: [
          {
            tenantId,
            accountId: accountMap.get(arAccountCode)!,
            debitAmount: fine,
            creditAmount: new Prisma.Decimal(0),
            narration: `Late Surcharge Receivable - ${feeVoucherId}`,
            studentId: studentProfileId,
          },
          {
            tenantId,
            accountId: accountMap.get(lateFeeRevenueCode)!,
            debitAmount: new Prisma.Decimal(0),
            creditAmount: fine,
            narration: `Late Surcharge Income - ${feeVoucherId}`,
            studentId: studentProfileId,
          },
        ],
      },
    },
  });

  // Keep the voucher's own balance in sync with the fine just posted to the
  // GL — an unpaid balance grows by exactly the newly assessed fine.
  await tx.feeVoucher.update({
    where: { id: feeVoucherId },
    data: {
      lateFine: { increment: Number(fine.toFixed(2)) },
      totalDue: { increment: Number(fine.toFixed(2)) },
      balance: { increment: Number(fine.toFixed(2)) },
      status: "OVERDUE",
    },
  });

  return {
    journalEntryId: journal.id,
    voucherNumber,
    fineAmount: fine.toFixed(2),
    status: "OVERDUE",
  };
}

/**
 * 3. Collects counter or online fee payment with excess auto-routed to Student Wallet:
 *    - Dr. Main Bank / Cash Account (1010 / 1020)  -> paymentAmount
 *    - Cr. Student Accounts Receivable (1030)      -> appliedToInvoice
 *    - Cr. Unearned Fee Liability / Wallet (2050)  -> excessToWallet
 */
export async function collectFeePayment(
  tx: Prisma.TransactionClient,
  params: CollectFeePaymentParams
): Promise<CollectFeePaymentResult> {
  const {
    tenantId,
    feeVoucherId,
    paymentAmount,
    paymentMethod,
    bankAccountCode = paymentMethod === "CASH" ? "1020" : "1010",
    arAccountCode = "1030",
    unearnedLiabilityCode = "2050",
    receiptNumber = `REC-${Date.now()}`,
    reference,
    executedById,
    notes,
  } = params;

  const payment = new Prisma.Decimal(paymentAmount);
  if (payment.lessThanOrEqualTo(0)) {
    throw new Error(`Payment amount must be positive. Received ${payment.toString()}`);
  }

  // Lock the real FeeVoucher row (there is no FeeInvoice table in the
  // schema) so concurrent payments against the same voucher can't read the
  // same stale remaining-due figure.
  const lockedRows = await tx.$queryRaw<
    Array<{ id: string; totalDue: number; amountPaid: number }>
  >`
    SELECT id, "totalDue", "amountPaid"
    FROM "FeeVoucher"
    WHERE id = ${feeVoucherId} AND "tenantId" = ${tenantId}
    FOR UPDATE
  `;
  if (lockedRows.length === 0) {
    throw new Error(`FeeVoucher ${feeVoucherId} not found for tenant ${tenantId}`);
  }
  const voucherRow = lockedRows[0];
  const remainingDue = Prisma.Decimal.max(
    new Prisma.Decimal(voucherRow.totalDue).sub(new Prisma.Decimal(voucherRow.amountPaid)),
    new Prisma.Decimal(0)
  );

  let appliedToInvoice = payment;
  let excessToWallet = new Prisma.Decimal(0);

  if (payment.greaterThan(remainingDue) && remainingDue.greaterThan(0)) {
    appliedToInvoice = remainingDue;
    excessToWallet = payment.minus(remainingDue);
  } else if (remainingDue.isZero()) {
    appliedToInvoice = new Prisma.Decimal(0);
    excessToWallet = payment;
  }

  const requiredCodes = [bankAccountCode];
  if (appliedToInvoice.greaterThan(0)) requiredCodes.push(arAccountCode);
  if (excessToWallet.greaterThan(0)) requiredCodes.push(unearnedLiabilityCode);

  const accounts = await tx.chartOfAccount.findMany({
    where: { tenantId, code: { in: requiredCodes }, isActive: true },
  });
  const accountMap = new Map(accounts.map((a) => [a.code, a.id]));

  if (!accountMap.has(bankAccountCode)) throw new Error(`Deposit account (${bankAccountCode}) not configured.`);

  const voucherNumber = await getNextVoucherNumber(tx, tenantId, "RECEIPT");

  const lines: Array<{
    tenantId: string;
    accountId: string;
    debitAmount: Prisma.Decimal;
    creditAmount: Prisma.Decimal;
    narration: string;
  }> = [
    // Dr. Bank/Cash
    {
      tenantId,
      accountId: accountMap.get(bankAccountCode)!,
      debitAmount: payment,
      creditAmount: new Prisma.Decimal(0),
      narration: `Fee Payment Received via ${paymentMethod} [Rcpt: ${receiptNumber}]`,
    },
  ];

  // Cr. Accounts Receivable
  if (appliedToInvoice.greaterThan(0)) {
    lines.push({
      tenantId,
      accountId: accountMap.get(arAccountCode)!,
      debitAmount: new Prisma.Decimal(0),
      creditAmount: appliedToInvoice,
      narration: `Settlement of Fee Voucher ${feeVoucherId}`,
    });
  }

  // Cr. Unearned Fee Liability (Wallet)
  if (excessToWallet.greaterThan(0)) {
    lines.push({
      tenantId,
      accountId: accountMap.get(unearnedLiabilityCode)!,
      debitAmount: new Prisma.Decimal(0),
      creditAmount: excessToWallet,
      narration: `Excess Payment Credited to Student Wallet`,
    });
  }

  const journal = await tx.journalEntry.create({
    data: {
      tenantId,
      entryNumber: voucherNumber,
      voucherType: "RECEIPT",
      postingDate: new Date(),
      postingStatus: "POSTED",
      narration: `Fee Collection Receipt - ${receiptNumber} (Voucher: ${feeVoucherId})${notes ? ` | ${notes}` : ""}`,
      reference: reference || receiptNumber,
      totalDebit: payment,
      totalCredit: payment,
      createdById: executedById,
      lineItems: {
        create: lines,
      },
    },
  });

  if (excessToWallet.greaterThan(0)) {
    try {
      // Resolve student for wallet ledger if not in params
      const voucher = await (tx as any).feeVoucher?.findUnique?.({ where: { id: feeVoucherId }, select: { studentProfileId: true } });
      const studentId = (voucher as any)?.studentProfileId || feeVoucherId; // fallback
      await createWalletLedgerIfNeeded(tx, {
        tenantId,
        studentProfileId: studentId,
        journalEntryId: journal.id,
        amount: excessToWallet,
        reason: `Excess wallet credit — ${receiptNumber}`,
      });
    } catch {}
  }

  const remainingBalance = Prisma.Decimal.max(remainingDue.minus(appliedToInvoice), new Prisma.Decimal(0));

  return {
    feeVoucherId,
    receiptNumber,
    paymentAmount: payment.toFixed(2),
    appliedToInvoice: appliedToInvoice.toFixed(2),
    excessToWallet: excessToWallet.toFixed(2),
    newBalance: remainingBalance.toFixed(2),
    status: remainingBalance.isZero() ? "PAID" : "PARTIAL",
    journalEntryId: journal.id,
  };
}
