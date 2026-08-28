import { Prisma, AccountType, NormalBalance, VoucherType } from "@prisma/client";

/**
 * 1. Standard 5-Tier Chart of Accounts Seeder
 */
export const DEFAULT_CHART_OF_ACCOUNTS: Array<{
  code: string;
  name: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  isSystem?: boolean;
}> = [
  // Assets (1000s)
  { code: "1010", name: "Main Bank Account", accountType: "ASSET", normalBalance: "DEBIT", isSystem: true },
  { code: "1020", name: "Petty Cash / Campus Register", accountType: "ASSET", normalBalance: "DEBIT", isSystem: true },
  { code: "1030", name: "Student Accounts Receivable", accountType: "ASSET", normalBalance: "DEBIT", isSystem: true },
  { code: "1040", name: "Advance Salary & Staff Loans", accountType: "ASSET", normalBalance: "DEBIT" },
  { code: "1500", name: "Fixed Assets & Equipment", accountType: "ASSET", normalBalance: "DEBIT" },

  // Liabilities (2000s)
  { code: "2010", name: "Accounts Payable", accountType: "LIABILITY", normalBalance: "CREDIT", isSystem: true },
  { code: "2020", name: "Salary & Wages Payable", accountType: "LIABILITY", normalBalance: "CREDIT", isSystem: true },
  { code: "2030", name: "Provident Fund Payable", accountType: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2040", name: "Income Tax / TDS Payable", accountType: "LIABILITY", normalBalance: "CREDIT" },
  { code: "2050", name: "Unearned / Advance Fee Received", accountType: "LIABILITY", normalBalance: "CREDIT", isSystem: true },
  { code: "2060", name: "Student Caution Money", accountType: "LIABILITY", normalBalance: "CREDIT" },

  // Equity (3000s)
  { code: "3010", name: "Institutional Capital", accountType: "EQUITY", normalBalance: "CREDIT", isSystem: true },
  { code: "3020", name: "Retained Earnings / Surplus Reserve", accountType: "EQUITY", normalBalance: "CREDIT", isSystem: true },
  { code: "3030", name: "Development & Waqf Fund", accountType: "EQUITY", normalBalance: "CREDIT" },

  // Revenue (4000s)
  { code: "4010", name: "Monthly Tuition Fee", accountType: "REVENUE", normalBalance: "CREDIT", isSystem: true },
  { code: "4020", name: "Admission Fee", accountType: "REVENUE", normalBalance: "CREDIT", isSystem: true },
  { code: "4030", name: "Examination Fee", accountType: "REVENUE", normalBalance: "CREDIT", isSystem: true },
  { code: "4040", name: "Transport Service Revenue", accountType: "REVENUE", normalBalance: "CREDIT" },
  { code: "4050", name: "Hostel & Messing Revenue", accountType: "REVENUE", normalBalance: "CREDIT" },
  { code: "4060", name: "Late Fee Surcharges & Fines", accountType: "REVENUE", normalBalance: "CREDIT", isSystem: true },
  { code: "4070", name: "Lab & Library Fee", accountType: "REVENUE", normalBalance: "CREDIT" },

  // Expenses (5000s)
  { code: "5010", name: "Academic Staff Salaries", accountType: "EXPENSE", normalBalance: "DEBIT", isSystem: true },
  { code: "5020", name: "Admin & Support Staff Salaries", accountType: "EXPENSE", normalBalance: "DEBIT", isSystem: true },
  { code: "5030", name: "Campus Utilities", accountType: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5040", name: "Building Rent", accountType: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5050", name: "Vehicle Fuel & Maintenance", accountType: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5060", name: "Fee Concessions & Scholarships", accountType: "EXPENSE", normalBalance: "DEBIT", isSystem: true },
  { code: "5070", name: "Exam Stationery & Printing", accountType: "EXPENSE", normalBalance: "DEBIT" },
  { code: "5080", name: "Payment Gateway Charges (MDR)", accountType: "EXPENSE", normalBalance: "DEBIT", isSystem: true },
];

export async function seedTenantChartOfAccounts(
  tx: Prisma.TransactionClient,
  tenantId: string,
  currency: string = "PKR"
) {
  const data = DEFAULT_CHART_OF_ACCOUNTS.map((acc) => ({
    tenantId,
    code: acc.code,
    name: acc.name,
    accountType: acc.accountType,
    normalBalance: acc.normalBalance,
    isSystem: acc.isSystem ?? false,
    isActive: true,
    currency,
  }));

  return tx.chartOfAccount.createMany({
    data,
    skipDuplicates: true,
  });
}

/**
 * 2. Default Fee Billing Heads Seeder
 */
export const DEFAULT_FEE_HEADS: Array<{ code: string; name: string; accountCode: string }> = [
  { code: "TUITION", name: "Monthly Tuition Fee", accountCode: "4010" },
  { code: "ADMISSION", name: "Admission & Registration Fee", accountCode: "4020" },
  { code: "EXAM", name: "Examination Fee", accountCode: "4030" },
  { code: "TRANSPORT", name: "Transport Service Fee", accountCode: "4040" },
  { code: "HOSTEL", name: "Hostel & Accommodation Fee", accountCode: "4050" },
  { code: "LAB", name: "Laboratory & Practical Fee", accountCode: "4070" },
];

export async function seedTenantFeeHeads(
  tx: Prisma.TransactionClient,
  tenantId: string
) {
  const data = DEFAULT_FEE_HEADS.map((head) => ({
    tenantId,
    code: head.code,
    name: head.name,
    accountCode: head.accountCode,
    isActive: true,
  }));

  return tx.feeHead.createMany({
    data,
    skipDuplicates: true,
  });
}

/**
 * 3. Fiscal Year and 12 Financial Periods Calendar Seeder
 */
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export async function seedTenantFiscalCalendar(
  tx: Prisma.TransactionClient,
  tenantId: string,
  fiscalYearStartMonth: number = 7, // 7 for July (BD/PK), 4 for April (IN), 1 for Jan
  currentYear: number = new Date().getFullYear()
) {
  const startMonthIdx = fiscalYearStartMonth - 1;
  const isCrossYear = startMonthIdx > 0;
  const endYear = isCrossYear ? currentYear + 1 : currentYear;
  const endMonthIdx = (startMonthIdx + 11) % 12;

  const startDate = new Date(Date.UTC(currentYear, startMonthIdx, 1, 0, 0, 0, 0));
  // Last day of the end month
  const endDate = new Date(Date.UTC(endYear, endMonthIdx + 1, 0, 23, 59, 59, 999));

  const fyName = isCrossYear
    ? `FY ${currentYear}-${endYear}`
    : `FY ${currentYear}`;

  const fiscalYear = await tx.fiscalYear.create({
    data: {
      tenantId,
      name: fyName,
      startDate,
      endDate,
      isClosed: false,
    },
  });

  const periodsData: Array<{
    tenantId: string;
    fiscalYearId: string;
    periodNumber: number;
    name: string;
    startDate: Date;
    endDate: Date;
    isClosed: boolean;
  }> = [];

  for (let i = 0; i < 12; i++) {
    const monthIdx = (startMonthIdx + i) % 12;
    const yearForMonth = startMonthIdx + i >= 12 ? currentYear + 1 : currentYear;
    const pStart = new Date(Date.UTC(yearForMonth, monthIdx, 1, 0, 0, 0, 0));
    const pEnd = new Date(Date.UTC(yearForMonth, monthIdx + 1, 0, 23, 59, 59, 999));

    periodsData.push({
      tenantId,
      fiscalYearId: fiscalYear.id,
      periodNumber: i + 1,
      name: `${MONTH_NAMES[monthIdx]} ${yearForMonth}`,
      startDate: pStart,
      endDate: pEnd,
      isClosed: false,
    });
  }

  await tx.financialPeriod.createMany({
    data: periodsData,
  });

  return fiscalYear;
}

/**
 * 4. Voucher Sequence Counters Seeder
 */
export async function seedTenantVoucherSequences(
  tx: Prisma.TransactionClient,
  tenantId: string,
  fiscalYear: number = new Date().getFullYear()
) {
  const sequenceTypes: Array<{ voucherType: VoucherType; prefix: string }> = [
    { voucherType: "JOURNAL", prefix: "JV" },
    { voucherType: "PAYMENT", prefix: "PAY" },
    { voucherType: "RECEIPT", prefix: "REC" },
    { voucherType: "SALES_FEE", prefix: "SAL" },
    { voucherType: "SALARY", prefix: "PAY" },
    { voucherType: "PURCHASE", prefix: "PUR" },
    { voucherType: "CONTRA", prefix: "CON" },
    { voucherType: "CLOSING", prefix: "JV" },
  ];

  const data = sequenceTypes.map((st) => ({
    tenantId,
    voucherType: st.voucherType,
    prefix: st.prefix,
    fiscalYear,
    current_number: 0,
  }));

  return tx.tenantVoucherSequence.createMany({
    data,
    skipDuplicates: true,
  });
}

/**
 * 5. Default Class Promotion Rules Seeder
 */
export async function seedTenantPromotionRules(
  tx: Prisma.TransactionClient,
  tenantId: string,
  academicYearId: string,
  classList: Array<{ id: string; classNumber: number; name: string }>
) {
  // Sort classes ascending by classNumber
  const sorted = [...classList].sort((a, b) => a.classNumber - b.classNumber);

  const rulesData = sorted.map((cls, idx) => {
    const isTerminalClass = idx === sorted.length - 1;
    const nextClass = isTerminalClass ? null : sorted[idx + 1];

    return {
      tenantId,
      academicYearId,
      classId: cls.id,
      minimumAttendance: 75,
      minimumOverallPercentage: 33,
      maxFailedSubjects: 0,
      allowConditionalPromotion: !isTerminalClass,
      nextClassId: nextClass ? nextClass.id : null,
    };
  });

  return tx.promotionRule.createMany({
    data: rulesData,
    skipDuplicates: true,
  });
}
