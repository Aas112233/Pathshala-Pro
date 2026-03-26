"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Save, Upload, Download, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useExamResults, useCreateExamResults, useExams, useExam, type ExamResult } from "@/hooks/use-exams";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StudentResult {
  studentId: string;
  studentName: string;
  rollNumber: string;
  marks: number;
  status?: "PASS" | "FAIL" | "ABSENT";
  grade?: string;
}

export default function ExamResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const examId = searchParams.get("examId");
  const subjectId = searchParams.get("subjectId");

  const [selectedExam, setSelectedExam] = useState(examId || "");
  const [selectedSubject, setSelectedSubject] = useState(subjectId || "");
  const [results, setResults] = useState<StudentResult[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const { data: examsData } = useExams();
  const { data: examData } = useExam(selectedExam);
  const { data: studentsData } = useStudents();
  const { data: academicYearsData } = useAcademicYears();
  const createResults = useCreateExamResults();

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

  function initializeResults() {
    if (!students || !exam) return;

    const maxMarks = subjects.find((s: any) => s.subjectId === selectedSubject)?.maxMarks || 100;

    const initialResults: StudentResult[] = students.map((student: any) => ({
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      rollNumber: student.rollNumber,
      marks: 0,
      status: "ABSENT",
      grade: "F",
    }));

    setResults(initialResults);
  }

  function handleUpdateMarks(studentId: string, marks: number) {
    if (!exam) return;
    const maxMarks = subjects.find((s: any) => s.subjectId === selectedSubject)?.maxMarks || 100;
    
    if (marks > maxMarks) {
      toast.error(`Marks cannot exceed ${maxMarks}`);
      return;
    }

    const { grade, status } = calculateGrade(marks, maxMarks);

    setResults(prev =>
      prev.map(r =>
        r.studentId === studentId
          ? { ...r, marks, status, grade }
          : r
      )
    );
  }

  function handleBulkUpdate(action: "pass" | "fail" | "absent") {
    const maxMarks = subjects.find((s: any) => s.subjectId === selectedSubject)?.maxMarks || 100;

    setResults(prev =>
      prev.map(r => {
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
      toast.error("Please select exam and subject");
      return;
    }

    setIsSaving(true);

    try {
      const resultsToSave = results
        .filter(r => r.status !== "ABSENT")
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
        toast.error("No results to save. Mark at least one student as present.");
        setIsSaving(false);
        return;
      }

      await createResults.mutateAsync(resultsToSave);
      toast.success(`Saved results for ${resultsToSave.length} students`);
    } catch (error) {
      toast.error("Failed to save results");
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
          <h1 className="text-3xl font-bold text-foreground">Exam Results</h1>
          <p className="text-muted-foreground mt-1">
            Enter and manage examination results
          </p>
        </div>
        <Button onClick={() => router.push("/exams")}>
          Back to Exams
        </Button>
      </div>

      {/* Selection Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Exam</CardTitle>
            <CardDescription>Choose the examination</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedExam} onValueChange={(value) => {
              setSelectedExam(value);
              setSelectedSubject("");
              setResults([]);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select an exam" />
              </SelectTrigger>
              <SelectContent>
                {exams?.map((exam: any) => (
                  <SelectItem key={exam.id} value={exam.id}>
                    {exam.name} ({exam.academicYear?.label})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Subject</CardTitle>
            <CardDescription>Choose the subject</CardDescription>
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
                <SelectValue placeholder="Select a subject" />
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
              <p className="text-muted-foreground">Total Students</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{passCount}</div>
              <p className="text-green-600">Pass</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">{failCount}</div>
              <p className="text-red-600">Fail</p>
            </CardContent>
          </Card>
          <Card className="border-gray-200 bg-gray-50 dark:bg-gray-950/20">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-gray-600">{absentCount}</div>
              <p className="text-gray-600">Absent</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Entry */}
      {selectedExam && selectedSubject && results.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Initialize Results Entry</CardTitle>
            <CardDescription>
              Click below to load the student list for results entry
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={initializeResults} size="lg">
              <Upload className="h-4 w-4 mr-2" />
              Load Student List
            </Button>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <>
          {/* Bulk Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bulk Actions</CardTitle>
              <CardDescription>Quick actions for all students</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkUpdate("pass")}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                  Mark All Pass
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkUpdate("fail")}
                >
                  <XCircle className="h-4 w-4 mr-2 text-red-600" />
                  Mark All Fail
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkUpdate("absent")}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Mark All Absent
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Student Results</CardTitle>
                  <CardDescription>
                    Enter marks for each student (Max: {subjects.find((s: any) => s.subjectId === selectedSubject)?.maxMarks})
                  </CardDescription>
                </div>
                <Button onClick={handleSave} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Results"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll No</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result) => (
                    <TableRow key={result.studentId}>
                      <TableCell className="font-medium">{result.rollNumber}</TableCell>
                      <TableCell>{result.studentName}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={subjects.find((s: any) => s.subjectId === selectedSubject)?.maxMarks || 100}
                          value={result.marks === 0 && result.status === "ABSENT" ? "" : result.marks}
                          onChange={(e) => {
                            const value = e.target.value === "" ? 0 : Number(e.target.value);
                            handleUpdateMarks(result.studentId, value);
                          }}
                          placeholder="Absent"
                          className="w-24"
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
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
