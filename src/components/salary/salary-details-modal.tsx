"use client";

import { AppModal } from "@/components/ui/app-modal";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { UserCircle, Calendar, DollarSign, TrendingDown, Wallet, Clock } from "lucide-react";
import type { SalaryLedgerWithDetails } from "@/types/entities";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";

interface SalaryDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  salary: SalaryLedgerWithDetails | null;
  onEdit?: (salary: SalaryLedgerWithDetails) => void;
  onPayment?: (salary: SalaryLedgerWithDetails) => void;
}

export function SalaryDetailsModal({
  isOpen,
  onClose,
  salary,
  onEdit,
  onPayment,
}: SalaryDetailsModalProps) {
  const t = useTranslations("salary");
  const { formatCurrency, formatDate } = useTenantFormatting();
  const monthKeys = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ];

  if (!salary) return null;

  const InfoRow = ({
    label,
    value,
    empty = t("ui.notAvailable"),
    highlight = false
  }: {
    label: string;
    value: string | number | undefined | null;
    empty?: string;
    highlight?: boolean;
  }) => (
    <div className="flex justify-between items-center py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium", highlight && "text-lg font-bold text-primary")}>
        {value || empty}
      </span>
    </div>
  );

  const isPaid = salary.status === "PAID" || salary.status === "PARTIAL";

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("ui.details.title")}
      description={`${salary.staffProfile?.firstName} ${salary.staffProfile?.lastName} - ${salary.staffProfile?.designation}`}
      maxWidth="3xl"
      className="max-h-[90vh]"
    >
      <div className="space-y-6 pt-2">
        {/* Header with Status */}
        <div className="flex items-start justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCircle className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold">
                {salary.staffProfile?.firstName} {salary.staffProfile?.lastName}
              </h3>
              <p className="text-sm text-muted-foreground">{salary.staffProfile?.staffId}</p>
              <p className="text-sm text-muted-foreground">{salary.staffProfile?.department}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={salary.status === "PAID" ? "default" : salary.status === "PARTIAL" ? "secondary" : "outline"} className="text-sm">
              {salary.status}
            </Badge>
            <div className="flex gap-2">
              {onEdit && !isPaid && (
                <Button variant="outline" size="sm" onClick={() => {
                  onEdit(salary);
                  onClose();
                }}>{t("ui.details.edit")}
                </Button>
              )}
              {onPayment && !isPaid && (
                <Button size="sm" onClick={() => {
                  onPayment(salary);
                  onClose();
                }}>{t("ui.details.recordPayment")}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Period Information */}
          <Card>
            <CardHeader className="pb-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {t("ui.details.period")}
              </h4>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow
                label={t("ui.details.month")}
                value={t(`ui.months.${monthKeys[salary.month - 1]}`)}
              />
              <InfoRow
                label={t("ui.details.year")}
                value={salary.year}
              />
              <InfoRow
                label={t("ui.details.academicYear")}
                value={salary.academicYear?.label}
              />
            </CardContent>
          </Card>

          {/* Staff Information */}
          <Card>
            <CardHeader className="pb-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                {t("ui.details.staff")}
              </h4>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow
                label={t("ui.details.staffId")}
                value={salary.staffProfile?.staffId}
              />
              <InfoRow
                label={t("ui.details.designation")}
                value={salary.staffProfile?.designation}
              />
              <InfoRow
                label={t("ui.details.department")}
                value={salary.staffProfile?.department}
              />
            </CardContent>
          </Card>
        </div>

        {/* Salary Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              {t("ui.details.breakdown")}
            </h4>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <InfoRow
                label={t("ui.details.baseSalary")}
                value={formatCurrency(salary.baseSalary)}
              />
              <InfoRow
                label={t("ui.details.deductions")}
                value={salary.deductions > 0 ? `-${formatCurrency(salary.deductions)}` : "-"}
                empty={salary.deductions > 0 ? undefined : "-"}
              />
              <InfoRow
                label={t("ui.details.advances")}
                value={salary.advances > 0 ? `-${formatCurrency(salary.advances)}` : "-"}
                empty={salary.advances > 0 ? undefined : "-"}
              />
              <div className="pt-3 border-t mt-3">
                <InfoRow
                  label={t("ui.details.netPayable")}
                  value={formatCurrency(salary.netPayable)}
                  highlight
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Information */}
        <Card>
          <CardHeader className="pb-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {t("ui.details.payment")}
            </h4>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <InfoRow
                label={t("ui.details.status")}
                value={salary.status}
              />
              <InfoRow
                label={t("ui.details.paidAmount")}
                value={salary.paidAmount > 0 ? formatCurrency(salary.paidAmount) : t("ui.notAvailable")}
                empty={salary.paidAmount > 0 ? undefined : "-"}
              />
              <InfoRow
                label={t("ui.details.balanceDue")}
                value={salary.netPayable - salary.paidAmount > 0 ? formatCurrency(salary.netPayable - salary.paidAmount) : t("ui.details.paidInFull")}
                empty={t("ui.details.paidInFull")}
                highlight={salary.netPayable - salary.paidAmount <= 0}
              />
              {salary.paidAt && (
                <InfoRow
                  label={t("ui.details.paidOn")}
                  value={formatDate(salary.paidAt)}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader className="pb-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t("ui.details.record")}
            </h4>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow
                label={t("ui.details.created")}
                value={formatDate(salary.createdAt)}
              />
              <InfoRow
                label={t("ui.details.updated")}
                value={formatDate(salary.updatedAt)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppModal>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}
