import {
  formatCurrencyValue,
  formatCompactCurrencyValue,
  type FormatCurrencyOptions,
} from "./currencies";
import {
  formatAcademicYear,
  type AcademicYearData,
} from "./academic-periods";

export interface CustomPaymentMethod {
  id: string;
  name: string;
  code: string; // e.g. CASH, BANK_TRANSFER, POS_CARD, EASYPAISA, JAZZCASH, BKASH, NAGAD, CHEQUE, STRIPE
  type: "CASH" | "BANK" | "DIGITAL" | "CHEQUE" | "OTHER";
  accountCode?: string; // 1020 for cash, 1010 for bank/digital
  isActive: boolean;
  isDefault?: boolean;
  instructions?: string;
}

export const DEFAULT_PAYMENT_METHODS: CustomPaymentMethod[] = [
  { id: "cash", name: "Cash", code: "CASH", type: "CASH", accountCode: "1020", isActive: true, isDefault: true },
  { id: "bank_transfer", name: "Bank Transfer", code: "BANK_TRANSFER", type: "BANK", accountCode: "1010", isActive: true },
  { id: "pos_card", name: "Card / POS", code: "POS_CARD", type: "DIGITAL", accountCode: "1010", isActive: true },
  { id: "easypaisa", name: "EasyPaisa", code: "EASYPAISA", type: "DIGITAL", accountCode: "1010", isActive: true },
  { id: "jazzcash", name: "JazzCash", code: "JAZZCASH", type: "DIGITAL", accountCode: "1010", isActive: true },
  { id: "bkash", name: "bKash", code: "BKASH", type: "DIGITAL", accountCode: "1010", isActive: true },
  { id: "cheque", name: "Cheque / Draft", code: "CHEQUE", type: "CHEQUE", accountCode: "1010", isActive: true },
];

export interface TenantSettings {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
  schoolCode?: string;
  establishedYear?: number;
  motto?: string;
  website?: string;
  currency: string;
  currencySymbol: string;
  taxRate: number;
  dateFormat: string;
  timeFormat: string;
  timezone: string;
  firstDayOfWeek: string;
  academicYearStart: string;
  gradingSystem: string;
  activeAcademicYearId?: string;
  activeSessionName?: string;
  paymentMethods?: CustomPaymentMethod[];
}

export const DEFAULT_TENANT_SETTINGS: TenantSettings = {
  id: "",
  tenantId: "",
  name: "",
  address: "",
  phone: "",
  email: "",
  currency: "BDT",
  currencySymbol: "৳",
  taxRate: 0,
  dateFormat: "DD/MM/YYYY",
  timeFormat: "24h",
  timezone: "Asia/Dhaka",
  firstDayOfWeek: "sunday",
  academicYearStart: "january",
  gradingSystem: "GPA",
  paymentMethods: DEFAULT_PAYMENT_METHODS,
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const FULL_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function getDateParts(date: Date | string, timezone: string) {
  const value = typeof date === "string" ? new Date(date) : date;
  if (isNaN(value.getTime())) {
    return { year: "", month: "", day: "", monthIndex: 0 };
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(value);
  const find = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";

  const monthStr = find("month");
  const monthIndex = parseInt(monthStr, 10) - 1;

  return {
    year: find("year"),
    month: monthStr,
    day: find("day"),
    monthIndex: isNaN(monthIndex) ? 0 : monthIndex,
  };
}

export function formatDateWithSettings(
  date: Date | string | null | undefined,
  settings: Partial<TenantSettings> = DEFAULT_TENANT_SETTINGS,
  formatOverride?: string
): string {
  if (!date) return "";
  const timezone = settings.timezone || DEFAULT_TENANT_SETTINGS.timezone;
  const dateFormat = formatOverride || settings.dateFormat || DEFAULT_TENANT_SETTINGS.dateFormat;
  const { year, month, day, monthIndex } = getDateParts(date, timezone);

  if (!year || !month || !day) return "";

  const shortMonth = MONTH_NAMES[monthIndex] || month;
  const fullMonth = FULL_MONTH_NAMES[monthIndex] || month;

  switch (dateFormat) {
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    case "DD-MM-YYYY":
      return `${day}-${month}-${year}`;
    case "DD MMM YYYY":
      return `${day} ${shortMonth} ${year}`;
    case "MMM DD, YYYY":
      return `${shortMonth} ${day}, ${year}`;
    case "D MMMM YYYY":
      return `${parseInt(day, 10)} ${fullMonth} ${year}`;
    case "DD/MM/YYYY":
    default:
      return `${day}/${month}/${year}`;
  }
}

export function formatTimeWithSettings(
  date: Date | string | null | undefined,
  settings: Partial<TenantSettings> = DEFAULT_TENANT_SETTINGS,
  timeFormatOverride?: string
): string {
  if (!date) return "";
  const timezone = settings.timezone || DEFAULT_TENANT_SETTINGS.timezone;
  const timeFormat = timeFormatOverride || settings.timeFormat || DEFAULT_TENANT_SETTINGS.timeFormat;
  const value = typeof date === "string" ? new Date(date) : date;

  if (isNaN(value.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat === "12h",
  }).format(value);
}

export function formatDateTimeWithSettings(
  date: Date | string | null | undefined,
  settings: Partial<TenantSettings> = DEFAULT_TENANT_SETTINGS
): string {
  if (!date) return "";
  const datePart = formatDateWithSettings(date, settings);
  const timePart = formatTimeWithSettings(date, settings);
  if (!datePart) return "";
  return `${datePart} ${timePart}`;
}

export function formatDateRangeWithSettings(
  startDate: Date | string,
  endDate: Date | string,
  settings: Partial<TenantSettings> = DEFAULT_TENANT_SETTINGS
): string {
  const startStr = formatDateWithSettings(startDate, settings);
  const endStr = formatDateWithSettings(endDate, settings);
  return `${startStr} – ${endStr}`;
}

export function formatRelativeTimeWithSettings(
  date: Date | string | null | undefined
): string {
  if (!date) return "";
  const value = typeof date === "string" ? new Date(date) : date;
  if (isNaN(value.getTime())) return "";

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - value.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return "Yesterday";
  if (diffInDays < 30) return `${diffInDays}d ago`;
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo ago`;
  return `${Math.floor(diffInDays / 365)}y ago`;
}

export function formatCurrencyWithSettings(
  amount: number,
  settings: Partial<TenantSettings> = DEFAULT_TENANT_SETTINGS,
  options?: FormatCurrencyOptions
): string {
  const currencyCode = settings.currency || DEFAULT_TENANT_SETTINGS.currency;
  const symbolOverride = settings.currencySymbol || DEFAULT_TENANT_SETTINGS.currencySymbol;

  return formatCurrencyValue(amount, {
    currencyCode,
    symbolOverride,
    ...options,
  });
}

export function formatCompactCurrencyWithSettings(
  amount: number,
  settings: Partial<TenantSettings> = DEFAULT_TENANT_SETTINGS,
  options?: FormatCurrencyOptions
): string {
  const currencyCode = settings.currency || DEFAULT_TENANT_SETTINGS.currency;
  const symbolOverride = settings.currencySymbol || DEFAULT_TENANT_SETTINGS.currencySymbol;

  return formatCompactCurrencyValue(amount, {
    currencyCode,
    symbolOverride,
    ...options,
  });
}

export function formatAcademicPeriodWithSettings(
  year: AcademicYearData | string | null | undefined,
  settings: Partial<TenantSettings> = DEFAULT_TENANT_SETTINGS,
  prefix?: string
): string {
  return formatAcademicYear(year, prefix);
}
