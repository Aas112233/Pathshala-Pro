"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { AppModal } from "@/components/ui/app-modal";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Check, X, DollarSign, Users } from "lucide-react";
import type { BulkPayrollEntry, BulkPayrollDTO } from "@/types/entities";

interface BulkPayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BulkPayrollDTO) => Promise<void>;
  staffList?: Array<{
    id: string;
    staffId: string;
    firstName: string;
    lastName: string;
    designation: string;
    department: string;
    baseSalary: number;
    isActive: boolean;
  }>;
  academicYears?: Array<{
    id: string;
    yearId: string;
    label: string;
    isClosed: boolean;
  }>;
}

interface FormErrors {
  academicYearId?: string;
  month?: string;
  year?: string;
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

interface StaffEntry extends BulkPayrollEntry {
  selected: boolean;
  staffName: string;
  staffId: string;
  department: string;
  hasExistingSalary?: boolean;
}

export function BulkPayrollModal({
  isOpen,
  onClose,
  onSubmit,
  staffList = [],
  academicYears = [],
}: BulkPayrollModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [entries, setEntries] = useState<StaffEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [formData, setFormData] = useState({
    academicYearId: "",
    month: currentMonth,
    year: currentYear,
  });

  // Initialize entries when staff list changes
  useEffect(() => {
    if (staffList.length > 0) {
      const initialEntries: StaffEntry[] = staffList
        .filter(s => s.isActive)
        .map(s => ({
          staffProfileId: s.id,
          staffName: `${s.firstName} ${s.lastName}`,
          staffId: s.staffId,
          department: s.department,
          baseSalary: s.baseSalary,
          deductions: 0,
          advances: 0,
          selected: true,
        }));
      setEntries(initialEntries);
    }
  }, [staffList]);

  // Get unique departments
  const departments = useMemo(() => {
    const depts = new Set(staffList.map(s => s.department));
    return Array.from(depts).filter(Boolean);
  }, [staffList]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesSearch = entry.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           entry.staffId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDepartment = !departmentFilter || entry.department === departmentFilter;
      return matchesSearch && matchesDepartment;
    });
  }, [entries, searchTerm, departmentFilter]);

  // Calculate totals
  const totals = useMemo(() => {
    const selectedEntries = filteredEntries.filter(e => e.selected);
    return {
      totalStaff: selectedEntries.length,
      totalBaseSalary: selectedEntries.reduce((sum, e) => sum + e.baseSalary, 0),
      totalDeductions: selectedEntries.reduce((sum, e) => sum + (e.deductions || 0), 0),
      totalAdvances: selectedEntries.reduce((sum, e) => sum + (e.advances || 0), 0),
      totalNetPayable: selectedEntries.reduce((sum, e) => 
        sum + (e.baseSalary - (e.deductions || 0) - (e.advances || 0)), 0),
    };
  }, [filteredEntries]);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.academicYearId) {
      newErrors.academicYearId = "Academic year is required";
    }

    if (!formData.month || formData.month < 1 || formData.month > 12) {
      newErrors.month = "Valid month is required";
    }

    if (!formData.year || formData.year < 2000 || formData.year > 2100) {
      newErrors.year = "Valid year is required";
    }

    const selectedCount = entries.filter(e => e.selected).length;
    if (selectedCount === 0) {
      toast.error("Please select at least one staff member");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0 && selectedCount > 0;
  }, [formData, entries]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: type === "number" ? parseInt(value) || value : value 
    }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }, [errors]);

  const handleEntryChange = useCallback((staffId: string, field: keyof StaffEntry, value: any) => {
    setEntries(prev => prev.map(entry => 
      entry.staffProfileId === staffId 
        ? { ...entry, [field]: value }
        : entry
    ));
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    setEntries(prev => prev.map(entry => ({
      ...entry,
      selected: checked,
    })));
  }, []);

  const handleSelectEntry = useCallback((staffId: string, checked: boolean) => {
    setEntries(prev => prev.map(entry =>
      entry.staffProfileId === staffId
        ? { ...entry, selected: checked }
        : entry
    ));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const selectedEntries = entries.filter(e => e.selected);
    const payload: BulkPayrollDTO = {
      academicYearId: formData.academicYearId,
      month: formData.month,
      year: formData.year,
      entries: selectedEntries.map(({ staffProfileId, baseSalary, deductions, advances }) => ({
        staffProfileId,
        baseSalary,
        deductions,
        advances,
      })),
    };

    setIsLoading(true);

    try {
      await onSubmit(payload);
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

  const allSelected = filteredEntries.length > 0 && filteredEntries.every(e => e.selected);
  const someSelected = filteredEntries.some(e => e.selected) && !allSelected;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Payroll Processing"
      description="Process salary for multiple staff members at once"
      maxWidth="6xl"
      className="max-h-[90vh]"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {/* Period Selection */}
        <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50">
          <div className="space-y-1.5">
            <Label htmlFor="academicYearId" className={labelClass}>Academic Year *</Label>
            <AppDropdown
              id="academicYearId"
              value={formData.academicYearId}
              onChange={(val) => {
                setFormData(prev => ({ ...prev, academicYearId: val }));
                if (errors.academicYearId) {
                  setErrors(prev => ({ ...prev, academicYearId: undefined }));
                }
              }}
              disabled={isLoading}
              invalid={Boolean(errors.academicYearId)}
              aria-describedby={errors.academicYearId ? "bulk-payroll-year-error" : undefined}
              triggerClassName={errors.academicYearId ? "border-destructive ring-1 ring-destructive" : ""}
              options={academicYears.map(ay => ({
                value: ay.id,
                label: `${ay.label}${ay.isClosed ? ' (Closed)' : ''}`,
                disabled: ay.isClosed,
              }))}
              placeholder="Select year"
            />
            {errors.academicYearId && <p id="bulk-payroll-year-error" className={errorClass}>{errors.academicYearId}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="month" className={labelClass}>Month *</Label>
            <AppDropdown
              id="month"
              value={formData.month.toString()}
              onChange={(val) => {
                setFormData(prev => ({ ...prev, month: parseInt(val) || 1 }));
                if (errors.month) {
                  setErrors(prev => ({ ...prev, month: undefined }));
                }
              }}
              disabled={isLoading}
              invalid={Boolean(errors.month)}
              aria-describedby={errors.month ? "bulk-payroll-month-error" : undefined}
              triggerClassName={errors.month ? "border-destructive ring-1 ring-destructive" : ""}
              options={MONTHS}
              placeholder="Select month"
            />
            {errors.month && <p id="bulk-payroll-month-error" className={errorClass}>{errors.month}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="year" className={labelClass}>Year *</Label>
            <Input
              id="year"
              type="number"
              name="year"
              value={formData.year}
              onChange={handleChange}
              min={2000}
              max={2100}
              disabled={isLoading}
              className={cn(inputClass, errors.year && "border-destructive focus:ring-destructive")}
            />
            {errors.year && <p className={errorClass}>{errors.year}</p>}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search by name or staff ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="w-[200px]">
            <AppDropdown
              value={departmentFilter}
              onChange={setDepartmentFilter}
              options={[
                { value: "", label: "All Departments" },
                ...departments.map(d => ({ value: d, label: d })),
              ]}
              placeholder="Filter by department"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Staff Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted px-4 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all staff"
              />
              <span className="text-sm font-medium">
                {filteredEntries.length} staff members
                {someSelected && ` (${filteredEntries.filter(e => e.selected).length} selected)`}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {totals.totalStaff} selected
              </span>
              <span className="flex items-center gap-1 text-primary font-semibold">
                <DollarSign className="h-4 w-4" />
                {totals.totalNetPayable.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="max-h-[40vh] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase w-[50px]">Select</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Department</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Base Salary</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Deductions</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Advances</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredEntries.map((entry) => {
                  const netPayable = entry.baseSalary - (entry.deductions || 0) - (entry.advances || 0);
                  return (
                    <tr key={entry.staffProfileId} className={cn("hover:bg-muted/30", !entry.selected && "opacity-50")}>
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={entry.selected}
                          onCheckedChange={(checked) => handleSelectEntry(entry.staffProfileId, checked as boolean)}
                          aria-label={`Select ${entry.staffName}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{entry.staffName}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{entry.staffId}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{entry.department || "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <Input
                          type="number"
                          value={entry.baseSalary}
                          onChange={(e) => handleEntryChange(entry.staffProfileId, "baseSalary", parseFloat(e.target.value) || 0)}
                          className="w-[100px] text-right"
                          disabled={!entry.selected || isLoading}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Input
                          type="number"
                          value={entry.deductions}
                          onChange={(e) => handleEntryChange(entry.staffProfileId, "deductions", parseFloat(e.target.value) || 0)}
                          className="w-[100px] text-right text-amber-600"
                          disabled={!entry.selected || isLoading}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Input
                          type="number"
                          value={entry.advances}
                          onChange={(e) => handleEntryChange(entry.staffProfileId, "advances", parseFloat(e.target.value) || 0)}
                          className="w-[100px] text-right text-amber-600"
                          disabled={!entry.selected || isLoading}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant={netPayable >= 0 ? "default" : "destructive"}>
                          {netPayable.toFixed(2)}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Processing {totals.totalStaff} staff members</p>
              <p className="text-xs text-muted-foreground">
                Base: {totals.totalBaseSalary.toFixed(2)} | 
                Deductions: {totals.totalDeductions.toFixed(2)} | 
                Advances: {totals.totalAdvances.toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Net Payable</p>
              <p className="text-2xl font-bold text-primary">{totals.totalNetPayable.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || totals.totalStaff === 0}>
            {isLoading ? "Processing..." : `Process Payroll for ${totals.totalStaff} Staff`}
          </Button>
        </div>
      </form>
    </AppModal>
  );
}
