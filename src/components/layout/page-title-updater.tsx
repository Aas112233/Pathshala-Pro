"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export function getPageTitle(pathname: string, t: any): string {
  if (!pathname || pathname === "/") {
    try {
      return t("nav.dashboard") || "Dashboard";
    } catch {
      return "Dashboard";
    }
  }

  if (pathname === "/login") {
    try {
      return t("auth.signInErp") || "Login";
    } catch {
      return "Login";
    }
  }

  if (pathname === "/onboarding") {
    try {
      return t("onboarding.title") || "Onboarding";
    } catch {
      return "Onboarding";
    }
  }

  // Handle system admin routes
  if (pathname.startsWith("/system-admin")) {
    const subPath = pathname.replace("/system-admin", "").replace(/^\//, "");
    if (!subPath) {
      try {
        return t("systemAdmin.title") || "System Admin";
      } catch {
        return "System Admin";
      }
    }
    if (subPath.startsWith("tenants")) {
      try {
        return t("systemAdmin.tenants") || "Tenants";
      } catch {
        return "Tenants";
      }
    }
    if (subPath.startsWith("billing")) {
      try {
        return t("systemAdmin.billing") || "Billing";
      } catch {
        return "Billing";
      }
    }
    if (subPath.startsWith("feature-flags")) {
      try {
        return t("systemAdmin.featureFlags") || "Feature Flags";
      } catch {
        return "Feature Flags";
      }
    }
    if (subPath.startsWith("audit-logs")) {
      try {
        return t("systemAdmin.auditLogs") || "Audit Logs";
      } catch {
        return "Audit Logs";
      }
    }
    if (subPath.startsWith("users")) {
      try {
        return t("systemAdmin.users") || "Platform Users";
      } catch {
        return "Platform Users";
      }
    }
    if (subPath.startsWith("settings")) {
      try {
        return t("systemAdmin.settings") || "Platform Settings";
      } catch {
        return "Platform Settings";
      }
    }
    return "System Administration";
  }

  // Handle specific dashboard sub-routes
  if (pathname === "/fees/collection") {
    try {
      return t("nav.feeCollection") || "Single POS Counter";
    } catch {
      return "Single POS Counter";
    }
  }

  if (pathname === "/fees/bulk") {
    try {
      return t("nav.bulkFeeCollection") || "Bulk Class Fee Entry";
    } catch {
      return "Bulk Class Fee Entry";
    }
  }

  if (pathname === "/accounting/fee-heads") {
    try {
      return t("nav.feeHeadMappings") || "Fee Head Accounting";
    } catch {
      return "Fee Head Accounting";
    }
  }

  if (pathname.startsWith("/exams/results")) {
    try {
      return t("nav.examResults") || "Exam Results";
    } catch {
      return "Exam Results";
    }
  }

  if (pathname.startsWith("/exams/") && pathname !== "/exams") {
    try {
      return t("exams.editExam") || "Edit Exam";
    } catch {
      return "Edit Exam";
    }
  }

  if (pathname.startsWith("/promotions/rules")) {
    try {
      return t("nav.promotionRules") || "Promotion Rules";
    } catch {
      return "Promotion Rules";
    }
  }

  if (pathname.startsWith("/promotions/calculate")) {
    try {
      return t("nav.promotions") || "Promotions";
    } catch {
      return "Promotions";
    }
  }

  if (pathname.startsWith("/reports/")) {
    const reportType = pathname.split("/")[2];
    if (reportType) {
      const formatted = reportType.charAt(0).toUpperCase() + reportType.slice(1);
      return `${formatted} Report`;
    }
    try {
      return t("nav.reports") || "Reports";
    } catch {
      return "Reports";
    }
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
    try {
      const translated = t(keyMap[segment]);
      if (translated) return translated;
    } catch {
      // Fallback below
    }
  }

  if (segment) {
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  }

  try {
    return t("nav.dashboard") || "Dashboard";
  } catch {
    return "Dashboard";
  }
}

export function PageTitleUpdater() {
  const pathname = usePathname();
  const t = useTranslations();

  useEffect(() => {
    try {
      const pageTitle = getPageTitle(pathname, t);
      document.title = `${pageTitle} | Pathshala Pro`;
    } catch {
      document.title = "Pathshala Pro - School Management ERP";
    }
  }, [pathname, t]);

  return null;
}
