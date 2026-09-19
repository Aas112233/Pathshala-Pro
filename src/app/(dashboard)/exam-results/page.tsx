"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { DataTable } from "@/components/shared/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { formatStudentName } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  Trophy,
  Lock,
  FileSpreadsheet,
  FileDown,
  Upload,
  X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { downloadBlob } from "@/lib/download-blob";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TableSkeleton } from "@/components/ui/skeleton";
import { ClassGradebookMatrix } from "@/components/exams/class-gradebook-matrix";
import { useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { usePDFExport } from "@/hooks/use-pdf-export";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";
import { useUnsavedChanges } from "@/providers/unsaved-changes-provider";
import {
  mapSheetRows,
  applyImportedMarks,
  buildMarksTemplateRows,
  type ImportMarkRow,
} from "@/lib/marks-import";

interface StudentMark {
  studentProfileId: string;
  studentId: string;
  rollNumber: string;
  firstName: string;
  lastName: string;
  obtainedMarks: string;
  existingGrade?: string;
  existingStatus?: string;
  isLocked?: boolean;
  /** Explicitly marked absent — persisted as status "ABSENT" with 0 marks. */
  isAbsent?: boolean;
}

export default function ExamResultsPage() {
  const t = useTranslations("results");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const { settings } = useTenantSettings();
  const { exportTranscriptPDF } = usePDFExport();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canReadExams = hasPermission(perms, "exams", "read");
  const canReadResults = hasPermission(perms, "exam-results", "read");
  const canWriteResults = hasPermission(perms, "exam-results", "write");

  // View state: list (default) or form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState("ledger");
  const [editingResult, setEditingResult] = useState<any>(null);

  // List view filter & pagination state
  const [listSearch, setListSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterExam, setFilterExam] = useState("");
  const [filterClass, setFilterClass] = useState("");
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
  }, [filterExam, filterClass, filterSubject, filterStatus]);

  // Selection state
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  // Student marks state
  const [studentMarks, setStudentMarks] = useState<StudentMark[]>([]);
  const [isExportingTabulation, setIsExportingTabulation] = useState(false);
  const [isFormReady, setIsFormReady] = useState(false);
  // Keyboard-first entry: one ref per row input; import flow state
  const markInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Fetch exams
  const { data: examsData } = useQuery({
    queryKey: ["exams", { all: true }],
    queryFn: async () => {
      const res = await fetch("/api/exams");
      if (!res.ok) throw new Error("Failed to fetch exams");
      return res.json();
    },
  });

  // Fetch classes
  const { data: classesData } = useQuery({
    queryKey: ["classes", { all: true, isActive: true }],
    queryFn: async () => {
      const res = await fetch("/api/classes?limit=100&isActive=true");
      if (!res.ok) throw new Error("Failed to fetch classes");
      return res.json();
    },
  });

  // Fetch results for the list view with server-side pagination & filters
  const { data: allResultsData, isLoading: isResultsLoading } = useQuery({
    queryKey: ["exam-results", "list", { page: listPage, search: debouncedSearch, examId: filterExam, classId: filterClass, subjectId: filterSubject, status: filterStatus }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(listPage),
        limit: String(LIST_PAGE_SIZE),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filterExam) params.set("examId", filterExam);
      if (filterClass) params.set("classId", filterClass);
      if (filterSubject) params.set("subjectId", filterSubject);
      if (filterStatus) params.set("status", filterStatus);

      const res = await fetch(`/api/exam-results?${params}`);
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
  // Class cascades from the selected exam: an exam is eligible for the classes
  // whose curriculum (ClassSubject) intersects the exam's subjects (Exam
  // carries no direct classId — classIds are attached server-side).
  const selectedFilterExamObj = useMemo(
    () => exams.find((e: any) => e.id === filterExam),
    [exams, filterExam]
  );
  const listClassFilterOptions = useMemo(() => {
    const eligible: string[] | undefined = selectedFilterExamObj?.classIds;
    const visible = eligible && eligible.length > 0
      ? classes.filter((c: any) => eligible.includes(c.id))
      : classes;
    return [
      { value: "", label: t("filterAllClasses") || "All Classes" },
      ...visible.map((c: any) => ({
        value: c.id,
        label: c.name,
      })),
    ];
  }, [classes, selectedFilterExamObj, t]);

  const listExamFilterOptions = useMemo(() => [
    { value: "", label: t("filterAllExams") },
    ...exams.map((e: any) => ({
      value: e.id,
      label: `${e.name} (${e.academicYear?.label || e.examId})`,
    })),
  ], [exams, t]);

  // Fetch class-specific subjects when filterClass is chosen
  const { data: filterClassSubjectsData } = useQuery({
    queryKey: ["class-subjects", { classId: filterClass, scope: "exam-results-filter" }],
    queryFn: async () => {
      if (!filterClass) return [];
      const res = await fetch(`/api/class-subjects?classId=${filterClass}`);
      if (!res.ok) return [];
      const json = await res.json();
      // Preserve the Subject FK id (nested subject carries no id) for filter values.
      return (json.data || [])
        .map((cs: any) => ({ id: cs.subjectId, name: cs.subject?.name }))
        .filter((s: any) => s.id && s.name);
    },
    enabled: !!filterClass,
  });

  // Build subject filter from exams' subjects (scoped by exam + class when set)
  const listSubjectFilterOptions = useMemo(() => {
    if (filterClass && filterClassSubjectsData && filterClassSubjectsData.length > 0) {
      return [
        { value: "", label: t("filterAllSubjects") },
        ...filterClassSubjectsData.map((s: any) => ({
          value: s.id,
          label: s.name,
        })),
      ];
    }

    const examsInScope = filterExam
      ? exams.filter((e: any) => e.id === filterExam)
      : filterClass && selectedFilterExamObj?.classIds && selectedFilterExamObj.classIds.length > 0
        ? exams.filter((e: any) => (e.classIds ?? []).includes(filterClass))
        : exams;
    const map = new Map<string, string>();
    examsInScope.forEach((e: any) => {
      e.subjects?.forEach((es: any) => {
        if (es?.subjectId && es?.subject?.name) map.set(es.subjectId, es.subject.name);
      });
    });
    return [
      { value: "", label: t("filterAllSubjects") },
      ...Array.from(map.entries()).map(([id, name]) => ({ value: id, label: name })),
    ];
  }, [exams, filterClass, filterExam, filterClassSubjectsData, selectedFilterExamObj, t]);

  const listStatusFilterOptions = useMemo(
    () => [
      { value: "", label: t("filterAllStatus") },
      { value: "PASS", label: t("pass") },
      { value: "FAIL", label: t("fail") },
      { value: "ABSENT", label: t("absent") },
    ],
    [t]
  );

  const hasActiveFilters = listSearch || filterExam || filterClass || filterSubject || filterStatus;

  const clearAllFilters = () => {
    setListSearch("");
    setDebouncedSearch("");
    setFilterExam("");
    setFilterClass("");
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
    queryKey: ["students", { classId: selectedClass, status: "ACTIVE", sortBy: "rollNumber", sortOrder: "asc", limit: 200 }],
    queryFn: async () => {
      const res = await fetch(
        `/api/students?limit=200&classId=${selectedClass}&status=ACTIVE&sortBy=rollNumber&sortOrder=asc`,
        {}
      );
      if (!res.ok) throw new Error("Failed to fetch students");
      return res.json();
    },
    enabled: !!selectedClass,
  });

  // Fetch existing results for the selected exam + subject + class combo (avoid pagination truncation)
  const { data: existingResultsData, isLoading: existingResultsLoading } = useQuery({
    queryKey: ["exam-results", "marks-entry", { examId: selectedExam, subjectId: selectedSubject, classId: selectedClass }],
    queryFn: async () => {
      const params = new URLSearchParams({ examId: selectedExam, subjectId: selectedSubject, limit: "200" });
      if (selectedClass) params.set("classId", selectedClass);
      const res = await fetch(`/api/exam-results?${params.toString()}`);
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

  // Roster hydration in progress: all three selectors picked but the
  // students/results queries haven't resolved yet (auto-hydration path).
  const isHydratingMarks =
    !!selectedExam &&
    !!selectedClass &&
    !!selectedSubject &&
    (studentsLoading || existingResultsLoading);

  // Auto-transition to marks entry table as soon as Exam, Class, and Subject are chosen
  // ponytail: wait for both students and existingResults to load before hydrating marks — avoids empty form after refresh
  useEffect(() => {
    if (
      isFormOpen &&
      selectedExam &&
      selectedClass &&
      selectedSubject &&
      !studentsLoading &&
      !existingResultsLoading &&
      students.length > 0 &&
      !isFormReady &&
      !editingResult
    ) {
      const marks: StudentMark[] = students.map((s: any) => {
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
          // Locked rows must render as locked in the auto-entry flow too,
          // otherwise the client sends them and relies on the server alone.
          isLocked: Boolean(existing?.isLocked),
          isAbsent: existing?.status === "ABSENT",
        };
      });

      setStudentMarks(marks);
      setIsFormReady(true);
    }
  }, [
    isFormOpen,
    selectedExam,
    selectedClass,
    selectedSubject,
    studentsLoading,
    existingResultsLoading,
    students,
    existingResults,
    isFormReady,
    editingResult,
  ]);

  // Build student marks list when all selections are made
  const loadStudentMarks = () => {
    if (!selectedExam || !selectedClass || !selectedSubject) {
      toast.error(t("pleaseSelectAll"));
      return;
    }
    if (studentsLoading || existingResultsLoading) {
      toast.error(t("loadingStudents"));
      return;
    }
    if (students.length === 0) {
      toast.error(t("noStudentsInClass"));
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
        isLocked: Boolean(existing?.isLocked),
        isAbsent: existing?.status === "ABSENT",
      };
    });

    setStudentMarks(marks);
    setIsFormReady(true);
  };

  // Update individual student marks
  const handleMarksChange = (index: number, value: string) => {
    const student = studentMarks[index];
    if (student?.isLocked) {
      toast.error(t("marksLockedDuePromotion"));
      return;
    }
    if (student?.isAbsent) return; // clear the absent flag before entering marks
    const maxMarks = selectedSubjectInfo?.maxMarks;
    if (!maxMarks) return; // no silent fallback ceiling — the server derives it
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

  // Toggle the explicit-absent flag for a student row
  const handleAbsentToggle = (index: number, absent: boolean) => {
    const student = studentMarks[index];
    if (student?.isLocked) {
      toast.error(t("marksLockedDuePromotion"));
      return;
    }
    setStudentMarks((prev) =>
      prev.map((m, i) =>
        i === index
          ? { ...m, isAbsent: absent, obtainedMarks: absent ? "" : m.obtainedMarks }
          : m
      )
    );
  };

  // Keyboard-first entry: Enter/Down jumps to the next editable row, Up to
  // the previous one (locked/absent rows are skipped, focus selects text).
  const focusMarkRow = (index: number, dir: 1 | -1) => {
    let i = index + dir;
    while (i >= 0 && i < studentMarks.length) {
      const row = studentMarks[i];
      const el = markInputRefs.current[i];
      if (el && !row.isLocked && !row.isAbsent && canWriteResults) {
        el.focus();
        el.select();
        return;
      }
      i += dir;
    }
  };

  const handleMarkKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      focusMarkRow(index, 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusMarkRow(index, -1);
    }
  };

  // Bulk import: Excel template download + Excel upload matched by roll/ID.
  const handleTemplateDownload = async () => {
    try {
      const ExcelJS = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Marks");
      ws.columns = [
        { header: "rollNumber", key: "roll", width: 14 },
        { header: "studentId", key: "sid", width: 16 },
        { header: "studentName", key: "name", width: 28 },
        { header: "obtainedMarks", key: "marks", width: 15 },
        { header: "absent", key: "absent", width: 12 },
      ];
      ws.getRow(1).font = { bold: true };
      for (const cells of buildMarksTemplateRows(studentMarks).slice(1)) {
        ws.addRow(cells);
      }
      const buffer = await wb.xlsx.writeBuffer();
      downloadBlob(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        "marks-template.xlsx"
      );
      toast.success(t("templateDownloaded"));
    } catch {
      toast.error(t("importInvalidFile"));
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const max = selectedSubjectInfo?.maxMarks;
    if (!max) {
      toast.error(t("pleaseSelectAll"));
      return;
    }
    if (!/\.xlsx?$/i.test(file.name)) {
      toast.error(t("importInvalidFile"));
      return;
    }
    setIsImporting(true);
    try {
      // Heavy parser loads on demand so the page bundle stays lean.
      const ExcelJS = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) throw new Error("empty workbook");
      const grid: string[][] = [];
      ws.eachRow((row) => {
        const vals: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) =>
          vals.push(String(cell.value ?? "").trim())
        );
        grid.push(vals);
      });
      const rows: ImportMarkRow[] = mapSheetRows(grid);
      if (rows.length === 0) {
        toast.error(t("importNoMatch"));
        return;
      }
      const { updated, matched, skipped } = applyImportedMarks(studentMarks, rows, max);
      if (matched === 0) {
        toast.error(t("importNoMatch"));
        return;
      }
      setStudentMarks(updated);
      toast.success(t("importSummary", { matched, skipped }));
    } catch {
      toast.error(t("importInvalidFile"));
    } finally {
      setIsImporting(false);
    }
  };

  // Save exam results
  const saveMutation = useMutation({
    mutationFn: async (results: any[]) => {
      // Single-result edit goes to the [id] endpoint; everything else is a
      // bulk upsert (safe to re-run — existing rows are updated in place).
      const endpoint = editingResult ? `/api/exam-results/${editingResult.id}` : "/api/exam-results";
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editingResult ? results[0] : results),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        // Surface the first field-level error plus how many more failed,
        // instead of dumping the entire joined summary into one toast.
        const fieldErrors: Array<{ message?: string }> = Array.isArray(data?.errors) ? data.errors : [];
        const first = fieldErrors[0]?.message;
        const extra = fieldErrors.length - 1;
        const summary = first
          ? extra > 0
            ? t("saveErrorSummary", { message: first, count: extra })
            : first
          : data?.message || t(editingResult ? "updateError" : "saveError");
        throw new Error(summary);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(t(editingResult ? "updateSuccess" : "saveSuccess"));
      queryClient.invalidateQueries({ queryKey: ["exam-results"] });
      handleBack();
    },
    onError: (err: any) => {
      toast.error(err.message || t(editingResult ? "updateError" : "saveError"));
    },
  });

  const handleSave = () => {
    const maxMarks = selectedSubjectInfo?.maxMarks;
    if (!maxMarks) {
      toast.error(t("pleaseSelectAll"));
      return;
    }

    // Rows with marks are saved as graded results; rows flagged absent are
    // saved as an explicit status "ABSENT" with zero marks — an absent
    // student must never silently look like "not graded yet" or a 0/F scorer.
    const filledMarks = studentMarks.filter(
      (m) => (m.obtainedMarks !== "" && m.obtainedMarks !== undefined) || m.isAbsent
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
      maxMarks,
      obtainedMarks: m.isAbsent ? 0 : parseFloat(m.obtainedMarks),
      absent: Boolean(m.isAbsent),
      reExamAllowed: false,
    }));

    saveMutation.mutate(results);
  };

  // Handle back to list — always reset the full entry state so reopening
  // starts from a clean selection screen instead of rehydrating the
  // previous marks (the auto-hydration effect would otherwise rebuild the
  // old table from the still-set selections + cached students).
  const handleBack = () => {
    setIsFormOpen(false);
    setIsFormReady(false);
    setStudentMarks([]);
    setSelectedExam("");
    setSelectedClass("");
    setSelectedSubject("");
    setEditingResult(null);
  };

  // Handle edit result
  const handleEditResult = (result: any) => {
    if (result.isLocked) {
      toast.error(t("examResultLockedDuePromotion"));
      return;
    }
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
      isLocked: Boolean(result.isLocked),
    }];

    setStudentMarks(marks);
    setIsFormReady(true);
    setIsFormOpen(true);
  };

  // Computed stats
  const passMarks = selectedSubjectInfo?.passMarks ?? 0;
  const maxMarks = selectedSubjectInfo?.maxMarks ?? 0;
  const passPercentage = maxMarks > 0 ? (passMarks / maxMarks) * 100 : 0;
  const filledCount = studentMarks.filter(
    (m) => m.obtainedMarks !== ""
  ).length;
  const absentCount = studentMarks.filter((m) => m.isAbsent).length;
  const passedCount = studentMarks.filter((m) => {
    if (m.isAbsent) return false;
    const marks = parseFloat(m.obtainedMarks);
    return !isNaN(marks) && maxMarks > 0 && (marks / maxMarks) * 100 >= passPercentage;
  }).length;
  const failedCount = studentMarks.filter((m) => {
    if (m.isAbsent) return false;
    const marks = parseFloat(m.obtainedMarks);
    return !isNaN(marks) && maxMarks > 0 && (marks / maxMarks) * 100 < passPercentage;
  }).length;
  const initialMarksRef = useMemo(() => studentMarks.map((m) => ({ id: m.studentProfileId, marks: m.obtainedMarks })), [isFormReady]);
  const marksEntryDirty = isFormOpen && isFormReady && JSON.stringify(initialMarksRef) !== JSON.stringify(studentMarks.map((m) => ({ id: m.studentProfileId, marks: m.obtainedMarks })));
  useUnsavedChanges(marksEntryDirty, "exam-results-marks-form");

  // Build options
  const examOptions = [
    { value: "", label: t("selectExam") },
    ...exams.map((e: any) => ({
      value: e.id,
      label: `${e.name} (${e.academicYear?.label || e.examId})`,
    })),
  ];

  const classOptions = useMemo(() => {
    const eligible: string[] | undefined = selectedExamObj?.classIds;
    let visible = eligible && eligible.length > 0
      ? classes.filter((c: any) => eligible.includes(c.id))
      : classes;
    // Never hide a class that is already selected (e.g. edit flow or stale
    // cache) — otherwise the dropdown would show a blank value.
    if (selectedClass && !visible.some((c: any) => c.id === selectedClass)) {
      const current = classes.find((c: any) => c.id === selectedClass);
      if (current) visible = [current, ...visible];
    }
    return [
      { value: "", label: t("selectClass") },
      ...visible.map((c: any) => ({
        value: c.id,
        label: `${c.name} (Class ${c.classNumber})`,
      })),
    ];
  }, [classes, selectedExamObj, selectedClass, t]);

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
    if (isNaN(num) || maxMarks <= 0) return "";
    const pct = (num / maxMarks) * 100;
    if (pct >= 80) return "text-emerald-600";
    if (pct >= 60) return "text-blue-600";
    if (pct >= passPercentage) return "text-amber-600";
    return "text-red-600";
  };

  const getGradeLabel = (marks: string) => {
    const num = parseFloat(marks);
    if (isNaN(num) || maxMarks <= 0) return "-";
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
      accessorKey: "studentProfile.rollNumber",
      header: t("rollNumber"),
      cell: ({ row }) => {
        const sp = row.original.studentProfile;
        return (
          <span className="font-medium">
            {sp?.rollNumber || "-"}
            {sp?.studentId && sp.studentId !== sp?.rollNumber && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                ({sp.studentId})
              </span>
            )}
          </span>
        );
      },
    },
    {
      accessorKey: "studentProfile.firstName",
      header: t("studentName"),
      cell: ({ row }) => {
        const sp = row.original.studentProfile;
        return (
          <span className="font-medium text-foreground">
            {sp ? formatStudentName(sp.firstName, sp.lastName, sp.firstNameBn, sp.lastNameBn) : "-"}
          </span>
        );
      },
    },
    {
      accessorKey: "studentProfile.class.name",
      header: t("className") || "Class",
      cell: ({ row }) => {
        const className = row.original.studentProfile?.class?.name;
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground border border-border/60">
            {className || row.original.studentProfile?.classId || "-"}
          </span>
        );
      },
    },
    {
      accessorKey: "exam.name",
      header: t("examName"),
      cell: ({ row }) => (
        <span className="font-medium text-foreground">{row.original.exam?.name || "-"}</span>
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
          <StatusBadge
            status="PASS"
            domain="examResult"
            label={t("pass")}
            icon={<CheckCircle className="h-3 w-3" />}
          />
        ) : status === "FAIL" ? (
          <StatusBadge
            status="FAIL"
            domain="examResult"
            label={t("fail")}
            icon={<XCircle className="h-3 w-3" />}
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      accessorKey: "actions",
      header: t("actions"),
      cell: ({ row }) => (
        row.original.isLocked ? (
          <div className="flex items-center justify-center h-8 w-8 text-amber-600 dark:text-amber-400" title={t("marksLockedDuePromotion")}>
            <Lock className="h-4 w-4" />
          </div>
        ) : !canWriteResults ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditResult(row.original)}
            className="h-8 w-8 p-0"
            title={t("editMarks")}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )
      ),
    },
  ];

  // ─── Screen 1: List View / Class Gradebook Matrix ───
  const handleTranscript = async () => {
    try {
      const school = { name: settings.name||"Pathshala Pro School", address: settings.address||"", phone: settings.phone||"", email: settings.email||"", logoUrl: settings.logoUrl };
      let student:any=null;
      try{ const r=await fetch("/api/students?limit=1",{credentials:"include"}); if(r.ok){ const j=await r.json(); const ls=(j as any)?.data||[]; if(ls.length>0) student=ls[0];}}catch{}
      const base = student || {firstName:"Demo",lastName:"Student",studentId:"STU001",rollNumber:"R-001",dateOfBirth:"2008-01-01",class:{name:"Class 10"}, section:{name:"A"}};
      const exam = exams[0];
      const subjects = exam ? (exam.subjects||[]).map((s:any)=>({ subjectName: s.subject?.name||s.subjectId, subjectCode: s.subject?.code||"-", maxMarks: s.maxMarks||100, obtainedMarks: 72, grade:"A", gradePoint: 3.6 })) : [{subjectName:"General", subjectCode:"GEN", maxMarks:100, obtainedMarks:75, grade:"A", gradePoint:3.6}];
      const totalMax = subjects.reduce((a:number,c:any)=>a+c.maxMarks,0) || 300;
      const totalObtained = subjects.reduce((a:number,c:any)=>a+c.obtainedMarks,0);
      const percentage = Number(((totalObtained/totalMax)*100).toFixed(1));
      const gpa = 3.4;
      const transcript:any = {
        studentName: `${base.firstName||""} ${base.lastName||""}`.trim()||"Demo Student", admissionNumber: base.studentId||"STU001", rollNumber: base.rollNumber||"R-001",
        dateOfBirth: base.dateOfBirth? new Date(base.dateOfBirth).toLocaleDateString():undefined, photoUrl: base.profilePictureUrl,
        years:[{ academicYear: exam?.academicYear?.label || new Date().getFullYear().toString(), className: base.class?.name||"Class 10", section: base.section?.name, rollNumber: base.rollNumber||"R-001", examName: exam?.name||"Final Exam", subjects, totalMax, totalObtained, percentage, gpa, grade:"A", result:"PASSED"}],
        cumulativeGpa:gpa, cumulativePercentage:percentage, overallGrade:"A", issueDate: new Date().toLocaleDateString(), transcriptNumber:`TR-${Date.now().toString().slice(-6)}`,
      };
      const url = typeof window!=="undefined"? `${window.location.origin}/verify/certificate/TR` : undefined;
      const res = await exportTranscriptPDF(school, transcript, url);
      if(res.success) toast.success(t("transcriptDownloaded")); else toast.error(t("pdfFailed"));
    } catch{ toast.error(t("pdfFailed")); }
  };

  const handleTabulationSheet = async () => {
    if (!filterClass) {
      toast.error(t("selectClassFirst"));
      return;
    }
    setIsExportingTabulation(true);
    try {
      const params = new URLSearchParams({ classId: filterClass });
      if (filterExam) params.set("examId", filterExam);
      const res = await fetch(`/api/exams/tabulation-sheet?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || t("tabulationFailed"));
      }
      const blob = await res.blob();
      downloadBlob(blob, `tabulation-sheet_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(t("tabulationExported"));
    } catch (error: any) {
      toast.error(error?.message || t("tabulationFailed"));
    } finally {
      setIsExportingTabulation(false);
    }
  };

  if (!isFormOpen) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("title")}
          description={t("description")}
          icon={ClipboardCheck}
        >
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleTranscript} title={t("transcriptPDF")}>
              {t("transcriptPDF")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTabulationSheet}
              disabled={isExportingTabulation}
            >
              {isExportingTabulation ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              {t("tabulationSheet")}
            </Button>
          {canWriteResults && (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("enterResults")}
            </Button>
          )}
          </div>
        </PageHeader>

        <Tabs value={activeViewTab} onValueChange={setActiveViewTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="ledger" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              {t("resultsLedger") || "Results Ledger"}
            </TabsTrigger>
            <TabsTrigger value="gradebook" className="gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              {t("classGradebook") || "Class Gradebook & Batch Cards"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ledger" className="space-y-6 mt-4">
            {!isAuthLoading && !canReadResults ? (
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="text-lg font-semibold text-foreground">{tCommon("accessRestricted")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{tCommon("noPermission")}</p>
              </div>
            ) : (
              <>
                {/* Search & Filter Bar */}
                <div className="bg-card rounded-lg border border-border p-4 shadow-sm space-y-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t("searchPlaceholder")}
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filter Dropdowns Row */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-44">
                  <AppDropdown
                    value={filterClass}
                    onChange={(val) => {
                      setFilterClass(val);
                      setFilterSubject("");
                    }}
                    options={listClassFilterOptions}
                    placeholder={t("filterAllClasses") || "All Classes"}
                    searchable
                  />
                </div>
                <div className="w-48">
                  <AppDropdown
                    value={filterExam}
                    onChange={(val) => {
                      setFilterExam(val);
                      setFilterClass("");
                      setFilterSubject("");
                    }}
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
                <div className="w-36">
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
              </>
            )}
          </TabsContent>

          <TabsContent value="gradebook" className="space-y-6 mt-4">
            <ClassGradebookMatrix exams={exams} classes={classes} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // ─── Screen 2: Marks Entry Form (like Admissions create form) ───
  if (isFormReady) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={editingResult ? t("editResult") : t("marksEntry")}
          description={`${selectedExamObj?.name} — ${selectedSubjectInfo?.name} (${t("maxMarks")}: ${selectedSubjectInfo?.maxMarks ?? "-"})`}
          icon={ClipboardCheck}
        >
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleTemplateDownload} title={t("downloadTemplate")}>
              <FileDown className="mr-2 h-4 w-4" />
              {t("downloadTemplate")}
            </Button>
            {canWriteResults && (
              <Button
                variant="outline"
                onClick={() => importFileRef.current?.click()}
                disabled={isImporting || saveMutation.isPending}
                title={t("importMarks")}
              >
                {isImporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {t("importMarks")}
              </Button>
            )}
            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImportFile}
            />
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("back")}
            </Button>
          </div>
        </PageHeader>

        {!isAuthLoading && !canReadResults ? (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">{tCommon("accessRestricted")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{tCommon("noPermission")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Main Marks Entry */}
            <div className="lg:col-span-4 space-y-6">
              <form
                id="exam-results-marks-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
            <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
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
                        key={student.studentProfileId || student.studentId || `student-row-${index}`}
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
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium">
                              {formatStudentName(student.firstName, student.lastName)}
                            </p>
                            {student.isLocked && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20" title={t("marksLockedDuePromotion")}>
                                <Lock className="h-2.5 w-2.5" /> Locked
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {student.studentId}
                          </p>
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <Input
                            type="number"
                            value={student.obtainedMarks}
                            disabled={student.isLocked || student.isAbsent || !canWriteResults}
                            onChange={(e) =>
                              handleMarksChange(index, e.target.value)
                            }
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => handleMarkKeyDown(e, index)}
                            ref={(el) => {
                              markInputRefs.current[index] = el;
                            }}
                            min={0}
                            max={maxMarks || undefined}
                            step="0.5"
                            placeholder="0"
                            className={`w-20 text-center font-semibold ${gradeColor} ${student.isLocked || student.isAbsent || !canWriteResults ? "bg-muted/60 text-muted-foreground opacity-75 cursor-not-allowed" : ""}`}
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
                        <div className="col-span-2 flex items-center justify-center gap-1">
                          {student.isAbsent ? (
                            <>
                              <StatusBadge
                                status="ABSENT"
                                domain="examResult"
                                label={t("absent")}
                                icon={<XCircle className="h-3 w-3" />}
                              />
                              {canWriteResults && !student.isLocked && (
                                <button
                                  type="button"
                                  onClick={() => handleAbsentToggle(index, false)}
                                  className="text-muted-foreground hover:text-foreground"
                                  title={t("clearAbsent")}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </>
                          ) : student.obtainedMarks !== "" ? (
                            isPassing ? (
                              <StatusBadge
                                status="PASS"
                                domain="examResult"
                                label={t("pass")}
                                icon={<CheckCircle className="h-3 w-3" />}
                              />
                            ) : (
                              <StatusBadge
                                status="FAIL"
                                domain="examResult"
                                label={t("fail")}
                                icon={<XCircle className="h-3 w-3" />}
                              />
                            )
                          ) : canWriteResults && !student.isLocked ? (
                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                              <Checkbox
                                checked={false}
                                disabled={student.isLocked || !canWriteResults}
                                onCheckedChange={() => handleAbsentToggle(index, true)}
                              />
                              {t("absent")}
                            </label>
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
            </form>
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-6">
            <div className="bg-card rounded-lg border border-border p-6 shadow-sm sticky top-6">
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
                      {absentCount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <XCircle className="h-3 w-3" /> {t("absent")}
                          </span>
                          <span className="font-bold text-muted-foreground">
                            {absentCount}
                          </span>
                        </div>
                      )}
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

              {canWriteResults && (
                <Button
                  type="submit"
                  form="exam-results-marks-form"
                  disabled={
                    saveMutation.isPending || filledCount === 0
                  }
                  className="w-full mt-8 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-lg"
                >
                  <Save className="h-4 w-4" />
                  {saveMutation.isPending
                    ? t("saving")
                    : t("saveResults")}
                </Button>
              )}
            </div>
          </div>
          </div>
        )}
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
          <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">
              {t("examDetails")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t("examName")}
                </label>
                {!canReadExams && !isAuthLoading ? (
                  <div className="py-2 text-sm text-muted-foreground">{tCommon("noPermission")}</div>
                ) : (
                  <AppDropdown
                    value={selectedExam}
                    onChange={(val) => {
                      setSelectedExam(val);
                      setSelectedClass("");
                      setSelectedSubject("");
                    }}
                    options={examOptions}
                    placeholder={t("selectExam")}
                    searchable
                  />
                )}
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
          <div className="bg-card rounded-lg border border-border p-8 shadow-sm">
            {isHydratingMarks ? (
              <TableSkeleton rows={6} />
            ) : (
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
            )}
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <div className="bg-card rounded-lg border border-border p-6 shadow-sm sticky top-6">
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

            {canWriteResults && (
              <Button
                onClick={loadStudentMarks}
                disabled={
                  !selectedExam ||
                  !selectedClass ||
                  !selectedSubject ||
                  studentsLoading ||
                  existingResultsLoading
                }
                className="w-full mt-8 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-lg"
              >
                {studentsLoading || existingResultsLoading ? (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
