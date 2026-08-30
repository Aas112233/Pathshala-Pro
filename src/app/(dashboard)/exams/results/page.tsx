"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter } from "next/navigation";
import { Save, Upload, Download, CheckCircle2, XCircle, AlertCircle, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCreateExamResults, useExams, useExam, type ExamResult } from "@/hooks/use-exams";
import { useAcademicYears } from "@/hooks/use-queries";
import { useStudents } from "@/hooks/use-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn, formatStudentName } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";

interface StudentResult {
  studentId: string;
  studentName: string;
  rollNumber: string;
  marks: number;
  status?: "PASS" | "FAIL" | "ABSENT";
  grade?: string;
  isLocked?: boolean;
}

export default function ExamResultsPage() {
  const t = useTranslations("exams.resultsEntry");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const examId = searchParams.get("examId");
  const subjectId = searchParams.get("subjectId");
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canReadExams = hasPermission(perms, "exams", "read");
  const canWriteExams = hasPermission(perms, "exams", "write");
  const canManageExams = hasPermission(perms, "exams", "manage");
  const canReadResults = hasPermission(perms, "exam-results", "read");
  const canWriteResults = hasPermission(perms, "exam-results", "write");
  void canWriteExams; void canManageExams;

  const [selectedExam, setSelectedExam] = useState(examId || "");
  const [selectedSubject, setSelectedSubject] = useState(subjectId || "");
  const [results, setResults] = useState<StudentResult[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const { data: examsData, isLoading: isExamsLoading } = useExams();
  const { data: examData } = useExam(selectedExam);
  const { data: studentsData } = useStudents();
  const { data: academicYearsData } = useAcademicYears();
  const createResults = useCreateExamResults();

  // Fetch existing results for exam+subject to rehydrate marks after refresh (fixes empty form)
  const { data: existingResultsData, isLoading: isExistingLoading } = useQuery({
    queryKey: ["exam-results", selectedExam, selectedSubject],
    queryFn: async () => {
      const params = new URLSearchParams({ examId: selectedExam, subjectId: selectedSubject, limit: "200" });
      const res = await fetch(`/api/exam-results?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch results");
      return res.json();
    },
    enabled: !!selectedExam && !!selectedSubject,
  });
  const existingResults: any[] = useMemo(() => {
    const d: any = existingResultsData;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    return "data" in d ? d.data : [];
  }, [existingResultsData]);

  // Extract data from API response
  const exams = Array.isArray(examsData) ? examsData : (examsData as any)?.data;
  const exam = examData as any;
  const students = Array.isArray(studentsData) ? studentsData : (studentsData as any)?.data;
  const academicYears = Array.isArray(academicYearsData) ? academicYearsData : (academicYearsData as any)?.data;

  const subjects = exam?.subjects || [];

  function calculateGrade(marks: number, maxMarks: number) {
    const percentage = (marks / maxMarks) * 100;
    if (percentage >= 80) return { grade: "A+", point: 5.0, status: "PASS" as const };
    if (percentage >= 70) return { grade: "A", point: 4.5, status: "PASS" as const };
    if (percentage >= 60) return { grade: "A-", point: 4.0, status: "PASS" as const };
    if (percentage >= 50) return { grade: "B", point: 3.5, status: "PASS" as const };
    if (percentage >= 40) return { grade: "C", point: 3.0, status: "PASS" as const };
    if (percentage >= 33) return { grade: "D", point: 2.0, status: "PASS" as const };
    return { grade: "F", point: 0.0, status: "FAIL" as const };
  }

  // Auto-initialize results as soon as exam and subject are selected — hydrate with saved marks if present
  // ponytail: wait for existingResults to load before hydrating, avoids empty form after refresh
  useEffect(() => {
    if (selectedExam && selectedSubject && students && students.length > 0 && exam && !isExistingLoading) {
      const maxMarks = subjects.find((s: any) => s.subjectId === selectedSubject)?.maxMarks || 100;

      const initialResults: StudentResult[] = students.map((student: any) => {
        const existing = existingResults.find((r: any) => r.studentProfileId === student.id && r.subjectId === selectedSubject);
        if (existing) {
          return {
            studentId: student.id,
            studentName: formatStudentName(student.firstName, student.lastName, student.firstNameBn, student.lastNameBn),
            rollNumber: student.rollNumber,
            marks: existing.obtainedMarks,
            status: existing.status as StudentResult["status"],
            grade: existing.grade,
            isLocked: Boolean(existing.isLocked),
          };
        }
        return {
          studentId: student.id,
          studentName: formatStudentName(student.firstName, student.lastName, student.firstNameBn, student.lastNameBn),
          rollNumber: student.rollNumber,
          marks: 0,
          status: "ABSENT",
          grade: "F",
          isLocked: false,
        };
      });

      setResults(initialResults);
    }
  }, [selectedExam, selectedSubject, students, exam, existingResults, isExistingLoading]);

  function handleUpdateMarks(studentId: string, marks: number) {
    if (!exam) return;
    const maxMarks = subjects.find((s: any) => s.subjectId === selectedSubject)?.maxMarks || 100;
    
    if (marks > maxMarks) {
      toast.error(t("marksExceed", { max: maxMarks }));
      return;
    }

    const { grade, status } = calculateGrade(marks, maxMarks);

    setResults(prev =>
      prev.map(r => {
        if (r.studentId === studentId) {
          if (r.isLocked) {
            toast.error(t("marksLockedDuePromotion"));
            return r;
          }
          return { ...r, marks, status, grade };
        }
        return r;
      })
    );
  }

  function handleBulkUpdate(action: "pass" | "fail" | "absent") {
    const maxMarks = subjects.find((s: any) => s.subjectId === selectedSubject)?.maxMarks || 100;

    setResults(prev =>
      prev.map(r => {
        if (r.isLocked) return r; // Skip locked promoted students
        if (action === "pass") {
          const passMarks = Math.ceil(maxMarks * 0.33);
          const { grade } = calculateGrade(passMarks, maxMarks);
          return { ...r, marks: passMarks, status: "PASS" as const, grade };
        }
        if (action === "fail") {
          const failMarks = Math.floor(maxMarks * 0.25);
          return { ...r, marks: failMarks, status: "FAIL" as const, grade: "F" };
        }
        return { ...r, marks: 0, status: "ABSENT" as const, grade: "F" };
      })
    );
  }

  async function handleSave() {
    if (!exam || !selectedSubject) {
      toast.error(t("selectExamSubject"));
      return;
    }

    setIsSaving(true);

    try {
      const resultsToSave = results
        .filter(r => !r.isLocked && r.status !== "ABSENT")
        .map((r: any) => ({
          studentProfileId: r.studentId,
          academicYearId: exam.academicYearId,
          examId: exam.id,
          subjectId: selectedSubject,
          maxMarks: subjects.find((s: any) => s.subjectId === selectedSubject)?.maxMarks || 100,
          obtainedMarks: r.marks,
          reExamAllowed: r.status === "FAIL",
        }));

      if (resultsToSave.length === 0) {
        if (results.some(r => r.isLocked)) {
          toast.info(t("allMarksLockedDuePromotion"));
        } else {
          toast.error(t("noResultsToSave"));
        }
        setIsSaving(false);
        return;
      }

      await createResults.mutateAsync(resultsToSave);
      toast.success(t("savedResults", { count: resultsToSave.length }));
    } catch (error: any) {
      toast.error(error.message || t("saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  const passCount = results.filter(r => r.status === "PASS").length;
  const failCount = results.filter(r => r.status === "FAIL").length;
  const absentCount = results.filter(r => r.status === "ABSENT").length;

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
        <Button onClick={() => router.push("/exams")}>
          {t("backToExams")}
        </Button>
      </div>

      {/* Selection Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("selectExam")}</CardTitle>
            <CardDescription>{t("chooseExam")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isExamsLoading || isAuthLoading ? (
              <Skeleton className="h-10 w-full" aria-busy="true" />
            ) : !canReadExams ? (
              <div className="py-4 text-center text-sm text-muted-foreground">{tCommon("noPermission")}</div>
            ) : (
              <Select value={selectedExam} onValueChange={(value) => {
                setSelectedExam(value);
                setSelectedSubject("");
                setResults([]);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectExamPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {exams?.map((exam: any) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.name} ({exam.academicYear?.label})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("selectSubject")}</CardTitle>
            <CardDescription>{t("chooseSubject")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Select 
              value={selectedSubject} 
              onValueChange={(value) => {
                setSelectedSubject(value);
                setResults([]);
              }}
              disabled={!selectedExam}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("selectSubjectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((es: any) => (
                  <SelectItem key={es.subjectId} value={es.subjectId}>
                    {es.subject.name} - {es.subject.code} (Max: {es.maxMarks})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      {results.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{results.length}</div>
              <p className="text-muted-foreground">{t("totalStudents")}</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{passCount}</div>
              <p className="text-green-600">{t("pass")}</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">{failCount}</div>
              <p className="text-red-600">{t("fail")}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-muted/30">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-muted-foreground">{absentCount}</div>
              <p className="text-muted-foreground">{t("absent")}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Loading */}
      {selectedExam && selectedSubject && results.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Skeleton className="h-10 w-full mb-3" />
            <Skeleton className="h-10 w-full mb-3" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <>
          {/* Bulk Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("bulkActions")}</CardTitle>
              <CardDescription>{t("bulkDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkUpdate("pass")}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                  {t("markAllPass")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkUpdate("fail")}
                >
                  <XCircle className="h-4 w-4 mr-2 text-red-600" />
                  {t("markAllFail")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkUpdate("absent")}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {t("markAllAbsent")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results Table */}
          <Card>
            <form
              id="exam-results-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t("studentResults")}</CardTitle>
                  <CardDescription>
                    {t("enterMarks", { max: subjects.find((s: any) => s.subjectId === selectedSubject)?.maxMarks || 100 })}
                  </CardDescription>
                </div>
                {canWriteResults && (
                  <Button type="submit" disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? t("saving") : t("saveResults")}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!isAuthLoading && !canReadResults ? (
                <div className="py-8 text-center">
                  <h2 className="text-lg font-semibold text-foreground">{tCommon("accessRestricted")}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{tCommon("noPermission")}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("rollNo")}</TableHead>
                      <TableHead>{t("studentName")}</TableHead>
                      <TableHead>{t("marks")}</TableHead>
                      <TableHead>{t("grade")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result) => (
                    <TableRow key={result.studentId} className={result.isLocked ? "bg-muted/15" : undefined}>
                      <TableCell className="font-medium">{result.rollNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{result.studentName}</span>
                          {result.isLocked && (
                            <Badge
                              variant="outline"
                              className="text-[10px] h-5 px-1.5 text-amber-600 bg-amber-500/10 border-amber-500/30 gap-1 inline-flex items-center"
                              title={t("marksLockedDuePromotion")}
                            >
                              <Lock className="h-2.5 w-2.5" />
                              Locked
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={subjects.find((s: any) => s.subjectId === selectedSubject)?.maxMarks || 100}
                          value={result.marks === 0 && result.status === "ABSENT" ? "" : result.marks}
                          disabled={result.isLocked}
                          onChange={(e) => {
                            const value = e.target.value === "" ? 0 : Number(e.target.value);
                            handleUpdateMarks(result.studentId, value);
                          }}
                          placeholder={t("absentPlaceholder")}
                          className={cn("w-24", result.isLocked && "bg-muted/60 text-muted-foreground opacity-75 cursor-not-allowed")}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            result.grade === "A+" || result.grade === "A" ? "default" :
                            result.grade === "B" || result.grade === "C" ? "secondary" :
                            result.grade === "F" ? "destructive" : "outline"
                          }
                        >
                          {result.grade || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            result.status === "PASS" ? "default" :
                            result.status === "FAIL" ? "destructive" : "secondary"
                          }
                        >
                          {result.status || "ABSENT"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              )}
            </CardContent>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}
