"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  GraduationCap,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Users,
  Sparkles,
} from "lucide-react";
import { usePromotionCalculation, useExecutePromotions } from "@/hooks/use-exams";
import { useAcademicYears, useStudents } from "@/hooks/use-queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ClassOption {
  id: string;
  classId?: string;
  name: string;
  classNumber?: number;
}

export default function PromotionsCalculatePage() {
  const router = useRouter();
  const t = useTranslations("promotions.calculator");
  const searchParams = useSearchParams();
  const classId = searchParams.get("classId");
  const academicYearId = searchParams.get("academicYearId");

  const { data: academicYearsData } = useAcademicYears();
  const { data: studentsData } = useStudents();
  const { data: calculation, isLoading, refetch } = usePromotionCalculation(
    classId || undefined,
    academicYearId || undefined
  );
  const executePromotions = useExecutePromotions();

  // Extract data from API response
  const academicYears = Array.isArray(academicYearsData)
    ? academicYearsData
    : (academicYearsData as any)?.data;
  const students = Array.isArray(studentsData)
    ? studentsData
    : (studentsData as any)?.data;

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState(classId || "");
  const [selectedYear, setSelectedYear] = useState(academicYearId || "");

  // Load all active classes directly
  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await fetch("/api/classes?limit=100&isActive=true");
        if (res.ok) {
          const json = await res.json();
          const items = json?.data?.items || json?.data || [];
          if (Array.isArray(items)) {
            setClasses(items);
          }
        }
      } catch (err) {
        console.error("Failed to load classes", err);
      }
    }
    loadClasses();
  }, []);

  // Fallback to student class mappings if classes API not yet loaded
  const availableClasses: ClassOption[] =
    classes.length > 0
      ? classes
      : ((Array.from(
          new Map(
            students
              ?.map((s: any) => [s.classId, s.class])
              .filter(([_, v]: any) => v)
          ).values()
        ).filter(Boolean) as unknown) as ClassOption[]);

  function handleClassChange(value: string) {
    setSelectedClass(value);
    window.history.pushState({}, "", `?classId=${value}&academicYearId=${selectedYear}`);
  }

  function handleYearChange(value: string) {
    setSelectedYear(value);
    window.history.pushState({}, "", `?classId=${selectedClass}&academicYearId=${value}`);
  }

  async function handleExecutePromotions() {
    if (!calculation) return;

    const calcData = Array.isArray(calculation) ? calculation[0] : calculation;
    const eligibleStudents = calcData.students.filter(
      (s: any) => s.eligible && s.action === "PROMOTED"
    );

    if (eligibleStudents.length === 0) {
      toast.error(t("noEligibleToast"));
      return;
    }

    const confirmMsg = t("confirmExecute", { count: eligibleStudents.length });
    if (!confirm(confirmMsg)) return;

    const promotionsData = eligibleStudents
      .map((student: any) => {
        const studentProfileId =
          student.studentProfileId ||
          student.id ||
          students?.find((s: any) => s.studentId === student.studentId || s.id === student.id)?.id ||
          student.studentId ||
          "";

        const fromClassId = student.fromClassId || student.currentClassId || selectedClass;
        const toClassId =
          student.suggestedNextClassId ||
          calcData.nextClass?.id ||
          calcData.promotionRule?.nextClassId ||
          "";

        return {
          studentProfileId,
          fromAcademicYearId: selectedYear,
          toAcademicYearId: selectedYear,
          fromClassId,
          toClassId,
          status: "PROMOTED" as const,
          reason: t("promotionReason", {
            percentage: calcData.promotionRule?.minimumOverallPercentage || 0,
          }),
        };
      })
      .filter((p: any) => p.studentProfileId && p.fromClassId && p.toClassId);

    if (promotionsData.length === 0) {
      toast.error("Unable to prepare promotions data. Missing student IDs or next class configuration.");
      return;
    }

    try {
      await executePromotions.mutateAsync(promotionsData);
      toast.success(t("successPromoted", { count: promotionsData.length }));
      refetch();
    } catch (error) {
      // Error toast already handled by hook onError
    }
  }

  function getStatusBadgeVariant(action: string) {
    switch (action) {
      case "PROMOTED":
        return "default";
      case "RETAINED":
        return "destructive";
      case "CONDITIONAL_PROMOTED":
        return "secondary";
      default:
        return "outline";
    }
  }

  function getStatusLabel(action: string) {
    switch (action) {
      case "PROMOTED":
        return t("status.promoted");
      case "RETAINED":
        return t("status.retained");
      case "CONDITIONAL_PROMOTED":
        return t("status.conditionalPromoted");
      default:
        return action.replace("_", " ");
    }
  }

  const calcData = calculation
    ? Array.isArray(calculation)
      ? calculation[0]
      : calculation
    : null;

  // Resolve human-readable next class name
  const nextClassName =
    calcData?.nextClass?.name ||
    calcData?.promotionRule?.nextClassName ||
    calcData?.students[0]?.suggestedNextClassName ||
    availableClasses.find((c: ClassOption) => c.id === calcData?.students[0]?.suggestedNextClassId)?.name ||
    (calcData?.students[0]?.suggestedNextClassId ? t("classAssigned") : t("graduatedFinalClass"));

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <GraduationCap className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {t("title")}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5 ml-1">
            {t("description")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/promotions/rules")}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("backToRules")}
          </Button>

          {calcData && (
            <Button
              onClick={handleExecutePromotions}
              disabled={calcData.eligibleCount === 0 || executePromotions.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm gap-2 font-medium"
            >
              {executePromotions.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("promoting")}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t("executeShort", { count: calcData.eligibleCount })}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Class & Academic Year Selection Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-xs border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{t("selectClass")}</CardTitle>
            <CardDescription className="text-xs">
              {t("selectClassDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedClass} onValueChange={handleClassChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("selectClassPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {availableClasses.map((cls: any) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{t("selectAcademicYear")}</CardTitle>
            <CardDescription className="text-xs">
              {t("selectAcademicYearDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("selectAcademicYearPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {academicYears?.map((year: any) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Results Section */}
      {calcData && (
        <div className="space-y-6">
          {/* Executive Action Banner */}
          <div className="relative overflow-hidden rounded-lg border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t("calculationComplete")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("nextClass")}: <strong className="text-foreground">{nextClassName}</strong>
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground tracking-tight">
                  {calcData.eligibleCount > 0
                    ? t("readyToPromote", {
                        eligible: calcData.eligibleCount,
                        total: calcData.totalStudents,
                        nextClass: nextClassName,
                      })
                    : t("noStudentsMeetCriteria")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("executionDescription", { nextClass: nextClassName })}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                <Button
                  size="lg"
                  onClick={handleExecutePromotions}
                  disabled={calcData.eligibleCount === 0 || executePromotions.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 gap-2.5 px-6 h-12 text-base rounded-lg"
                >
                  {executePromotions.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {t("executingPromotions")}
                    </>
                  ) : (
                    <>
                      <GraduationCap className="h-5 w-5" />
                      {t("executePromotions", { count: calcData.eligibleCount })}
                      <ArrowRight className="h-4 w-4 ml-0.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* 4-Column Balanced Summary Metric Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Students */}
            <Card className="shadow-xs border-border/60">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("totalAssessed")}
                  </p>
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
                    {calcData.totalStudents}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{t("studentsEnrolled")}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted text-muted-foreground">
                  <Users className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            {/* Eligible */}
            <Card className="shadow-xs border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    {t("eligibleForPromotion")}
                  </p>
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-1">
                    {calcData.eligibleCount}
                  </div>
                  <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-1">
                    {calcData.totalStudents > 0
                      ? t("passingRate", { rate: Math.round((calcData.eligibleCount / calcData.totalStudents) * 100) })
                      : t("passingRate", { rate: 0 })}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            {/* Retained */}
            <Card className="shadow-xs border-rose-500/20 bg-rose-500/5">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                    {t("retainedInGrade")}
                  </p>
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-1">
                    {calcData.retainedCount}
                  </div>
                  <p className="text-xs text-rose-700/70 dark:text-rose-400/70 mt-1">{t("requiresRepetition")}</p>
                </div>
                <div className="p-3 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <XCircle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            {/* Conditional */}
            <Card className="shadow-xs border-amber-500/20 bg-amber-500/5">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    {t("conditionalPromotion")}
                  </p>
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-1">
                    {calcData.conditionalCount}
                  </div>
                  <p className="text-xs text-amber-700/70 dark:text-amber-400/70 mt-1">{t("reExamRequiredLabel")}</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Promotion Rules Criteria Applied */}
          <Card className="shadow-xs border-border/60">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                <TrendingUp className="h-4 w-4 text-primary" />
                {t("activePromotionCriteria")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                  <p className="text-xs font-medium text-muted-foreground">{t("minAttendance")}</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">
                    {calcData.promotionRule.minimumAttendance}%
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                  <p className="text-xs font-medium text-muted-foreground">{t("minOverallAverage")}</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">
                    {calcData.promotionRule.minimumOverallPercentage}%
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                  <p className="text-xs font-medium text-muted-foreground">{t("minPerSubject")}</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">
                    {calcData.promotionRule.minimumPerSubject}%
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                  <p className="text-xs font-medium text-muted-foreground">{t("maxFailedSubjects")}</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">
                    {calcData.promotionRule.maxFailedSubjects}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Student Details Eligibility Table */}
          <Card className="shadow-xs border-border/60 overflow-hidden">
            <CardHeader className="border-b border-border/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold">{t("studentEligibilityBreakdown")}</CardTitle>
                  <CardDescription className="text-xs">
                    {t("eligibilityDescription")}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 self-start sm:self-auto">
                  <Download className="h-4 w-4" />
                  {t("exportRoster")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">{t("student")}</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">{t("rollNo")}</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">{t("average")}</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">{t("failedSubjects")}</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">{t("statusLabel")}</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">{t("targetClass")}</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">{t("evaluationReason")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calcData.students.map((student: any) => (
                      <TableRow key={student.studentId} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div>
                            <p className="font-semibold text-foreground text-sm">{student.studentName}</p>
                            <p className="text-xs text-muted-foreground font-mono">{student.studentId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm font-medium">{student.rollNumber || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Progress
                              value={parseFloat(student.metrics.overallPercentage)}
                              className="w-20 h-2"
                            />
                            <span
                              className={`text-xs font-bold ${
                                parseFloat(student.metrics.overallPercentage) >= 70
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : parseFloat(student.metrics.overallPercentage) >= 40
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {student.metrics.overallPercentage}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {student.metrics.failedSubjectsCount > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {student.metrics.failedSubjects.map((subject: any, i: number) => (
                                <Badge
                                  key={i}
                                  variant="destructive"
                                  className="text-[11px] font-medium px-1.5 py-0"
                                >
                                  {subject}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              None
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getStatusBadgeVariant(student.action)}
                            className="text-xs font-medium px-2 py-0.5 gap-1"
                          >
                            {student.action === "PROMOTED" && <CheckCircle2 className="h-3 w-3" />}
                            {student.action === "RETAINED" && <XCircle className="h-3 w-3" />}
                            {student.action === "CONDITIONAL_PROMOTED" && (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            {getStatusLabel(student.action)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-xs font-medium border-primary/20 bg-primary/5 text-primary"
                          >
                            {student.action === "RETAINED"
                              ? student.currentClass || t("currentClass")
                              : student.suggestedNextClassName || nextClassName}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-md space-y-0.5">
                            {student.reasons.map((reason: any, i: number) => (
                              <p key={i} className="text-xs text-muted-foreground">
                                • {reason}
                              </p>
                            ))}
                            {student.reExamAllowed && (
                              <Badge
                                variant="outline"
                                className="mt-1 text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                              >
                                {t("reExamPermitted")}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {(!selectedClass || !selectedYear) && (
        <Card className="border-dashed border-2 border-border/80 shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-lg bg-muted/60 text-muted-foreground mb-4">
              <GraduationCap className="h-10 w-10 text-primary/70" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1.5">{t("selectClassAndYear")}</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {t("selectClassAndYearDescription")}
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-6" aria-busy="true">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="shadow-xs border-border/60">
                <CardContent className="p-5 space-y-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-36" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="shadow-xs border-border/60">
            <CardContent className="p-6">
              <TableSkeleton rows={6} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
