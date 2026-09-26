import { Prisma } from "@prisma/client";
import { getNextVoucherNumber } from "@/lib/accounting-sequence";
import { ApiError } from "@/lib/api-error";
import { GL_CODES } from "@/lib/constants";
import { resolveMethodAccountCode } from "@/lib/payment-method-routing";

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
    // the same stale `prevBal` and race on `balanceAfter`. The tenantId
    // predicate keeps the lock from being acquirable on another tenant's row.
    await tx.$queryRaw`SELECT id FROM "StudentProfile" WHERE id = ${params.studentProfileId} AND "tenantId" = ${params.tenantId} FOR UPDATE`;
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
  } catch (error) {
    // A mocked / in-memory TransactionClient (unit tests) has no raw-SQL support
    // and no StudentWalletLedger model, so there is nothing to serialise or
    // record. Any REAL failure must propagate: swallowing it here would both
    // lose the wallet credit (money silently unallocated, violating the
    // excess-to-2050 rule) and leave Postgres in an aborted state (25P02), which
    // then surfaces on the next statement as a misleading, unrelated error.
    if (typeof (tx as any)?.$queryRaw !== "function") return;
    throw error;
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
  arAccountCode?: string;          // Default: GL_CODES.RECEIVABLE (Student Accounts Receivable)
  concessionAccountCode?: string;  // Default: GL_CODES.CONCESSION_EXPENSE (Fee Concession & Scholarship Expense)
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
  bankAccountCode?: string;        // Default: GL_CODES.BANK (or GL_CODES.CASH Cash Register)
  arAccountCode?: string;          // Default: GL_CODES.RECEIVABLE
  unearnedLiabilityCode?: string;  // Default: GL_CODES.WALLET (Student Wallet / Advance)
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
    arAccountCode = GL_CODES.RECEIVABLE,
    concessionAccountCode = GL_CODES.CONCESSION_EXPENSE,
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
    new Set(items.map((item) => item.revenueAccountCode || feeHeadAccountMap.get(item.feeHeadCode) || GL_CODES.TUITION_REVENUE))
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
    const headCode = item.revenueAccountCode || feeHeadAccountMap.get(item.feeHeadCode) || GL_CODES.TUITION_REVENUE;
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
    throw ApiError.unprocessableEntity(`Invalid fee discount (${discount.toString()}) for ${gross.toString()}.`);
  }

  const [feeHead, accounts] = await Promise.all([
    tx.feeHead.findUnique({
      where: { tenantId_code: { tenantId: params.tenantId, code: params.feeHeadCode } },
      select: { accountCode: true },
    }),
    tx.chartOfAccount.findMany({
      where: { tenantId: params.tenantId, code: { in: [GL_CODES.RECEIVABLE, GL_CODES.CONCESSION_EXPENSE] }, isActive: true },
    }),
  ]);
  const revenueCode = feeHead?.accountCode || GL_CODES.TUITION_REVENUE;
  const revenueAccount = await tx.chartOfAccount.findFirst({
    where: { tenantId: params.tenantId, code: revenueCode, isActive: true },
  });
  const accountMap = new Map(accounts.map((account) => [account.code, account]));
  // A tenant without a seeded chart of accounts cannot post a fee accrual.
  // Throwing ApiError (not a bare Error) keeps the actionable reason visible to
  // the administrator instead of collapsing into a generic 500.
  if (!accountMap.has(GL_CODES.RECEIVABLE)) {
    throw ApiError.internal(`Accounts Receivable account (${GL_CODES.RECEIVABLE}) not configured. Seed the tenant's chart of accounts under Accounting > Chart of Accounts.`);
  }
  if (!revenueAccount) {
    throw ApiError.internal(`Revenue account (${revenueCode}) not configured. Map the ${params.feeHeadCode} fee head to an active account under Accounting > Fee Heads.`);
  }
  if (discount.greaterThan(0) && !accountMap.has(GL_CODES.CONCESSION_EXPENSE)) {
    throw ApiError.internal(`Fee Concession account (${GL_CODES.CONCESSION_EXPENSE}) not configured. Seed the tenant's chart of accounts before granting concessions.`);
  }

  const net = gross.minus(discount);
  const postingDate = params.dueDate || new Date();
  const period = await resolveOpenPeriod(tx, { tenantId: params.tenantId, postingDate });
  const voucherNumber = await getNextVoucherNumber(tx, params.tenantId, "SALES_FEE");
  const lineItems = [];
  if (net.greaterThan(0)) {
    lineItems.push({
      tenantId: params.tenantId,
      accountId: accountMap.get(GL_CODES.RECEIVABLE)!.id,
      debitAmount: net,
      creditAmount: new Prisma.Decimal(0),
      narration: `Student Fee Voucher Receivable - ${params.reference}`,
      studentId: params.studentProfileId,
    });
  }
  if (discount.greaterThan(0)) {
    lineItems.push({
      tenantId: params.tenantId,
      accountId: accountMap.get(GL_CODES.CONCESSION_EXPENSE)!.id,
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
      postingDate,
      postingStatus: "POSTED",
      narration: `Fee Voucher Accrual - ${params.reference}`,
      reference: params.reference,
      totalDebit: gross,
      totalCredit: gross,
      createdById: params.executedById,
      ...(period.fiscalYearId ? { fiscalYearId: period.fiscalYearId } : {}),
      ...(period.financialPeriodId ? { financialPeriodId: period.financialPeriodId } : {}),
      lineItems: { create: lineItems },
    },
  });

  return { journalEntryId: journal.id, voucherNumber };
}

