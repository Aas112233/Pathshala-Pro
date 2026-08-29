"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TopSheet } from "@/components/ui/top-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  Calendar,
  Layers,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Download,
  Sparkles,
  ArrowRight,
  Loader2,
  Users,
  Building2,
  Clock,
} from "lucide-react";
import { useAcademicYears } from "@/hooks/use-queries";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";

interface BatchInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  classes?: Array<{ id: string; name: string; sections?: Array<{ id: string; name: string }> }>;
}

const MONTHS = [
  { value: 1, key: "january", name: "January" },
  { value: 2, key: "february", name: "February" },
  { value: 3, key: "march", name: "March" },
  { value: 4, key: "april", name: "April" },
  { value: 5, key: "may", name: "May" },
  { value: 6, key: "june", name: "June" },
  { value: 7, key: "july", name: "July" },
  { value: 8, key: "august", name: "August" },
  { value: 9, key: "september", name: "September" },
  { value: 10, key: "october", name: "October" },
  { value: 11, key: "november", name: "November" },
  { value: 12, key: "december", name: "December" },
];

export function BatchInvoiceModal({
  isOpen,
  onClose,
  onSuccess,
  classes = [],
}: BatchInvoiceModalProps) {
  const t = useTranslations("feesExtras.batchInvoice");
  const tMonths = useTranslations("months");
  const { currencySymbol, formatCurrency } = useTenantFormatting();
  const { data: academicYearsResponse } = useAcademicYears();
  const academicYears = academicYearsResponse?.data || [];

  const now = new Date();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultSummary, setResultSummary] = useState<any>(null);

  const [formData, setFormData] = useState({
    academicYearId: "",
    feeType: "TUITION",
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    target: "ALL_STUDENTS" as "ALL_STUDENTS" | "CLASS" | "SECTION",
    classId: "",
    sectionId: "",
    baseAmount: 3500,
    useClassFeeStructure: true,
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
    carryForwardArrears: true,
    note: "Monthly Tuition Fee",
  });

  const selectedClass = classes.find((c) => c.id === formData.classId);
  const availableSections = selectedClass?.sections || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const activeAyId = formData.academicYearId || academicYears[0]?.id;
    if (!activeAyId) {
      toast.error(t("errSelectYear"));
      return;
    }

    if (!formData.useClassFeeStructure && formData.baseAmount <= 0) {
      toast.error(t("errAmount"));
      return;
    }

    const monthName = tMonths(MONTHS.find((m) => m.value === formData.month)?.key || "january");
    const feeTypeName = `${formData.feeType === "TUITION" ? "Tuition Fee" : formData.feeType} (${monthName} ${formData.year})`;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/fees/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          academicYearId: activeAyId,
          feeType: feeTypeName,
          baseAmount: Number(formData.baseAmount) || 0,
        }),
      });

      const res = await response.json();
      if (!response.ok || !res.success) {
        toast.error(res.error?.message || res.message || t("generateFailed"));
        return;
      }

      setResultSummary(res.data);
      toast.success(res.message || t("generateSuccess"));
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || t("networkError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setResultSummary(null);
    onClose();
  };

  const selectedMonthName = tMonths(MONTHS.find((m) => m.value === formData.month)?.key || "january");

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={resetAndClose}
      title={t("title")}
      subtitle={t("subtitle")}
      description={t("description")}
      maxWidth="3xl"
    >
      {resultSummary ? (
        /* Result Summary View */
        <div className="space-y-6 py-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 shadow-sm">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold text-foreground">
              {t("generatedTitle", { count: resultSummary.totalVouchersCreated })}
            </h3>
            <p className="text-xs text-muted-foreground">
              Monthly tuition invoices for <span className="font-semibold text-foreground">{selectedMonthName} {formData.year}</span> are now active.
            </p>
          </div>

          <Card className="max-w-md mx-auto text-left border border-border shadow-xs">
            <CardContent className="p-4 space-y-2.5 text-xs">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">{t("totalInvoicedLabel")}</span>
                <span className="font-bold text-foreground font-mono">
                  {formatCurrency(resultSummary.totalInvoiceAmount)}
                </span>
              </div>
              {resultSummary.totalConcessionsApplied > 0 && (
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">{t("discountsLabel")}</span>
                  <span className="font-semibold text-emerald-600 font-mono">
                    -{formatCurrency(resultSummary.totalConcessionsApplied)}
                  </span>
                </div>
              )}
              {resultSummary.totalArrearsIncluded > 0 && (
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">{t("arrearsRolledLabel")}</span>
                  <span className="font-semibold text-rose-600 font-mono">
                    +{formatCurrency(resultSummary.totalArrearsIncluded)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("dueDateResultLabel")}</span>
                <span className="font-semibold text-foreground">{resultSummary.dueDate}</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center gap-3 pt-2">
            <Button
              onClick={resetAndClose}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs px-6"
            >
              Done & Return to Ledger
            </Button>
          </div>
        </div>
      ) : (
        /* 3-Step Wizard Form */
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Informational Guidance on 12-Month Billing */}
          <div className="p-3 bg-muted/30 rounded-lg border border-border flex items-center gap-2.5 text-xs text-muted-foreground">
            <Clock className="h-4 w-4 text-primary shrink-0" />
            <span>
              {t("annualGuidance")}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Step 1: Academic Year & Billing Month */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("academicYearLabel")}</Label>
              <select
                value={formData.academicYearId || academicYears[0]?.id || ""}
                onChange={(e) => setFormData({ ...formData, academicYearId: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {academicYears.map((ay: any) => (
                  <option key={ay.id} value={ay.id}>
                    {ay.label} {ay.isClosed ? t("closedSuffix") : t("activeSuffix")}
                  </option>
                ))}
              </select>
            </div>

            {/* Billing Month & Year */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("billingMonth")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={formData.month}
                  onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value, 10) })}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {tMonths(m.key)}
                    </option>
                  ))}
                </select>

                <select
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value, 10) })}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {[2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Step 2: Target Scope */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold">{t("scopeLabel")}</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "ALL_STUDENTS", label: t("scopeSchool"), icon: Users },
                  { id: "CLASS", label: t("scopeClass"), icon: Building2 },
                  { id: "SECTION", label: t("scopeSection"), icon: Layers },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = formData.target === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, target: item.id as any })}
                      className={`p-3 rounded-lg border text-left transition-all flex items-center gap-2.5 ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-bold ring-1 ring-primary"
                          : "border-border text-foreground hover:bg-muted/40 font-medium text-xs"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-primary" />
                      <span className="text-xs">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Class & Section selectors when targeted */}
            {formData.target !== "ALL_STUDENTS" && (
              <div className="space-y-1.5 sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/20 rounded-lg border border-border">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">{t("selectClassLabel")}</Label>
                  <select
                    value={formData.classId}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value, sectionId: "" })}
                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs"
                  >
                    <option value="">{t("chooseClass")}</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.target === "SECTION" && (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">{t("selectSectionLabel")}</Label>
                    <select
                      value={formData.sectionId}
                      onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
                      disabled={!formData.classId}
                      className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs disabled:opacity-50"
                    >
                      <option value="">{t("chooseSection")}</option>
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

            {/* Step 3: Due Date */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="due-dt" className="text-xs font-semibold">
                {t("dueDateLabel")} ({selectedMonthName})
              </Label>
              <Input
                id="due-dt"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="h-10 text-xs"
              />
            </div>
          </div>

          {/* Automatic Class Fee Structure Option */}
          <div className="p-3.5 bg-primary/5 rounded-lg border border-primary/20 flex items-start gap-3">
            <Checkbox
              id="structure-toggle"
              checked={formData.useClassFeeStructure}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, useClassFeeStructure: checked === true })
              }
              className="mt-0.5"
            />
            <div className="text-xs space-y-1 flex-1">
              <label htmlFor="structure-toggle" className="font-bold text-foreground cursor-pointer block">
                {t("useStructure")}
              </label>
              <p className="text-muted-foreground leading-relaxed">
                {t("useStructureHelper")}
              </p>
            </div>
          </div>

          {/* Arrears Rollover Option */}
          <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-start gap-3">
            <Checkbox
              id="arrears-toggle"
              checked={formData.carryForwardArrears}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, carryForwardArrears: checked === true })
              }
              className="mt-0.5"
            />
            <div className="text-xs space-y-0.5">
              <label htmlFor="arrears-toggle" className="font-bold text-foreground cursor-pointer">
                {t("carryForwardLabel")}
              </label>
              <p className="text-muted-foreground leading-relaxed">
                {t("carryForwardHelperShort")}
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting} className="text-xs">
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-2 rounded-lg px-5 h-10"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("monthInvoices", { month: selectedMonthName })}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> {t("generateMonth", { month: selectedMonthName, year: formData.year })}
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </TopSheet>
  );
}
