"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Moon,
  Sun,
  Globe,
  LogOut,
  ChevronDown,
  Building2,
  Shield,
  ShieldAlert,
  Check,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { useAuth } from "@/components/providers/auth-provider";
import { useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { HeaderNotificationCenter } from "@/components/layout/header-notification-center";

function getBreadcrumbKey(pathname: string): string {
  if (pathname === "/" || pathname === "/system-admin") return "nav.dashboard";

  const segments = pathname.split("/").filter(Boolean);
  const isSystemAdmin = segments[0] === "system-admin";
  const segment = isSystemAdmin ? segments[1] || "dashboard" : segments[0];

  const keyMap: Record<string, string> = {
    dashboard: "nav.dashboard",
    students: "nav.students",
    attendance: "nav.attendance",
    exams: "nav.exams",
    "academic-year": "nav.academicYear",
    fees: "nav.feeVouchers",
    transactions: "nav.transactions",
    staff: "nav.staff",
    salary: "nav.salaryPayroll",
    users: "nav.users",
    settings: "nav.settings",
    tenants: "systemAdmin.tenants",
    billing: "systemAdmin.billing",
  };
  return keyMap[segment] ?? "nav.dashboard";
}

export function Header() {
  const pathname = usePathname();
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [localeOpen, setLocaleOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [currentLocale, setCurrentLocale] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get current locale from cookie on mount
  useEffect(() => {
    const cookieLocale = document.cookie
      .split("; ")
      .find((row) => row.startsWith("locale="))
      ?.split("=")[1] as Locale | undefined;
    if (cookieLocale && locales.includes(cookieLocale)) {
      setCurrentLocale(cookieLocale);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setLocaleOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function switchLocale(locale: Locale) {
    document.cookie = `locale=${locale};path=/;max-age=31536000`;
    setCurrentLocale(locale);
    setLocaleOpen(false);
    window.location.reload();
  }

  const { settings } = useTenantSettings();
  const institutionName = settings?.name?.trim() || (user as any)?.tenant?.name || "Pathshala Pro";
  const breadcrumbKey = getBreadcrumbKey(pathname);
  const userRole = user?.role ? user.role.replace("_", " ") : "ADMINISTRATOR";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/95 px-6 backdrop-blur-md">
      {/* Left - Module & Breadcrumb Context */}
      <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
        <div className="hidden sm:flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary w-fit max-w-full">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="whitespace-nowrap tracking-tight">{institutionName}</span>
        </div>
        <div className="h-4 w-[1px] bg-border/80 hidden sm:block shrink-0" />
        <h1 className="text-base font-bold tracking-tight text-foreground whitespace-nowrap">
          {t(breadcrumbKey as any) || t("nav.dashboard")}
        </h1>
      </div>

      {/* Right - Global Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Categorized Notifications Center */}
        <HeaderNotificationCenter />

        {/* Locale Switcher */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setLocaleOpen(!localeOpen)}
            className={cn(
              "flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              localeOpen && "bg-muted text-foreground"
            )}
            title={t("settings.language")}
          >
            <Globe className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">{localeNames[currentLocale]}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", localeOpen && "rotate-180")} />
          </button>
          {localeOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-border/80 bg-popover p-1 shadow-xl z-50 animate-in fade-in-50 zoom-in-95">
              {locales.map((locale) => (
                <button
                  key={locale}
                  onClick={() => switchLocale(locale)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:bg-accent",
                    "text-popover-foreground",
                    currentLocale === locale && "bg-accent font-semibold"
                  )}
                >
                  <span>{localeNames[locale]}</span>
                  {currentLocale === locale && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={t("header.theme.toggle")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </button>

        {/* Separator */}
        <div className="h-6 w-[1px] bg-border/80 mx-0.5 hidden sm:block" />

        {/* User Profile Pill (Cloudvira & Semper Fi style) */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border border-border/60 bg-card px-2 py-1.5 text-left transition-all hover:bg-muted/60",
              userMenuOpen && "bg-muted"
            )}
          >
            <div className="relative">
              <div
                suppressHydrationWarning
                className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-xs"
              >
                {mounted && user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
            </div>
            <div className="hidden lg:flex flex-col">
              <span suppressHydrationWarning className="text-xs font-semibold text-foreground leading-tight">
                {mounted && user?.name ? user.name : t("header.user.fallbackName")}
              </span>
              <span suppressHydrationWarning className="text-[10px] font-medium text-muted-foreground capitalize">
                {mounted && userRole ? userRole.toLowerCase() : t("header.user.fallbackRole").toLowerCase()}
              </span>
            </div>
            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", userMenuOpen && "rotate-180")} />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-border/80 bg-popover p-1.5 shadow-xl z-50 animate-in fade-in-50 zoom-in-95">
              <div className="border-b border-border/60 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold tracking-wide text-foreground">
                    {userRole}
                  </span>
                </div>
                <p className="text-xs font-semibold text-foreground mt-1 truncate">
                  {user?.name}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <div className="py-1">
                {(user?.role === "SYSTEM_ADMIN" || !!(user as any)?.impersonatedBy) && (
                  <Link
                    href="/system-admin"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>{t("header.systemAdmin.label")}</span>
                  </Link>
                )}

                <button
                  onClick={() => {
                    logout();
                    setUserMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>{t("auth.signOut")}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
