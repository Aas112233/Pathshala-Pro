import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  GraduationCap,
  Landmark,
  Receipt,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon per report id.
 *
 * Shared by the hub cards and the per-report access guard so the "not available
 * for your role" state keeps the same visual identity as the card the user
 * clicked. Kept out of `report-registry.ts` so that module stays free of UI
 * dependencies and can be imported by tests and server code.
 */
export const REPORT_ICON: Record<string, LucideIcon> = {
  fees: Receipt,
  salary: Wallet,
  financial: Landmark,
  admissions: UserPlus,
  attendance: CalendarCheck,
  students: GraduationCap,
  exams: BookOpen,
};

export const DEFAULT_REPORT_ICON: LucideIcon = BarChart3;

export function reportIcon(reportId: string): LucideIcon {
  return REPORT_ICON[reportId] ?? DEFAULT_REPORT_ICON;
}
