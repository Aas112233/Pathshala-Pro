"use client";

import { useTranslations } from "next-intl";
import { MoreVertical, Pencil, Trash2, Eye, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SalaryLedger } from "@/types/entities";

interface SalaryActionsDropdownProps {
  salary: SalaryLedger;
  onEdit?: (salary: SalaryLedger) => void;
  onView?: (salary: SalaryLedger) => void;
  onDelete?: (salary: SalaryLedger) => void;
  onPayment?: (salary: SalaryLedger) => void;
  onGenerateSlip?: (salary: SalaryLedger) => void;
}

export function SalaryActionsDropdown({
  salary,
  onEdit,
  onView,
  onDelete,
  onPayment,
  onGenerateSlip,
}: SalaryActionsDropdownProps) {
  const t = useTranslations("salary");

  const isPaid = salary.status === "PAID" || salary.status === "PARTIAL";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("ui.actions.aria")}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        {onView && (
          <DropdownMenuItem onSelect={() => onView(salary)}>
            <Eye className="h-4 w-4" />
            <span>{t("ui.actions.viewDetails")}</span>
          </DropdownMenuItem>
        )}
        {onEdit && !isPaid && (
          <DropdownMenuItem onSelect={() => onEdit(salary)}>
            <Pencil className="h-4 w-4" />
            <span>{t("ui.actions.edit")}</span>
          </DropdownMenuItem>
        )}
        {onPayment && !isPaid && (
          <DropdownMenuItem
            className="text-[var(--status-success-text)] focus:bg-[var(--status-success-bg)] focus:text-[var(--status-success-text)]"
            onSelect={() => onPayment(salary)}
          >
            <FileText className="h-4 w-4" />
            <span>{t("ui.actions.recordPayment")}</span>
          </DropdownMenuItem>
        )}
        {onGenerateSlip && (
          <DropdownMenuItem onSelect={() => onGenerateSlip(salary)}>
            <FileText className="h-4 w-4" />
            <span>{t("ui.actions.downloadSlip")}</span>
          </DropdownMenuItem>
        )}
        {onDelete && !isPaid && (
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(salary)}>
            <Trash2 className="h-4 w-4" />
            <span>{t("ui.actions.delete")}</span>
          </DropdownMenuItem>
        )}
        {isPaid && (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-[var(--status-warning-text)]">
              {t("ui.actions.locked")}
            </span>{" "}
            - {t("ui.actions.paidLocked")}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
