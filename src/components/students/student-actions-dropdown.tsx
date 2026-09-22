"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MoreVertical, Pencil, Trash2, Eye, TrendingUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StudentProfile } from "@/types/entities";

interface StudentActionsDropdownProps {
  student: StudentProfile;
  onEdit?: (student: StudentProfile) => void;
  onView?: (student: StudentProfile) => void;
  onViewPerformance?: (student: StudentProfile) => void;
  onDelete?: (student: StudentProfile) => void;
}

export function StudentActionsDropdown({
  student,
  onEdit,
  onView,
  onViewPerformance,
  onDelete,
}: StudentActionsDropdownProps) {
  const t = useTranslations("students");
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("actions.studentActions")}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        {onView && (
          <DropdownMenuItem onSelect={() => onView(student)}>
            <Eye className="h-4 w-4" />
            <span>{t("actions.viewDetails")}</span>
          </DropdownMenuItem>
        )}
        {onViewPerformance && (
          <DropdownMenuItem onSelect={() => onViewPerformance(student)}>
            <TrendingUp className="h-4 w-4 text-primary" />
            <span>{t("actions.viewPerformance")}</span>
          </DropdownMenuItem>
        )}
        {onEdit && (
          <DropdownMenuItem onSelect={() => onEdit(student)}>
            <Pencil className="h-4 w-4" />
            <span>{t("actions.edit")}</span>
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem
            variant="destructive"
            disabled={isDeleting}
            onSelect={async (event) => {
              event.preventDefault();
              setIsDeleting(true);
              try {
                await onDelete(student);
              } finally {
                setIsDeleting(false);
              }
            }}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span>{isDeleting ? t("actions.deleting") : t("actions.delete")}</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