/**
 * Current wallet balance for a student (last StudentWalletLedger.balanceAfter,
 * 0 when the student never received an excess credit).
 */
export async function getWalletBalance(
  tx: Prisma.TransactionClient,
  params: { tenantId: string; studentProfileId: string },
): Promise<Prisma.Decimal> {
  const agg = await (tx as any).studentWalletLedger?.aggregate?.({
    where: { tenantId: params.tenantId, studentProfileId: params.studentProfileId },
    _sum: { amount: true },
  });
  if (agg?._sum?.amount !== undefined && agg?._sum?.amount !== null) {
    return new Prisma.Decimal(agg._sum.amount);
  }
  const last = await (tx as any).studentWalletLedger?.findFirst?.({
    where: { tenantId: params.tenantId, studentProfileId: params.studentProfileId },
    orderBy: { createdAt: "desc" },
  });
  return last ? new Prisma.Decimal(last.balanceAfter) : new Prisma.Decimal(0);
}

/**
 * Pays a fee voucher from the student's advance wallet:
 *    - Dr. Unearned Fee Liability / Wallet (2050) -> amount
 *    - Cr. Student Accounts Receivable (1030)      -> amount
 * plus a negative StudentWalletLedger entry. No bank/cash leg moves — the
 * cash already entered the ledger when the excess was collected.
 */
