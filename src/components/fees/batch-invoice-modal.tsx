"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TopSheet } from "@/components/ui/top-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  Calendar,
  Layers,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Download,
} from "lucide-react";
import { useAcademicYears } from "@/hooks/use-queries";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";

interface BatchInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  classes?: Array<{ id: string; name: string; sections?: Array<{ id: string; name: string }> }>;
}

export function BatchInvoiceModal({
  isOpen,
  onClose,
  onSuccess,
  classes = [],
}: BatchInvoiceModalProps) {
  const t = useTranslations();
  const { currencySymbol, formatCurrency } = useTenantFormatting();
  const { data: academicYearsResponse } = useAcademicYears();
  const academicYears = academicYearsResponse?.data || [];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultSummary, setResultSummary] = useState<any>(null);

  const [formData, setFormData] = useState({
    academicYearId: "",
    feeType: "TUITION",
    target: "ALL_STUDENTS" as "ALL_STUDENTS" | "CLASS" | "SECTION",
    classId: "",
    sectionId: "",
    baseAmount: 3500,
    useClassFeeStructure: true,
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
    carryForwardArrears: true,
    note: "Monthly Institutional Tuition Fee",
  });

  const selectedClass = classes.find((c) => c.id === formData.classId);
  const availableSections = selectedClass?.sections || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const activeAyId = formData.academicYearId || academicYears[0]?.id;
    if (!activeAyId) {
      toast.error(t("feesExtras.batchInvoice.errSelectYear"));
      return;
    }

    if (!formData.useClassFeeStructure && formData.baseAmount <= 0) {
      toast.error(t("feesExtras.batchInvoice.errAmount"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/fees/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          academicYearId: activeAyId,
          baseAmount: Number(formData.baseAmount) || 0,
        }),
      });

      const res = await response.json();
      if (!response.ok || !res.success) {
        toast.error(res.error?.message || t("feesExtras.batchInvoice.generateFailed"));
        return;
      }

      setResultSummary(res.data);
      toast.success(res.message || t("feesExtras.batchInvoice.generateSuccess"));
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || t("feesExtras.batchInvoice.networkError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setResultSummary(null);
    onClose();
  };

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={resetAndClose}
      title={t("feesExtras.batchInvoice.title")}
      subtitle={t("feesExtras.batchInvoice.subtitle")}
      description={t("feesExtras.batchInvoice.description")}
      maxWidth="3xl"
    >
      {resultSummary ? (
        <div className="space-y-6 py-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold text-foreground">
              {t("feesExtras.batchInvoice.generatedTitle", {
                count: resultSummary.totalVouchersCreated,
              })}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("feesExtras.batchInvoice.generatedSubtitle")}
            </p>
          </div>

          <Card className="max-w-md mx-auto text-left border border-border shadow-none">
            <CardContent className="p-4 space-y-2.5 text-xs">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">{t("feesExtras.batchInvoice.totalInvoicedLabel")}</span>
                <span className="font-bold text-foreground font-mono">
                  {formatCurrency(resultSummary.totalInvoiceAmount)}
                </span>
              </div>
              {resultSummary.totalConcessionsApplied > 0 && (
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Concessions & Scholarships Deducted:</span>
                  <span className="font-semibold text-emerald-600 font-mono">
                    -{formatCurrency(resultSummary.totalConcessionsApplied)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Historical Arrears Rolled:</span>
                <span className="font-semibold text-rose-600 font-mono">
                  +{formatCurrency(resultSummary.totalArrearsIncluded)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Due Date:</span>
                <span className="font-semibold text-foreground">{resultSummary.dueDate}</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center gap-3 pt-2">
            <Button onClick={resetAndClose} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Done & Return to Ledger
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Academic Year */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Academic Year</Label>
              <select
                value={formData.academicYearId || academicYears[0]?.id || ""}
                onChange={(e) => setFormData({ ...formData, academicYearId: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {academicYears.map((ay: any) => (
                  <option key={ay.id} value={ay.id}>
                    {ay.label} {ay.isClosed ? "(Closed)" : "(Active)"}
                  </option>
                ))}
              </select>
            </div>

            {/* Fee Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Fee Type</Label>
              <select
                value={formData.feeType}
                onChange={(e) => setFormData({ ...formData, feeType: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="TUITION">Monthly Tuition Fee</option>
                <option value="ADMISSION">Admission / Registration Fee</option>
                <option value="EXAM">Examination & Assessment Fee</option>
                <option value="TRANSPORT">Transport & Bus Van Fee</option>
                <option value="HOSTEL">Hostel & Boarding Fee</option>
                <option value="ANNUAL">Annual Development Charges</option>
              </select>
            </div>

            {/* Target Scope */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold">Billing Target Scope</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "ALL_STUDENTS", label: "Entire School" },
                  { id: "CLASS", label: "Specific Class" },
                  { id: "SECTION", label: "Specific Section" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, target: t.id as any })}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                      formData.target === t.id
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                        : "border-border text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Class & Section selectors when targeted */}
            {formData.target !== "ALL_STUDENTS" && (
              <div className="space-y-1.5 sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/20 rounded-xl border border-border">
                <div className="space-y-1">
                  <Label className="text-xs">Select Grade / Class</Label>
                  <select
                    value={formData.classId}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value, sectionId: "" })}
                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs"
                  >
                    <option value="">Choose Class...</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.target === "SECTION" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Select Section</Label>
                    <select
                      value={formData.sectionId}
                      onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
                      disabled={!formData.classId}
                      className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs disabled:opacity-50"
                    >
                      <option value="">Choose Section...</option>
                      {availableSections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Due Date */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="due-dt" className="text-xs font-semibold">
                Payment Due Date
              </Label>
              <Input
                id="due-dt"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="h-10 text-sm"
              />
            </div>
          </div>

          {/* Use Class Fee Structure Option */}
          <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800 flex items-start gap-3">
            <Checkbox
              id="structure-toggle"
              checked={formData.useClassFeeStructure}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, useClassFeeStructure: checked === true })
              }
              className="mt-0.5"
            />
            <div className="text-xs space-y-1 flex-1">
              <label htmlFor="structure-toggle" className="font-semibold text-foreground cursor-pointer block">
                Use Configured Class Tuition Rates & Student Concessions (Recommended)
              </label>
              <p className="text-muted-foreground leading-relaxed">
                Pulls each student's class fee schedule automatically (e.g. Class 1 = $2,000, Class 10 = $5,000) and deducts active sibling/scholarship discounts.
              </p>
            </div>
          </div>

          {/* Fallback Manual Base Amount (if not using structure) */}
          {!formData.useClassFeeStructure && (
            <div className="space-y-1.5 p-3.5 bg-muted/20 rounded-xl border border-border">
              <Label htmlFor="base-amt" className="text-xs font-semibold">
                Uniform Base Fee per Student ({currencySymbol})
              </Label>
              <Input
                id="base-amt"
                type="number"
                min="0"
                value={formData.baseAmount}
                onChange={(e) => setFormData({ ...formData, baseAmount: parseFloat(e.target.value) || 0 })}
                className="h-10 text-sm font-semibold"
              />
            </div>
          )}

          {/* Arrears Rollover Option */}
          <div className="p-3.5 bg-primary/5 rounded-xl border border-primary/15 flex items-start gap-3">
            <Checkbox
              id="arrears-toggle"
              checked={formData.carryForwardArrears}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, carryForwardArrears: checked === true })
              }
              className="mt-0.5"
            />
            <div className="text-xs space-y-0.5">
              <label htmlFor="arrears-toggle" className="font-semibold text-foreground cursor-pointer">
                Carry Forward Historical Unpaid Arrears
              </label>
              <p className="text-muted-foreground leading-relaxed">
                Automatically calculates each student’s outstanding balance from prior months and adds it directly into their new voucher.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm"
            >
              {isSubmitting ? (
                <>Generating Invoices...</>
              ) : (
                <>
                  <Receipt className="h-4 w-4" /> Generate Batch Vouchers Now
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </TopSheet>
  );
}
