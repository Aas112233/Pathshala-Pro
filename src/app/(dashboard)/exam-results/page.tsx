"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { DataTable } from "@/components/shared/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { formatStudentName } from "@/lib/utils";
import {
  ClipboardCheck,
  Save,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  Search,
  FilterX,
  Pencil,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface StudentMark {
  studentProfileId: string;
  studentId: string;
  rollNumber: string;
  firstName: string;
  lastName: string;
  obtainedMarks: string;
  existingGrade?: string;
  existingStatus?: string;
}

export default function ExamResultsPage() {
  const t = useTranslations("results");
  const queryClient = useQueryClient();

  // View state: list (default) or form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<any>(null);

  // List view filter & pagination state
  const [listSearch, setListSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterExam, setFilterExam] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [listPage, setListPage] = useState(1);
  const LIST_PAGE_SIZE = 20;

  // Debounce search input — reset page on change
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(listSearch);
      setListPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [listSearch]);

  // Reset page when filters change
  useEffect(() => {
    setListPage(1);
  }, [filterExam, filterSubject, filterStatus]);

  // Selection state
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  // Student marks state
  const [studentMarks, setStudentMarks] = useState<StudentMark[]>([]);
  const [isFormReady, setIsFormReady] = useState(false);

  // Fetch exams
  const { data: examsData } = useQuery({
    queryKey: ["exams-all"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch("/api/exams", {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch exams");
      return res.json();
    },
  });

  // Fetch classes
  const { data: classesData } = useQuery({
    queryKey: ["classes-all"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch("/api/classes?limit=100&isActive=true", {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch classes");
      return res.json();
    },
  });

  // Fetch results for the list view with server-side pagination & filters
  const { data: allResultsData, isLoading: isResultsLoading } = useQuery({
    queryKey: ["all-exam-results", listPage, debouncedSearch, filterExam, filterSubject, filterStatus],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const params = new URLSearchParams({
        page: String(listPage),
        limit: String(LIST_PAGE_SIZE),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filterExam) params.set("examId", filterExam);
      if (filterSubject) params.set("subjectId", filterSubject);
      if (filterStatus) params.set("status", filterStatus);

      const res = await fetch(`/api/exam-results?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch results");
      return res.json();
    },
    placeholderData: (prev) => prev,
  });

  // Get the selected exam object to access its subjects
  const exams = useMemo(
    () => ("data" in (examsData || {}) ? (examsData as any).data : []),
    [examsData]
  );

  const classes = useMemo(
    () => ("data" in (classesData || {}) ? (classesData as any).data : []),
    [classesData]
  );

  const allResults = useMemo(
    () =>
      "data" in (allResultsData || {})
        ? (allResultsData as any).data
        : [],
    [allResultsData]
  );

  const listPagination = useMemo(
    () => (allResultsData as any)?.pagination || null,
    [allResultsData]
  );

  // Build filter dropdown options from the exams data (already fetched)
  const listExamFilterOptions = useMemo(() => [
    { value: "", label: t("filterAllExams") },
    ...exams.map((e: any) => ({
      value: e.id,
      label: `${e.name} (${e.academicYear?.label || e.examId})`,
    })),
  ], [exams, t]);

  // Build subject filter from all exams' subjects (deduplicated)
  const listSubjectFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    exams.forEach((e: any) => {
      e.subjects?.forEach((es: any) => {
        const subj = es.subject;
        if (subj?.id && subj?.name) map.set(subj.id, subj.name);
      });
    });
    return [
      { value: "", label: t("filterAllSubjects") },
      ...Array.from(map.entries()).map(([id, name]) => ({ value: id, label: name })),
    ];
  }, [exams, t]);

  const listStatusFilterOptions = useMemo(
    () => [
      { value: "", label: t("filterAllStatus") },
      { value: "PASS", label: t("pass") },
      { value: "FAIL", label: t("fail") },
    ],
    [t]
  );

  const hasActiveFilters = listSearch || filterExam || filterSubject || filterStatus;

  const clearAllFilters = () => {
    setListSearch("");
    setDebouncedSearch("");
    setFilterExam("");
    setFilterSubject("");
    setFilterStatus("");
    setListPage(1);
  };

  const selectedExamObj = useMemo(
    () => exams.find((e: any) => e.id === selectedExam),
    [exams, selectedExam]
  );

  // Get subjects from the selected exam's exam-subject mapping
  const examSubjects = useMemo(() => {
    if (!selectedExamObj?.subjects) return [];
    return selectedExamObj.subjects.map((es: any) => ({
      id: es.subject?.id || es.subjectId,
      subjectId: es.subject?.subjectId || "",
      name: es.subject?.name || "Unknown",
      code: es.subject?.code || "",
      maxMarks: es.maxMarks,
      passMarks: es.passMarks,
    }));
  }, [selectedExamObj]);

  // Fetch students by class
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ["students-by-class", selectedClass],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch(
        `/api/students?limit=200&classId=${selectedClass}&status=ACTIVE&sortBy=rollNumber&sortOrder=asc`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Tenant-ID": tenantId || "",
          },
        }
      );
      if (!res.ok) throw new Error("Failed to fetch students");
      return res.json();
    },
    enabled: !!selectedClass,
  });

  // Fetch existing results for the selected exam + subject combo
  const { data: existingResultsData } = useQuery({
    queryKey: ["exam-results", selectedExam, selectedSubject],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");
      const res = await fetch(
        `/api/exam-results?examId=${selectedExam}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Tenant-ID": tenantId || "",
          },
        }
      );
      if (!res.ok) throw new Error("Failed to fetch results");
      return res.json();
    },
    enabled: !!selectedExam && !!selectedSubject,
  });

  const students = useMemo(
    () => ("data" in (studentsData || {}) ? (studentsData as any).data : []),
    [studentsData]
  );

  const existingResults = useMemo(
    () =>
      "data" in (existingResultsData || {})
        ? (existingResultsData as any).data
        : [],
    [existingResultsData]
  );

  // Get max marks for the selected subject from exam subjects
  const selectedSubjectInfo = useMemo(
    () => examSubjects.find((s: any) => s.id === selectedSubject),
    [examSubjects, selectedSubject]
  );

  // Build student marks list when all selections are made
  const loadStudentMarks = () => {
    if (!selectedExam || !selectedClass || !selectedSubject) {
      toast.error(t("pleaseSelectAll"));
      return;
    }

    const marks: StudentMark[] = students.map((s: any) => {
      // Check if an existing result exists for this student + subject
      const existing = existingResults.find(
        (r: any) =>
          r.studentProfileId === s.id && r.subjectId === selectedSubject
      );

      return {
        studentProfileId: s.id,
        studentId: s.studentId,
        rollNumber: s.rollNumber,
        firstName: s.firstName,
        lastName: s.lastName,
        obtainedMarks: existing ? String(existing.obtainedMarks) : "",
        existingGrade: existing?.grade,
        existingStatus: existing?.status,
      };
    });

    setStudentMarks(marks);
    setIsFormReady(true);
  };

  // Update individual student marks
  const handleMarksChange = (index: number, value: string) => {
    const maxMarks = selectedSubjectInfo?.maxMarks || 100;
    // Allow empty string for clearing
    if (value === "") {
      setStudentMarks((prev) =>
        prev.map((m, i) => (i === index ? { ...m, obtainedMarks: "" } : m))
      );
      return;
    }
    const numVal = parseFloat(value);
    if (isNaN(numVal) || numVal < 0 || numVal > maxMarks) return;

    setStudentMarks((prev) =>
      prev.map((m, i) => (i === index ? { ...m, obtainedMarks: value } : m))
    );
  };

  // Save exam results
  const saveMutation = useMutation({
    mutationFn: async (results: any[]) => {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id");

      // If editing a single result, use PUT with single result
      if (editingResult) {
        const res = await fetch(`/api/exam-results/${editingResult.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-Tenant-ID": tenantId || "",
          },
          body: JSON.stringify(results[0]),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "Failed to update result");
        }
        return res.json();
      }

      // Otherwise use bulk save
      const res = await fetch("/api/exam-results", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Tenant-ID": tenantId || "",
        },
        body: JSON.stringify(results),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save results");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t(editingResult ? "updateSuccess" : "saveSuccess"));
      queryClient.invalidateQueries({ queryKey: ["all-exam-results"] });
      handleBack();
    },
    onError: (err: any) => {
      toast.error(err.message || t(editingResult ? "updateError" : "saveError"));
    },
  });

  const handleSave = () => {
    const maxMarks = selectedSubjectInfo?.maxMarks || 100;

    // Filter out students with empty marks
    const filledMarks = studentMarks.filter(
      (m) => m.obtainedMarks !== "" && m.obtainedMarks !== undefined
    );

    if (filledMarks.length === 0) {
      toast.error(t("fillAllMarks"));
      return;
    }

    const results = filledMarks.map((m) => ({
      studentProfileId: m.studentProfileId,
      academicYearId: selectedExamObj?.academicYearId,
      examId: selectedExam,
      subjectId: selectedSubject,
      maxMarks: maxMarks,
      obtainedMarks: parseFloat(m.obtainedMarks),
      reExamAllowed: false,
    }));

    saveMutation.mutate(results);
  };

  const handleBack = () => {
    if (isFormReady) {
      setIsFormReady(false);
      setStudentMarks([]);
      setEditingResult(null);
    } else {
      setIsFormOpen(false);
      setSelectedExam("");
      setSelectedClass("");
      setSelectedSubject("");
      setEditingResult(null);
    }
  };

  // Handle edit result
  const handleEditResult = (result: any) => {
    setEditingResult(result);
    setSelectedExam(result.examId);
    setSelectedSubject(result.subjectId);
    setSelectedClass(result.studentProfile?.classId || "");

    // Load student marks with existing result
    const student = result.studentProfile;
    if (!student) return;

    const marks: StudentMark[] = [{
      studentProfileId: student.id,
      studentId: student.studentId,
      rollNumber: student.rollNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      obtainedMarks: String(result.obtainedMarks),
      existingGrade: result.grade,
      existingStatus: result.status,
    }];

    setStudentMarks(marks);
    setIsFormReady(true);
    setIsFormOpen(true);
  };

  // Computed stats
  const passMarks = selectedSubjectInfo?.passMarks || 33;
  const maxMarks = selectedSubjectInfo?.maxMarks || 100;
  const passPercentage = (passMarks / maxMarks) * 100;
  const filledCount = studentMarks.filter(
    (m) => m.obtainedMarks !== ""
  ).length;
  const passedCount = studentMarks.filter((m) => {
    const marks = parseFloat(m.obtainedMarks);
    return !isNaN(marks) && (marks / maxMarks) * 100 >= passPercentage;
  }).length;
  const failedCount = studentMarks.filter((m) => {
    const marks = parseFloat(m.obtainedMarks);
    return !isNaN(marks) && (marks / maxMarks) * 100 < passPercentage;
  }).length;

  // Build options
  const examOptions = [
    { value: "", label: t("selectExam") },
    ...exams.map((e: any) => ({
      value: e.id,
      label: `${e.name} (${e.academicYear?.label || e.examId})`,
    })),
  ];

  const classOptions = [
    { value: "", label: t("selectClass") },
    ...classes.map((c: any) => ({
      value: c.id,
      label: `${c.name} (Class ${c.classNumber})`,
    })),
  ];

  const subjectOptions = [
    { value: "", label: t("selectSubject") },
    ...examSubjects.map((s: any) => ({
      value: s.id,
      label: `${s.name} (${s.code}) — Max: ${s.maxMarks}`,
    })),
  ];

  // Grade color helper
  const getGradeColor = (marks: string) => {
    const num = parseFloat(marks);
    if (isNaN(num)) return "";
    const pct = (num / maxMarks) * 100;
    if (pct >= 80) return "text-emerald-600";
    if (pct >= 60) return "text-blue-600";
    if (pct >= passPercentage) return "text-amber-600";
    return "text-red-600";
  };

  const getGradeLabel = (marks: string) => {
    const num = parseFloat(marks);
    if (isNaN(num)) return "-";
    const pct = (num / maxMarks) * 100;
    if (pct >= 80) return "A+";
    if (pct >= 70) return "A";
    if (pct >= 60) return "A-";
    if (pct >= 50) return "B";
    if (pct >= 40) return "C";
    if (pct >= 33) return "D";
    return "F";
  };

  // ─── DataTable columns for list view ───
  const listColumns: ColumnDef<any>[] = [
    {
      accessorKey: "studentProfile.studentId",
      header: t("rollNumber"),
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.studentProfile?.studentId || "-"}
        </span>
      ),
    },
    {
      accessorKey: "studentProfile.firstName",
      header: t("studentName"),
      cell: ({ row }) => {
        const sp = row.original.studentProfile;
        return (
          <span>
            {sp ? formatStudentName(sp.firstName, sp.lastName, sp.firstNameBn, sp.lastNameBn) : "-"}
          </span>
        );
      },
    },
    {
      accessorKey: "exam.name",
      header: t("examName"),
      cell: ({ row }) => (
        <span>{row.original.exam?.name || "-"}</span>
      ),
    },
    {
      accessorKey: "subject.name",
      header: t("subjectName"),
      cell: ({ row }) => (
        <span>{row.original.subject?.name || "-"}</span>
      ),
    },
    {
      accessorKey: "obtainedMarks",
      header: t("obtainedMarks"),
      cell: ({ getValue }) => (
        <span className="font-semibold">{getValue<number>()}</span>
      ),
    },
    {
      accessorKey: "maxMarks",
      header: t("maxMarks"),
    },
    {
      accessorKey: "grade",
      header: t("grade"),
      cell: ({ getValue }) => {
        const grade = getValue<string>();
        return (
          <span className="font-bold">{grade || "-"}</span>
        );
      },
    },
    {
      accessorKey: "status",
      header: t("status"),
      cell: ({ getValue }) => {
        const status = getValue<string>();
        return status === "PASS" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            <CheckCircle className="h-3 w-3" />
            {t("pass")}
          </span>
        ) : status === "FAIL" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
            <XCircle className="h-3 w-3" />
            {t("fail")}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      accessorKey: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleEditResult(row.original)}
          className="h-8 w-8 p-0"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  // ─── Screen 1: List View (like Admissions list) ───
  if (!isFormOpen) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("title")}
          description={t("description")}
          icon={ClipboardCheck}
        >
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("enterResults")}
          </Button>
        </PageHeader>

        {/* Search & Filter Bar */}
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm text-foreground outline-none ring-ring transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Filter Dropdowns Row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-48">
              <AppDropdown
                value={filterExam}
                onChange={setFilterExam}
                options={listExamFilterOptions}
                placeholder={t("filterAllExams")}
                searchable
              />
            </div>
            <div className="w-48">
              <AppDropdown
                value={filterSubject}
                onChange={setFilterSubject}
                options={listSubjectFilterOptions}
                placeholder={t("filterAllSubjects")}
                searchable
              />
            </div>
            <div className="w-40">
              <AppDropdown
                value={filterStatus}
                onChange={setFilterStatus}
                options={listStatusFilterOptions}
                placeholder={t("filterAllStatus")}
              />
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-muted-foreground hover:text-foreground gap-1"
              >
                <FilterX className="h-4 w-4" />
                {t("clearFilters")}
              </Button>
            )}

            {/* Result count */}
            <span className="ml-auto text-xs text-muted-foreground">
              {listPagination ? `${listPagination.totalCount}` : allResults.length} {t("totalStudents").toLowerCase()}
            </span>
          </div>
        </div>

        <DataTable
          columns={listColumns}
          data={allResults}
          isLoading={isResultsLoading}
          pagination={listPagination || undefined}
          onPageChange={setListPage}
        />
      </div>
    );
  }

  // ─── Screen 2: Marks Entry Form (like Admissions create form) ───
  if (isFormReady) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={editingResult ? t("editResult") : t("marksEntry")}
          description={`${selectedExamObj?.name} — ${selectedSubjectInfo?.name} (${t("maxMarks")}: ${maxMarks})`}
          icon={ClipboardCheck}
        >
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("back")}
          </Button>
        </PageHeader>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Main Marks Entry */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-muted/50 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <div className="col-span-1">#</div>
                <div className="col-span-2">{t("rollNumber")}</div>
                <div className="col-span-3">{t("studentName")}</div>
                <div className="col-span-2 text-center">
                  {t("obtainedMarks")}
                </div>
                <div className="col-span-1 text-center">{t("maxMarks")}</div>
                <div className="col-span-1 text-center">{t("grade")}</div>
                <div className="col-span-2 text-center">{t("status")}</div>
              </div>

              {/* Student Rows */}
              {studentMarks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">
                    {t("noStudentsInClass")}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {studentMarks.map((student, index) => {
                    const grade = getGradeLabel(student.obtainedMarks);
                    const gradeColor = getGradeColor(student.obtainedMarks);
                    const num = parseFloat(student.obtainedMarks);
                    const isPassing =
                      !isNaN(num) &&
                      (num / maxMarks) * 100 >= passPercentage;
                    const isFailing =
                      !isNaN(num) &&
                      (num / maxMarks) * 100 < passPercentage;

                    return (
                      <div
                        key={student.studentProfileId}
                        className={`grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors hover:bg-muted/30 ${isFailing
                          ? "bg-red-50/50 dark:bg-red-950/10"
                          : ""
                          }`}
                      >
                        <div className="col-span-1 text-sm text-muted-foreground">
                          {index + 1}
                        </div>
                        <div className="col-span-2">
                          <span className="text-sm font-medium">
                            {student.rollNumber}
                          </span>
                        </div>
                        <div className="col-span-3">
                          <p className="text-sm font-medium">
                            {formatStudentName(student.firstName, student.lastName)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {student.studentId}
                          </p>
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <input
                            type="number"
                            value={student.obtainedMarks}
                            onChange={(e) =>
                              handleMarksChange(index, e.target.value)
                            }
                            onFocus={(e) => e.target.select()}
                            min={0}
                            max={maxMarks}
                            step="0.5"
                            placeholder="0"
                            className={`w-20 text-center rounded-md border border-input bg-background px-2 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary ${gradeColor}`}
                          />
                        </div>
                        <div className="col-span-1 text-center text-sm text-muted-foreground">
                          {maxMarks}
                        </div>
                        <div className="col-span-1 text-center">
                          <span
                            className={`text-sm font-bold ${gradeColor}`}
                          >
                            {grade}
                          </span>
                        </div>
                        <div className="col-span-2 flex justify-center">
                          {student.obtainedMarks !== "" ? (
                            isPassing ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                <CheckCircle className="h-3 w-3" />
                                {t("pass")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                                <XCircle className="h-3 w-3" />
                                {t("fail")}
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-6">
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm sticky top-6">
              <h2 className="text-lg font-bold text-foreground mb-6 font-mono uppercase tracking-tighter text-center">
                {t("summary")}
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("examName")}
                  </span>
                  <span className="font-semibold text-primary truncate max-w-[140px]">
                    {selectedExamObj?.name}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("subjectName")}
                  </span>
                  <span className="font-semibold text-primary truncate max-w-[140px]">
                    {selectedSubjectInfo?.name}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-dashed">
                  <span className="text-muted-foreground">
                    {t("totalStudents")}
                  </span>
                  <span className="font-bold text-2xl">
                    {studentMarks.length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("marks")} {t("enterResults").toLowerCase()}
                  </span>
                  <span className="font-semibold">{filledCount}</span>
                </div>

                {filledCount > 0 && (
                  <>
                    <div className="pt-2 border-t border-dashed space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> {t("passed")}
                        </span>
                        <span className="font-bold text-green-600">
                          {passedCount}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-red-600 flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> {t("failed")}
                        </span>
                        <span className="font-bold text-red-600">
                          {failedCount}
                        </span>
                      </div>
                    </div>

                    {/* Pass rate bar */}
                    <div className="pt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>
                          {t("pass")}%
                        </span>
                        <span>
                          {filledCount > 0
                            ? Math.round(
                              (passedCount / filledCount) * 100
                            )
                            : 0}
                          %
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-500 transition-all duration-500"
                          style={{
                            width: `${filledCount > 0
                              ? (passedCount / filledCount) * 100
                              : 0
                              }%`,
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <Button
                onClick={handleSave}
                disabled={
                  saveMutation.isPending || filledCount === 0
                }
                className="w-full mt-8 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-lg"
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending
                  ? t("saving")
                  : t("saveResults")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Screen 2a: Selection Screen (create form - like Admissions create) ───
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("enterResults")}
        description={t("description")}
        icon={ClipboardCheck}
      >
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back")}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-4 space-y-6">
          {/* Exam & Class Details Card */}
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">
              {t("examDetails")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t("examName")}
                </label>
                <AppDropdown
                  value={selectedExam}
                  onChange={(val) => {
                    setSelectedExam(val);
                    setSelectedSubject("");
                  }}
                  options={examOptions}
                  placeholder={t("selectExam")}
                  searchable
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t("className")}
                </label>
                <AppDropdown
                  value={selectedClass}
                  onChange={setSelectedClass}
                  options={classOptions}
                  placeholder={t("selectClass")}
                  searchable
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t("subjectName")}
                </label>
                <AppDropdown
                  value={selectedSubject}
                  onChange={setSelectedSubject}
                  options={subjectOptions}
                  placeholder={t("selectSubject")}
                  searchable
                  disabled={!selectedExam}
                />
              </div>
            </div>
          </div>

          {/* Guidance Card */}
          <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
            <div className="flex flex-col items-center justify-center text-center py-6">
              <ClipboardCheck className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {!selectedExam
                  ? t("selectExamFirst")
                  : !selectedClass
                    ? t("selectClassToLoad")
                    : !selectedSubject
                      ? t("selectSubjectToEnter")
                      : t("enterMarksForStudents")}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm sticky top-6">
            <h2 className="text-lg font-bold text-foreground mb-6 font-mono uppercase tracking-tighter text-center">
              {t("summary")}
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("examName")}
                </span>
                <span className="font-semibold text-primary truncate max-w-[140px]">
                  {selectedExamObj?.name || "-"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("className")}
                </span>
                <span className="font-semibold text-primary">
                  {classes.find((c: any) => c.id === selectedClass)?.name ||
                    "-"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("subjectName")}
                </span>
                <span className="font-semibold text-primary truncate max-w-[140px]">
                  {selectedSubjectInfo?.name || "-"}
                </span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-dashed">
                <span className="text-muted-foreground">
                  {t("studentsLoaded")}
                </span>
                <span className="font-bold text-2xl">
                  {selectedClass ? students.length : 0}
                </span>
              </div>
            </div>

            <Button
              onClick={loadStudentMarks}
              disabled={
                !selectedExam ||
                !selectedClass ||
                !selectedSubject ||
                studentsLoading
              }
              className="w-full mt-8 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-lg"
            >
              {studentsLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("loadingStudents")}
                </>
              ) : (
                <>
                  <ClipboardCheck className="h-4 w-4" />
                  {t("enterResults")}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
