"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SIDEBAR_NAV, APP_NAME } from "@/lib/constants";
import { ChevronLeft, GraduationCap } from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const translations: Record<string, string> = {
  "nav.dashboard": "Dashboard",
  "nav.students": "Students",
  "nav.staff": "Staff",
  "nav.academicYear": "Academic Year",
  "nav.finance": "Finance",
  "nav.feeVouchers": "Fee Vouchers",
  "nav.transactions": "Transactions",
  "nav.salaryPayroll": "Salary",
  "nav.settings": "Settings",
  "nav.academics": "Academics",
  "nav.communication": "Communication",
  "nav.exams": "Exams",
  "nav.attendance": "Attendance",
  "nav.users": "Users",
  "nav.overview": "Overview",
  "nav.admissions": "Admissions",
  "nav.createAdmission": "Create Admission",
  "nav.academic": "Academics",
  "nav.academicSettings": "Academic Settings",
  "nav.classes": "Classes",
  "nav.groups": "Groups",
  "nav.sections": "Sections",
  "nav.hr": "HR & Staff",
  "nav.administration": "Administration",
};

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-4 w-4" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              {APP_NAME}
            </span>
          )}
        </Link>
        <button
          onClick={onToggle}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              collapsed && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {SIDEBAR_NAV.map((group) => (
          <div key={group.labelKey} className="mb-4">
            {!collapsed && (
              <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
                {translations[group.labelKey] || group.labelKey}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                const label = translations[item.titleKey] || item.titleKey;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                    title={collapsed ? label : undefined}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive
                          ? "text-primary"
                          : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
                      )}
                    />
                    {!collapsed && <span>{label}</span>}
                    {!collapsed && item.badge && (
                      <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <p className="text-xs text-sidebar-foreground/40">v0.1.0</p>
        )}
      </div>
    </aside>
  );
}
