"use client";

import { useTranslations } from "next-intl";
import { MoreVertical, Pencil, Trash2, Eye, FileText, CheckCircle2, XCircle } from "lucide-react";
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
  onApprove?: (salary: SalaryLedger) => void;
  onReject?: (salary: SalaryLedger) => void;
}

export function SalaryActionsDropdown({
  salary,
  onEdit,
  onView,
  onDelete,
  onPayment,
  onGenerateSlip,
  onApprove,
  onReject,
}: SalaryActionsDropdownProps) {
  const t = useTranslations("salary");

  const isPaid = salary.status === "PAID";
  const isApproved = salary.status === "APPROVED";
  const isPending = salary.status === "PENDING" || salary.status === "PENDING_APPROVAL";
  const isRejected = salary.status === "REJECTED";

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
        {onApprove && isPending && (
          <DropdownMenuItem
            className="text-emerald-600 focus:bg-emerald-50 focus:text-emerald-700 dark:focus:bg-emerald-950/40"
            onSelect={() => onApprove(salary)}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{t("approvals.quickApprove")}</span>
          </DropdownMenuItem>
        )}
        {onReject && isPending && (
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            onSelect={() => onReject(salary)}
          >
            <XCircle className="h-4 w-4" />
            <span>{t("approvals.reject")}</span>
          </DropdownMenuItem>
        )}
        {onPayment && (isApproved || salary.status === "PARTIAL") && !isPaid && (
          <DropdownMenuItem
            className="text-[var(--status-success-text)] focus:bg-[var(--status-success-bg)] focus:text-[var(--status-success-text)]"
            onSelect={() => onPayment(salary)}
          >
            <FileText className="h-4 w-4" />
            <span>{t("ui.actions.recordPayment")}</span>
          </DropdownMenuItem>
        )}
        {onEdit && (isPending || isRejected) && (
          <DropdownMenuItem onSelect={() => onEdit(salary)}>
            <Pencil className="h-4 w-4" />
            <span>{t("ui.actions.edit")}</span>
          </DropdownMenuItem>
        )}
        {onGenerateSlip && (
          <DropdownMenuItem onSelect={() => onGenerateSlip(salary)}>
            <FileText className="h-4 w-4" />
            <span>{t("ui.actions.downloadSlip")}</span>
          </DropdownMenuItem>
        )}
        {onDelete && (isPending || isRejected) && (
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(salary)}>
            <Trash2 className="h-4 w-4" />
            <span>{t("ui.actions.delete")}</span>
          </DropdownMenuItem>
        )}
        {isApproved && !isPaid && (
          <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-t border-border/50">
            <span className="font-semibold text-emerald-600">{t("approvals.approvedBadge")}</span> - {t("approvals.readyForPayment")}
          </div>
        )}
        {isPaid && (
          <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-t border-border/50">
            <span className="font-semibold text-[var(--status-warning-text)]">
              {t("ui.actions.locked")}
            </span>{" "}
            - {t("ui.actions.paidLocked")}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
