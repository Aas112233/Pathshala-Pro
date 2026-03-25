"use client";

import { usePathname } from "next/navigation";
import { Bell, Search, Moon, Sun, Globe } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { useState, useRef, useEffect } from "react";

function getBreadcrumbKey(pathname: string): string {
  if (pathname === "/") return "nav.dashboard";
  const segment = pathname.split("/").filter(Boolean)[0];
  const keyMap: Record<string, string> = {
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
  };
  return keyMap[segment] ?? "nav.dashboard";
}

// Simple translation fallback
const translations: Record<string, string> = {
  "nav.dashboard": "Dashboard",
  "nav.students": "Students",
  "nav.attendance": "Attendance",
  "nav.exams": "Exams",
  "nav.academicYear": "Academic Year",
  "nav.feeVouchers": "Fee Vouchers",
  "nav.transactions": "Transactions",
  "nav.staff": "Staff",
  "nav.salaryPayroll": "Salary & Payroll",
  "nav.users": "Users",
  "nav.settings": "Settings",
  "settings.language": "Language",
};

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [localeOpen, setLocaleOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setLocaleOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function switchLocale(locale: Locale) {
    document.cookie = `locale=${locale};path=/;max-age=31536000`;
    setLocaleOpen(false);
    window.location.reload();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      {/* Left - Breadcrumb */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-foreground">
          {translations[getBreadcrumbKey(pathname)]}
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
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={translations["settings.language"]}
          >
            <Globe className="h-4 w-4" />
          </button>
          {localeOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-border bg-popover p-1 shadow-lg">
              {locales.map((locale) => (
                <button
                  key={locale}
                  onClick={() => switchLocale(locale)}
                  className={cn(
                    "flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                    "text-popover-foreground"
                  )}
                >
                  {localeNames[locale]}
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
        <button className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          A
        </button>
      </div>
    </header>
  );
}
