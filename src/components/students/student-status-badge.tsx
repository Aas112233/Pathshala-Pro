import { cn } from "@/lib/utils";
import type { StudentStatus } from "@/types/entities";

interface StudentStatusBadgeProps {
  status: StudentStatus;
  className?: string;
}

const statusConfig: Record<StudentStatus, { label: string; variant: string }> = {
  ACTIVE: { label: "Active", variant: "success" },
  INACTIVE: { label: "Inactive", variant: "secondary" },
  GRADUATED: { label: "Graduated", variant: "info" },
  TRANSFERRED: { label: "Transferred", variant: "warning" },
};

export function StudentStatusBadge({ status, className }: StudentStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.ACTIVE;

  const variantClasses = {
    success: "bg-green-100 text-green-800 border-green-200",
    secondary: "bg-gray-100 text-gray-800 border-gray-200",
    info: "bg-blue-100 text-blue-800 border-blue-200",
    warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantClasses[config.variant as keyof typeof variantClasses],
        className
      )}
    >
      {config.label}
    </span>
  );
}