export async function applyWalletDebit(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    studentProfileId: string;
    feeVoucherId: string;
    amount: number | Prisma.Decimal;
    executedById: string;
    receiptNumber: string;
    transactionId?: string;
    note?: string;
    /** Same intent-key contract as postFeeReceipt: replay returns the original journal. */
    idempotencyKey?: string;
  }
): Promise<{ journalEntryId: string; voucherNumber: string }> {
  const amount = new Prisma.Decimal(params.amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (amount.lessThanOrEqualTo(0)) {
    throw ApiError.internal("Wallet debit amount must be positive.");
  }

  const walletReference = params.idempotencyKey?.trim() || params.receiptNumber;
  const existingWalletJournal = await (tx as any).journalEntry?.findFirst?.({
    where: { tenantId: params.tenantId, reference: walletReference },
    select: { id: true, entryNumber: true },
  });
  if (existingWalletJournal) {
    return { journalEntryId: existingWalletJournal.id, voucherNumber: existingWalletJournal.entryNumber };
  }

  // Serialize against concurrent wallet debits/credits on the same student.
  await tx.$queryRaw`SELECT id FROM "StudentProfile" WHERE id = ${params.studentProfileId} AND "tenantId" = ${params.tenantId} FOR UPDATE`;

  const voucher = await (tx as any).feeVoucher?.findUnique?.({
    where: { id: params.feeVoucherId },
    select: { studentProfileId: true },
  });
  if (voucher && voucher.studentProfileId && voucher.studentProfileId !== params.studentProfileId) {
    throw ApiError.badRequest(
      `Fee voucher ${params.feeVoucherId} belongs to student ${voucher.studentProfileId}, not ${params.studentProfileId}. Cannot debit another student's wallet.`
    );
  }

  const balance = await getWalletBalance(tx, { tenantId: params.tenantId, studentProfileId: params.studentProfileId });
  if (balance.lessThan(amount)) {
    throw ApiError.badRequest(`Insufficient wallet balance (${balance.toFixed(2)}) for debit ${amount.toFixed(2)}.`);
  }

  const accounts = await tx.chartOfAccount.findMany({
    where: { tenantId: params.tenantId, code: { in: [GL_CODES.WALLET, GL_CODES.RECEIVABLE] }, isActive: true },
  });
  const accountMap = new Map(accounts.map((a) => [a.code, a.id]));
  if (!accountMap.has(GL_CODES.WALLET) || !accountMap.has(GL_CODES.RECEIVABLE)) {
    throw ApiError.internal(`Wallet (${GL_CODES.WALLET}) or Receivable (${GL_CODES.RECEIVABLE}) account not configured.`);
  }

  const voucherNumber = await getNextVoucherNumber(tx, params.tenantId, "RECEIPT");
  const period = await resolveOpenPeriod(tx, { tenantId: params.tenantId });
  const journal = await tx.journalEntry.create({
    data: {
      tenantId: params.tenantId,
      entryNumber: voucherNumber,
      voucherType: "RECEIPT",
      postingDate: new Date(),
      postingStatus: "POSTED",
      narration: `Wallet Applied - ${params.receiptNumber} (Voucher: ${params.feeVoucherId})${params.note ? ` | ${params.note}` : ""}`,
      reference: walletReference,
      totalDebit: amount,
      totalCredit: amount,
      createdById: params.executedById,
      ...(period.fiscalYearId ? { fiscalYearId: period.fiscalYearId } : {}),
      ...(period.financialPeriodId ? { financialPeriodId: period.financialPeriodId } : {}),
      lineItems: {
        create: [
          {
            tenantId: params.tenantId,
            accountId: accountMap.get(GL_CODES.WALLET)!,
            debitAmount: amount,
            creditAmount: new Prisma.Decimal(0),
            narration: `Wallet Debit - ${params.feeVoucherId}`,
            studentId: params.studentProfileId,
          },
          {
            tenantId: params.tenantId,
            accountId: accountMap.get(GL_CODES.RECEIVABLE)!,
            debitAmount: new Prisma.Decimal(0),
            creditAmount: amount,
            narration: `Settlement of Fee Voucher ${params.feeVoucherId} from Wallet`,
            studentId: params.studentProfileId,
          },
        ],
      },
    },
  });

  const newBal = balance.minus(amount);
  await (tx as any).studentWalletLedger?.create?.({
    data: {
      tenantId: params.tenantId,
      studentProfileId: params.studentProfileId,
      journalEntryId: journal.id,
      transactionId: params.transactionId,
      amount: amount.mul(-1),
      balanceAfter: newBal,
      reason: `Wallet applied to voucher — ${params.feeVoucherId}`,
    },
  });

  return { journalEntryId: journal.id, voucherNumber };
}

/**
 * Best-effort BankAccount balance sync. BankAccount rows optionally link to
 * the GL via `accountCode` — when linked, keep currentBalance in step with
 * posted journals; when unlinked, this is a no-op (GL remains the truth).
 */
export async function syncBankBalance(
  tx: Prisma.TransactionClient,
  params: { tenantId: string; accountCode: string; delta: number | Prisma.Decimal },
): Promise<void> {
  const deltaNum = Number(new Prisma.Decimal(params.delta).toFixed(2));
  if (!Number.isFinite(deltaNum) || deltaNum === 0) return;
  try {
    await (tx as any).bankAccount?.updateMany?.({
      where: { tenantId: params.tenantId, accountCode: params.accountCode },
      data: { currentBalance: { increment: deltaNum } },
    });
  } catch {}
}

/**
 * Resolves the open fiscal year/period for a posting date. Throws when the
 * date falls inside a closed period or closed fiscal year, so back-dated
 * collections cannot silently rewrite a closed book. Returns {} when the
 * tenant has no fiscal setup (period tracking not yet adopted).
 */
export async function resolveOpenPeriod(
  tx: Prisma.TransactionClient,
  params: { tenantId: string; postingDate?: Date },
): Promise<{ fiscalYearId?: string; financialPeriodId?: string }> {
  const postingDate = params.postingDate ?? new Date();
  const fiscalYear = await (tx as any).fiscalYear?.findFirst?.({
    where: { tenantId: params.tenantId, startDate: { lte: postingDate }, endDate: { gte: postingDate } },
    select: { id: true, isClosed: true },
  });
  if (!fiscalYear) return {};
  if (fiscalYear.isClosed) {
    throw ApiError.badRequest("Fiscal year is closed for this posting date. Post into the open year.");
  }
  const period = await (tx as any).financialPeriod?.findFirst?.({
    where: { tenantId: params.tenantId, fiscalYearId: fiscalYear.id, startDate: { lte: postingDate }, endDate: { gte: postingDate } },
    select: { id: true, isClosed: true },
  });
  if (period) {
    if (period.isClosed) {
      throw ApiError.badRequest("Financial period is closed for this posting date.");
    }
    return { fiscalYearId: fiscalYear.id, financialPeriodId: period.id };
  }
  return { fiscalYearId: fiscalYear.id };
}

/**
 * Cash-counter → bank deposit (CONTRA): moves collected cash into the bank
 * without touching revenue or receivables.
 *    - Dr. Bank account (toCode)   -> amount
 *    - Cr. Cash account (fromCode) -> amount
 */
export async function postCashDeposit(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    fromCode?: string;
    toCode: string;
    amount: number | Prisma.Decimal;
    executedById: string;
    note?: string;
    bankReference?: string;
    receiptRefs?: string;
    postingDate?: Date;
    idempotencyKey?: string;
  }
): Promise<{ journalEntryId: string; voucherNumber: string }> {
  const { tenantId, fromCode = GL_CODES.CASH, toCode, executedById } = params;

  if (params.idempotencyKey) {
    const existing = await (tx as any).journalEntry?.findFirst?.({
      where: { tenantId, reference: params.idempotencyKey },
    });
    if (existing) {
      return { journalEntryId: existing.id, voucherNumber: existing.entryNumber };
    }
  }
  const amount = new Prisma.Decimal(params.amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (amount.lessThanOrEqualTo(0)) {
    throw ApiError.badRequest("Deposit amount must be positive.");
  }
  if (fromCode === toCode) {
    throw ApiError.badRequest("Deposit source and destination accounts must differ.");
  }
  const bankReference = params.bankReference?.trim().slice(0, 100) || "";
  const receiptRefs = params.receiptRefs?.trim().slice(0, 1000) || "";
  const accounts = await tx.chartOfAccount.findMany({
    where: { tenantId, code: { in: [fromCode, toCode] }, isActive: true },
  });
  const accountMap = new Map(accounts.map((a) => [a.code, a.id]));
  if (!accountMap.has(fromCode) || !accountMap.has(toCode)) {
    throw ApiError.internal(`Deposit accounts (${fromCode} → ${toCode}) not configured.`);
  }
  const postingDate = params.postingDate ?? new Date();
  const period = await resolveOpenPeriod(tx, { tenantId, postingDate });
  const voucherNumber = await getNextVoucherNumber(tx, tenantId, "CONTRA");
  const narrationParts = [`Cash Deposit ${fromCode} → ${toCode}`];
  if (bankReference) narrationParts.push(`Bank ref: ${bankReference}`);
  if (receiptRefs) narrationParts.push(`Receipts: ${receiptRefs}`);
  if (params.note) narrationParts.push(params.note);
  const journal = await tx.journalEntry.create({
    data: {
      tenantId,
      entryNumber: voucherNumber,
      voucherType: "CONTRA",
      postingDate,
      postingStatus: "POSTED",
      narration: narrationParts.join(" | "),
      reference: bankReference || voucherNumber,
      totalDebit: amount,
      totalCredit: amount,
      createdById: executedById,
      ...(period.fiscalYearId ? { fiscalYearId: period.fiscalYearId } : {}),
      ...(period.financialPeriodId ? { financialPeriodId: period.financialPeriodId } : {}),
      lineItems: {
        create: [
          { tenantId, accountId: accountMap.get(toCode)!, debitAmount: amount, creditAmount: new Prisma.Decimal(0), narration: `Cash deposited to ${toCode}` },
          { tenantId, accountId: accountMap.get(fromCode)!, debitAmount: new Prisma.Decimal(0), creditAmount: amount, narration: `Cash moved out of ${fromCode}` },
        ],
      },
    },
  });
  await syncBankBalance(tx, { tenantId, accountCode: toCode, delta: amount });
  await syncBankBalance(tx, { tenantId, accountCode: fromCode, delta: amount.mul(-1) });
  return { journalEntryId: journal.id, voucherNumber };
}

/**
 * Single receipt poster for every fee collection path (counter, bulk,
 * direct transaction). Resolves the deposit account from the tenant's
 * configured paymentMethods, enforces balanced/non-zero guards, writes an
 * AuditLog marker, and links any wallet excess with its transactionId.
 */
export async function postFeeReceipt(
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
    transactionId?: string;
    bankAccountCode?: string;
    /**
     * Idempotency key for this exact payment intent (e.g. client-generated
     * per pay-button click). A replay with the same key returns the original
     * receipt journal instead of posting — and incrementing the voucher for —
     * a duplicate payment. Falls back to receiptNumber when omitted.
     */
    idempotencyKey?: string;
  }
): Promise<{ journalEntryId: string; voucherNumber: string }> {
  const payment = new Prisma.Decimal(params.amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const applied = new Prisma.Decimal(params.appliedToInvoice).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const excess = new Prisma.Decimal(params.excessToWallet || 0).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (payment.lessThanOrEqualTo(0) || !applied.plus(excess).equals(payment)) {
    throw ApiError.internal("Invalid fee payment journal amounts.");
  }

  const reference = params.idempotencyKey?.trim() || params.receiptNumber;
  const existing = await (tx as any).journalEntry?.findFirst?.({
    where: { tenantId: params.tenantId, reference },
    select: { id: true, entryNumber: true },
  });
  if (existing) return { journalEntryId: existing.id, voucherNumber: existing.entryNumber };

  if (params.feeVoucherId) {
    const voucher = await (tx as any).feeVoucher?.findUnique?.({
      where: { id: params.feeVoucherId },
      select: { studentProfileId: true },
    });
    if (voucher?.studentProfileId && params.studentProfileId && voucher.studentProfileId !== params.studentProfileId) {
      throw ApiError.badRequest(`Fee voucher ${params.feeVoucherId} belongs to student ${voucher.studentProfileId}, not ${params.studentProfileId}.`);
    }
  }

  let bankCode = params.bankAccountCode
    || resolveMethodAccountCode(undefined, params.paymentMethod);
  try {
    const tenant = await tx.tenant.findUnique({
      where: { tenantId: params.tenantId },
      select: { featureFlags: true },
    });
    const flags = (tenant?.featureFlags as any) || {};
    if (Array.isArray(flags.paymentMethods)) {
      bankCode = params.bankAccountCode
        || resolveMethodAccountCode(flags.paymentMethods, params.paymentMethod);
    }
  } catch {}

  const requiredCodes = [bankCode];
  if (applied.greaterThan(0)) requiredCodes.push(GL_CODES.RECEIVABLE);
  if (excess.greaterThan(0)) requiredCodes.push(GL_CODES.WALLET);
  const accounts = await tx.chartOfAccount.findMany({
    where: { tenantId: params.tenantId, code: { in: requiredCodes }, isActive: true },
  });
  const accountMap = new Map(accounts.map((account) => [account.code, account]));
  for (const code of requiredCodes) {
    if (!accountMap.has(code)) {
      throw ApiError.internal(`Account (${code}) not configured for payment method ${params.paymentMethod}. Seed the tenant's chart of accounts under Accounting > Chart of Accounts.`);
    }
  }

  const voucherNumber = await getNextVoucherNumber(tx, params.tenantId, "RECEIPT");
  const period = await resolveOpenPeriod(tx, { tenantId: params.tenantId });
  const lines = [{
    tenantId: params.tenantId,
    accountId: accountMap.get(bankCode)!.id,
    debitAmount: payment,
    creditAmount: new Prisma.Decimal(0),
    // Snapshot the method→account routing on the narration itself, so history
    // stays interpretable even if the tenant remaps the method tomorrow.
    narration: `Fee Payment Received via ${params.paymentMethod}→${bankCode} [Rcpt: ${params.receiptNumber}]`,
  }];
  if (applied.greaterThan(0)) {
    lines.push({
      tenantId: params.tenantId,
      accountId: accountMap.get(GL_CODES.RECEIVABLE)!.id,
      debitAmount: new Prisma.Decimal(0),
      creditAmount: applied,
      narration: `Settlement of Fee Voucher ${params.feeVoucherId}`,
    });
  }
  if (excess.greaterThan(0)) {
    lines.push({
      tenantId: params.tenantId,
      accountId: accountMap.get(GL_CODES.WALLET)!.id,
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
      reference,
      totalDebit: payment,
      totalCredit: payment,
      createdById: params.executedById,
      ...(period.fiscalYearId ? { fiscalYearId: period.fiscalYearId } : {}),
      ...(period.financialPeriodId ? { financialPeriodId: period.financialPeriodId } : {}),
      lineItems: { create: lines },
    },
  });

  await syncBankBalance(tx, { tenantId: params.tenantId, accountCode: bankCode, delta: payment });

  try {
    await (tx as any).auditLog?.create?.({
      data: {
        tenantId: params.tenantId,
        userId: params.executedById ?? null,
        action: "JOURNAL_POST",
        entity: "Journal",
        entityId: journal.id,
        details: {
          entryNumber: journal.entryNumber,
          voucherType: "RECEIPT",
          reference: params.receiptNumber,
          paymentMethod: params.paymentMethod,
          totalDebit: payment.toFixed(2),
          totalCredit: payment.toFixed(2),
        },
      },
    });
  } catch {}

  if (excess.greaterThan(0)) {
    await createWalletLedgerIfNeeded(tx, {
      tenantId: params.tenantId,
      studentProfileId: params.studentProfileId,
      journalEntryId: journal.id,
      transactionId: params.transactionId,
      amount: excess,
      reason: `Excess payment wallet credit — ${params.feeVoucherId}`,
    });
  }

  return { journalEntryId: journal.id, voucherNumber };
}

/**
 * Dispatcher for collection journals: bank/cash/digital methods post a
 * RECEIPT via postFeeReceipt; WALLET_CREDIT settles from the advance wallet
 * via applyWalletDebit (overpay-from-wallet is rejected — excess would loop
 * straight back into the wallet it came from).
 */
export async function postCollectionJournal(
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
    transactionId?: string;
    /** Forwarded to the receipt/wallet poster for replay protection. */
    idempotencyKey?: string;
  }
): Promise<{ journalEntryId: string; voucherNumber: string }> {
  if (params.paymentMethod === "WALLET_CREDIT") {
    const amountDec = new Prisma.Decimal(params.amount);
    const appliedDec = new Prisma.Decimal(params.appliedToInvoice);
    const excess = new Prisma.Decimal(params.excessToWallet || 0);
    if (excess.greaterThan(0) || !amountDec.equals(appliedDec)) {
      throw ApiError.badRequest("Wallet payments cannot exceed the voucher balance due or leave unallocated funds.");
    }
    return applyWalletDebit(tx, {
      tenantId: params.tenantId,
      studentProfileId: params.studentProfileId,
      feeVoucherId: params.feeVoucherId,
      amount: params.appliedToInvoice,
      executedById: params.executedById,
      receiptNumber: params.receiptNumber,
      transactionId: params.transactionId,
      note: params.note,
      idempotencyKey: params.idempotencyKey,
    });
  }
  return postFeeReceipt(tx, { ...params, idempotencyKey: params.idempotencyKey });
}

