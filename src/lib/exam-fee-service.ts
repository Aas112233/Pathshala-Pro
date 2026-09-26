import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
import { getNextVoucherNumber } from "@/lib/accounting-sequence";
import { GL_CODES } from "@/lib/constants";
import {
  postLegacyFeeInvoiceAccrual,
  postCollectionJournal,
  computeStackedConcession,
} from "@/lib/fee-service";

/**
 * Per-exam fee billing. All business logic here is server-side by design
 * (AGENTS rule 6): the client only orchestrates UI state and triggers
 * mutations. Nothing below may be re-implemented in a viewmodel.
 *
 * Design notes worth keeping in mind when editing:
 *
 *  - Money is `Prisma.Decimal` end to end. `toCents`-style integer math is
 *    used inside the existing `math-utils`; here Decimal is the correct tool
 *    because every value round-trips through Postgres `Decimal(15,2)`.
 *
 *  - An exam fee posts to the tenant's `EXAM` FeeHead (account 4030 by
 *    default), NOT to `ClassFeeStructure.examFee`. That column is part of the
 *    *monthly recurring* bundle; conflating a one-time exam charge with it
 *    would corrupt `totalMonthlyFee` and the monthly invoicing path.
 */

export const EXAM_FEE_TYPE = "EXAM" as const;
export const EXAM_FEE_HEAD_CODE = "EXAM";

/**
 * Fee head an exam-fee concession is scoped to by default.
 *
 * `computeStackedConcession` treats `appliesToHead === "TUITION"` as
 * "tuition-scoped" and any *other* value as "all-heads" (eligible against the
 * full billed base). Concessions are stored with `appliesToHead` defaulting to
 * `"TUITION"`, so passing the literal "EXAM" here would be a silent
 * no-op filter against rows that never say "EXAM". Leaving it undefined makes
 * the engine fall through to its all-heads path, which is the correct scope
 * for a per-exam charge billed outside the monthly bundle.
 */
const EXAM_CONCESSION_HEAD = undefined;

export interface ExamClassFeeInput {
  classId: string;
  /** Blank string means "class sits the exam but is not charged". */
  feeAmount?: number | string | null;
  isFeeApplicable?: boolean;
}

/**
 * What one student owes for one exam, already concession-adjusted.
 */
export interface ExamFeeDueRow {
  studentProfileId: string;
  classId: string;
  grossAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  netPayable: Prisma.Decimal;
  /** Existing voucher for this (student, exam) pair, when one has been raised. */
  existingVoucherId: string | null;
  existingVoucherStatus: string | null;
  existingBalance: Prisma.Decimal;
  /** Amount still collectable against the existing voucher. */
  outstanding: Prisma.Decimal;
  isPaid: boolean;
}

/**
 * Resolves the per-class exam fee map for an exam.
 *
 * Returns only rows explicitly marked fee-applicable with a positive amount —
 * a listed-but-free class is not a payable. Callers must treat an absent class
 * as "no charge", never as zero-amount charge.
 */
