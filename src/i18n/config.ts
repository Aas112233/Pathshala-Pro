export const locales = ["en", "bn", "hi", "ur"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  bn: "Bengali",
  hi: "Hindi",
  ur: "Urdu",
};

export const rtlLocales: Locale[] = ["ur"];

export function isRtl(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}
