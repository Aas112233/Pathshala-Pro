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
};

function getDateParts(date: Date | string, timezone: string) {
  const value = typeof date === "string" ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(value);
  const find = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: find("year"),
    month: find("month"),
    day: find("day"),
  };
}

export function formatDateWithSettings(
  date: Date | string,
  settings: Partial<TenantSettings> = DEFAULT_TENANT_SETTINGS
) {
  const timezone = settings.timezone || DEFAULT_TENANT_SETTINGS.timezone;
  const dateFormat = settings.dateFormat || DEFAULT_TENANT_SETTINGS.dateFormat;
  const { year, month, day } = getDateParts(date, timezone);

  switch (dateFormat) {
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    case "DD-MM-YYYY":
      return `${day}-${month}-${year}`;
    case "DD/MM/YYYY":
    default:
      return `${day}/${month}/${year}`;
  }
}

export function formatDateTimeWithSettings(
  date: Date | string,
  settings: Partial<TenantSettings> = DEFAULT_TENANT_SETTINGS
) {
  const timezone = settings.timezone || DEFAULT_TENANT_SETTINGS.timezone;
  const timeFormat = settings.timeFormat || DEFAULT_TENANT_SETTINGS.timeFormat;
  const datePart = formatDateWithSettings(date, settings);
  const value = typeof date === "string" ? new Date(date) : date;
  const timePart = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: timeFormat === "12h",
  }).format(value);

  return `${datePart} ${timePart}`;
}

export function formatCurrencyWithSettings(
  amount: number,
  settings: Partial<TenantSettings> = DEFAULT_TENANT_SETTINGS
) {
  const symbol = settings.currencySymbol || DEFAULT_TENANT_SETTINGS.currencySymbol;
  const formattedAmount = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `${symbol}${formattedAmount}`;
}
