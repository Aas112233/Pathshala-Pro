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
  Landmark,
  ShieldAlert,
  DollarSign,
  Megaphone,
  Flag,
  Radio,
  FileSpreadsheet,
  Library,
  Bus,
  UserPlus,
  ClipboardPen,
  CalendarOff,
  Package,
  BedDouble,
  Award,
  HeartPulse,
  FileQuestion,
  Database,
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
  PRINCIPAL: "PRINCIPAL",
  MANAGER: "MANAGER",
  ACCOUNTANT: "ACCOUNTANT",
  TEACHER: "TEACHER",
  CLERK: "CLERK",
  AUDITOR: "AUDITOR",
  PARENT: "PARENT",
  STUDENT: "STUDENT",
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
        titleKey: "systemAdmin.broadcasts",
        href: "/system-admin/notices",
        icon: Megaphone,
      },
      {
        titleKey: "systemAdmin.featureFlags",
        href: "/system-admin/feature-flags",
        icon: Flag,
      },
      {
        titleKey: "systemAdmin.auditLogs",
        href: "/system-admin/audit-logs",
        icon: ShieldAlert,
      },
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
    labelKey: "nav.studentsAndAdmissions",
    items: [
      {
        titleKey: "nav.admissions",
        href: "/admissions",
        icon: UserPlus,
      },
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
        titleKey: "nav.certificates",
        href: "/certificates",
        icon: Award,
      },
    ],
  },
  {
    labelKey: "nav.academicTeaching",
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
        titleKey: "nav.timetable",
        href: "/timetable",
        icon: CalendarRange,
      },
      {
        titleKey: "nav.homework",
        href: "/homework",
        icon: ClipboardPen,
      },
      {
        titleKey: "nav.leaves",
        href: "/leaves",
        icon: CalendarOff,
      },
    ],
  },
  {
    labelKey: "nav.examinations",
    items: [
      {
        titleKey: "nav.exams",
        href: "/exams",
        icon: BookOpen,
      },
      {
        titleKey: "nav.questionPapers",
        href: "/exams/question-papers",
        icon: FileQuestion,
      },
      {
        titleKey: "nav.questionBank",
        href: "/exams/question-bank",
        icon: Database,
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
        titleKey: "nav.feeCollection",
        href: "/fees/collection",
        icon: CreditCard,
      },
      {
        titleKey: "nav.bulkFeeCollection",
        href: "/fees/bulk",
        icon: Users,
      },
      {
        titleKey: "nav.feeVouchers",
        href: "/fees",
        icon: Receipt,
      },
      {
        titleKey: "nav.feeStructures",
        href: "/fees/structures",
        icon: Layers,
      },
      {
        titleKey: "nav.transactions",
        href: "/transactions",
        icon: ArrowLeftRight,
      },
      {
        titleKey: "nav.expenses",
        href: "/accounting/expenses",
        icon: Wallet,
      },
      {
        titleKey: "nav.bankAccounts",
        href: "/accounting/accounts",
        icon: Landmark,
      },
      {
        titleKey: "nav.profitLoss",
        href: "/accounting/profit-loss",
        icon: BarChart3,
      },
      {
        titleKey: "nav.statements",
        href: "/accounting/statements",
        icon: FileSpreadsheet,
      },
      {
        titleKey: "nav.feeHeadMappings",
        href: "/accounting/fee-heads",
        icon: Landmark,
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
    labelKey: "nav.campusFacilities",
    items: [
      {
        titleKey: "nav.transport",
        href: "/transport",
        icon: Bus,
      },
      {
        titleKey: "nav.library",
        href: "/library",
        icon: Library,
      },
      {
        titleKey: "nav.hostel",
        href: "/hostel",
        icon: BedDouble,
      },
      {
        titleKey: "nav.inventory",
        href: "/inventory",
        icon: Package,
      },
      {
        titleKey: "nav.health",
        href: "/health",
        icon: HeartPulse,
      },
    ],
  },
  {
    labelKey: "nav.reportsAndNotices",
    items: [
      {
        titleKey: "nav.notices",
        href: "/notices",
        icon: Megaphone,
      },
      {
        titleKey: "nav.reports",
        href: "/reports",
        icon: BarChart3,
      },
    ],
  },
  {
    labelKey: "nav.systemSettings",
    items: [
      {
        titleKey: "nav.academicYear",
        href: "/academic-year",
        icon: CalendarRange,
      },
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
];

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const PAYMENT_METHODS = [
  { value: "CASH", labelKey: "collection.cash" },
  { value: "BANK_TRANSFER", labelKey: "collection.bankTransfer" },
  { value: "POS_CARD", labelKey: "collection.posCard" },
  { value: "DIGITAL", labelKey: "collection.digital" },
  { value: "CHEQUE", labelKey: "collection.cheque" },
  { value: "EASYPAISA", labelKey: "collection.easypaisa" },
  { value: "JAZZCASH", labelKey: "collection.jazzcash" },
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

export const ACADEMIC_MONTHS = [
  { value: 1, index: 0, key: "january", label: "January", shortLabel: "Jan" },
  { value: 2, index: 1, key: "february", label: "February", shortLabel: "Feb" },
  { value: 3, index: 2, key: "march", label: "March", shortLabel: "Mar" },
  { value: 4, index: 3, key: "april", label: "April", shortLabel: "Apr" },
  { value: 5, index: 4, key: "may", label: "May", shortLabel: "May" },
  { value: 6, index: 5, key: "june", label: "June", shortLabel: "Jun" },
  { value: 7, index: 6, key: "july", label: "July", shortLabel: "Jul" },
  { value: 8, index: 7, key: "august", label: "August", shortLabel: "Aug" },
  { value: 9, index: 8, key: "september", label: "September", shortLabel: "Sep" },
  { value: 10, index: 9, key: "october", label: "October", shortLabel: "Oct" },
  { value: 11, index: 10, key: "november", label: "November", shortLabel: "Nov" },
  { value: 12, index: 11, key: "december", label: "December", shortLabel: "Dec" },
] as const;

export const MONTH_NAMES = ACADEMIC_MONTHS.map((m) => m.label);
export const SHORT_MONTH_NAMES = ACADEMIC_MONTHS.map((m) => m.shortLabel);

export function getMonthName(month: number | string): string {
  const num = typeof month === "string" ? parseInt(month, 10) : month;
  if (num >= 1 && num <= 12) return ACADEMIC_MONTHS[num - 1].label;
  if (num >= 0 && num <= 11) return ACADEMIC_MONTHS[num].label;
  return String(month || "");
}

export function getShortMonthName(month: number | string): string {
  const num = typeof month === "string" ? parseInt(month, 10) : month;
  if (num >= 1 && num <= 12) return ACADEMIC_MONTHS[num - 1].shortLabel;
  if (num >= 0 && num <= 11) return ACADEMIC_MONTHS[num].shortLabel;
  return String(month || "");
}

