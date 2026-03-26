"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { GraduationCap, TrendingUp, CheckCircle2, XCircle, AlertTriangle, Download } from "lucide-react";
import { usePromotionCalculation, useExecutePromotions, type ClassPromotion } from "@/hooks/use-exams";
import { useAcademicYears } from "@/hooks/use-queries";
import { useStudents } from "@/hooks/use-queries";
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
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function PromotionsCalculatePage() {
  const searchParams = useSearchParams();
  const classId = searchParams.get("classId");
  const academicYearId = searchParams.get("academicYearId");

  const { data: academicYearsData } = useAcademicYears();
  const { data: studentsData } = useStudents();
  const { data: calculation, isLoading, refetch } = usePromotionCalculation(classId || undefined, academicYearId || undefined);
  const executePromotions = useExecutePromotions();

  // Extract data from API response
  const academicYears = Array.isArray(academicYearsData) ? academicYearsData : (academicYearsData as any)?.data;
  const students = Array.isArray(studentsData) ? studentsData : (studentsData as any)?.data;

  const [selectedClass, setSelectedClass] = useState(classId || "");
  const [selectedYear, setSelectedYear] = useState(academicYearId || "");

  function handleClassChange(value: string) {
    setSelectedClass(value);
    // Trigger refetch with new params
    window.history.pushState({}, "", `?classId=${value}&academicYearId=${selectedYear}`);
  }

  function handleYearChange(value: string) {
    setSelectedYear(value);
    window.history.pushState({}, "", `?classId=${selectedClass}&academicYearId=${value}`);
  }

  async function handleExecutePromotions() {
    if (!calculation) return;

    const calcData = Array.isArray(calculation) ? calculation[0] : calculation;
    const eligibleStudents = calcData.students.filter((s: any) => s.eligible && s.action === "PROMOTED");
    
    if (eligibleStudents.length === 0) {
      toast.error("No students eligible for promotion");
      return;
    }

    const confirmMsg = `Execute promotions for ${eligibleStudents.length} students? This will update their class assignments.`;
    if (!confirm(confirmMsg)) return;

    const promotionsData = eligibleStudents.map((student: any) => ({
      studentProfileId: students?.find((s: any) => s.studentId === student.studentId)?.id || "",
      fromAcademicYearId: selectedYear,
      toAcademicYearId: selectedYear,
      fromClassId: selectedClass,
      toClassId: calcData.students[0].suggestedNextClassId || "",
      status: "PROMOTED" as const,
      reason: `Promoted based on ${calcData.promotionRule.minimumOverallPercentage}% minimum criteria`,
    }));

    try {
      await executePromotions.mutateAsync(promotionsData);
      refetch();
    } catch (error) {
      toast.error("Failed to execute promotions");
    }
  }

  function getStatusColor(action: string) {
    switch (action) {
      case "PROMOTED": return "bg-green-500";
      case "RETAINED": return "bg-red-500";
      case "CONDITIONAL_PROMOTED": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  }

  function getStatusBadgeVariant(action: string) {
    switch (action) {
      case "PROMOTED": return "default";
      case "RETAINED": return "destructive";
      case "CONDITIONAL_PROMOTED": return "secondary";
      default: return "outline";
    }
  }

  // Get unique classes for dropdown
  const classes = Array.from(new Map(students?.map((s: any) => [s.classId, s.class]).filter(([_, v]: any) => v)).values())
    .filter(Boolean);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Promotion Calculator</h1>
          <p className="text-muted-foreground mt-1">
            Calculate and process student promotions
          </p>
        </div>
        <Button onClick={() => window.history.back()}>
          Back
        </Button>
      </div>

      {/* Selection */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Class</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedClass} onValueChange={handleClassChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls: any) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Academic Year</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedYear} onValueChange={handleYearChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
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

      {/* Results */}
      {calculation && (
        <>
          {(() => {
            const calcData = Array.isArray(calculation) ? calculation[0] : calculation;
            if (!calcData) return null;

            return (
              <>
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{calcData.totalStudents}</div>
                <p className="text-muted-foreground">Total Students</p>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{calcData.eligibleCount}</div>
                <p className="text-green-600">Eligible</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">{calcData.retainedCount}</div>
                <p className="text-red-600">Retained</p>
              </CardContent>
            </Card>
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-600">{calcData.conditionalCount}</div>
                <p className="text-yellow-600">Conditional</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center justify-center h-full">
                <Button
                  onClick={handleExecutePromotions}
                  disabled={calcData.eligibleCount === 0 || executePromotions.isPending}
                  className="w-full"
                >
                  <GraduationCap className="h-4 w-4 mr-2" />
                  {executePromotions.isPending ? "Processing..." : "Execute Promotions"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Promotion Rules Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Applied Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Minimum Attendance</p>
                  <p className="text-lg font-semibold">{calcData.promotionRule.minimumAttendance}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Minimum Overall</p>
                  <p className="text-lg font-semibold">{calcData.promotionRule.minimumOverallPercentage}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Minimum Per Subject</p>
                  <p className="text-lg font-semibold">{calcData.promotionRule.minimumPerSubject}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Max Failed Subjects</p>
                  <p className="text-lg font-semibold">{calcData.promotionRule.maxFailedSubjects}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Student Details Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Student Eligibility</CardTitle>
                  <CardDescription>
                    Promotion eligibility for each student based on exam performance
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Roll No</TableHead>
                    <TableHead>Average %</TableHead>
                    <TableHead>Failed Subjects</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calcData.students.map((student: any) => (
                    <TableRow key={student.studentId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{student.studentName}</p>
                          <p className="text-sm text-muted-foreground">{student.studentId}</p>
                        </div>
                      </TableCell>
                      <TableCell>{student.rollNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={parseFloat(student.metrics.overallPercentage)} className="w-20" />
                          <span className={
                            parseFloat(student.metrics.overallPercentage) >= 70 ? "text-green-600" :
                            parseFloat(student.metrics.overallPercentage) >= 40 ? "text-yellow-600" : "text-red-600"
                          }>
                            {student.metrics.overallPercentage}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {student.metrics.failedSubjectsCount > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {student.metrics.failedSubjects.map((subject: any, i: number) => (
                              <Badge key={i} variant="destructive" className="text-xs">
                                {subject}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4" />
                            None
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(student.action)}>
                          {student.action === "PROMOTED" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {student.action === "RETAINED" && <XCircle className="h-3 w-3 mr-1" />}
                          {student.action === "CONDITIONAL_PROMOTED" && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {student.action.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          {student.reasons.map((reason: any, i: number) => (
                            <p key={i} className="text-sm text-muted-foreground">• {reason}</p>
                          ))}
                          {student.reExamAllowed && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              Re-exam Allowed
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
              );
          })()}
        </>
      )}

      {/* Empty State */}
      {(!selectedClass || !selectedYear) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GraduationCap className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select Class and Year</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Choose a class and academic year above to calculate promotion eligibility for all students
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">Calculating promotion eligibility...</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
