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
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const APP_NAME = "Pathshala Pro";
export const APP_DESCRIPTION = "School Management ERP System";

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  TEACHER: "TEACHER",
  CLERK: "CLERK",
} as const;

export const SIDEBAR_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Academic",
    items: [
      {
        title: "Students",
        href: "/students",
        icon: GraduationCap,
      },
      {
        title: "Attendance",
        href: "/attendance",
        icon: CalendarCheck,
      },
      {
        title: "Exams",
        href: "/exams",
        icon: BookOpen,
      },
      {
        title: "Academic Year",
        href: "/academic-year",
        icon: CalendarRange,
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        title: "Fee Vouchers",
        href: "/fees",
        icon: Receipt,
      },
      {
        title: "Fee Collection",
        href: "/fees/collection",
        icon: CreditCard,
      },
      {
        title: "Transactions",
        href: "/transactions",
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    label: "HR",
    items: [
      {
        title: "Staff",
        href: "/staff",
        icon: Users,
      },
      {
        title: "Salary / Payroll",
        href: "/salary",
        icon: Wallet,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Users",
        href: "/users",
        icon: UserCheck,
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
      },
    ],
  },
];

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "DIGITAL", label: "Digital" },
] as const;

export const VOUCHER_STATUSES = [
  { value: "PENDING", label: "Pending" },
  { value: "PARTIAL", label: "Partial" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export const STUDENT_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "GRADUATED", label: "Graduated" },
  { value: "TRANSFERRED", label: "Transferred" },
] as const;
