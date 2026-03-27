"use client";

import { AppModal } from "@/components/ui/app-modal";
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
  const { formatCurrency, formatDate } = useTenantFormatting();

  if (!salary) return null;

  const InfoRow = ({ 
    label, 
    value, 
    empty = "-",
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
      title="Salary Ledger Details"
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
                }}>
                  Edit
                </Button>
              )}
              {onPayment && !isPaid && (
                <Button size="sm" onClick={() => {
                  onPayment(salary);
                  onClose();
                }}>
                  Record Payment
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
                Period Information
              </h4>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow 
                label="Month" 
                value={["January", "February", "March", "April", "May", "June", 
                       "July", "August", "September", "October", "November", "December"][salary.month - 1]} 
              />
              <InfoRow 
                label="Year" 
                value={salary.year} 
              />
              <InfoRow 
                label="Academic Year" 
                value={salary.academicYear?.label} 
              />
            </CardContent>
          </Card>

          {/* Staff Information */}
          <Card>
            <CardHeader className="pb-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                Staff Information
              </h4>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow 
                label="Staff ID" 
                value={salary.staffProfile?.staffId} 
              />
              <InfoRow 
                label="Designation" 
                value={salary.staffProfile?.designation} 
              />
              <InfoRow 
                label="Department" 
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
              Salary Breakdown
            </h4>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <InfoRow 
                label="Base Salary" 
                value={formatCurrency(salary.baseSalary)} 
              />
              <InfoRow 
                label="Deductions" 
                value={salary.deductions > 0 ? `-${formatCurrency(salary.deductions)}` : "-"} 
                empty={salary.deductions > 0 ? undefined : "-"}
              />
              <InfoRow 
                label="Advances" 
                value={salary.advances > 0 ? `-${formatCurrency(salary.advances)}` : "-"} 
                empty={salary.advances > 0 ? undefined : "-"}
              />
              <div className="pt-3 border-t mt-3">
                <InfoRow 
                  label="Net Payable" 
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
              Payment Information
            </h4>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <InfoRow 
                label="Status" 
                value={salary.status} 
              />
              <InfoRow 
                label="Paid Amount" 
                value={salary.paidAmount > 0 ? formatCurrency(salary.paidAmount) : "-"} 
                empty={salary.paidAmount > 0 ? undefined : "-"}
              />
              <InfoRow 
                label="Balance Due" 
                value={salary.netPayable - salary.paidAmount > 0 ? formatCurrency(salary.netPayable - salary.paidAmount) : "Paid in Full"} 
                empty="Paid in Full"
                highlight={salary.netPayable - salary.paidAmount <= 0}
              />
              {salary.paidAt && (
                <InfoRow 
                  label="Paid On" 
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
              Record Information
            </h4>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow 
                label="Created" 
                value={formatDate(salary.createdAt)} 
              />
              <InfoRow 
                label="Last Updated" 
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