export async function resolveExamClassFees(
  tx: Prisma.TransactionClient,
  params: { tenantId: string; examId: string }
): Promise<Map<string, Prisma.Decimal>> {
  const rows = await tx.examClass.findMany({
    where: { tenantId: params.tenantId, examId: params.examId },
    select: { classId: true, feeAmount: true, isFeeApplicable: true },
  });

  const map = new Map<string, Prisma.Decimal>();
  for (const row of rows) {
    if (!row.isFeeApplicable) continue;
    const amount = new Prisma.Decimal(row.feeAmount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    if (amount.greaterThan(0)) {
      map.set(row.classId, amount);
    }
  }
  return map;
}

/**
 * Validates and normalises the per-class fee block submitted with a create or
 * update exam request. Runs server-side so a tampered client cannot inject a
 * negative, NaN, or over-precision amount into AR.
 */
export function validateExamClassFees(
  entries: ExamClassFeeInput[]
): Array<{ classId: string; feeAmount: Prisma.Decimal; isFeeApplicable: boolean }> {
  const seen = new Set<string>();
  return entries.map((entry) => {
    const classId = (entry.classId || "").trim();
    if (!classId) {
      throw ApiError.badRequest("Each exam class fee requires a classId.");
    }
    if (seen.has(classId)) {
      throw ApiError.badRequest(`Duplicate class in exam fee configuration: ${classId}.`);
    }
    seen.add(classId);

    // Per AGENTS rule 15, an untouched field is "not charged", not "zero
    // charged": isFeeApplicable stays false so the class is listed for the
    // exam without generating a payable line.
    const raw = entry.feeAmount;
    const blank = raw === undefined || raw === null || String(raw).trim() === "";
    if (blank) {
      return { classId, feeAmount: new Prisma.Decimal(0), isFeeApplicable: false };
    }

    const amount = new Prisma.Decimal(String(raw));
    if (amount.isNaN()) {
      throw ApiError.badRequest(`Invalid exam fee amount for class ${classId}.`);
    }
    if (amount.isNegative()) {
      throw ApiError.badRequest(`Exam fee cannot be negative (class ${classId}: ${amount.toString()}).`);
    }
    if (amount.greaterThan(10000000)) {
      throw ApiError.badRequest(`Exam fee exceeds the maximum allowed (class ${classId}).`);
    }

    const rounded = amount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    return {
      classId,
      feeAmount: rounded,
      // An explicit 0 is a deliberate "this class is free for this exam"
      // signal and is preserved as applicable-but-zero so the admin's intent
    // survives, rather than being silently downgraded to "not listed".
      isFeeApplicable: entry.isFeeApplicable ?? rounded.greaterThan(0),
    };
  });
}

/**
 * Computes what each student in scope owes for an exam, honouring the
 * tenant's stacked-concession rules, and folding in any voucher already
 * raised so the cashier never sees the same fee twice.
 */
export async function computeExamFeeDue(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    examId: string;
    classId?: string;
    sectionId?: string;
    academicYearId: string;
    /** Restrict to these students; omit to use the class/section filter. */
    studentProfileIds?: string[];
  }
): Promise<ExamFeeDueRow[]> {
  const { tenantId, examId, classId, sectionId, academicYearId, studentProfileIds } = params;

  const exam = await tx.exam.findFirst({
    where: { id: examId, tenantId },
    select: { id: true, academicYearId: true, name: true, isPublished: true },
  });
  if (!exam) {
    throw ApiError.notFound(`Exam ${examId} not found for tenant ${tenantId}.`);
  }
  if (exam.academicYearId !== academicYearId) {
    throw ApiError.badRequest(
      `Exam belongs to a different academic year than the one selected.`
    );
  }

  const classFees = await resolveExamClassFees(tx, { tenantId, examId });
  if (classFees.size === 0) {
    return [];
  }

  // Scoping: a requested class must actually be on the exam, and must carry a
  // fee. Silently returning an empty grid for a class that was never
  // configured would read as "everyone is paid" to a cashier.
  if (classId) {
    if (!classFees.has(classId)) {
      throw ApiError.badRequest(
        `Class is not configured with an exam fee for this exam. Add the class and its fee on the exam first.`
      );
    }
  }

  const feeClassIds = Array.from(classFees.keys());
  const studentWhere: Prisma.StudentProfileWhereInput = {
    tenantId,
    status: "ACTIVE",
    classId: classId ? classId : { in: feeClassIds },
  };
  if (sectionId) {
    studentWhere.sectionId = sectionId;
  }
  if (studentProfileIds && studentProfileIds.length > 0) {
    studentWhere.id = { in: studentProfileIds };
  }

  const students = await tx.studentProfile.findMany({
    where: studentWhere,
    select: { id: true, classId: true },
  });
  if (students.length === 0) {
    return [];
  }

  const studentIds = students.map((s) => s.id);
  const [concessions, existingVouchers] = await Promise.all([
    tx.studentFeeConcession.findMany({
      where: { tenantId, studentProfileId: { in: studentIds }, isActive: true },
    }),
    tx.feeVoucher.findMany({
      where: { tenantId, studentProfileId: { in: studentIds }, examId },
      select: { id: true, studentProfileId: true, status: true, balance: true, totalDue: true, amountPaid: true },
    }),
  ]);

  const concessionsByStudent = new Map<string, typeof concessions>();
  for (const c of concessions) {
    const list = concessionsByStudent.get(c.studentProfileId) ?? [];
    list.push(c);
    concessionsByStudent.set(c.studentProfileId, list);
  }

  const voucherByStudent = new Map<string, (typeof existingVouchers)[number]>();
  for (const v of existingVouchers) {
    voucherByStudent.set(v.studentProfileId, v);
  }

  return students.map((student) => {
    const classFee = classFees.get(student.classId!)!;
    const studentConcessions = concessionsByStudent.get(student.id) ?? [];

    // The same stacking engine the monthly path uses, applied against the
    // exam fee as the concession base. Reusing it keeps waiver policy
    // identical across both desks instead of forking the rules.
    const discount = studentConcessions.length
      ? computeStackedConcession(classFee, studentConcessions.map((c) => ({
          discountType: c.discountType,
          discountValue: new Prisma.Decimal(c.discountValue as any),
          appliesToHead: (c as any).appliesToHead || EXAM_CONCESSION_HEAD,
          priority: (c as any).priority,
          validFrom: (c as any).validFrom,
          validUntil: (c as any).validUntil,
        })), classFee)
      : new Prisma.Decimal(0);

    // A stacked concession can never exceed the base; clamp rather than
    // letting a mis-seeded waiver produce a negative payable.
    const safeDiscount = Prisma.Decimal.min(discount, classFee);
    const net = Prisma.Decimal.max(classFee.minus(safeDiscount), new Prisma.Decimal(0))
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    const voucher = voucherByStudent.get(student.id);
    const outstanding = voucher
      ? Prisma.Decimal.max(new Prisma.Decimal(voucher.balance), new Prisma.Decimal(0))
      : net;

    return {
      studentProfileId: student.id,
      classId: student.classId!,
      grossAmount: classFee,
      discountAmount: safeDiscount,
      netPayable: net,
      existingVoucherId: voucher?.id ?? null,
      existingVoucherStatus: voucher?.status ?? null,
      existingBalance: voucher ? new Prisma.Decimal(voucher.balance) : new Prisma.Decimal(0),
      outstanding,
      isPaid: outstanding.isZero(),
    };
  });
}

