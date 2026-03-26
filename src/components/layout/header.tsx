"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Bell, Search, Moon, Sun, Globe, LogOut, ChevronDown } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { useAuth } from "@/components/providers/auth-provider";

function getBreadcrumbKey(pathname: string): string {
  if (pathname === "/" || pathname === "/system-admin") return "nav.dashboard";
  
  const segments = pathname.split("/").filter(Boolean);
  const isSystemAdmin = segments[0] === "system-admin";
  const segment = isSystemAdmin ? (segments[1] || "dashboard") : segments[0];
  
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Get current locale from cookie on mount
  useEffect(() => {
    const cookieLocale = document.cookie
      .split("; ")
      .find(row => row.startsWith("locale="))
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

  const breadcrumbKey = getBreadcrumbKey(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      {/* Left - Breadcrumb */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-foreground">
          {t(breadcrumbKey as any) || t("nav.dashboard")}
        </h1>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Search className="h-4 w-4" />
        </button>

        {/* Locale Switcher */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setLocaleOpen(!localeOpen)}
            className={cn(
              "flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              localeOpen && "bg-accent"
            )}
            title={t("settings.language")}
          >
            <Globe className="h-4 w-4" />
            <span className="text-sm font-medium">{localeNames[currentLocale]}</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", localeOpen && "rotate-180")} />
          </button>
          {localeOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-popover p-1 shadow-lg">
              {locales.map((locale) => (
                <button
                  key={locale}
                  onClick={() => switchLocale(locale)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                    "text-popover-foreground",
                    currentLocale === locale && "bg-accent"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Globe className="h-4 w-4 opacity-70" />
                    {localeNames[locale]}
                  </span>
                  {currentLocale === locale && (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </button>

        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
        </button>

        {/* User Avatar */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
            title={user?.name || "User"}
          >
            {user?.name?.charAt(0) || "U"}
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-popover p-1 shadow-lg">
              <div className="border-b border-border px-3 py-2">
                <p className="text-sm font-medium text-foreground">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  logout();
                  setUserMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                <span>{t("auth.signOut")}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
