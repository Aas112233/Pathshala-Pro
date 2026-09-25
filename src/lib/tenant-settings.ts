import {
  formatCurrencyValue,
  formatCompactCurrencyValue,
  type FormatCurrencyOptions,
} from "./currencies";
import { GL_CODES } from "./constants";
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
  { id: "cash", name: "Cash", code: "CASH", type: "CASH", accountCode: GL_CODES.CASH, isActive: true, isDefault: true },
  { id: "bank_transfer", name: "Bank Transfer", code: "BANK_TRANSFER", type: "BANK", accountCode: GL_CODES.BANK, isActive: true },
  { id: "pos_card", name: "Card / POS", code: "POS_CARD", type: "DIGITAL", accountCode: GL_CODES.BANK, isActive: true },
  { id: "easypaisa", name: "EasyPaisa", code: "EASYPAISA", type: "DIGITAL", accountCode: GL_CODES.BANK, isActive: true },
  { id: "jazzcash", name: "JazzCash", code: "JAZZCASH", type: "DIGITAL", accountCode: GL_CODES.BANK, isActive: true },
  { id: "bkash", name: "bKash", code: "BKASH", type: "DIGITAL", accountCode: GL_CODES.BANK, isActive: true },
  { id: "cheque", name: "Cheque / Draft", code: "CHEQUE", type: "CHEQUE", accountCode: GL_CODES.BANK, isActive: true },
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

/** Wall-clock offset of `timeZone` at `date`, in milliseconds east of UTC. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * UTC instants bounding the tenant-local calendar day that contains `date`.
 *
 * "Today's collection" is a cash-reconciliation figure, so it has to follow the
 * school's timezone rather than the server's: at 01:00 in Asia/Dhaka the UTC
 * day is still yesterday, and a counter total that straddles the two cannot be
 * reconciled against the drawer.
 */
export function getTenantDayRange(
  date: Date,
  timezone?: string | null,
): { start: Date; end: Date } {
  const tz = timezone || DEFAULT_TENANT_SETTINGS.timezone;
  try {
    const { year, month, day } = getDateParts(date, tz);
    const wallMidnight = Date.UTC(Number(year), Number(month) - 1, Number(day));
    if (!Number.isFinite(wallMidnight)) throw new RangeError("unparseable date parts");
    // Two passes: the offset sampled at UTC midnight is wrong only for a local
    // midnight that crosses a DST transition, and the second pass corrects it.
    const firstPass = wallMidnight - timeZoneOffsetMs(new Date(wallMidnight), tz);
    const start = new Date(wallMidnight - timeZoneOffsetMs(new Date(firstPass), tz));
    return { start, end: new Date(start.getTime() + 86_400_000 - 1) };
  } catch {
    // Unknown timezone configured on the tenant: fall back to the UTC day
    // rather than throwing the whole report.
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    return { start, end: new Date(start.getTime() + 86_400_000 - 1) };
  }
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

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day <= daysInMonth;
}

function toISODate(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Parse a tenant-formatted date string back to ISO yyyy-mm-dd.
 * Returns "" for empty/invalid input (never throws). Defaults to DD/MM/YYYY.
 */
export function parseDateWithSettings(
  text: string,
  settings: Partial<TenantSettings> = DEFAULT_TENANT_SETTINGS
): string {
  const raw = (text ?? "").trim();
  if (!raw) return "";
  const dateFormat = settings.dateFormat || DEFAULT_TENANT_SETTINGS.dateFormat;

  const numeric = (s: string) => {
    const n = parseInt(s, 10);
    return isNaN(n) ? -1 : n;
  };

  let y = -1;
  let m = -1;
  let d = -1;

  if (dateFormat === "YYYY-MM-DD") {
    const parts = raw.split("-");
    if (parts.length !== 3) return "";
    y = numeric(parts[0]);
    m = numeric(parts[1]);
    d = numeric(parts[2]);
    if (parts[0].length !== 4) return "";
  } else if (dateFormat === "DD-MM-YYYY") {
    const parts = raw.split("-");
    if (parts.length !== 3) return "";
    d = numeric(parts[0]);
    m = numeric(parts[1]);
    y = numeric(parts[2]);
    if (parts[2].length !== 4) return "";
  } else if (dateFormat === "MM/DD/YYYY") {
    const parts = raw.split("/");
    if (parts.length !== 3) return "";
    m = numeric(parts[0]);
    d = numeric(parts[1]);
    y = numeric(parts[2]);
    if (parts[2].length !== 4) return "";
  } else {
    // DD/MM/YYYY (default)
    const parts = raw.split("/");
    if (parts.length !== 3) return "";
    d = numeric(parts[0]);
    m = numeric(parts[1]);
    y = numeric(parts[2]);
    if (parts[2].length !== 4) return "";
  }

  if (!isRealCalendarDate(y, m, d)) return "";
  return toISODate(y, m, d);
}

/**
 * Insert separators into a completed 8-digit run typed without separators
 * (e.g. "31122026" → "31/12/2026" under DD/MM/YYYY). Returns "" when the
 * run is not exactly 8 digits or the tenant format is not numeric-only
 * (month-name formats cannot be reconstructed from digits). Callers must
 * still validate the result with parseDateWithSettings — this only places
 * the separators, it never invents a valid date.
 */
export function formatDigitRunDate(
  digits: string,
  dateFormat?: string
): string {
  if (!/^\d{8}$/.test(digits)) return "";
  const format = dateFormat || DEFAULT_TENANT_SETTINGS.dateFormat;
  switch (format) {
    case "YYYY-MM-DD":
      return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    case "MM/DD/YYYY":
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
    case "DD-MM-YYYY":
      return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 8)}`;
    case "DD/MM/YYYY":
    default:
      // Unknown formats fall through only when they are slash-based numeric;
      // month-name formats return "" via the caller-free path below.
      if (format !== "DD/MM/YYYY" && /[A-Za-z]/.test(format)) return "";
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
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
