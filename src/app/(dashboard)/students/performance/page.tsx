"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  GraduationCap,
  TrendingUp,
  Award,
  CalendarCheck,
  ClipboardCheck,
  Printer,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  BookOpen,
  User,
  School,
  Calendar,
  Layers,
  Search,
} from "lucide-react";
import { useStudents, useAcademicYears, useStudentPerformance } from "@/hooks/use-queries";
import { ERPMetricCard } from "@/components/ui/erp-metric-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ClassItem {
  id: string;
  name: string;
  classNumber?: number;
}

interface SectionItem {
  id: string;
  classId: string;
  name: string;
}

export default function StudentPerformancePage() {
  const t = useTranslations("studentPerformance");
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialStudentId = searchParams.get("studentId") || "";
  const initialAcademicYearId = searchParams.get("academicYearId") || "";

  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId);
  const [selectedYearId, setSelectedYearId] = useState<string>(initialAcademicYearId);
  const [studentSearchText, setStudentSearchText] = useState<string>("");

  const [classesList, setClassesList] = useState<ClassItem[]>([]);
  const [sectionsList, setSectionsList] = useState<SectionItem[]>([]);

  // 1. Fetch Classes & Sections
  useEffect(() => {
    async function loadAcademicStructure() {
      try {
        const [classesRes, sectionsRes] = await Promise.all([
          fetch("/api/classes?limit=100&isActive=true"),
          fetch("/api/sections?limit=100"),
        ]);
        if (classesRes.ok) {
          const json = await classesRes.json();
          const items = json?.data?.items || json?.data || [];
          if (Array.isArray(items)) setClassesList(items);
        }
        if (sectionsRes.ok) {
          const json = await sectionsRes.json();
          const items = json?.data?.items || json?.data || [];
          if (Array.isArray(items)) setSectionsList(items);
        }
      } catch (err) {
        console.error("Failed to load academic structure", err);
      }
    }
    loadAcademicStructure();
  }, []);

  // 2. Fetch Students List for Selection
  const { data: studentsData, isLoading: isStudentsLoading } = useStudents({
    limit: 200,
  });

  const studentsList: any[] = useMemo(() => {
    const raw = (studentsData as any)?.data?.items || (studentsData as any)?.data || studentsData || [];
    return Array.isArray(raw) ? raw : [];
  }, [studentsData]);

  // 3. Fetch Academic Years
  const { data: academicYearsData } = useAcademicYears();
  const academicYears: any[] = useMemo(() => {
    const raw = (academicYearsData as any)?.data || academicYearsData || [];
    return Array.isArray(raw) ? raw : [];
  }, [academicYearsData]);

  // Auto-select academic year if not set
  useEffect(() => {
    if (!selectedYearId && academicYears.length > 0) {
      const active = academicYears.find((y) => !y.isClosed) || academicYears[0];
      if (active?.id) setSelectedYearId(active.id);
    }
  }, [academicYears, selectedYearId]);

  // If initialStudentId provided, pre-select student's class and section
  useEffect(() => {
    if (initialStudentId && studentsList.length > 0 && !selectedStudentId) {
      const match = studentsList.find((s) => s.id === initialStudentId || s.studentId === initialStudentId);
      if (match) {
        setSelectedStudentId(match.id);
        if (match.classId) setSelectedClassId(match.classId);
        if (match.sectionId) setSelectedSectionId(match.sectionId);
      }
    }
  }, [initialStudentId, studentsList, selectedStudentId]);

  // 4. Fetch 360-Degree Performance Data for Selected Student
  const {
    data: performanceData,
    isLoading: isPerformanceLoading,
  } = useStudentPerformance(selectedStudentId, selectedYearId || undefined);

  const performance = (performanceData as any)?.data || performanceData;

  // Filter sections by selected class
  const filteredSections = useMemo(() => {
    if (!selectedClassId) return sectionsList;
    return sectionsList.filter((s) => s.classId === selectedClassId);
  }, [sectionsList, selectedClassId]);

  // Filter students for searchable dropdown
  const filteredStudents = useMemo(() => {
    if (!studentSearchText.trim()) return studentsList;
    const q = studentSearchText.toLowerCase();
    return studentsList.filter((s) => {
      const fullName = `${s.firstName || ""} ${s.lastName || ""}`.toLowerCase();
      const roll = (s.rollNumber || "").toLowerCase();
      const id = (s.studentId || "").toLowerCase();
      return fullName.includes(q) || roll.includes(q) || id.includes(q);
    });
  }, [studentsList, studentSearchText]);

  function handleSelectStudent(studentId: string) {
    setSelectedStudentId(studentId);
    router.replace(`/students/performance?studentId=${studentId}${selectedYearId ? `&academicYearId=${selectedYearId}` : ""}`);
  }

  function handlePrintTranscript() {
    window.print();
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 print:p-0 print:m-0">
      {/* Header (Hidden on Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-primary" />
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("description")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {performance && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintTranscript}
              className="gap-2 shadow-xs"
            >
              <Printer className="h-4 w-4" />
              {t("printReport")}
            </Button>
          )}
        </div>
      </div>

      {/* Selector & Filter Toolbar (Hidden on Print) */}
      <Card className="border-border/60 shadow-xs print:hidden">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Class Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("selectClass")}
              </label>
              <Select
                value={selectedClassId}
                onValueChange={(val) => {
                  setSelectedClassId(val === "ALL" ? "" : val);
                  setSelectedSectionId("");
                  setSelectedStudentId("");
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t("selectClass")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("allSections")}</SelectItem>
                  {classesList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("selectSection")}
              </label>
              <Select
                value={selectedSectionId}
                onValueChange={(val) => {
                  setSelectedSectionId(val === "ALL" ? "" : val);
                  setSelectedStudentId("");
                }}
                disabled={!selectedClassId}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t("selectSection")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("allSections")}</SelectItem>
                  {filteredSections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Student Search & Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("selectStudent")}
              </label>
              <Select
                value={selectedStudentId}
                onValueChange={handleSelectStudent}
                disabled={studentsList.length === 0}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={studentsList.length === 0 ? t("noResults") : t("selectStudent")} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {studentsList.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-medium">{s.firstName} {s.lastName}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({s.rollNumber || s.studentId})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Academic Session */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("academicSession")}
              </label>
              <Select
                value={selectedYearId}
                onValueChange={(val) => setSelectedYearId(val)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t("currentSession")} />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((year: any) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      {!selectedStudentId ? (
        <Card className="border-dashed border-2 py-16 text-center shadow-xs">
          <CardContent className="space-y-4 max-w-md mx-auto">
            <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <GraduationCap className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-foreground">{t("noStudentSelected")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("selectStudentPrompt")}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : isPerformanceLoading ? (
        <div className="space-y-6">
          <CardGridSkeleton count={4} />
          <div className="h-64 rounded-xl bg-muted/40 animate-pulse" />
        </div>
      ) : !performance ? (
        <Card className="py-12 text-center">
          <CardContent className="space-y-2">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-base font-medium text-foreground">{t("noPerformanceData")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6 print:space-y-4">
          {/* Institutional Printable Header (Only visible on Print) */}
          <div className="hidden print:block border-b pb-4 mb-4 text-center space-y-1">
            <h2 className="text-2xl font-bold text-black uppercase tracking-wider">{t("officialTranscript")}</h2>
            <p className="text-xs text-muted-foreground">{performance.academicYear?.label} — {t("generatedOn", { date: new Date().toLocaleDateString() })}</p>
          </div>

          {/* Student Banner */}
          <Card className="border-border/70 bg-gradient-to-r from-primary/5 via-card to-card overflow-hidden shadow-xs">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xl sm:text-2xl border-2 border-primary/20 shrink-0">
                    {performance.student.firstName?.[0]}{performance.student.lastName?.[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                        {performance.student.firstName} {performance.student.lastName}
                      </h2>
                      {performance.student.firstNameBn && (
                        <span className="text-sm font-medium text-muted-foreground">
                          ({performance.student.firstNameBn} {performance.student.lastNameBn || ""})
                        </span>
                      )}
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                        {performance.student.status}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Award className="h-3.5 w-3.5 text-primary" />
                        <strong>{t("rollNumber")}:</strong> {performance.student.rollNumber || "N/A"}
                      </span>
                      <span className="flex items-center gap-1">
                        <School className="h-3.5 w-3.5" />
                        <strong>{t("classSection")}:</strong> {performance.student.className} {performance.student.sectionName ? `(${performance.student.sectionName})` : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        <strong>{t("studentId")}:</strong> {performance.student.studentId}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Risk Level Badge */}
                <div className="flex flex-col sm:items-end gap-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    {t("riskLevel")}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs px-2.5 py-1 font-semibold gap-1.5",
                      performance.insights.riskLevel === "LOW" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                      performance.insights.riskLevel === "MODERATE" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                      performance.insights.riskLevel === "HIGH" && "bg-destructive/10 text-destructive border-destructive/20"
                    )}
                  >
                    {performance.insights.riskLevel === "LOW" && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {performance.insights.riskLevel === "MODERATE" && <AlertTriangle className="h-3.5 w-3.5" />}
                    {performance.insights.riskLevel === "HIGH" && <AlertCircle className="h-3.5 w-3.5" />}
                    {performance.insights.riskLevel === "LOW" && t("riskLow")}
                    {performance.insights.riskLevel === "MODERATE" && t("riskModerate")}
                    {performance.insights.riskLevel === "HIGH" && t("riskHigh")}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4 Core KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ERPMetricCard
              subtitle={t("cumulativeGpa")}
              title={`Grade ${performance.metrics.letterGrade}`}
              value={`${performance.metrics.cumulativeGpa.toFixed(2)} / ${performance.metrics.maxGpa.toFixed(1)}`}
              icon={GraduationCap}
              breakdowns={[
                {
                  label: `${performance.metrics.overallPercentage}% ${t("overallPercentage")}`,
                  count: `${performance.metrics.totalSubjectsPassed} Passed`,
                  color: "emerald",
                },
              ]}
            />

            <ERPMetricCard
              subtitle={t("meritRank")}
              title={t("topPercentile", { percentile: performance.metrics.percentile })}
              value={performance.metrics.meritRankLabel}
              icon={Award}
              breakdowns={[
                {
                  label: t("cohortRank", {
                    rank: performance.metrics.meritRank,
                    total: performance.metrics.totalClassStudents,
                  }),
                  count: `#${performance.metrics.meritRank}`,
                  color: "indigo",
                },
              ]}
            />

            <ERPMetricCard
              subtitle={t("attendanceRate")}
              title={performance.attendance.status}
              value={`${performance.attendance.attendanceRate}%`}
              icon={CalendarCheck}
              breakdowns={[
                {
                  label: t("daysPresent", {
                    present: performance.attendance.presentDays,
                    total: performance.attendance.totalDays,
                  }),
                  count: `${performance.attendance.presentDays}d`,
                  color: performance.attendance.attendanceRate >= 75 ? "emerald" : "rose",
                },
              ]}
            />

            <ERPMetricCard
              subtitle={t("homeworkCompletion")}
              title={`${performance.homework.onTimeCount} On-Time`}
              value={`${performance.homework.completionRate}%`}
              icon={ClipboardCheck}
              breakdowns={[
                {
                  label: t("submissionsCount", {
                    submitted: performance.homework.submittedCount,
                    total: performance.homework.totalAssigned,
                  }),
                  count: `${performance.homework.averageScorePercentage}%`,
                  color: "purple",
                },
              ]}
            />
          </div>

          {/* Subject Mastery Matrix & Benchmarking */}
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    {t("subjectMastery")}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {t("subjectMasteryDescription")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 border-b border-border/60 text-xs font-semibold text-muted-foreground uppercase">
                    <tr>
                      <th className="py-3 px-4">{t("subject")}</th>
                      <th className="py-3 px-3 text-center">{t("obtainedMarks")}</th>
                      <th className="py-3 px-3 text-center">{t("percentage")}</th>
                      <th className="py-3 px-3 text-center">{t("grade")}</th>
                      <th className="py-3 px-3 text-center">{t("gradePoint")}</th>
                      <th className="py-3 px-4 min-w-[180px]">{t("classAverage")}</th>
                      <th className="py-3 px-3 text-center">{t("masteryLevel")}</th>
                      <th className="py-3 px-3 text-center">{t("trend")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {performance.subjectMastery.map((sub: any) => {
                      const diff = Math.round((sub.percentage - sub.classAveragePercentage) * 10) / 10;
                      return (
                        <tr key={sub.subjectId} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-medium text-foreground">
                            <div>{sub.subjectName}</div>
                            <div className="text-[11px] text-muted-foreground">{sub.subjectCode}</div>
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-foreground">
                            {sub.obtainedMarks} <span className="text-xs text-muted-foreground font-normal">/ {sub.maxMarks}</span>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-primary">
                            {sub.percentage}%
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Badge variant="outline" className="font-semibold text-xs">
                              {sub.letterGrade}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-center font-medium">
                            {sub.gradePoint.toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Student: <strong className="text-foreground">{sub.percentage}%</strong></span>
                                <span>Class: <strong>{sub.classAveragePercentage}%</strong></span>
                              </div>
                              <Progress value={sub.percentage} className="h-1.5" />
                              <div className="text-[11px] flex items-center gap-1">
                                {diff > 0 ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center">
                                    <ArrowUpRight className="h-3 w-3" /> +{diff}% vs Class
                                  </span>
                                ) : diff < 0 ? (
                                  <span className="text-rose-600 dark:text-rose-400 flex items-center">
                                    <ArrowDownRight className="h-3 w-3" /> {diff}% vs Class
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground flex items-center">
                                    <Minus className="h-3 w-3" /> Matched Class Avg
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[11px] px-2 py-0.5 font-medium",
                                sub.masteryLevel === "EXCELLENT" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                                sub.masteryLevel === "PROFICIENT" && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
                                sub.masteryLevel === "DEVELOPING" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                                sub.masteryLevel === "NEEDS_SUPPORT" && "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                              )}
                            >
                              {sub.masteryLevel === "EXCELLENT" && t("masteryExcellent")}
                              {sub.masteryLevel === "PROFICIENT" && t("masteryProficient")}
                              {sub.masteryLevel === "DEVELOPING" && t("masteryDeveloping")}
                              {sub.masteryLevel === "NEEDS_SUPPORT" && t("masteryNeedsSupport")}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {sub.trend === "IMPROVING" && (
                              <Badge variant="outline" className="text-[11px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400 gap-0.5">
                                <ArrowUpRight className="h-3 w-3" /> {t("improving")}
                              </Badge>
                            )}
                            {sub.trend === "STABLE" && (
                              <Badge variant="outline" className="text-[11px] text-muted-foreground gap-0.5">
                                <Minus className="h-3 w-3" /> {t("stable")}
                              </Badge>
                            )}
                            {sub.trend === "DECLINING" && (
                              <Badge variant="outline" className="text-[11px] border-rose-500/30 text-rose-600 dark:text-rose-400 gap-0.5">
                                <ArrowDownRight className="h-3 w-3" /> {t("declining")}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Exam Progression & Chronological Trends */}
          {performance.examProgression?.length > 0 && (
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  {t("examProgression")}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {t("examProgressionDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {performance.examProgression.map((ex: any, idx: number) => (
                    <div
                      key={ex.examId || idx}
                      className="p-4 rounded-xl border border-border/70 bg-card hover:border-primary/40 transition-colors space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-base text-foreground">{ex.examTitle}</h4>
                          <p className="text-xs text-muted-foreground">{ex.term} • {ex.examType}</p>
                        </div>
                        <Badge variant="outline" className="text-xs font-semibold bg-primary/10 text-primary border-primary/20">
                          {ex.letterGrade} ({ex.percentage}%)
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/50">
                        <div>
                          <p className="text-muted-foreground">{t("totalMarks")}</p>
                          <p className="font-semibold text-foreground">{ex.totalMarksObtained} / {ex.totalMaxMarks}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t("gradePoint")}</p>
                          <p className="font-semibold text-foreground">{ex.gpa.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="pt-1">
                        <Progress value={ex.percentage} className="h-1.5" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Academic Strengths, Focus Areas & Actionable Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Core Strengths */}
            <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  {t("keyStrengths")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {performance.insights.strengths.map((str: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{str}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Areas for Focus */}
            <Card className="border-amber-500/20 bg-amber-500/5 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t("focusAreas")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {performance.insights.focusAreas.map((foc: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-foreground">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{foc}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Teacher Recommendations */}
            <Card className="border-blue-500/20 bg-blue-500/5 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  {t("advisoryNotes")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {performance.insights.actionableRecommendations.map((rec: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-foreground">
                    <ArrowUpRight className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Printable Signature Section (Only visible on Print) */}
          <div className="hidden print:grid grid-cols-2 gap-12 pt-16 mt-8 border-t border-black/20 text-xs">
            <div className="text-center border-t border-black pt-2">
              <p className="font-semibold text-black">Class Teacher Signature</p>
            </div>
            <div className="text-center border-t border-black pt-2">
              <p className="font-semibold text-black">{t("authorizedSignatory")}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
