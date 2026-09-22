import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StudentStatus } from "@/types/entities";

interface StudentStatusBadgeProps {
  status: StudentStatus;
  className?: string;
}

export function StudentStatusBadge({ status, className }: StudentStatusBadgeProps) {
  const t = useTranslations("students");

  const labelMap: Record<StudentStatus, string> = {
    ACTIVE: t("active"),
    INACTIVE: t("inactive"),
    GRADUATED: t("graduated"),
    TRANSFERRED: t("transferred"),
  };

  return (
    <StatusBadge
      status={status}
      domain="student"
      label={labelMap[status] ?? t("active")}
      className={className}
    />
  );
}
