"use client";

import { useState, useCallback } from "react";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { PaymentDTO, SalaryLedgerWithDetails } from "@/types/entities";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (salaryId: string, data: PaymentDTO) => Promise<void>;
  salary: SalaryLedgerWithDetails | null;
}

interface FormErrors {
  paidAmount?: string;
  paymentMethod?: string;
  paymentDate?: string;
}

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "DIGITAL", label: "Digital Payment" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
];

export function PaymentModal({
  isOpen,
  onClose,
  onSubmit,
  salary,
}: PaymentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [formData, setFormData] = useState<PaymentDTO>({
    paidAmount: salary?.netPayable || 0,
    paymentMethod: "CASH",
    paymentDate: new Date().toISOString().split('T')[0],
    note: "",
  });

  // Reset form when salary changes
  useState(() => {
    if (salary) {
      setFormData(prev => ({
        ...prev,
        paidAmount: salary.netPayable - (salary.paidAmount || 0),
      }));
    }
  });

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.paidAmount || formData.paidAmount <= 0) {
      newErrors.paidAmount = "Payment amount must be greater than zero";
    }

    const remainingBalance = (salary?.netPayable || 0) - (salary?.paidAmount || 0);
    if (formData.paidAmount > remainingBalance) {
      newErrors.paidAmount = `Payment amount cannot exceed remaining balance (${remainingBalance})`;
    }

    if (!formData.paymentMethod) {
      newErrors.paymentMethod = "Payment method is required";
    }

    if (!formData.paymentDate) {
      newErrors.paymentDate = "Payment date is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, salary]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: type === "number" ? parseFloat(value) || 0 : value 
    }));
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }, [errors]);

  const handleDropdownChange = useCallback((name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }, [errors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!salary) return;

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await onSubmit(salary.id, formData);
      onClose();
    } catch (error: any) {
      // Error is handled by the view model
    } finally {
      setIsLoading(false);
    }
  };

  if (!salary) return null;

  const remainingBalance = salary.netPayable - (salary.paidAmount || 0);
  const isPartialPayment = formData.paidAmount < remainingBalance;

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Record Salary Payment"
      description={`Recording payment for ${salary.staffProfile?.firstName} ${salary.staffProfile?.lastName}`}
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="outline" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" disabled={isLoading}>
            {isLoading ? "Processing..." : isPartialPayment ? "Record Partial Payment" : "Mark as Paid"}
          </Button>
        </div>
      }
    >
      <form id="payment-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Summary Card */}
        <div className="p-4 rounded-lg bg-muted/50 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Net Payable:</span>
            <span className="font-medium">{salary.netPayable.toFixed(2)}</span>
          </div>
          {salary.paidAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Previously Paid:</span>
              <span className="font-medium">{salary.paidAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold border-t pt-2">
            <span className="text-foreground">Remaining Balance:</span>
            <span className="text-primary">{remainingBalance.toFixed(2)}</span>
          </div>
        </div>

        <ERPFormSection>
          <ERPFormGrid cols={2}>
            {/* Payment Amount */}
            <ERPFormField label="Payment Amount" required htmlFor="paidAmount">
              <Input
                id="paidAmount"
                type="number"
                name="paidAmount"
                value={formData.paidAmount}
                onChange={handleChange}
                min={0.01}
                max={remainingBalance}
                step={0.01}
                disabled={isLoading}
                aria-invalid={Boolean(errors.paidAmount)}
              />
              {errors.paidAmount && <p className="text-xs text-destructive mt-1">{errors.paidAmount}</p>}
              {isPartialPayment && (
                <p className="text-xs text-amber-600">
                  This will be a partial payment. Remaining: {(remainingBalance - formData.paidAmount).toFixed(2)}
                </p>
              )}
            </ERPFormField>

            {/* Payment Method */}
            <ERPFormField label="Payment Method" required htmlFor="paymentMethod">
              <AppDropdown
                id="paymentMethod"
                value={formData.paymentMethod}
                onChange={(value) => handleDropdownChange("paymentMethod", value)}
                disabled={isLoading}
                invalid={Boolean(errors.paymentMethod)}
                aria-describedby={errors.paymentMethod ? "payment-method-error" : undefined}
                triggerClassName={errors.paymentMethod ? "border-destructive ring-1 ring-destructive" : ""}
                options={PAYMENT_METHODS}
                placeholder="Select payment method"
              />
              {errors.paymentMethod && <p id="payment-method-error" className="text-xs text-destructive mt-1">{errors.paymentMethod}</p>}
            </ERPFormField>

            {/* Payment Date */}
            <ERPFormField label="Payment Date" required htmlFor="paymentDate">
              <Input
                id="paymentDate"
                type="date"
                name="paymentDate"
                value={formData.paymentDate}
                onChange={handleChange}
                disabled={isLoading}
                aria-invalid={Boolean(errors.paymentDate)}
              />
              {errors.paymentDate && <p className="text-xs text-destructive mt-1">{errors.paymentDate}</p>}
            </ERPFormField>

            {/* Note */}
            <ERPFormField label="Note (Optional)" htmlFor="note">
              <Input
                id="note"
                name="note"
                value={formData.note}
                onChange={handleChange}
                placeholder="e.g., Cash paid in hand, Bank ref #..."
                disabled={isLoading}
              />
            </ERPFormField>
          </ERPFormGrid>
        </ERPFormSection>
      </form>
    </TopSheet>
  );
}
