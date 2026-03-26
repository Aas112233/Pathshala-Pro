import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Receipt,
  CreditCard,
  ArrowLeftRight,
  UserCheck,
  Wallet,
  CalendarCheck,
  BookOpen,
  CalendarRange,
  Settings,
  School,
  Layers,
  ClipboardList,
  ClipboardCheck,
  FilePlus,
  TrendingUp,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  titleKey: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

export interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

export const APP_NAME = "Pathshala Pro";
export const APP_DESCRIPTION = "School Management ERP System";

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  TEACHER: "TEACHER",
  CLERK: "CLERK",
  STUDENT: "STUDENT",
  PRINCIPAL: "PRINCIPAL",
  MANAGER: "MANAGER",
  AUDITOR: "AUDITOR",
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
} as const;

export const SYSTEM_ADMIN_NAV: NavGroup[] = [
  {
    labelKey: "nav.overview",
    items: [
      {
        titleKey: "nav.dashboard",
        href: "/system-admin",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    labelKey: "systemAdmin.management",
    items: [
      {
        titleKey: "systemAdmin.tenants",
        href: "/system-admin/tenants",
        icon: School,
      },
      {
        titleKey: "systemAdmin.billing",
        href: "/system-admin/billing",
        icon: Receipt,
      },
    ],
  },
  {
    labelKey: "systemAdmin.system",
    items: [
      {
        titleKey: "nav.users",
        href: "/system-admin/users",
        icon: UserCheck,
      },
      {
        titleKey: "nav.settings",
        href: "/system-admin/settings",
        icon: Settings,
      },
    ],
  },
];

export const SIDEBAR_NAV: NavGroup[] = [
  {
    labelKey: "nav.overview",
    items: [
      {
        titleKey: "nav.dashboard",
        href: "/",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    labelKey: "nav.admissions",
    items: [
      {
        titleKey: "nav.createAdmission",
        href: "/admissions",
        icon: FilePlus,
      },
    ],
  },
  {
    labelKey: "nav.academic",
    items: [
      {
        titleKey: "nav.students",
        href: "/students",
        icon: GraduationCap,
      },
      {
        titleKey: "nav.attendance",
        href: "/attendance",
        icon: CalendarCheck,
      },
      {
        titleKey: "nav.exams",
        href: "/exams",
        icon: BookOpen,
      },
      {
        titleKey: "nav.examResults",
        href: "/exam-results",
        icon: ClipboardCheck,
      },
      {
        titleKey: "nav.promotions",
        href: "/promotions/calculate",
        icon: TrendingUp,
      },
      {
        titleKey: "nav.academicYear",
        href: "/academic-year",
        icon: CalendarRange,
      },
    ],
  },
  {
    labelKey: "nav.academicSettings",
    items: [
      {
        titleKey: "nav.classes",
        href: "/academic/classes",
        icon: School,
      },
      {
        titleKey: "nav.subjects",
        href: "/subjects",
        icon: BookOpen,
      },
      {
        titleKey: "nav.groups",
        href: "/academic/groups",
        icon: Layers,
      },
      {
        titleKey: "nav.sections",
        href: "/academic/sections",
        icon: ClipboardList,
      },
      {
        titleKey: "nav.promotionRules",
        href: "/promotions/rules",
        icon: Settings,
      },
    ],
  },
  {
    labelKey: "nav.finance",
    items: [
      {
        titleKey: "nav.feeVouchers",
        href: "/fees",
        icon: Receipt,
      },
      {
        titleKey: "nav.feeCollection",
        href: "/fees/collection",
        icon: CreditCard,
      },
      {
        titleKey: "nav.transactions",
        href: "/transactions",
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    labelKey: "nav.hr",
    items: [
      {
        titleKey: "nav.staff",
        href: "/staff",
        icon: Users,
      },
      {
        titleKey: "nav.salaryPayroll",
        href: "/salary",
        icon: Wallet,
      },
    ],
  },
  {
    labelKey: "nav.administration",
    items: [
      {
        titleKey: "nav.users",
        href: "/users",
        icon: UserCheck,
      },
      {
        titleKey: "nav.settings",
        href: "/settings",
        icon: Settings,
      },
    ],
  },
  {
    labelKey: "nav.reports",
    items: [
      {
        titleKey: "reports.overview",
        href: "/reports",
        icon: BarChart3,
      },
      {
        titleKey: "reports.feeReport.title",
        href: "/reports/fees",
        icon: Receipt,
      },
      {
        titleKey: "reports.attendanceReport.title",
        href: "/reports/attendance",
        icon: CalendarCheck,
      },
      {
        titleKey: "reports.studentReport.title",
        href: "/reports/students",
        icon: GraduationCap,
      },
      {
        titleKey: "reports.examReport.title",
        href: "/reports/exams",
        icon: BookOpen,
      },
    ],
  },
];

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const PAYMENT_METHODS = [
  { value: "CASH", labelKey: "collection.cash" },
  { value: "DIGITAL", labelKey: "collection.digital" },
] as const;

export const VOUCHER_STATUSES = [
  { value: "PENDING", labelKey: "fees.pending" },
  { value: "PARTIAL", labelKey: "fees.partial" },
  { value: "PAID", labelKey: "fees.paid" },
  { value: "OVERDUE", labelKey: "fees.overdue" },
  { value: "CANCELLED", labelKey: "common.cancel" },
] as const;

export const STUDENT_STATUSES = [
  { value: "ACTIVE", labelKey: "common.active" },
  { value: "INACTIVE", labelKey: "common.inactive" },
  { value: "GRADUATED", labelKey: "students.graduated" },
  { value: "TRANSFERRED", labelKey: "students.transferred" },
] as const;
