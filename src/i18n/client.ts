"use client";

import { useLocale } from "next-intl";
import { isRtl } from "@/i18n/config";

export function useTranslationsClient() {
  const locale = useLocale();
  const rtl = isRtl(locale as any);

  return {
    locale,
    rtl,
    dir: rtl ? "rtl" : "ltr",
  };
}
