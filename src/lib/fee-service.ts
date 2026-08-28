import { Prisma } from "@prisma/client";
import { getNextVoucherNumber } from "@/lib/accounting-sequence";

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

  // Calculate totals
  let grossAmount = new Prisma.Decimal(0);
  for (const item of items) {
    const itemAmt = new Prisma.Decimal(item.amount);
    if (itemAmt.lessThan(0)) {
      throw new Error(`Fee item amount cannot be negative. Received ${itemAmt.toString()} for ${item.title}`);
    }
    grossAmount = grossAmount.plus(itemAmt);
  }

  const discount = new Prisma.Decimal(concessionAmount);
  if (discount.lessThan(0) || discount.greaterThan(grossAmount)) {
    throw new Error(`Invalid concession amount (${discount.toString()}) for gross fee (${grossAmount.toString()})`);
  }

  const netPayable = grossAmount.minus(discount);

  // Generate Concurrency-Safe Invoice Number
  const voucherNumber = await getNextVoucherNumber(tx, tenantId, "SALES_FEE", billingYear);

  // Resolve Revenue Account mappings
  const revenueAccountCodes = Array.from(
    new Set(items.map((i) => i.revenueAccountCode || "4010"))
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
      debitAmount: netPayable,
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
      debitAmount: discount,
      creditAmount: new Prisma.Decimal(0),
      narration: `Fee Concession (${concessionReason || "Institutional Waiver"}) - ${voucherNumber}`,
      studentId: studentProfileId,
      classId,
    });
  }

  // Leg 3: Credit Respective Revenue Heads
  for (const item of items) {
    const headCode = item.revenueAccountCode || "4010";
    const revAccId = accountMap.get(headCode);
    if (!revAccId) {
      throw new Error(`Revenue account (${headCode}) for item '${item.title}' not configured.`);
    }

    journalLines.push({
      tenantId,
      accountId: revAccId,
      debitAmount: new Prisma.Decimal(0),
      creditAmount: new Prisma.Decimal(item.amount),
      narration: `Fee Revenue: ${item.title} (${item.feeHeadCode})`,
      studentId: studentProfileId,
      classId,
    });
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
      totalDebit: grossAmount,
      totalCredit: grossAmount,
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

  // Lock and query invoice if available
  let remainingDue = payment;
  try {
    const lockedRows = await tx.$queryRaw<
      Array<{ id: string; netAmount: number; paidAmount: number }>
    >`
      SELECT id, "netAmount", "paidAmount"
      FROM "FeeInvoice"
      WHERE id = ${feeVoucherId} AND "tenantId" = ${tenantId}
      FOR UPDATE
    `;
    if (lockedRows.length > 0) {
      const inv = lockedRows[0];
      const net = new Prisma.Decimal(inv.netAmount);
      const paid = new Prisma.Decimal(inv.paidAmount);
      remainingDue = Prisma.Decimal.max(net.minus(paid), new Prisma.Decimal(0));
    }
  } catch {
    // Non-fatal if table not yet migrated
  }

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
