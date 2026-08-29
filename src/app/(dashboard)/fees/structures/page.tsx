"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { ERPMetricCard } from "@/components/ui/erp-metric-card";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { useAcademicYears } from "@/hooks/use-queries";
import {
  useClassFeeStructures,
  useCreateClassFeeStructure,
  useUpdateClassFeeStructure,
  useDeleteClassFeeStructure,
  useStudentConcessions,
  useSaveStudentConcession,
  type ClassFeeStructureItem,
} from "@/hooks/use-fee-structures";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  Receipt,
  GraduationCap,
  DollarSign,
  TrendingUp,
  Percent,
  Sparkles,
  Users,
  Award,
  BookOpen,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

export default function FeeStructuresPage() {
  const t = useTranslations("feeStructures");
  const tCommon = useTranslations("common");
  const { currencySymbol, formatCurrency } = useTenantFormatting();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canReadFees = hasPermission(perms, "fees", "read");
  const canWriteFees = hasPermission(perms, "fees", "write");
  const canManageFees = hasPermission(perms, "fees", "manage");

  // Academic Years & Classes queries
  const { data: ayResponse } = useAcademicYears();
  const academicYears = ayResponse?.data || [];
  const [selectedYearId, setSelectedYearId] = useState<string>("");

  const activeYearId = selectedYearId || academicYears[0]?.id || "";

  const { data: classesResponse } = useQuery({
    queryKey: ["classes-fee-structures"],
    queryFn: async () => {
      const res = await fetch("/api/classes?limit=100&isActive=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load classes");
      return res.json();
    },
  });
  const activeClasses = (classesResponse as any)?.data || [];

  // Fee Structures query & mutations
  const { data: structuresResponse, isLoading } = useClassFeeStructures(activeYearId);
  const structures = structuresResponse?.data || [];

  const createMutation = useCreateClassFeeStructure();
  const updateMutation = useUpdateClassFeeStructure();
  const deleteMutation = useDeleteClassFeeStructure();

  // Concessions query & mutation
  const { data: concessionsResponse } = useStudentConcessions();
  const concessions = concessionsResponse?.data || [];
  const saveConcessionMutation = useSaveStudentConcession();

  // Modal / Sheet States
  const [isStructureSheetOpen, setIsStructureSheetOpen] = useState(false);
  const [editingStructure, setEditingStructure] = useState<ClassFeeStructureItem | null>(null);
  const [isConcessionSheetOpen, setIsConcessionSheetOpen] = useState(false);

  // Form State for Class Fee Structure
  const [formValues, setFormValues] = useState({
    classId: "",
    academicYearId: "",
    tuitionFee: 2500,
    labFee: 200,
    computerFee: 300,
    examFee: 200,
    sportsFee: 100,
    libraryFee: 100,
    otherFee: 0,
    billingCycle: "MONTHLY" as "MONTHLY" | "QUARTERLY" | "BI_ANNUAL" | "ANNUAL",
    notes: "",
  });

  // Form State for Student Concession
  const [concessionForm, setConcessionForm] = useState({
    studentProfileId: "",
    concessionType: "SIBLING" as "SIBLING" | "STAFF_CHILD" | "MERIT" | "NEED_BASED" | "CUSTOM",
    discountType: "PERCENTAGE" as "PERCENTAGE" | "FIXED_AMOUNT",
    discountValue: 20,
    reason: "",
  });

  // Calculate live computed total for form
  const liveFormTotal = useMemo(() => {
    return (
      (Number(formValues.tuitionFee) || 0) +
      (Number(formValues.labFee) || 0) +
      (Number(formValues.computerFee) || 0) +
      (Number(formValues.examFee) || 0) +
      (Number(formValues.sportsFee) || 0) +
      (Number(formValues.libraryFee) || 0) +
      (Number(formValues.otherFee) || 0)
    );
  }, [formValues]);

  // Aggregate KPI metrics
  const totalClassesConfigured = structures.length;
  const totalProjectedMonthlyRevenue = structures.reduce(
    (sum, s) => sum + (s.projectedRevenue || 0),
    0
  );
  const averageFeePerClass =
    totalClassesConfigured > 0
      ? structures.reduce((sum, s) => sum + (s.totalMonthlyFee || 0), 0) /
        totalClassesConfigured
      : 0;
  const activeConcessionCount = concessions.length;

  const handleOpenAddSheet = () => {
    setEditingStructure(null);
    setFormValues({
      classId: activeClasses[0]?.id || "",
      academicYearId: activeYearId,
      tuitionFee: 2500,
      labFee: 200,
      computerFee: 300,
      examFee: 200,
      sportsFee: 100,
      libraryFee: 100,
      otherFee: 0,
      billingCycle: "MONTHLY",
      notes: "",
    });
    setIsStructureSheetOpen(true);
  };

  const handleOpenEditSheet = (item: ClassFeeStructureItem) => {
    setEditingStructure(item);
    setFormValues({
      classId: item.classId,
      academicYearId: item.academicYearId,
      tuitionFee: item.tuitionFee || 0,
      labFee: item.labFee || 0,
      computerFee: item.computerFee || 0,
      examFee: item.examFee || 0,
      sportsFee: item.sportsFee || 0,
      libraryFee: item.libraryFee || 0,
      otherFee: item.otherFee || 0,
      billingCycle: item.billingCycle || "MONTHLY",
      notes: item.notes || "",
    });
    setIsStructureSheetOpen(true);
  };

  const handleSaveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValues.classId) {
      toast.error("Please select a target class.");
      return;
    }

    const targetAyId = formValues.academicYearId || activeYearId || academicYears[0]?.id;
    if (!targetAyId) {
      toast.error("Please select an academic year.");
      return;
    }

    const payload = {
      classId: formValues.classId,
      academicYearId: targetAyId,
      tuitionFee: Number(formValues.tuitionFee) || 0,
      labFee: Number(formValues.labFee) || 0,
      computerFee: Number(formValues.computerFee) || 0,
      examFee: Number(formValues.examFee) || 0,
      sportsFee: Number(formValues.sportsFee) || 0,
      libraryFee: Number(formValues.libraryFee) || 0,
      otherFee: Number(formValues.otherFee) || 0,
      billingCycle: formValues.billingCycle || "MONTHLY",
      notes: formValues.notes || undefined,
      isActive: true,
    };

    try {
      if (editingStructure) {
        await updateMutation.mutateAsync({
          id: editingStructure.id,
          data: payload,
        });
        toast.success(t("saveSuccess"));
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(t("saveSuccess"));
      }
      setIsStructureSheetOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save fee structure");
    }
  };

  const handleDeleteStructure = async (id: string, name: string) => {
    if (!confirm(t("deleteConfirm"))) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t("deleteSuccess"));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete fee structure");
    }
  };

  const currentYearLabel =
    academicYears.find((y: any) => y.id === activeYearId)?.label || "Active";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={Layers}
      >
        <div className="flex items-center gap-2.5">
          {/* Academic Year Filter */}
          <div className="flex items-center gap-1.5 bg-background border border-input rounded-xl px-3 py-1.5 shadow-2xs">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <select
              value={activeYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer"
            >
              {academicYears.map((ay: any) => (
                <option key={ay.id} value={ay.id}>
                  {ay.label} {ay.isClosed ? "(Closed)" : ""}
                </option>
              ))}
            </select>
          </div>

          {canWriteFees && (
            <Button
              variant="outline"
              onClick={() => setIsConcessionSheetOpen(true)}
              className="gap-2 text-xs font-semibold rounded-lg border-border"
            >
              <Percent className="h-3.5 w-3.5 text-amber-500" />
              {t("manageConcessions")} ({activeConcessionCount})
            </Button>
          )}

          {canWriteFees && (
            <Button
              onClick={handleOpenAddSheet}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 text-xs font-semibold rounded-lg"
            >
              <Plus className="h-4 w-4" />
              {t("setClassFee")}
            </Button>
          )}
        </div>
      </PageHeader>

      {!isAuthLoading && !canReadFees ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Access restricted</h2>
          <p className="mt-2 text-sm text-muted-foreground">You do not have permission to view fees.</p>
        </div>
      ) : (
        <>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ERPMetricCard
          title={t("configuredGrades")}
          value={`${totalClassesConfigured} / ${activeClasses.length}`}
          unit="Classes"
          breakdowns={[
            { label: tCommon("active"), count: totalClassesConfigured, color: "emerald" },
            {
              label: tCommon("inactive"),
              count: Math.max(0, activeClasses.length - totalClassesConfigured),
              color: "amber",
            },
          ]}
        />

        <ERPMetricCard
          title={t("projectedRevenue")}
          value={formatCurrency(totalProjectedMonthlyRevenue)}
          unit="Estimated / Mo"
        />

        <ERPMetricCard
          title={t("averageMonthlyFee")}
          value={formatCurrency(averageFeePerClass)}
          unit="/ Class / Mo"
        />

        <ERPMetricCard
          title={t("studentConcessions")}
          value={`${activeConcessionCount}`}
          unit="Active Students"
          breakdowns={[
            {
              label: t("siblingDiscount"),
              count: concessions.filter((c) => c.concessionType === "SIBLING").length,
              color: "cyan",
            },
            {
              label: t("waiversAndScholarships"),
              count: concessions.filter((c) => c.concessionType !== "SIBLING").length,
              color: "rose",
            },
          ]}
        />
      </div>

      {/* Class Tuition Fee Structures Matrix */}
      <Card className="border border-border/80 shadow-none rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/10">
          <div>
            <h3 className="text-sm font-bold text-foreground">{t("matrixTitle")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("matrixSubtitle", { year: currentYearLabel })}
            </p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground bg-background px-3 py-1 rounded-lg border border-border">
            {t("classesDefined", { count: structures.length })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">{t("thClassGrade")}</th>
                <th className="py-3 px-3">{t("thBaseTuition")}</th>
                <th className="py-3 px-3">{t("thLabFee")}</th>
                <th className="py-3 px-3">{t("thComputerFee")}</th>
                <th className="py-3 px-3">{t("thExamFee")}</th>
                <th className="py-3 px-3">{t("thSportsLibrary")}</th>
                <th className="py-3 px-4 font-bold text-foreground">{t("thTotalMonthly")}</th>
                <th className="py-3 px-3 text-center">{t("thCycle")}</th>
                <th className="py-3 px-4 text-right">{t("thStatus")}</th>
                <th className="py-3 px-4 text-right">{tCommon("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">
                    {tCommon("loading")}
                  </td>
                </tr>
              ) : structures.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    <div className="space-y-3">
                      <Layers className="h-10 w-10 mx-auto text-muted-foreground/40" />
                      <p className="font-semibold text-sm text-foreground">{t("noStructuresTitle")}</p>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        {t("noStructuresDesc")}
                      </p>
                      {canWriteFees && (
                        <Button onClick={handleOpenAddSheet} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 text-xs">
                          <Plus className="h-3.5 w-3.5" /> {t("setClassFee")}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                structures.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    {/* Class */}
                    <td className="py-3.5 px-4 font-bold text-foreground flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">
                        {item.class?.classNumber || item.class?.name?.slice(0, 2) || "CL"}
                      </div>
                      <span>{item.class?.name || "Class"}</span>
                    </td>

                    {/* Breakdown columns */}
                    <td className="py-3.5 px-3 font-medium font-mono">{formatCurrency(item.tuitionFee)}</td>
                    <td className="py-3.5 px-3 font-mono text-muted-foreground">{item.labFee ? formatCurrency(item.labFee) : "—"}</td>
                    <td className="py-3.5 px-3 font-mono text-muted-foreground">{item.computerFee ? formatCurrency(item.computerFee) : "—"}</td>
                    <td className="py-3.5 px-3 font-mono text-muted-foreground">{item.examFee ? formatCurrency(item.examFee) : "—"}</td>
                    <td className="py-3.5 px-3 font-mono text-muted-foreground">
                      {item.sportsFee || item.libraryFee ? formatCurrency((item.sportsFee || 0) + (item.libraryFee || 0)) : "—"}
                    </td>

                    {/* Total Monthly Fee */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-mono">
                        {formatCurrency(item.totalMonthlyFee)}
                      </span>
                    </td>

                    {/* Billing Cycle */}
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md text-[11px] font-mono">
                        {item.billingCycle || "MONTHLY"}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-right">
                      <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canWriteFees && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditSheet(item)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            title={t("editClassFee")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canManageFees && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteStructure(item.id, item.class?.name || "Class")}
                            className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                            title={tCommon("delete")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* TopSlide-Down Form (TopSheet) for Adding / Editing Class Fee Structure */}
      <TopSheet
        isOpen={isStructureSheetOpen}
        onClose={() => setIsStructureSheetOpen(false)}
        title={editingStructure ? `${t("editClassFee")}: ${editingStructure.class?.name}` : t("formTitle")}
        subtitle={t("formSubtitle")}
        description={t("formDescription")}
        maxWidth="4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">{t("computedTotalMonthlyFee")}:</span>
              <span className="text-base font-bold text-emerald-600 font-mono">
                {formatCurrency(liveFormTotal)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" type="button" onClick={() => setIsStructureSheetOpen(false)}>
                {tCommon("cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleSaveStructure}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 font-semibold"
              >
                <CheckCircle2 className="h-4 w-4" />
                {editingStructure ? t("editClassFee") : t("saveStructure")}
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSaveStructure} className="space-y-6 py-2">
          {/* Section 1: Class & Year */}
          <ERPFormSection title={t("gradeAndTerm")} description={t("formDescription")}>
            <ERPFormGrid cols={3}>
              <ERPFormField label={t("targetClass")} required>
                <select
                  value={formValues.classId}
                  onChange={(e) => setFormData({ classId: e.target.value })}
                  disabled={!!editingStructure}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs font-semibold"
                >
                  <option value="">{t("targetClass")}...</option>
                  {activeClasses.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </ERPFormField>

              <ERPFormField label={t("academicYear")} required>
                <select
                  value={formValues.academicYearId || activeYearId}
                  onChange={(e) => setFormData({ academicYearId: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs"
                >
                  {academicYears.map((ay: any) => (
                    <option key={ay.id} value={ay.id}>
                      {ay.label}
                    </option>
                  ))}
                </select>
              </ERPFormField>

              <ERPFormField label={t("billingCycle")}>
                <select
                  value={formValues.billingCycle}
                  onChange={(e) => setFormData({ billingCycle: e.target.value as any })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs"
                >
                  <option value="MONTHLY">{t("monthlyCycle")}</option>
                  <option value="QUARTERLY">{t("quarterlyCycle")}</option>
                  <option value="BI_ANNUAL">{t("biAnnualCycle")}</option>
                  <option value="ANNUAL">{t("annualCycle")}</option>
                </select>
              </ERPFormField>
            </ERPFormGrid>
          </ERPFormSection>

          {/* Section 2: Multi-Head Fee Allocation Breakdown */}
          <ERPFormSection
            title={t("feeHeadsBreakdown")}
            description="Itemize tuition and associated institutional facilities"
          >
            <ERPFormGrid cols={3}>
              <ERPFormField label={`${t("baseTuitionFee")} (${currencySymbol})`} required>
                <Input
                  type="number"
                  min="0"
                  value={formValues.tuitionFee}
                  onChange={(e) => setFormData({ tuitionFee: parseFloat(e.target.value) || 0 })}
                  className="font-bold text-sm"
                />
              </ERPFormField>

              <ERPFormField label={`${t("labCharges")} (${currencySymbol})`}>
                <Input
                  type="number"
                  min="0"
                  value={formValues.labFee}
                  onChange={(e) => setFormData({ labFee: parseFloat(e.target.value) || 0 })}
                />
              </ERPFormField>

              <ERPFormField label={`${t("computerCharges")} (${currencySymbol})`}>
                <Input
                  type="number"
                  min="0"
                  value={formValues.computerFee}
                  onChange={(e) => setFormData({ computerFee: parseFloat(e.target.value) || 0 })}
                />
              </ERPFormField>

              <ERPFormField label={`${t("examFeeLabel")} (${currencySymbol})`}>
                <Input
                  type="number"
                  min="0"
                  value={formValues.examFee}
                  onChange={(e) => setFormData({ examFee: parseFloat(e.target.value) || 0 })}
                />
              </ERPFormField>

              <ERPFormField label={`${t("sportsFeeLabel")} (${currencySymbol})`}>
                <Input
                  type="number"
                  min="0"
                  value={formValues.sportsFee}
                  onChange={(e) => setFormData({ sportsFee: parseFloat(e.target.value) || 0 })}
                />
              </ERPFormField>

              <ERPFormField label={`${t("libraryFeeLabel")} (${currencySymbol})`}>
                <Input
                  type="number"
                  min="0"
                  value={formValues.libraryFee}
                  onChange={(e) => setFormData({ libraryFee: parseFloat(e.target.value) || 0 })}
                />
              </ERPFormField>
            </ERPFormGrid>
          </ERPFormSection>
        </form>
      </TopSheet>

      {/* TopSlide-Down Sheet for Student Concessions */}
      <TopSheet
        isOpen={isConcessionSheetOpen}
        onClose={() => setIsConcessionSheetOpen(false)}
        title={t("concessionsTitle")}
        subtitle={t("concessionsSubtitle")}
        description={t("waiversAndScholarships")}
        maxWidth="3xl"
      >
        <div className="space-y-6 py-2">
          {/* Add Concession Form */}
          <div className="p-4 bg-muted/20 border border-border rounded-lg space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              {t("concessionsSubtitle")}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <Label className="text-xs">{t("selectStudent")} (ID / Roll)</Label>
                <Input
                  placeholder="e.g. Student CUID or roll"
                  value={concessionForm.studentProfileId}
                  onChange={(e) => setConcessionForm({ ...concessionForm, studentProfileId: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">{t("concessionCategory")}</Label>
                <select
                  value={concessionForm.concessionType}
                  onChange={(e) => setConcessionForm({ ...concessionForm, concessionType: e.target.value as any })}
                  className="w-full h-9 px-2 rounded-md border border-input bg-background text-xs"
                >
                  <option value="SIBLING">{t("siblingDiscount")}</option>
                  <option value="STAFF_CHILD">{t("staffChild")}</option>
                  <option value="MERIT">{t("meritScholarship")}</option>
                  <option value="NEED_BASED">{t("needBased")}</option>
                  <option value="CUSTOM">{t("customConcession")}</option>
                </select>
              </div>

              <div>
                <Label className="text-xs">{t("discountValue")}</Label>
                <div className="flex gap-1.5">
                  <Input
                    type="number"
                    min="0"
                    value={concessionForm.discountValue}
                    onChange={(e) => setConcessionForm({ ...concessionForm, discountValue: parseFloat(e.target.value) || 0 })}
                    className="h-9 text-xs font-bold"
                  />
                  <select
                    value={concessionForm.discountType}
                    onChange={(e) => setConcessionForm({ ...concessionForm, discountType: e.target.value as any })}
                    className="w-24 h-9 px-2 rounded-md border border-input bg-background text-xs font-semibold"
                  >
                    <option value="PERCENTAGE">%</option>
                    <option value="FIXED_AMOUNT">{currencySymbol}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={async () => {
                  if (!concessionForm.studentProfileId) {
                    toast.error("Please enter a valid student profile ID.");
                    return;
                  }
                  try {
                    await saveConcessionMutation.mutateAsync({
                      ...concessionForm,
                      isActive: true,
                    });
                    toast.success(t("concessionSaved"));
                    setConcessionForm({ ...concessionForm, studentProfileId: "", reason: "" });
                  } catch (err: any) {
                    toast.error(err.message || "Failed to save concession");
                  }
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8 px-4"
              >
                {t("saveConcession")}
              </Button>
            </div>
          </div>

          {/* Active Concessions Table */}
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wider font-semibold">
                <tr className="border-b border-border">
                  <th className="p-3">Student</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Discount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {concessions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      No active concessions configured.
                    </td>
                  </tr>
                ) : (
                  concessions.map((c) => (
                    <tr key={c.id}>
                      <td className="p-3 font-semibold text-foreground">
                        {c.studentProfile?.firstName} {c.studentProfile?.lastName} ({c.studentProfile?.rollNumber})
                      </td>
                      <td className="p-3 text-muted-foreground">{c.studentProfile?.class?.name || "—"}</td>
                      <td className="p-3">
                        <span className="bg-muted px-2 py-0.5 rounded-md font-mono text-[11px]">
                          {c.concessionType}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold font-mono text-emerald-600">
                        {c.discountType === "PERCENTAGE" ? `${c.discountValue}% OFF` : `-${formatCurrency(c.discountValue)}`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </TopSheet>
        </>
      )}
    </div>
  );

  function setFormData(partial: Partial<typeof formValues>) {
    setFormValues((prev) => ({ ...prev, ...partial }));
  }
}
