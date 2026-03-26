import type { NextIntlConfig } from "next-intl";

export default {
  locales: ["en", "bn", "hi", "ur"],
  defaultLocale: "en",
  localeCookie: "locale",
  localeDetection: true,
} satisfies NextIntlConfig;