/**
 * Creates (or tops up) the FeeVoucher carrying a student's exam-fee charge.
 *
 * Exam fees are billed into the *same* `FeeVoucher` ledger as tuition rather
 * than a parallel table, so a student's total arrears, the AR subledger, aging
 * reports, the advance wallet and receipt PDFs all keep working unchanged.
 * The row is distinguished by `feeType = "EXAM"` + `examId`.
 *
 * Due-date default is 14 days out, or the exam's start date when that is
 * closer and still in the future — collecting an exam fee after the exam has
 * already run is a collections problem, not an invoicing one.
 */
export async function generateExamFeeVoucher(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    examId: string;
    studentProfileId: string;
    academicYearId: string;
    executedById: string;
    dueDate?: Date;
    /** Only needed when the student has no class-derived fee. */
    overrideAmount?: number | Prisma.Decimal;
    note?: string;
  }
): Promise<{
  feeVoucherId: string;
  voucherId: string;
  totalDue: string;
  balance: string;
  status: string;
  created: boolean;
}> {
  const { tenantId, examId, studentProfileId, academicYearId, executedById } = params;

  const exam = await tx.exam.findFirst({
    where: { id: examId, tenantId },
    select: { id: true, name: true, examId: true, academicYearId: true, startDate: true },
  });
  if (!exam) {
    throw ApiError.notFound(`Exam ${examId} not found.`);
  }

  const student = await tx.studentProfile.findFirst({
    where: { id: studentProfileId, tenantId },
    select: { id: true, classId: true },
  });
  if (!student) {
    throw ApiError.notFound(`Student ${studentProfileId} not found.`);
  }

  const classFees = await resolveExamClassFees(tx, { tenantId, examId });
  const classFee = student.classId ? classFees.get(student.classId) : undefined;

  const gross = classFee ?? (params.overrideAmount !== undefined
    ? new Prisma.Decimal(params.overrideAmount)
    : null);
  if (gross === null) {
    throw ApiError.badRequest(
      `Class ${student.classId ?? "(none)"} has no exam fee configured for this exam.`
    );
  }
  const grossRounded = gross.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (grossRounded.lessThanOrEqualTo(0)) {
    throw ApiError.badRequest("Exam fee amount must be greater than zero.");
  }

  const discounts = await tx.studentFeeConcession.findMany({
    where: { tenantId, studentProfileId, isActive: true },
  });
  const discount = discounts.length
    ? computeStackedConcession(grossRounded, discounts.map((c) => ({
        discountType: c.discountType,
        discountValue: new Prisma.Decimal(c.discountValue as any),
        appliesToHead: (c as any).appliesToHead || EXAM_CONCESSION_HEAD,
        priority: (c as any).priority,
        validFrom: (c as any).validFrom,
        validUntil: (c as any).validUntil,
      })), grossRounded)
    : new Prisma.Decimal(0);
  const safeDiscount = Prisma.Decimal.min(discount, grossRounded).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const net = grossRounded.minus(safeDiscount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  const dueDate = params.dueDate ?? defaultExamDueDate(exam.startDate);

  // Reuse the accrual poster: it resolves the EXAM FeeHead → 4030, enforces
  // Dr AR + Dr Concession === Cr Revenue, and round-trips through Decimal.
  // The same balance checks that guard the monthly path guard this one.
  const reference = `EXAM-FEE:${exam.examId}`;
  const accrual = await postLegacyFeeInvoiceAccrual(tx, {
    tenantId,
    studentProfileId,
    feeHeadCode: EXAM_FEE_HEAD_CODE,
    amount: grossRounded,
    discountAmount: safeDiscount,
    executedById,
    reference,
    dueDate,
  });

  // billingMonth/billingYear stay NULL: an exam charge is not tied to a
  // calendar month. The (student, examId) unique index is what stops a
  // duplicate, precisely because NULL months do not participate in the
  // existing composite unique.
  const voucherId = accrual?.voucherNumber ?? await getNextVoucherNumber(tx, tenantId, "SALES_FEE");
  const voucher = await tx.feeVoucher.create({
    data: {
      tenantId,
      voucherId,
      studentProfileId,
      academicYearId,
      feeType: EXAM_FEE_TYPE,
      examId,
      baseAmount: grossRounded,
      discountAmount: safeDiscount,
      arrears: new Prisma.Decimal(0),
      lateFine: new Prisma.Decimal(0),
      totalDue: net,
      amountPaid: new Prisma.Decimal(0),
      balance: net,
      dueDate,
      status: "PENDING",
      ...(accrual?.journalEntryId ? { journalEntryId: accrual.journalEntryId } : {}),
    },
  });

  return {
    feeVoucherId: voucher.id,
    voucherId: voucher.voucherId,
    totalDue: net.toFixed(2),
    balance: net.toFixed(2),
    status: "PENDING",
    created: true,
  };
}

function defaultExamDueDate(examStart: Date): Date {
  const twoWeeksOut = new Date();
  twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);
  const start = new Date(examStart);
  // The exam start is only a useful deadline if it has not already passed.
  if (start.getTime() > Date.now() && start.getTime() < twoWeeksOut.getTime()) {
    return start;
  }
  return twoWeeksOut;
}