/**
 * Posts a receipt journal for legacy FeeVoucher transactions.
 * Thin wrapper over postFeeReceipt (kept for call-site compatibility).
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
    transactionId?: string;
  }
): Promise<{ journalEntryId: string; voucherNumber: string }> {
  return postFeeReceipt(tx, params);
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
    arAccountCode?: string;        // Default: GL_CODES.RECEIVABLE
    lateFeeRevenueCode?: string;   // Default: GL_CODES.LATE_FINE_REVENUE
    notes?: string;
  }
) {
  const {
    tenantId,
    feeVoucherId,
    studentProfileId,
    fineAmount,
    executedById,
    arAccountCode = GL_CODES.RECEIVABLE,
    lateFeeRevenueCode = GL_CODES.LATE_FINE_REVENUE,
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
  const period = await resolveOpenPeriod(tx, { tenantId });

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
      ...(period.fiscalYearId ? { fiscalYearId: period.fiscalYearId } : {}),
      ...(period.financialPeriodId ? { financialPeriodId: period.financialPeriodId } : {}),
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
      lateFine: { increment: fine },
      totalDue: { increment: fine },
      balance: { increment: fine },
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
    bankAccountCode = paymentMethod === "CASH" ? GL_CODES.CASH : GL_CODES.BANK,
    arAccountCode = GL_CODES.RECEIVABLE,
    unearnedLiabilityCode = GL_CODES.WALLET,
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
    Array<{ id: string; studentProfileId?: string; totalDue: Prisma.Decimal; amountPaid: Prisma.Decimal }>
  >`
    SELECT id, "studentProfileId", "totalDue", "amountPaid"
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

  // Resolve student once for the wallet ledger link.
  let studentProfileId = voucherRow.studentProfileId;
  if (!studentProfileId) {
    const voucherForWallet = await (tx as any).feeVoucher?.findUnique?.({ where: { id: feeVoucherId }, select: { studentProfileId: true } });
    studentProfileId = (voucherForWallet as any)?.studentProfileId;
  }
  if (!studentProfileId) {
    throw new Error(`Fee voucher ${feeVoucherId} has no associated student profile`);
  }

  const { journalEntryId } = await postFeeReceipt(tx, {
    tenantId,
    studentProfileId,
    feeVoucherId,
    amount: payment,
    appliedToInvoice,
    excessToWallet,
    paymentMethod,
    receiptNumber,
    executedById,
    note: notes ? `${notes} (Voucher: ${feeVoucherId})` : `Voucher: ${feeVoucherId}`,
    bankAccountCode: params.bankAccountCode,
  });

  const remainingBalance = Prisma.Decimal.max(remainingDue.minus(appliedToInvoice), new Prisma.Decimal(0));

  return {
    feeVoucherId,
    receiptNumber,
    paymentAmount: payment.toFixed(2),
    appliedToInvoice: appliedToInvoice.toFixed(2),
    excessToWallet: excessToWallet.toFixed(2),
    newBalance: remainingBalance.toFixed(2),
    status: remainingBalance.isZero() ? "PAID" : "PARTIAL",
    journalEntryId,
  };
}

/**
 * Reverses (waives) a late-fine surcharge, in full or in part:
 *    - Dr. Late Fee Surcharge Income (4060) -> waivedAmount
 *    - Cr. Accounts Receivable (1030)       -> waivedAmount
 * and decrements the voucher's lateFine/totalDue/balance. Never drives a
 * balance negative — the waiver is capped at the outstanding fine.
 */
