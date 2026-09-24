"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { safeTranslate, type Translator } from "@/lib/i18n-safe";

export function getPageTitle(pathname: string, t: Translator): string {
  if (!pathname || pathname === "/") {
    return safeTranslate(t, "nav.dashboard", "Dashboard");
  }

  if (pathname === "/login") {
    return safeTranslate(t, "auth.signInErp", "Login");
  }

  if (pathname === "/onboarding") {
    return safeTranslate(t, "onboarding.title", "Onboarding");
  }

  // Handle system admin routes
  if (pathname.startsWith("/system-admin")) {
    const subPath = pathname.replace("/system-admin", "").replace(/^\//, "");
    if (!subPath) {
      return safeTranslate(t, "systemAdmin.title", "System Admin");
    }
    if (subPath.startsWith("tenants")) {
      return safeTranslate(t, "systemAdmin.tenants", "Tenants");
    }
    if (subPath.startsWith("billing")) {
      return safeTranslate(t, "systemAdmin.billing", "Billing");
    }
    if (subPath.startsWith("feature-flags")) {
      return safeTranslate(t, "systemAdmin.featureFlags", "Feature Flags");
    }
    if (subPath.startsWith("audit-logs")) {
      return safeTranslate(t, "systemAdmin.auditLogs", "Audit Logs");
    }
    if (subPath.startsWith("users")) {
      return safeTranslate(t, "systemAdmin.users", "Platform Users");
    }
    if (subPath.startsWith("settings")) {
      return safeTranslate(t, "systemAdmin.settings", "Platform Settings");
    }
    return "System Administration";
  }

  // Handle specific dashboard sub-routes
  if (pathname === "/fees/collection") {
    return safeTranslate(t, "nav.feeCollection", "Single POS Counter");
  }

  if (pathname === "/fees/bulk") {
    return safeTranslate(t, "nav.bulkFeeCollection", "Bulk Class Fee Entry");
  }

  if (pathname === "/fees/collectors") {
    return safeTranslate(t, "nav.feeCollectors", "Fee Collectors");
  }

  if (pathname === "/accounting/deposits") {
    return safeTranslate(t, "nav.deposits", "Cash Deposits");
  }

  if (pathname === "/accounting/fee-heads") {
    return safeTranslate(t, "nav.feeHeadMappings", "Fee Head Accounting");
  }

  if (pathname.startsWith("/exams/results")) {
    return safeTranslate(t, "nav.examResults", "Exam Results");
  }

  if (pathname.startsWith("/exams/") && pathname !== "/exams") {
    return safeTranslate(t, "exams.editExam", "Edit Exam");
  }

  if (pathname.startsWith("/promotions/rules")) {
    return safeTranslate(t, "nav.promotionRules", "Promotion Rules");
  }

  if (pathname.startsWith("/promotions/calculate")) {
    return safeTranslate(t, "nav.promotions", "Promotions");
  }

  if (pathname.startsWith("/reports/")) {
    const reportType = pathname.split("/")[2];
    if (reportType) {
      const formatted = reportType.charAt(0).toUpperCase() + reportType.slice(1);
      return `${formatted} Report`;
    }
    return safeTranslate(t, "nav.reports", "Reports");
  }

  const segment = pathname.split("/").filter(Boolean)[0];

  const keyMap: Record<string, string> = {
    dashboard: "nav.dashboard",
    students: "nav.students",
    admissions: "nav.admissions",
    attendance: "nav.attendance",
    exams: "nav.exams",
    "exam-results": "nav.examResults",
    "academic-year": "nav.academicYear",
    fees: "nav.feeVouchers",
    transactions: "nav.transactions",
    staff: "nav.staff",
    salary: "nav.salaryPayroll",
    users: "nav.users",
    settings: "nav.settings",
    leaves: "nav.leaves",
    timetable: "nav.timetable",
    homework: "nav.homework",
    library: "nav.library",
    transport: "nav.transport",
    hostel: "nav.hostel",
    inventory: "nav.inventory",
    notices: "nav.notices",
    reports: "nav.reports",
    certificates: "nav.certificates",
    health: "nav.health",
    enquiries: "nav.enquiries",
    subjects: "nav.subjects",
    promotions: "nav.promotions",
  };

  if (segment && keyMap[segment]) {
    const translated = safeTranslate(t, keyMap[segment], "");
    if (translated) return translated;
  }

  if (segment) {
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  }

  return safeTranslate(t, "nav.dashboard", "Dashboard");
}

export function PageTitleUpdater() {
  const pathname = usePathname();
  const t = useTranslations();

  useEffect(() => {
    try {
      const pageTitle = getPageTitle(pathname, t as Translator);
      document.title = `${pageTitle} | Pathshala Pro`;
    } catch {
      document.title = "Pathshala Pro - School Management ERP";
    }
  }, [pathname, t]);

  return null;
}
