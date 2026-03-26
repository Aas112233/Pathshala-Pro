import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { TenantSettingsProvider } from "@/components/providers/tenant-settings-provider";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { Toaster } from "sonner";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { locales, isRtl } from "@/i18n/config";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Pathshala Pro - School Management ERP",
  description:
    "Ultra-fast, multi-tenant school management SaaS for South Asian schools. Manage fees, students, staff, and academics.",
};

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
      className={cn("font-sans", geist.variable)}
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
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