export async function waiveLateFine(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    feeVoucherId: string;
    studentProfileId: string;
    amount?: number | Prisma.Decimal;
    executedById: string;
    reason?: string;
    arAccountCode?: string;
    lateFeeRevenueCode?: string;
  }
) {
  const {
    tenantId,
    feeVoucherId,
    studentProfileId,
    executedById,
    reason,
    arAccountCode = GL_CODES.RECEIVABLE,
    lateFeeRevenueCode = GL_CODES.LATE_FINE_REVENUE,
  } = params;

  const lockedRows = await tx.$queryRaw<
    Array<{ id: string; lateFine: Prisma.Decimal; totalDue: Prisma.Decimal; amountPaid: Prisma.Decimal }>
  >`
    SELECT id, "lateFine", "totalDue", "amountPaid"
    FROM "FeeVoucher"
    WHERE id = ${feeVoucherId} AND "tenantId" = ${tenantId}
    FOR UPDATE
  `;
  if (lockedRows.length === 0) {
    throw new Error(`FeeVoucher ${feeVoucherId} not found for tenant ${tenantId}`);
  }
  const outstandingFine = new Prisma.Decimal(lockedRows[0].lateFine);
  if (outstandingFine.lessThanOrEqualTo(0)) {
    throw ApiError.badRequest("Voucher carries no outstanding late fine to waive.");
  }
  const waived = params.amount !== undefined
    ? new Prisma.Decimal(params.amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    : outstandingFine;
  if (waived.lessThanOrEqualTo(0) || waived.greaterThan(outstandingFine)) {
    throw ApiError.badRequest(`Waiver amount must be within 0 and outstanding fine (${outstandingFine.toFixed(2)}).`);
  }

  const accounts = await tx.chartOfAccount.findMany({
    where: { tenantId, code: { in: [arAccountCode, lateFeeRevenueCode] }, isActive: true },
  });
  const accountMap = new Map(accounts.map((a) => [a.code, a.id]));
  if (!accountMap.has(arAccountCode)) throw new Error(`Accounts Receivable (${arAccountCode}) not configured.`);
  if (!accountMap.has(lateFeeRevenueCode)) throw new Error(`Late Fee Revenue (${lateFeeRevenueCode}) not configured.`);

  const period = await resolveOpenPeriod(tx, { tenantId });
  const voucherNumber = await getNextVoucherNumber(tx, tenantId, "JOURNAL");
  const journal = await tx.journalEntry.create({
    data: {
      tenantId,
      entryNumber: voucherNumber,
      voucherType: "JOURNAL",
      postingDate: new Date(),
      postingStatus: "POSTED",
      narration: `Late Fine Waived on Voucher ${feeVoucherId}${reason ? ` | ${reason}` : ""}`,
      reference: feeVoucherId,
      totalDebit: waived,
      totalCredit: waived,
      createdById: executedById,
      ...(period.fiscalYearId ? { fiscalYearId: period.fiscalYearId } : {}),
      ...(period.financialPeriodId ? { financialPeriodId: period.financialPeriodId } : {}),
      lineItems: {
        create: [
          {
            tenantId,
            accountId: accountMap.get(lateFeeRevenueCode)!,
            debitAmount: waived,
            creditAmount: new Prisma.Decimal(0),
            narration: `Late Fine Waiver - ${feeVoucherId}`,
            studentId: studentProfileId,
          },
          {
            tenantId,
            accountId: accountMap.get(arAccountCode)!,
            debitAmount: new Prisma.Decimal(0),
            creditAmount: waived,
            narration: `Late Fine Receivable Reversed - ${feeVoucherId}`,
            studentId: studentProfileId,
          },
        ],
      },
    },
  });

  const totalDue = new Prisma.Decimal(lockedRows[0].totalDue).minus(waived);
  const amountPaid = new Prisma.Decimal(lockedRows[0].amountPaid);
  const newBalance = Prisma.Decimal.max(new Prisma.Decimal(0), totalDue.minus(amountPaid));
  const newStatus = newBalance.isZero() ? "PAID" : amountPaid.greaterThan(0) ? "PARTIAL" : "OVERDUE";
  await tx.feeVoucher.update({
    where: { id: feeVoucherId },
    data: {
      lateFine: { decrement: waived },
      totalDue: { decrement: waived },
      balance: newBalance.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
      status: newStatus,
    },
  });

  return { journalEntryId: journal.id, voucherNumber, waivedAmount: waived.toFixed(2), status: newStatus };
}
