"use client";

import { useState, useCallback, useEffect } from "react";
import { AppModal } from "@/components/ui/app-modal";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { CreateSalaryLedgerDTO, SalaryLedgerWithDetails } from "@/types/entities";

interface SalaryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateSalaryLedgerDTO) => Promise<void>;
  initialData?: SalaryLedgerWithDetails | null;
  isEditing?: boolean;
  staffList?: Array<{
    id: string;
    staffId: string;
    firstName: string;
    lastName: string;
    designation: string;
    department: string;
    baseSalary: number;
  }>;
  academicYears?: Array<{
    id: string;
    yearId: string;
    label: string;
  }>;
}

interface FormErrors {
  staffProfileId?: string;
  academicYearId?: string;
  month?: string;
  year?: string;
  baseSalary?: string;
}

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export function SalaryFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isEditing = false,
  staffList = [],
  academicYears = [],
}: SalaryFormModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [formData, setFormData] = useState<CreateSalaryLedgerDTO>({
    staffProfileId: "",
    academicYearId: "",
    month: currentMonth,
    year: currentYear,
    baseSalary: 0,
    deductions: 0,
    advances: 0,
  });

  // Calculate net payable
  const netPayable = formData.baseSalary - (formData.deductions || 0) - (formData.advances || 0);

  // Reset form data when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData({
        staffProfileId: initialData.staffProfileId,
        academicYearId: initialData.academicYearId,
        month: initialData.month,
        year: initialData.year,
        baseSalary: initialData.baseSalary,
        deductions: initialData.deductions,
        advances: initialData.advances,
      });
    } else {
      // Reset to empty form for new salary
      setFormData({
        staffProfileId: "",
        academicYearId: "",
        month: currentMonth,
        year: currentYear,
        baseSalary: 0,
        deductions: 0,
        advances: 0,
      });
      setErrors({});
    }
  }, [initialData, currentMonth, currentYear]);

  // Auto-fill base salary when staff is selected
  useEffect(() => {
    if (formData.staffProfileId && !isEditing) {
      const staff = staffList.find(s => s.id === formData.staffProfileId);
      if (staff) {
        setFormData(prev => ({
          ...prev,
          baseSalary: staff.baseSalary || 0,
        }));
      }
    }
  }, [formData.staffProfileId, staffList, isEditing]);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.staffProfileId) {
      newErrors.staffProfileId = "Staff member is required";
    }

    if (!formData.academicYearId) {
      newErrors.academicYearId = "Academic year is required";
    }

    if (!formData.month || formData.month < 1 || formData.month > 12) {
      newErrors.month = "Valid month is required";
    }

    if (!formData.year || formData.year < 2000 || formData.year > 2100) {
      newErrors.year = "Valid year is required";
    }

    if (formData.baseSalary < 0) {
      newErrors.baseSalary = "Base salary must be non-negative";
    }

    if ((formData.deductions || 0) < 0) {
      newErrors.baseSalary = "Deductions must be non-negative";
    }

    if ((formData.advances || 0) < 0) {
      newErrors.baseSalary = "Advances must be non-negative";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

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

  const handleDropdownChange = useCallback((name: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [name]: typeof value === "string" ? parseInt(value) || value : value }));
    // Clear error
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }, [errors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await onSubmit(formData);
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

  const selectedStaff = staffList.find(s => s.id === formData.staffProfileId);

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Salary Ledger" : "Process Salary"}
      description={isEditing ? "Update salary ledger information." : "Create a new salary ledger entry for a staff member."}
      maxWidth="3xl"
      className="max-h-[90vh]"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {/* Staff Selection */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground border-b pb-2">Staff & Period</h4>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="staffProfileId" className={labelClass}>Staff Member <span className="text-destructive">*</span></Label>
              <AppDropdown
                id="staffProfileId"
                value={formData.staffProfileId}
                onChange={(val) => handleDropdownChange("staffProfileId", val)}
                disabled={isLoading || isEditing}
                invalid={Boolean(errors.staffProfileId)}
                aria-describedby={errors.staffProfileId ? "salary-staffProfileId-error" : undefined}
                triggerClassName={errors.staffProfileId ? "border-destructive ring-1 ring-destructive" : ""}
                options={staffList.map(s => ({
                  value: s.id,
                  label: `${s.firstName} ${s.lastName} (${s.staffId})`,
                }))}
                placeholder="Select staff member"
                searchable
              />
              {errors.staffProfileId && <p id="salary-staffProfileId-error" className={errorClass}>{errors.staffProfileId}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="academicYearId" className={labelClass}>Academic Year <span className="text-destructive">*</span></Label>
              <AppDropdown
                id="academicYearId"
                value={formData.academicYearId}
                onChange={(val) => handleDropdownChange("academicYearId", val)}
                disabled={isLoading || isEditing}
                invalid={Boolean(errors.academicYearId)}
                aria-describedby={errors.academicYearId ? "salary-academicYearId-error" : undefined}
                triggerClassName={errors.academicYearId ? "border-destructive ring-1 ring-destructive" : ""}
                options={academicYears.map(ay => ({
                  value: ay.id,
                  label: ay.label,
                }))}
                placeholder="Select year"
              />
              {errors.academicYearId && <p id="salary-academicYearId-error" className={errorClass}>{errors.academicYearId}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="month" className={labelClass}>Month <span className="text-destructive">*</span></Label>
              <AppDropdown
                id="month"
                value={formData.month.toString()}
                onChange={(val) => handleDropdownChange("month", parseInt(val) || 1)}
                disabled={isLoading || isEditing}
                invalid={Boolean(errors.month)}
                aria-describedby={errors.month ? "salary-month-error" : undefined}
                triggerClassName={errors.month ? "border-destructive ring-1 ring-destructive" : ""}
                options={MONTHS}
                placeholder="Select month"
              />
              {errors.month && <p id="salary-month-error" className={errorClass}>{errors.month}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="year" className={labelClass}>Year <span className="text-destructive">*</span></Label>
              <Input
                id="year"
                type="number"
                name="year"
                value={formData.year}
                onChange={handleChange}
                min={2000}
                max={2100}
                disabled={isLoading || isEditing}
                className={cn(inputClass, errors.year && "border-destructive focus:ring-destructive")}
              />
              {errors.year && <p className={errorClass}>{errors.year}</p>}
            </div>
          </div>
        </div>

        {/* Salary Breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground border-b pb-2">Salary Breakdown</h4>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="baseSalary" className={labelClass}>Base Salary</Label>
              <Input
                id="baseSalary"
                type="number"
                name="baseSalary"
                value={formData.baseSalary}
                onChange={handleChange}
                min={0}
                step={0.01}
                disabled={isLoading}
                className={cn(inputClass, errors.baseSalary && "border-destructive focus:ring-destructive")}
              />
              {errors.baseSalary && <p className={errorClass}>{errors.baseSalary}</p>}
              {selectedStaff && !isEditing && (
                <p className="text-xs text-muted-foreground">From profile: {selectedStaff.baseSalary}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deductions" className={labelClass}>Deductions</Label>
              <Input
                id="deductions"
                type="number"
                name="deductions"
                value={formData.deductions}
                onChange={handleChange}
                min={0}
                step={0.01}
                disabled={isLoading}
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground">e.g., tax, insurance</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="advances" className={labelClass}>Advances</Label>
              <Input
                id="advances"
                type="number"
                name="advances"
                value={formData.advances}
                onChange={handleChange}
                min={0}
                step={0.01}
                disabled={isLoading}
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground">Salary advance taken</p>
            </div>

            <div className="space-y-1.5">
              <Label className={labelClass}>Net Payable</Label>
              <div className={cn(
                "px-3 py-2 rounded-md border bg-muted font-semibold",
                netPayable < 0 ? "border-destructive text-destructive" : "border-input text-foreground"
              )}>
                {netPayable.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Base - Deductions - Advances</p>
            </div>
          </div>
        </div>

        {/* Actions - Fixed at bottom */}
        <div className="flex justify-end gap-3 pt-4 border-t mt-4 sticky bottom-0 bg-background">
          <Button variant="outline" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : isEditing ? "Update Salary" : "Create Salary Ledger"}
          </Button>
        </div>
      </form>
    </AppModal>
  );
}
