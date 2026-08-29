"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  Trophy,
  Download,
  FileSpreadsheet,
  Users,
  TrendingUp,
  Award,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { usePDFExport } from "@/hooks/use-pdf-export";
import { useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { toast } from "sonner";
import type { BatchStudentResult } from "@/lib/pdf-templates";

interface ClassGradebookMatrixProps {
  exams: Array<{ id: string; name: string; academicYear?: { name: string } }>;
  classes: Array<{ id: string; name: string }>;
}

export function ClassGradebookMatrix({ exams, classes }: ClassGradebookMatrixProps) {
  const t = useTranslations("results");
  const { settings } = useTenantSettings();
  const { exportBatchReportCardsPDF } = usePDFExport();

  const [selectedExam, setSelectedExam] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Fetch batch results
  const {
    data: batchData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["batch-report-cards", selectedExam, selectedClass],
    queryFn: async () => {
      if (!selectedExam || !selectedClass) return null;
      const res = await fetch(
        `/api/exams/${selectedExam}/batch-report-cards?classId=${selectedClass}`
      );
      if (!res.ok) throw new Error("Failed to load class gradebook");
      const json = await res.json();
      return json.data;
    },
    enabled: !!selectedExam && !!selectedClass,
  });

  const students: BatchStudentResult[] = batchData?.students || [];
  const statistics = batchData?.statistics;
  const examInfo = batchData?.exam;
  const classInfo = batchData?.class;

  // Extract all distinct subject names for column headers
  const subjectHeaders: Array<{ name: string; code: string; maxMarks: number }> = [];
  if (students.length > 0 && students[0].subjects) {
    for (const sub of students[0].subjects) {
      subjectHeaders.push({
        name: sub.subjectName,
        code: sub.subjectCode,
        maxMarks: sub.maxMarks,
      });
    }
  }

  // Find class topper
  const classTopper = students.find((s) => s.rank === 1);

  const handleDownloadBatchPDF = async () => {
    if (!students || students.length === 0) {
      toast.error(t("noStudentResultsPdf"));
      return;
    }

    setIsGeneratingPDF(true);
    const toastId = toast.loading(t("generatingPdf"));

    try {
      const fileName = `${(classInfo?.name || "Class").replace(/\s+/g, "_")}_${(
        examInfo?.name || "Exam"
      ).replace(/\s+/g, "_")}_Report_Cards.pdf`;

      const result = await exportBatchReportCardsPDF({
        school: {
          name: settings.name || "Pathshala Pro School",
          address: settings.address || "Main Campus",
          phone: settings.phone || "",
          email: settings.email || "",
        },
        students,
        fileName,
      });

      if (result.success) {
        toast.success(t("batchPdfDownloaded"), { id: toastId });
      } else {
        toast.error(t("pdfFailed"), { id: toastId });
      }
    } catch (err) {
      console.error("Batch PDF generation error:", err);
      toast.error(t("pdfError"), { id: toastId });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleExportCSV = () => {
    if (!students || students.length === 0) {
      toast.error(t("noDataExport"));
      return;
    }

    const headers = [
      t("rank"),
      t("rollNo"),
      t("studentName"),
      t("admissionNo"),
      ...subjectHeaders.map((s) => `${s.name} (${s.maxMarks})`),
      t("totalObtained"),
      t("totalMax"),
      t("percentage"),
      t("gpa"),
      t("grade"),
      t("status"),
    ];

    const rows = students.map((st) => [
      st.rankLabel,
      st.student.rollNumber,
      `"${st.student.name}"`,
      st.student.admissionNumber,
      ...st.subjects.map((sub) => sub.obtainedMarks),
      st.totalObtainedMarks,
      st.totalMaxMarks,
      st.percentage,
      st.gpa.toFixed(2),
      st.letterGrade,
      st.passed ? t("passedStatus") : t("failedStatus"),
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${(classInfo?.name || "Class").replace(/\s+/g, "_")}_Gradebook_Matrix.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t("csvExported"));
  };

  return (
    <div className="space-y-6">
      {/* Selection Control Bar */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                {t("selectExamLabel")}
              </label>
              <div className="mt-1">
                <AppDropdown
                  value={selectedExam}
                  onChange={setSelectedExam}
                  options={exams.map((e) => ({
                    value: e.id,
                    label: `${e.name} ${e.academicYear ? `(${e.academicYear.name})` : ""}`,
                  }))}
                  placeholder={t("chooseExam")}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                {t("selectClassGrade")}
              </label>
              <div className="mt-1">
                <AppDropdown
                  value={selectedClass}
                  onChange={setSelectedClass}
                  options={classes.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                  placeholder={t("chooseClass")}
                />
              </div>
            </div>

            <div className="flex items-end gap-2">
              <Button
                onClick={() => refetch()}
                disabled={!selectedExam || !selectedClass || isLoading}
                className="w-full h-10 gap-2 font-medium"
              >
                {isLoading || isFetching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("loadingMatrix")}
                  </>
                ) : (
                  <>
                    <Trophy className="h-4 w-4" />
                    {t("loadGradebook")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gradebook Content */}
      {students.length > 0 && statistics && (
        <div className="space-y-6">
          {/* Action Header & KPIs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted/40 p-4 rounded-lg border border-border">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <span>{classInfo?.name}</span>
                <span className="text-muted-foreground font-normal">•</span>
                <span className="text-primary">{examInfo?.name} {t("gradebook")}</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("gradebookSummary")}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="h-9 gap-1.5 text-xs font-semibold"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                {t("exportCsv")}
              </Button>
              <Button
                size="sm"
                onClick={handleDownloadBatchPDF}
                disabled={isGeneratingPDF}
                className="h-9 gap-1.5 text-xs font-semibold bg-primary text-primary-foreground shadow-sm"
              >
                {isGeneratingPDF ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("generatingPdf")}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    {t("downloadReportCards")}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Metric Cards Row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{statistics.totalStudents}</p>
                  <p className="text-xs text-muted-foreground font-medium">{t("studentsInClass")}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{statistics.classAverage}%</p>
                  <p className="text-xs text-muted-foreground font-medium">{t("classAverageScore")}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">
                    {statistics.passRate}%
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">
                    {t("passRate")} ({statistics.passCount}/{statistics.totalStudents})
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 shadow-xs">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-600">
                  <Award className="h-5 w-5" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-300 truncate">
                    {classTopper ? classTopper.student.name : t("notAvailable")}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                    {t("firstPosition")} ({classTopper?.percentage}%)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Matrix Spreadsheet View */}
          <Card className="border-border shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/80 border-b border-border text-muted-foreground font-bold uppercase tracking-wider">
                    <th className="py-3 px-3 text-center w-16">{t("rank")}</th>
                    <th className="py-3 px-3 w-20">{t("rollNo")}</th>
                    <th className="py-3 px-4 min-w-[180px]">{t("studentName")}</th>
                    {subjectHeaders.map((sub, sIdx) => (
                      <th key={sIdx} className="py-3 px-3 text-center min-w-[110px]">
                        <div>{sub.name}</div>
                        <div className="text-[10px] text-muted-foreground font-normal">
                          {t("max")}: {sub.maxMarks}
                        </div>
                      </th>
                    ))}
                    <th className="py-3 px-3 text-right min-w-[100px]">{t("totalScore")}</th>
                    <th className="py-3 px-3 text-right w-20">{t("percentage")}</th>
                    <th className="py-3 px-3 text-right w-16">{t("gpa")}</th>
                    <th className="py-3 px-3 text-center w-24">{t("status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-card">
                  {students.map((st) => {
                    const isTop3 = st.rank <= 3;
                    const rankColor =
                      st.rank === 1
                        ? "bg-amber-500 text-white font-bold"
                        : st.rank === 2
                        ? "bg-muted text-muted-foreground font-bold"
                        : st.rank === 3
                        ? "bg-amber-700 text-white font-bold"
                        : "bg-muted text-muted-foreground";

                    return (
                      <tr
                        key={st.student.id}
                        className={`hover:bg-muted/30 transition-colors ${
                          st.rank === 1 ? "bg-amber-50/30 dark:bg-amber-950/10" : ""
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center h-6 w-8 rounded-full text-[11px] ${rankColor}`}
                          >
                            {st.rankLabel}
                          </span>
                        </td>

                        {/* Roll */}
                        <td className="py-3 px-3 font-mono font-semibold text-muted-foreground">
                          {st.student.rollNumber}
                        </td>

                        {/* Name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {st.rank === 1 && <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                            <div>
                              <p className="font-semibold text-foreground">{st.student.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {st.student.admissionNumber}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Subject Marks */}
                        {st.subjects.map((sub, subIdx) => {
                          const isFailed = sub.obtainedMarks < sub.passMarks;
                          return (
                            <td key={subIdx} className="py-3 px-3 text-center">
                              <div
                                className={`font-semibold ${
                                  isFailed ? "text-destructive font-bold" : "text-foreground"
                                }`}
                              >
                                {sub.obtainedMarks}
                              </div>
                              <div
                                className={`text-[10px] ${
                                  isFailed ? "text-destructive" : "text-primary"
                                }`}
                              >
                                {sub.grade} ({sub.gradePoint.toFixed(1)})
                              </div>
                            </td>
                          );
                        })}

                        {/* Total Score */}
                        <td className="py-3 px-3 text-right font-mono font-semibold text-foreground">
                          {st.totalObtainedMarks} / {st.totalMaxMarks}
                        </td>

                        {/* Percentage */}
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          <span
                            className={
                              st.percentage >= 80
                                ? "text-emerald-600"
                                : st.percentage >= 60
                                ? "text-blue-600"
                                : st.percentage >= 33
                                ? "text-amber-600"
                                : "text-destructive"
                            }
                          >
                            {st.percentage}%
                          </span>
                        </td>

                        {/* GPA */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-foreground">
                          {st.gpa.toFixed(2)}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 text-center">
                          <StatusBadge
                            status={st.passed ? "PASS" : "FAIL"}
                            variant={st.passed ? "success" : "error"}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {(!selectedExam || !selectedClass || (students.length === 0 && !isLoading)) && (
        <div className="text-center py-16 px-4 rounded-lg border-2 border-dashed border-border/80 bg-card">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 text-primary">
            <Trophy className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">{t("gradebookBatchTitle")}</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
            {t("gradebookBatchDescription")}
          </p>
        </div>
      )}
    </div>
  );
}
