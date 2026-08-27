/**
 * Comprehensive Currency Registry & Formatting
 * Central source of truth for all currencies, symbols, codes, and formatting.
 * Zero hardcoded currency logic.
 */

export interface CurrencyDefinition {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  symbolPosition: "prefix" | "suffix";
  spacing: boolean;
  countries: string[];
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyDefinition> = {
  BDT: {
    code: "BDT",
    name: "Bangladeshi Taka",
    symbol: "৳",
    decimals: 2,
    symbolPosition: "prefix",
    spacing: true,
    countries: ["BD"],
  },
  PKR: {
    code: "PKR",
    name: "Pakistani Rupee",
    symbol: "₨",
    decimals: 2,
    symbolPosition: "prefix",
    spacing: true,
    countries: ["PK"],
  },
  INR: {
    code: "INR",
    name: "Indian Rupee",
    symbol: "₹",
    decimals: 2,
    symbolPosition: "prefix",
    spacing: true,
    countries: ["IN"],
  },
  USD: {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    decimals: 2,
    symbolPosition: "prefix",
    spacing: false,
    countries: ["US"],
  },
  EUR: {
    code: "EUR",
    name: "Euro",
    symbol: "€",
    decimals: 2,
    symbolPosition: "prefix",
    spacing: true,
    countries: ["EU", "DE", "FR", "IT", "ES"],
  },
  GBP: {
    code: "GBP",
    name: "British Pound",
    symbol: "£",
    decimals: 2,
    symbolPosition: "prefix",
    spacing: false,
    countries: ["GB"],
  },
  AED: {
    code: "AED",
    name: "UAE Dirham",
    symbol: "د.إ",
    decimals: 2,
    symbolPosition: "prefix",
    spacing: true,
    countries: ["AE"],
  },
  SAR: {
    code: "SAR",
    name: "Saudi Riyal",
    symbol: "﷼",
    decimals: 2,
    symbolPosition: "prefix",
    spacing: true,
    countries: ["SA"],
  },
  CAD: {
    code: "CAD",
    name: "Canadian Dollar",
    symbol: "CA$",
    decimals: 2,
    symbolPosition: "prefix",
    spacing: false,
    countries: ["CA"],
  },
  AUD: {
    code: "AUD",
    name: "Australian Dollar",
    symbol: "AU$",
    decimals: 2,
    symbolPosition: "prefix",
    spacing: false,
    countries: ["AU"],
  },
  QAR: {
    code: "QAR",
    name: "Qatari Riyal",
    symbol: "QR",
    decimals: 2,
    symbolPosition: "prefix",
    spacing: true,
    countries: ["QA"],
  },
  KWD: {
    code: "KWD",
    name: "Kuwaiti Dinar",
    symbol: "KD",
    decimals: 3,
    symbolPosition: "prefix",
    spacing: true,
    countries: ["KW"],
  },
  OMR: {
    code: "OMR",
    name: "Omani Rial",
    symbol: "OMR",
    decimals: 3,
    symbolPosition: "prefix",
    spacing: true,
    countries: ["OM"],
  },
  BHD: {
    code: "BHD",
    name: "Bahraini Dinar",
    symbol: "BD",
    decimals: 3,
    symbolPosition: "prefix",
    spacing: true,
    countries: ["BH"],
  },
  MYR: {
    code: "MYR",
    name: "Malaysian Ringgit",
    symbol: "RM",
    decimals: 2,
    symbolPosition: "prefix",
    spacing: true,
    countries: ["MY"],
  },
  SGD: {
    code: "SGD",
    name: "Singapore Dollar",
    symbol: "SG$",
    decimals: 2,
    symbolPosition: "prefix",
    spacing: false,
    countries: ["SG"],
  },
  TRY: {
    code: "TRY",
    name: "Turkish Lira",
    symbol: "₺",
    decimals: 2,
    symbolPosition: "prefix",
    spacing: true,
    countries: ["TR"],
  },
};

export const CURRENCY_LIST = Object.values(SUPPORTED_CURRENCIES);
export const CURRENCIES = CURRENCY_LIST;

export function getCurrencyInfo(code: string): CurrencyDefinition {
  const upper = (code || "").toUpperCase();
  return (
    SUPPORTED_CURRENCIES[upper] || {
      code: upper || "BDT",
      name: upper || "Currency",
      symbol: upper || "৳",
      decimals: 2,
      symbolPosition: "prefix",
      spacing: true,
      countries: [],
    }
  );
}

export interface FormatCurrencyOptions {
  currencyCode?: string;
  symbolOverride?: string;
  decimals?: number;
  compact?: boolean;
  showCode?: boolean;
}

/**
 * Formats a monetary number into a localized string with correct currency symbol and position.
 */
export function formatCurrencyValue(
  amount: number,
  options: FormatCurrencyOptions = {}
): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    amount = 0;
  }

  const {
    currencyCode = "BDT",
    symbolOverride,
    decimals,
    compact = false,
    showCode = false,
  } = options;

  const info = getCurrencyInfo(currencyCode);
  const symbol = symbolOverride !== undefined ? symbolOverride : info.symbol;
  const dec = decimals !== undefined ? decimals : info.decimals;

  if (compact) {
    return formatCompactCurrencyValue(amount, {
      ...options,
      currencyCode,
      symbolOverride: symbol,
    });
  }

  const formattedNum = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : dec,
    maximumFractionDigits: dec,
  }).format(amount);

  const space = info.spacing ? " " : "";

  let result =
    info.symbolPosition === "suffix"
      ? `${formattedNum}${space}${symbol}`
      : `${symbol}${space}${formattedNum}`;

  if (showCode && currencyCode) {
    result += ` (${currencyCode})`;
  }

  return result;
}

/**
 * Compact currency formatter (e.g. ₨ 4.85M, $ 120K, ৳ 1.5M)
 */
export function formatCompactCurrencyValue(
  amount: number,
  options: FormatCurrencyOptions = {}
): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    amount = 0;
  }

  const { currencyCode = "BDT", symbolOverride } = options;
  const info = getCurrencyInfo(currencyCode);
  const symbol = symbolOverride !== undefined ? symbolOverride : info.symbol;
  const space = info.spacing ? " " : "";

  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  let formatted = "";
  if (abs >= 1_000_000_000) {
    formatted = parseFloat((abs / 1_000_000_000).toFixed(2)).toString() + "B";
  } else if (abs >= 1_000_000) {
    formatted = parseFloat((abs / 1_000_000).toFixed(2)).toString() + "M";
  } else if (abs >= 1_000) {
    formatted = parseFloat((abs / 1_000).toFixed(1)).toString() + "K";
  } else {
    formatted = parseFloat(abs.toFixed(info.decimals)).toString();
  }

  return info.symbolPosition === "suffix"
    ? `${sign}${formatted}${space}${symbol}`
    : `${sign}${symbol}${space}${formatted}`;
}
