import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { defaultLocale, locales, type Locale } from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  // Priority: cookie > Accept-Language header > default
  let locale: Locale = defaultLocale;

  const cookieLocale = cookieStore.get("locale")?.value as Locale | undefined;
  if (cookieLocale && locales.includes(cookieLocale)) {
    locale = cookieLocale;
  } else {
    const acceptLanguage = headerStore.get("accept-language") ?? "";
    const browserLocale = acceptLanguage.split(",")[0]?.split("-")[0] as Locale;
    if (browserLocale && locales.includes(browserLocale)) {
      locale = browserLocale;
    }
  }

  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
    timeZone: "Asia/Dhaka",
  };
});
