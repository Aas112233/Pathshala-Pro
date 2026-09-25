import type { Metadata } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { GlobalActionGuard } from "@/components/providers/global-action-guard";
import { IdleSessionGuard } from "@/components/providers/idle-session-guard";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { TenantSettingsProvider } from "@/components/providers/tenant-settings-provider";
import { AcademicYearProvider } from "@/components/providers/academic-year-provider";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { UnsavedChangesProvider } from "@/providers/unsaved-changes-provider";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { PageTitleUpdater } from "@/components/layout/page-title-updater";
import { locales, isRtl } from "@/i18n/config";

const jakarta = localFont({
  src: [
    { path: "../../public/fonts/PlusJakartaSans-Variable.ttf", weight: "200 800", style: "normal" },
    { path: "../../public/fonts/PlusJakartaSans-Italic-Variable.ttf", weight: "200 800", style: "italic" },
  ],
  variable: "--font-jakarta-local",
  display: "swap",
  adjustFontFallback: false,
});

const bengali = localFont({
  src: "../../public/fonts/NotoSerifBengali-Variable.ttf",
  weight: "100 900",
  style: "normal",
  variable: "--font-bengali-local",
  display: "swap",
  adjustFontFallback: false,
  preload: false,
});

const hind = localFont({
  src: [
    { path: "../../public/fonts/HindSiliguri-Light.ttf", weight: "300", style: "normal" },
    { path: "../../public/fonts/HindSiliguri-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/HindSiliguri-Medium.ttf", weight: "500", style: "normal" },
    { path: "../../public/fonts/HindSiliguri-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../../public/fonts/HindSiliguri-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-hind-local",
  display: "swap",
  adjustFontFallback: false,
  preload: false,
});

const tiro = localFont({
  src: [
    { path: "../../public/fonts/TiroBangla-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/TiroBangla-Italic.ttf", weight: "400", style: "italic" },
  ],
  variable: "--font-tiro-local",
  display: "swap",
  adjustFontFallback: false,
  preload: false,
});

const anek = localFont({
  src: "../../public/fonts/AnekBangla-Variable.ttf",
  weight: "300 700",
  style: "normal",
  variable: "--font-anek-local",
  display: "swap",
  adjustFontFallback: false,
  preload: false,
});

const amiri = localFont({
  src: [
    { path: "../../public/fonts/Amiri-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/Amiri-Bold.ttf", weight: "700", style: "normal" },
    { path: "../../public/fonts/Amiri-Italic.ttf", weight: "400", style: "italic" },
  ],
  variable: "--font-amiri-local",
  display: "swap",
  adjustFontFallback: false,
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("layout");
  return {
    title: {
      default: t("title"),
      template: t("template"),
    },
    description: t("description"),
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let locale: string;
  try {
    locale = await getLocale();
  } catch {
    locale = "en";
  }

  if (!locales.includes(locale as any)) {
    notFound();
  }

  let messages: any;
  try {
    messages = await getMessages();
  } catch {
    messages = (await import(`../messages/${locale}.json`)).default;
  }

  const rtl = isRtl(locale as any);

  return (
    <html
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      suppressHydrationWarning
      className={cn(jakarta.variable, bengali.variable, hind.variable, tiro.variable, anek.variable, amiri.variable, "font-sans")}
    >
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider>
            <AuthProvider>
              <TenantSettingsProvider>
                <QueryProvider>
                  <GlobalActionGuard />
                  <IdleSessionGuard />
                  <AcademicYearProvider>
                    <ErrorBoundary>
                    <UnsavedChangesProvider>
                      <PageTitleUpdater />
                      {children}
                      <Toaster
                        richColors
                        position="top-right"
                        closeButton
                        duration={3500}
                        visibleToasts={3}
                      />
                    </UnsavedChangesProvider>
                    </ErrorBoundary>
                  </AcademicYearProvider>
                </QueryProvider>
              </TenantSettingsProvider>
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
