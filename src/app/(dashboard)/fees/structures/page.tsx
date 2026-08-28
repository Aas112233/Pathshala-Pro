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
import { BatchInvoiceModal } from "@/components/fees/batch-invoice-modal";
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
  const t = useTranslations();
  const { currencySymbol, formatCurrency } = useTenantFormatting();

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
  const [isBatchInvoiceOpen, setIsBatchInvoiceOpen] = useState(false);
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
        toast.success("Fee structure updated successfully!");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Class fee structure created successfully!");
      }
      setIsStructureSheetOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save fee structure");
    }
  };

  const handleDeleteStructure = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the fee structure for ${name}?`)) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(`Fee structure for ${name} removed.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete fee structure");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Class Tuition Fee Structures"
        description="Configure tiered monthly tuition rates, multi-head fee breakdown, and student concessions per grade."
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

          <Button
            variant="outline"
            onClick={() => setIsConcessionSheetOpen(true)}
            className="gap-2 text-xs font-semibold rounded-xl border-border"
          >
            <Percent className="h-3.5 w-3.5 text-amber-500" />
            Manage Concessions ({activeConcessionCount})
          </Button>

          <Button
            onClick={() => setIsBatchInvoiceOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-xs font-semibold rounded-xl shadow-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            1-Click Monthly Invoicing
          </Button>

          <Button
            onClick={handleOpenAddSheet}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-xs font-semibold rounded-xl shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Set Class Fee
          </Button>
        </div>
      </PageHeader>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ERPMetricCard
          title="CONFIGURED GRADES"
          subtitle="TUITION SCHEDULES"
          value={`${totalClassesConfigured} / ${activeClasses.length}`}
          trend={{ value: `${Math.round((totalClassesConfigured / (activeClasses.length || 1)) * 100)}% Coverage`, isPositive: true }}
          breakdowns={[
            { label: "Active", count: totalClassesConfigured, color: "emerald" },
            { label: "Pending", count: Math.max(0, activeClasses.length - totalClassesConfigured), color: "amber" },
          ]}
        />

        <ERPMetricCard
          title="PROJECTED REVENUE"
          subtitle="MONTHLY BILLING ESTIMATE"
          value={formatCurrency(totalProjectedMonthlyRevenue)}
          trend={{ value: "Based on active enrollments", isPositive: true }}
          breakdowns={[
            { label: "Base Tuition", count: Math.round(totalProjectedMonthlyRevenue * 0.8), color: "cyan" },
            { label: "Labs & Funds", count: Math.round(totalProjectedMonthlyRevenue * 0.2), color: "purple" },
          ]}
        />

        <ERPMetricCard
          title="AVERAGE MONTHLY FEE"
          subtitle="ACROSS ALL CONFIGURED CLASSES"
          value={formatCurrency(averageFeePerClass)}
          trend={{ value: "Institutional Avg", isPositive: true }}
          breakdowns={[
            { label: "Primary Tier", count: 1, color: "emerald" },
            { label: "Secondary Tier", count: 1, color: "amber" },
          ]}
        />

        <ERPMetricCard
          title="STUDENT CONCESSIONS"
          subtitle="WAIVERS & SCHOLARSHIPS"
          value={`${activeConcessionCount} Students`}
          trend={{ value: "Sibling & Merit", isPositive: true }}
          breakdowns={[
            { label: "Sibling (20%)", count: concessions.filter((c) => c.concessionType === "SIBLING").length, color: "cyan" },
            { label: "Scholarships", count: concessions.filter((c) => c.concessionType !== "SIBLING").length, color: "rose" },
          ]}
        />
      </div>

      {/* Class Tuition Fee Structures Matrix */}
      <Card className="border border-border/80 shadow-xs rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/10">
          <div>
            <h3 className="text-sm font-bold text-foreground">Grade-Wise Fee Structure Matrix</h3>
            <p className="text-xs text-muted-foreground">
              Tuition fee rates configured for academic year {academicYears.find((y: any) => y.id === activeYearId)?.label || "Active"}
            </p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground bg-background px-3 py-1 rounded-lg border border-border">
            {structures.length} Classes Defined
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Class / Grade</th>
                <th className="py-3 px-3">Base Tuition</th>
                <th className="py-3 px-3">Lab Fee</th>
                <th className="py-3 px-3">Computer</th>
                <th className="py-3 px-3">Exam Fee</th>
                <th className="py-3 px-3">Sports / Library</th>
                <th className="py-3 px-4 font-bold text-foreground">Total Monthly Fee</th>
                <th className="py-3 px-3 text-center">Enrollment</th>
                <th className="py-3 px-4 text-right">Projected Revenue</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">
                    Loading fee structures...
                  </td>
                </tr>
              ) : structures.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    <div className="space-y-3">
                      <Layers className="h-10 w-10 mx-auto text-muted-foreground/40" />
                      <p className="font-semibold text-sm text-foreground">No Class Fee Structures Configured Yet</p>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        Click "Set Class Fee" above to establish tuition schedules for classes in this academic year.
                      </p>
                      <Button onClick={handleOpenAddSheet} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-xs">
                        <Plus className="h-3.5 w-3.5" /> Set First Class Fee
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                structures.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    {/* Class */}
                    <td className="py-3.5 px-4 font-bold text-foreground flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
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

                    {/* Student count */}
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md text-[11px]">
                        <Users className="h-3 w-3" /> {item.studentCount}
                      </span>
                    </td>

                    {/* Projected Revenue */}
                    <td className="py-3.5 px-4 text-right font-bold text-foreground font-mono">
                      {formatCurrency(item.projectedRevenue)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditSheet(item)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          title="Edit Fee Structure"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStructure(item.id, item.class?.name || "Class")}
                          className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                          title="Delete Structure"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
        title={editingStructure ? `Edit Fee Schedule: ${editingStructure.class?.name}` : "Set Class Tuition Fee Schedule"}
        subtitle="ACADEMIC FINANCE & PRICING"
        description="Configure base monthly tuition rate and multi-head fee allocations for this grade."
        maxWidth="4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Computed Total Monthly Fee:</span>
              <span className="text-base font-bold text-emerald-600 font-mono">
                {formatCurrency(liveFormTotal)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" type="button" onClick={() => setIsStructureSheetOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveStructure}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-semibold shadow-xs"
              >
                <CheckCircle2 className="h-4 w-4" />
                {editingStructure ? "Update Fee Schedule" : "Save Class Fee Schedule"}
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSaveStructure} className="space-y-6 py-2">
          {/* Section 1: Class & Year */}
          <ERPFormSection title="Grade & Academic Year" description="Target class and billing frequency">
            <ERPFormGrid cols={3}>
              <ERPFormField label="Target Class / Grade" required>
                <select
                  value={formValues.classId}
                  onChange={(e) => setFormData({ classId: e.target.value })}
                  disabled={!!editingStructure}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs font-semibold"
                >
                  <option value="">Choose Class...</option>
                  {activeClasses.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </ERPFormField>

              <ERPFormField label="Academic Year" required>
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

              <ERPFormField label="Billing Cycle">
                <select
                  value={formValues.billingCycle}
                  onChange={(e) => setFormData({ billingCycle: e.target.value as any })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-xs"
                >
                  <option value="MONTHLY">Monthly Billing</option>
                  <option value="QUARTERLY">Quarterly Term</option>
                  <option value="BI_ANNUAL">Bi-Annual (6-Month)</option>
                  <option value="ANNUAL">Annual Fee Schedule</option>
                </select>
              </ERPFormField>
            </ERPFormGrid>
          </ERPFormSection>

          {/* Section 2: Multi-Head Fee Allocation Breakdown */}
          <ERPFormSection
            title="Multi-Head Fee Breakdown"
            description="Itemize tuition and associated institutional facilities"
          >
            <ERPFormGrid cols={3}>
              <ERPFormField label={`Base Tuition Fee (${currencySymbol})`} required>
                <Input
                  type="number"
                  min="0"
                  value={formValues.tuitionFee}
                  onChange={(e) => setFormData({ tuitionFee: parseFloat(e.target.value) || 0 })}
                  className="font-bold text-sm"
                />
              </ERPFormField>

              <ERPFormField label={`Science / Lab Fee (${currencySymbol})`}>
                <Input
                  type="number"
                  min="0"
                  value={formValues.labFee}
                  onChange={(e) => setFormData({ labFee: parseFloat(e.target.value) || 0 })}
                />
              </ERPFormField>

              <ERPFormField label={`Computer / IT Fee (${currencySymbol})`}>
                <Input
                  type="number"
                  min="0"
                  value={formValues.computerFee}
                  onChange={(e) => setFormData({ computerFee: parseFloat(e.target.value) || 0 })}
                />
              </ERPFormField>

              <ERPFormField label={`Examination Fund (${currencySymbol})`}>
                <Input
                  type="number"
                  min="0"
                  value={formValues.examFee}
                  onChange={(e) => setFormData({ examFee: parseFloat(e.target.value) || 0 })}
                />
              </ERPFormField>

              <ERPFormField label={`Sports & Physical Ed (${currencySymbol})`}>
                <Input
                  type="number"
                  min="0"
                  value={formValues.sportsFee}
                  onChange={(e) => setFormData({ sportsFee: parseFloat(e.target.value) || 0 })}
                />
              </ERPFormField>

              <ERPFormField label={`Library & Journals (${currencySymbol})`}>
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
        title="Student Fee Concessions & Scholarships"
        subtitle="DISCOUNT POLICY MATRIX"
        description="Manage automated sibling discounts, staff child waivers, and merit scholarships."
        maxWidth="3xl"
      >
        <div className="space-y-6 py-2">
          {/* Add Concession Form */}
          <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Grant New Student Concession / Waiver
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <Label className="text-xs">Student ID or Profile ID</Label>
                <Input
                  placeholder="e.g. Student CUID or roll"
                  value={concessionForm.studentProfileId}
                  onChange={(e) => setConcessionForm({ ...concessionForm, studentProfileId: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Concession Category</Label>
                <select
                  value={concessionForm.concessionType}
                  onChange={(e) => setConcessionForm({ ...concessionForm, concessionType: e.target.value as any })}
                  className="w-full h-9 px-2 rounded-md border border-input bg-background text-xs"
                >
                  <option value="SIBLING">Sibling Discount</option>
                  <option value="STAFF_CHILD">Staff Child Waiver</option>
                  <option value="MERIT">Merit Scholarship</option>
                  <option value="NEED_BASED">Need-Based / Zakat</option>
                  <option value="CUSTOM">Custom Institutional Concession</option>
                </select>
              </div>

              <div>
                <Label className="text-xs">Discount Value (% or Amount)</Label>
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
                    toast.success("Student concession saved successfully!");
                    setConcessionForm({ ...concessionForm, studentProfileId: "", reason: "" });
                  } catch (err: any) {
                    toast.error(err.message || "Failed to save concession");
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 px-4"
              >
                Apply Concession
              </Button>
            </div>
          </div>

          {/* Active Concessions Table */}
          <div className="border border-border rounded-xl overflow-hidden">
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

      {/* 1-Click Batch Monthly Invoicing Modal */}
      <BatchInvoiceModal
        isOpen={isBatchInvoiceOpen}
        onClose={() => setIsBatchInvoiceOpen(false)}
        classes={activeClasses}
      />
    </div>
  );

  function setFormData(partial: Partial<typeof formValues>) {
    setFormValues((prev) => ({ ...prev, ...partial }));
  }
}
