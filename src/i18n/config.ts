export const locales = ["en", "bn", "hi", "ur"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  bn: "বাংলা",
  hi: "हिन्दी",
  ur: "اردو",
};

export const rtlLocales: Locale[] = ["ur"];

export function isRtl(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}

export function getDirection(locale: Locale): "ltr" | "rtl" {
  return isRtl(locale) ? "rtl" : "ltr";
}
