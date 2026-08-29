import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { TenantSettingsProvider } from "@/components/providers/tenant-settings-provider";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { PageTitleUpdater } from "@/components/layout/page-title-updater";
import { locales, isRtl } from "@/i18n/config";

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
      className={cn("font-sans")}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@100..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider>
            <AuthProvider>
              <TenantSettingsProvider>
                <QueryProvider>
                  <ErrorBoundary>
                    <PageTitleUpdater />
                    {children}
                    <Toaster richColors position="top-right" />
                  </ErrorBoundary>
                </QueryProvider>
              </TenantSettingsProvider>
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
