"use client";

import { useState, useCallback } from "react";
import { AppModal } from "@/components/ui/app-modal";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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

  const inputClass = cn(
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
    "focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary",
    "transition-colors duration-200"
  );

  const labelClass = "text-sm font-medium";
  const errorClass = "text-xs text-destructive mt-1";

  if (!salary) return null;

  const remainingBalance = salary.netPayable - (salary.paidAmount || 0);
  const isPartialPayment = formData.paidAmount < remainingBalance;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Salary Payment"
      description={`Recording payment for ${salary.staffProfile?.firstName} ${salary.staffProfile?.lastName}`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
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

        {/* Payment Amount */}
        <div className="space-y-1.5">
          <Label htmlFor="paidAmount" className={labelClass}>Payment Amount *</Label>
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
            className={cn(inputClass, errors.paidAmount && "border-destructive focus:ring-destructive")}
          />
          {errors.paidAmount && <p className={errorClass}>{errors.paidAmount}</p>}
          {isPartialPayment && (
            <p className="text-xs text-amber-600">
              This will be a partial payment. Remaining: {(remainingBalance - formData.paidAmount).toFixed(2)}
            </p>
          )}
        </div>

        {/* Payment Method */}
        <div className="space-y-1.5">
          <Label htmlFor="paymentMethod" className={labelClass}>Payment Method *</Label>
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
          {errors.paymentMethod && <p id="payment-method-error" className={errorClass}>{errors.paymentMethod}</p>}
        </div>

        {/* Payment Date */}
        <div className="space-y-1.5">
          <Label htmlFor="paymentDate" className={labelClass}>Payment Date *</Label>
          <Input
            id="paymentDate"
            type="date"
            name="paymentDate"
            value={formData.paymentDate}
            onChange={handleChange}
            disabled={isLoading}
            className={cn(inputClass, errors.paymentDate && "border-destructive focus:ring-destructive")}
          />
          {errors.paymentDate && <p className={errorClass}>{errors.paymentDate}</p>}
        </div>

        {/* Note */}
        <div className="space-y-1.5">
          <Label htmlFor="note" className={labelClass}>Note (Optional)</Label>
          <Input
            id="note"
            name="note"
            value={formData.note}
            onChange={handleChange}
            placeholder="e.g., Cash paid in hand, Bank ref #..."
            disabled={isLoading}
            className={inputClass}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Processing..." : isPartialPayment ? "Record Partial Payment" : "Mark as Paid"}
          </Button>
        </div>
      </form>
    </AppModal>
  );
}
