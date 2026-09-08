"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  GraduationCap,
  TrendingUp,
  Pencil,
  Trash2,
  Lock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  usePromotionRules,
  useCreatePromotionRule,
  useUpdatePromotionRule,
  useDeletePromotionRule,
  type PromotionRule,
} from "@/hooks/use-exams";
import { useAcademicYears, useStudents } from "@/hooks/use-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TopSheet } from "@/components/ui/top-sheet";
import { ERPFormSection, ERPFormGrid, ERPFormField } from "@/components/ui/erp-form-layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ClassOption {
  id: string;
  classId?: string;
  name: string;
  classNumber?: number;
}

export default function PromotionRulesPage() {
  const router = useRouter();
  const t = useTranslations("promotions.ruleManager");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any | null>(null);
  const [deletingRule, setDeletingRule] = useState<any | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("");

  const { data: rulesData, isLoading } = usePromotionRules({ academicYearId: selectedYear || undefined });
  const { data: academicYearsData } = useAcademicYears();
  const { data: studentsData } = useStudents();

  const createRule = useCreatePromotionRule();
  const updateRule = useUpdatePromotionRule();
  const deleteRule = useDeletePromotionRule();

  const [classesList, setClassesList] = useState<ClassOption[]>([]);

  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await fetch("/api/classes?limit=100&isActive=true");
        if (res.ok) {
          const json = await res.json();
          const items = json?.data?.items || json?.data || [];
          if (Array.isArray(items)) {
            setClassesList(items);
          }
        }
      } catch (err) {
        console.error("Failed to load classes", err);
      }
    }
    loadClasses();
  }, []);

  // Extract data from API response
  const rules = Array.isArray(rulesData) ? rulesData : (rulesData as any)?.data;
  const academicYears = Array.isArray(academicYearsData) ? academicYearsData : (academicYearsData as any)?.data;
  const students = Array.isArray(studentsData) ? studentsData : (studentsData as any)?.data;

  // Fallback to unique classes from students if classesList is empty
  const classes =
    classesList.length > 0
      ? classesList
      : Array.from(
          new Map(
            students
              ?.map((s: any) => [s.classId, s.class])
              .filter(([_, v]: any) => v)
          ).values()
        ).filter(Boolean);

  const [formData, setFormData] = useState({
    academicYearId: "",
    classId: "",
    minimumAttendance: 75,
    minimumOverallPercentage: 40,
    minimumPerSubject: 33,
    maxFailedSubjects: 0,
    allowConditionalPromotion: false,
    autoPromote: true,
    nextClassId: "",
  });

  function openCreateModal() {
    setEditingRule(null);
    setFormData({
      academicYearId: selectedYear || "",
      classId: "",
      minimumAttendance: 75,
      minimumOverallPercentage: 40,
      minimumPerSubject: 33,
      maxFailedSubjects: 0,
      allowConditionalPromotion: false,
      autoPromote: true,
      nextClassId: "",
    });
    setSheetOpen(true);
  }

  function openEditModal(rule: any) {
    if (rule.isLocked) {
      toast.error(t("lockedTooltip", { count: rule.historicalPromotionCount || 1 }));
      return;
    }
    setEditingRule(rule);
    setFormData({
      academicYearId: rule.academicYearId || "",
      classId: rule.classId || "",
      minimumAttendance: rule.minimumAttendance ?? 75,
      minimumOverallPercentage: rule.minimumOverallPercentage ?? 40,
      minimumPerSubject: rule.minimumPerSubject ?? 33,
      maxFailedSubjects: rule.maxFailedSubjects ?? 0,
      allowConditionalPromotion: Boolean(rule.allowConditionalPromotion),
      autoPromote: Boolean(rule.autoPromote),
      nextClassId: rule.nextClassId || "",
    });
    setSheetOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.academicYearId || !formData.classId) {
      toast.error(t("selectYearAndClass"));
      return;
    }

    const payload = {
      ...formData,
      nextClassId: formData.nextClassId || null,
    };

    if (editingRule) {
      updateRule.mutate(
        { id: editingRule.id, data: payload as Partial<PromotionRule> },
        {
          onSuccess: () => {
            setSheetOpen(false);
            setEditingRule(null);
          },
        }
      );
    } else {
      createRule.mutate(payload as Partial<PromotionRule>, {
        onSuccess: () => {
          setSheetOpen(false);
          setEditingRule(null);
        },
      });
    }
  }

  function handleDeleteConfirm() {
    if (!deletingRule) return;
    deleteRule.mutate(deletingRule.id, {
      onSuccess: () => {
        setDeletingRule(null);
      },
    });
  }

  function handleCalculatePromotions(rule: PromotionRule) {
    router.push(`/promotions/calculate?classId=${rule.classId}&academicYearId=${rule.academicYearId}`);
  }

  const isPending = createRule.isPending || updateRule.isPending;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("description")}
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          {t("createRule")}
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder={t("selectAcademicYear")} />
          </SelectTrigger>
          <SelectContent>
            {academicYears?.map((year: any) => (
              <SelectItem key={year.id} value={year.id}>
                {year.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Rules Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full">
            <CardGridSkeleton count={6} />
          </div>
        ) : rules?.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">{t("noRulesFound")}</p>
            <Button variant="link" onClick={openCreateModal}>
              {t("createFirstRule")}
            </Button>
          </div>
        ) : (
          rules?.map((rule: any) => (
            <Card key={rule.id} className="relative flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg font-bold">{rule.class?.name}</CardTitle>
                      <CardDescription className="text-xs">{rule.academicYear?.label}</CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline" className="text-xs border-primary/20 bg-primary/5 text-primary">
                        {rule.nextClass?.name ? t("nextClassValue", { name: rule.nextClass.name }) : t("finalGrade")}
                      </Badge>
                      {rule.isLocked && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 gap-1 py-0.5"
                          title={t("lockedTooltip", { count: rule.historicalPromotionCount })}
                        >
                          <Lock className="h-2.5 w-2.5" />
                          {t("lockedBadge")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-md bg-muted/40 border border-border/50">
                      <p className="text-muted-foreground">{t("attendance")}</p>
                      <p className="font-semibold text-foreground">{rule.minimumAttendance}%</p>
                    </div>
                    <div className="p-2 rounded-md bg-muted/40 border border-border/50">
                      <p className="text-muted-foreground">{t("overall")}</p>
                      <p className="font-semibold text-foreground">{rule.minimumOverallPercentage}%</p>
                    </div>
                    <div className="p-2 rounded-md bg-muted/40 border border-border/50">
                      <p className="text-muted-foreground">{t("perSubject")}</p>
                      <p className="font-semibold text-foreground">{rule.minimumPerSubject}%</p>
                    </div>
                    <div className="p-2 rounded-md bg-muted/40 border border-border/50">
                      <p className="text-muted-foreground">{t("maxFails")}</p>
                      <p className="font-semibold text-foreground">{rule.maxFailedSubjects}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {rule.allowConditionalPromotion && (
                      <Badge variant="secondary" className="text-[11px]">{t("conditionalOk")}</Badge>
                    )}
                    {rule.autoPromote && (
                      <Badge variant="outline" className="text-[11px]">{t("autoPromote")}</Badge>
                    )}
                  </div>
                </CardContent>
              </div>

              <CardContent className="pt-0 border-t border-border/40 mt-3">
                <div className="flex items-center justify-between gap-2 pt-3">
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5"
                    onClick={() => handleCalculatePromotions(rule)}
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    {t("calculate")}
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(rule)}
                      disabled={rule.isLocked}
                      className="h-8 px-2.5 text-xs gap-1"
                      title={rule.isLocked ? t("lockedTooltip", { count: rule.historicalPromotionCount }) : t("editRule")}
                    >
                      {rule.isLocked ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <Pencil className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">{t("editRule")}</span>
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingRule(rule)}
                      disabled={rule.isLocked}
                      className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      title={rule.isLocked ? t("lockedTooltip", { count: rule.historicalPromotionCount }) : t("deleteRule")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create / Edit TopSheet */}
      <TopSheet
        isOpen={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditingRule(null); }}
        title={editingRule ? t("editRuleTitle") : t("createRuleTitle")}
        description={editingRule ? t("editRuleDescription") : t("createRuleDescription")}
        maxWidth="2xl"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setSheetOpen(false); setEditingRule(null); }}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" form="promotion-rule-form" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  {editingRule ? t("updating") : t("creating")}
                </>
              ) : (
                editingRule ? t("saveChanges") : t("createRule")
              )}
            </Button>
          </div>
        }
      >
        <form id="promotion-rule-form" onSubmit={handleSubmit} className="space-y-5">
          <ERPFormSection>
            <ERPFormGrid cols={2}>
              <ERPFormField label={t("academicYear")} required htmlFor="academicYearId">
                <Select
                  value={formData.academicYearId}
                  onValueChange={(value) => setFormData({ ...formData, academicYearId: value })}
                  disabled={Boolean(editingRule)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectYear")} />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears?.map((year: any) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ERPFormField>
              <ERPFormField label={t("class")} required htmlFor="classId">
                <Select
                  value={formData.classId}
                  onValueChange={(value) => setFormData({ ...formData, classId: value })}
                  disabled={Boolean(editingRule)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectClass")} />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls: any) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ERPFormField>
            </ERPFormGrid>

            <ERPFormGrid cols={3}>
              <ERPFormField label={t("minAttendance")} htmlFor="minimumAttendance">
                <Input
                  id="minimumAttendance"
                  type="number"
                  min={0}
                  max={100}
                  value={formData.minimumAttendance}
                  onChange={(e) => setFormData({ ...formData, minimumAttendance: Number(e.target.value) })}
                />
              </ERPFormField>
              <ERPFormField label={t("minOverall")} htmlFor="minimumOverallPercentage">
                <Input
                  id="minimumOverallPercentage"
                  type="number"
                  min={0}
                  max={100}
                  value={formData.minimumOverallPercentage}
                  onChange={(e) => setFormData({ ...formData, minimumOverallPercentage: Number(e.target.value) })}
                />
              </ERPFormField>
              <ERPFormField label={t("minPerSubject")} htmlFor="minimumPerSubject">
                <Input
                  id="minimumPerSubject"
                  type="number"
                  min={0}
                  max={100}
                  value={formData.minimumPerSubject}
                  onChange={(e) => setFormData({ ...formData, minimumPerSubject: Number(e.target.value) })}
                />
              </ERPFormField>
            </ERPFormGrid>

            <ERPFormGrid cols={2}>
              <ERPFormField label={t("maxFailedSubjects")} htmlFor="maxFailedSubjects">
                <Input
                  id="maxFailedSubjects"
                  type="number"
                  min={0}
                  max={20}
                  value={formData.maxFailedSubjects}
                  onChange={(e) => setFormData({ ...formData, maxFailedSubjects: Number(e.target.value) })}
                />
              </ERPFormField>
              <ERPFormField label={t("nextClass")} htmlFor="nextClassId">
                <Select
                  value={formData.nextClassId || "NONE"}
                  onValueChange={(value) => setFormData({ ...formData, nextClassId: value === "NONE" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectNextClass")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">{t("noNextClass")}</SelectItem>
                    {classes.map((cls: any) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ERPFormField>
            </ERPFormGrid>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("allowConditionalPromotion")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("conditionalPromotionDescription")}
                  </p>
                </div>
                <Switch
                  checked={formData.allowConditionalPromotion}
                  onCheckedChange={(checked) => setFormData({ ...formData, allowConditionalPromotion: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("autoPromote")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("autoPromoteDescription")}
                  </p>
                </div>
                <Switch
                  checked={formData.autoPromote}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoPromote: checked })}
                />
              </div>
            </div>
          </ERPFormSection>
        </form>
      </TopSheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deletingRule)} onOpenChange={(open) => !open && setDeletingRule(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>{t("deleteRule")}</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-sm text-foreground">
              {t("deleteConfirm")}
            </DialogDescription>
          </DialogHeader>

          {deletingRule && (
            <div className="p-3 rounded-md bg-muted text-xs space-y-1">
              <p><strong className="text-foreground">{t("class")}:</strong> {deletingRule.class?.name}</p>
              <p><strong className="text-foreground">{t("academicYear")}:</strong> {deletingRule.academicYear?.label}</p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingRule(null)}
              disabled={deleteRule.isPending}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteRule.isPending}
              className="gap-1.5"
            >
              {deleteRule.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("deleteRule")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