/**
 * Collects against a student's exam-fee voucher, creating the voucher first if
 * it does not exist yet.
 *
 * Payment routing, wallet overflow (account 2050), receipt numbering, bank
 * balance sync and the double-entry posting are all delegated to the shared
 * fee-service functions, so an exam receipt is indistinguishable in the
 * ledger from a tuition receipt — which is what reconciliation requires.
 */
export async function collectExamFeePayment(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    examId: string;
    studentProfileId: string;
    academicYearId: string;
    amountPaid: number | Prisma.Decimal;
    paymentMethod: string;
    receiptNumber?: string;
    chequeNumber?: string;
    reference?: string;
    note?: string;
    executedById: string;
    /** Route an overpayment to the advance wallet instead of rejecting it. */
    allowAdvanceToWallet?: boolean;
    /** Client-generated key per pay intent; replay returns the original receipt. */
    idempotencyKey?: string;
  }
): Promise<{
  feeVoucherId: string;
  voucherId: string;
  receiptNumber: string;
  amountPaid: string;
  appliedToInvoice: string;
  excessToWallet: string;
  newBalance: string;
  status: string;
  voucherCreated: boolean;
}> {
  const { tenantId, examId, studentProfileId, academicYearId, executedById } = params;

  const payment = new Prisma.Decimal(params.amountPaid).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (payment.lessThanOrEqualTo(0)) {
    throw ApiError.badRequest(`Payment amount must be greater than 0. Received ${payment.toString()}.`);
  }

  if (params.paymentMethod === "CHEQUE" && !params.chequeNumber) {
    throw ApiError.badRequest("Cheque number is required for CHEQUE payments.");
  }

  let voucher: { id: string; voucherId: string; balance: Prisma.Decimal | string | number; status: string } | null = null;
  if (typeof (tx as any).$queryRaw === "function") {
    const lockedRows = await tx.$queryRaw<
      Array<{ id: string; voucherId: string; balance: Prisma.Decimal; status: string }>
    >`
      SELECT id, "voucherId", balance, status
      FROM "FeeVoucher"
      WHERE "tenantId" = ${tenantId}
        AND "studentProfileId" = ${studentProfileId}
        AND "examId" = ${examId}
      FOR UPDATE
    `;
    if (lockedRows && lockedRows.length > 0) {
      voucher = lockedRows[0];
    }
  }
  if (!voucher) {
    voucher = await tx.feeVoucher.findFirst({
      where: { tenantId, studentProfileId, examId },
      select: { id: true, voucherId: true, balance: true, status: true },
    });
  }

  let voucherCreated = false;
  if (!voucher) {
    const created = await generateExamFeeVoucher(tx, {
      tenantId,
      examId,
      studentProfileId,
      academicYearId,
      executedById,
      note: params.note,
    });
    voucherCreated = true;
    voucher = {
      id: created.feeVoucherId,
      voucherId: created.voucherId,
      balance: new Prisma.Decimal(created.balance),
      status: created.status,
    };
  }
  if (!voucher) {
    throw ApiError.internal("Exam fee voucher could not be created.");
  }

  const remainingDue = Prisma.Decimal.max(new Prisma.Decimal(voucher.balance), new Prisma.Decimal(0));

  if (remainingDue.isZero()) {
    throw ApiError.badRequest(
      `Exam fee for this student is already fully paid (voucher ${voucher.voucherId}). No further amount is due.`
    );
  }

  if (payment.greaterThan(remainingDue) && !params.allowAdvanceToWallet) {
    throw ApiError.badRequest(
      `Payment amount (${payment.toFixed(2)}) exceeds the outstanding exam fee (${remainingDue.toFixed(2)}). Enable advance-to-wallet to credit the difference to the student wallet.`
    );
  }

  const applied = Prisma.Decimal.min(payment, remainingDue);
  const excess = payment.minus(applied);

  const receiptNumber = params.receiptNumber || (await getNextVoucherNumber(tx, tenantId, "RECEIPT"));

  await postCollectionJournal(tx, {
    tenantId,
    studentProfileId,
    feeVoucherId: voucher.id,
    amount: payment,
    appliedToInvoice: applied,
    excessToWallet: excess,
    paymentMethod: params.paymentMethod,
    receiptNumber,
    executedById,
    idempotencyKey: params.idempotencyKey,
    note: params.note
      ? `${params.note} (Exam: ${examId})`
      : `Exam fee collection (Exam: ${examId})`,
  });

  const newBalance = Prisma.Decimal.max(remainingDue.minus(applied), new Prisma.Decimal(0));
  const newStatus = newBalance.isZero() ? "PAID" : "PARTIAL";
  await tx.feeVoucher.update({
    where: { id: voucher.id },
    data: {
      amountPaid: { increment: applied },
      balance: newBalance,
      status: newStatus,
    },
  });

  return {
    feeVoucherId: voucher.id,
    voucherId: voucher.voucherId,
    receiptNumber,
    amountPaid: payment.toFixed(2),
    appliedToInvoice: applied.toFixed(2),
    excessToWallet: excess.toFixed(2),
    newBalance: newBalance.toFixed(2),
    status: newStatus,
    voucherCreated,
  };
}

/**
 * Default GL routing for the EXAM revenue head.
 *
 * Intentionally NOT hardcoded to 4030: the tenant's own `FeeHead` row for
 * code "EXAM" is the authority (seeded to 4030 on provisioning, but an
 * administrator may remap it). `postLegacyFeeInvoiceAccrual` resolves that
 * row and falls back to tuition revenue, so this constant only documents the
 * expected default.
 */
export const EXAM_FEE_REVENUE_CODE = GL_CODES.TUITION_REVENUE;
