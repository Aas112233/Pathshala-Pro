"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
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
  CalendarRange,
  CalendarClock,
  ShieldAlert,
  Info,
  Award,
  Repeat2,
  LogOut,
  MoreVertical,
  RotateCcw,
  PencilLine,
  TrendingDown,
  FileText,
  Printer,
} from "lucide-react";
import {
  usePromotionCalculation,
  useExecutePromotions,
  usePromotionPreflight,
} from "@/hooks/use-exams";
import { RolloverPreflightPanel } from "@/components/shared/rollover-preflight-panel";
import type {
  PromotionDecisionView,
  PromotionReason,
  PromotionAction,
  ExecutePromotionsResult,
} from "@/hooks/use-exams";
import {
  useBulkIssueCertificates,
  type BulkCertificateType,
  type IssuedCertificate,
} from "@/hooks/use-certificates";
import { useCertificatePrinter } from "@/hooks/use-certificate-printer";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";
import { useAcademicYearContext } from "@/components/providers/academic-year-provider";
import { useExcelExport } from "@/hooks/use-excel-export";
import { useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { formatDateWithSettings } from "@/lib/tenant-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { ERPDataTable, ERPStatusPill } from "@/components/ui/erp-data-table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface ClassOption {
  id: string;
  classId?: string;
  name: string;
  classNumber?: number;
}

/** A server decision plus the local flag recording a manual override. */
type RosterRow = PromotionDecisionView & { overridden?: boolean };

const STATUS_PILL_VARIANT: Record<
  PromotionAction,
  "emerald" | "amber" | "rose" | "indigo" | "subtle"
> = {
  PROMOTED: "emerald",
  CONDITIONAL_PROMOTED: "amber",
  RETAINED: "rose",
  GRADUATED: "indigo",
  DEMOTED: "subtle",
  TRANSFERRED: "subtle",
};

const STATUS_ICON: Record<PromotionAction, ReactNode> = {
  PROMOTED: <CheckCircle2 className="h-3 w-3" />,
  RETAINED: <XCircle className="h-3 w-3" />,
  CONDITIONAL_PROMOTED: <AlertTriangle className="h-3 w-3" />,
  GRADUATED: <Award className="h-3 w-3" />,
  DEMOTED: <Repeat2 className="h-3 w-3" />,
  TRANSFERRED: <LogOut className="h-3 w-3" />,
};

const STATUS_ICON_CLASS: Record<PromotionAction, string> = {
  PROMOTED: "text-emerald-600 dark:text-emerald-400",
  CONDITIONAL_PROMOTED: "text-amber-600 dark:text-amber-400",
  RETAINED: "text-rose-600 dark:text-rose-400",
  GRADUATED: "text-indigo-600 dark:text-indigo-400",
  DEMOTED: "text-muted-foreground",
  TRANSFERRED: "text-muted-foreground",
};

/** A manual decision for one student. */
interface PromotionOverride {
  action: PromotionAction;
  /** Set for DEMOTED only: the lower class the student repeats. */
  toClassId?: string;
}

/**
 * Actions an operator may set with a single click. DEMOTED is deliberately not
 * one of them: it is incomplete without a target class, so choosing it opens a
 * picker rather than committing immediately (see `handleRequestDemotion`).
 */
const OVERRIDE_ACTIONS: PromotionAction[] = [
  "PROMOTED",
  "CONDITIONAL_PROMOTED",
  "RETAINED",
  "GRADUATED",
  "TRANSFERRED",
];

export default function PromotionsCalculatePage() {
  const router = useRouter();
  const t = useTranslations("promotions.calculator");
  const tReason = useTranslations("promotions.reasons");
  const tPreflight = useTranslations("promotions.preflight");
  const searchParams = useSearchParams();
  const classIdParam = searchParams.get("classId");
  const academicYearIdParam = searchParams.get("academicYearId");
  const targetYearIdParam = searchParams.get("toAcademicYearId");

  const { academicYears, selectedAcademicYearId } = useAcademicYearContext();
  const { settings } = useTenantSettings();
  const { exportData } = useExcelExport({
    fileName: "promotion_roster",
    schoolName: settings.name || "Pathshala Pro School",
    schoolAddress: settings.address,
    schoolPhone: settings.phone,
    schoolEmail: settings.email,
  });

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState(classIdParam || "");
  const [selectedYear, setSelectedYear] = useState(academicYearIdParam || "");
  const [selectedTargetYear, setSelectedTargetYear] = useState(targetYearIdParam || "");
  const [rollNumberPolicy, setRollNumberPolicy] = useState<"PRESERVE" | "SEQUENTIAL">(
    "PRESERVE"
  );

  // Roster table state (client-side: the operator must be able to select across
  // the whole cohort before committing, which server-side paging would break).
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [selectionTouched, setSelectionTouched] = useState(false);
  /** Manual per-student decisions, keyed by studentProfileId. */
  const [overrides, setOverrides] = useState<Record<string, PromotionOverride>>({});
  /** The student whose demotion target is being chosen, if any. */
  const [demotionFor, setDemotionFor] = useState<{
    studentProfileId: string;
    studentName: string;
  } | null>(null);
  const [demotionClassId, setDemotionClassId] = useState("");

  // Default the source year to the globally selected academic year.
  useEffect(() => {
    if (!academicYearIdParam && !selectedYear && selectedAcademicYearId) {
      setSelectedYear(selectedAcademicYearId);
    }
  }, [academicYearIdParam, selectedYear, selectedAcademicYearId]);

  useEffect(() => {
    async function loadClasses() {
      try {
        const res = await fetch("/api/classes?limit=100&isActive=true");
        if (res.ok) {
          const json = await res.json();
          const items = json?.data?.items || json?.data || [];
          if (Array.isArray(items)) setClasses(items);
        }
      } catch {
        // Non-fatal: the selector simply stays empty until the API recovers.
      }
    }
    loadClasses();
  }, []);

  const {
    data: calculation,
    isLoading,
    isFetching,
    refetch,
  } = usePromotionCalculation(
    selectedClass || undefined,
    selectedYear || undefined,
    selectedTargetYear || undefined
  );

  const executePromotions = useExecutePromotions();

  // ---------------------------------------------------------------------------
  // Pre-flight readiness.
  //
  // The server enforces these checks on the write path regardless, but a gate
  // the operator cannot see is a trap: the roster can look perfectly healthy
  // while the run is doomed by a rule that was never given a next class, or by
  // a student who is already enrolled in the target year. Scoped to the current
  // selection so the report describes the batch that would actually run.
  // ---------------------------------------------------------------------------
  const preflight = usePromotionPreflight(
    selectedClass || undefined,
    selectedYear || undefined,
    selectedTargetYear || undefined,
    selectedIds.map(String)
  );
  const preflightBlocked = preflight.data ? !preflight.data.canProceed : false;

  // ---------------------------------------------------------------------------
  // Post-execution: the documents the exits now owe.
  //
  // This has to hang off the *result* of the run, not off the roster. The
  // roster is refetched afterwards and exited students are no longer enrolled
  // in the source class, so they vanish from it — exactly the students who need
  // a certificate are the ones the list no longer shows.
  // ---------------------------------------------------------------------------
  const { user: authUser } = useAuth();
  const certificatePermissions = getEffectivePermissions(
    authUser?.role as string,
    (authUser as any)?.permissions,
    (authUser as any)?.accessLevel
  );
  const canIssueCertificates = hasPermission(certificatePermissions, "certificates", "write");

  const bulkIssueCertificates = useBulkIssueCertificates();
  const { printCertificate, printingId } = useCertificatePrinter();

  const [executionResult, setExecutionResult] = useState<ExecutePromotionsResult | null>(null);
  /** Documents issued in this run, keyed by studentProfileId. */
  const [issuedByStudent, setIssuedByStudent] = useState<Record<string, IssuedCertificate>>({});
  const [issuingType, setIssuingType] = useState<BulkCertificateType | null>(null);

  const exitedStudents = useMemo(() => {
    if (!executionResult) return [];
    return executionResult.promotions
      .filter(
        (promotion) => promotion.status === "GRADUATED" || promotion.status === "TRANSFERRED"
      )
      .map((promotion) => ({
        studentProfileId: promotion.studentProfileId,
        studentName:
          `${promotion.studentProfile?.firstName ?? ""} ${
            promotion.studentProfile?.lastName ?? ""
          }`.trim() ||
          promotion.studentProfile?.studentId ||
          promotion.studentProfileId,
        studentId: promotion.studentProfile?.studentId ?? "",
        status: promotion.status as "GRADUATED" | "TRANSFERRED",
      }));
  }, [executionResult]);

  const transferredExits = useMemo(
    () => exitedStudents.filter((student) => student.status === "TRANSFERRED"),
    [exitedStudents]
  );
  const graduatedExits = useMemo(
    () => exitedStudents.filter((student) => student.status === "GRADUATED"),
    [exitedStudents]
  );

  const pendingCertificates = useMemo(
    () => exitedStudents.filter((student) => !issuedByStudent[student.studentProfileId]),
    [exitedStudents, issuedByStudent]
  );
  const pendingTransferred = useMemo(
    () => transferredExits.filter((student) => !issuedByStudent[student.studentProfileId]),
    [transferredExits, issuedByStudent]
  );
  const pendingGraduated = useMemo(
    () => graduatedExits.filter((student) => !issuedByStudent[student.studentProfileId]),
    [graduatedExits, issuedByStudent]
  );

  const calcData = calculation ?? null;
  const students = useMemo(() => calcData?.students ?? [], [calcData]);

  const nextClassName =
    calcData?.nextClass?.name ||
    calcData?.promotionRule?.nextClassName ||
    t("graduatedFinalClass");

  const targetYearLabel = calcData?.targetAcademicYear?.label ?? null;

  // ---------------------------------------------------------------------------
  // Default selection: everything that actually moves (advances or exits).
  // Retained students are deliberately left unchecked — retaining a student is
  // a heavier academic decision that is usually handled case by case — but they
  // remain selectable so a school can record them in the same run.
  // ---------------------------------------------------------------------------
  const defaultSelectedIds = useMemo(
    () =>
      students
        .filter((s) => s.advances || s.exits)
        .map((s) => s.studentProfileId),
    [students]
  );

  useEffect(() => {
    if (selectionTouched) return;
    setSelectedIds(defaultSelectedIds);
  }, [defaultSelectedIds, selectionTouched]);

  // Any change to the cohort or the target year invalidates a manual selection
  // and every manual override — they were decisions about a different cohort.
  useEffect(() => {
    setSelectionTouched(false);
    setOverrides({});
    setPage(1);
    // A previous run's exit list describes a cohort that is no longer on
    // screen, so it goes with the overrides.
    setExecutionResult(null);
    setIssuedByStudent({});
  }, [selectedClass, selectedYear, selectedTargetYear]);

  const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);

  const classById = useMemo(() => new Map(classes.map((cls) => [cls.id, cls])), [classes]);

  /**
   * The roster as the operator will actually commit it: server-computed
   * decisions with any manual override applied. Movement flags are re-derived
   * here so the badge, the target class and the export never contradict the
   * chosen action.
   */
  const resolvedStudents = useMemo<RosterRow[]>(
    () =>
      students.map((student) => {
        const override = overrides[student.studentProfileId];
        if (!override) return student;

        const { action, toClassId } = override;
        const exits = action === "GRADUATED" || action === "TRANSFERRED";
        const advances = action === "PROMOTED" || action === "CONDITIONAL_PROMOTED";
        const demoted = action === "DEMOTED";

        // A demotion is the one override whose target is neither the source
        // class nor the rule's next class: it is whatever lower class the
        // operator picked. Everything else follows from the action.
        const targetClassId = demoted
          ? (toClassId ?? student.fromClassId)
          : exits || action === "RETAINED"
            ? student.fromClassId
            : student.targetClassId;

        const targetClassName = exits
          ? null
          : demoted
            ? (classById.get(toClassId ?? "")?.name ?? null)
            : action === "RETAINED"
              ? student.fromClassName
              : student.targetClassName;

        return {
          ...student,
          action,
          overridden: true,
          eligible: action === "PROMOTED" || action === "GRADUATED",
          advances,
          repeats: action === "RETAINED" || demoted,
          exits,
          requiresReExam: action === "CONDITIONAL_PROMOTED",
          targetClassId,
          targetClassName,
        };
      }),
    [students, overrides, classById]
  );

  const selectedStudents = useMemo(
    () => resolvedStudents.filter((s) => selectedSet.has(s.studentProfileId)),
    [resolvedStudents, selectedSet]
  );

  /** Overrides that would be dropped because the student is no longer ticked. */
  const orphanOverrides = useMemo(
    () => Object.keys(overrides).filter((id) => !selectedSet.has(id)),
    [overrides, selectedSet]
  );

  /** Recording a decision implies acting on the student, so tick the row too. */
  function markSelected(studentProfileId: string) {
    setSelectionTouched(true);
    setSelectedIds((prev) =>
      prev.some((id) => String(id) === studentProfileId) ? prev : [...prev, studentProfileId]
    );
  }

  function handleSetOverride(studentProfileId: string, action: PromotionAction | null) {
    if (action === "DEMOTED") {
      // A demotion is incomplete without a target class, so the click opens the
      // picker and only commits from there.
      const student = resolvedStudents.find((s) => s.studentProfileId === studentProfileId);
      setDemotionClassId("");
      setDemotionFor({ studentProfileId, studentName: student?.studentName ?? "" });
      return;
    }

    setOverrides((prev) => {
      const next = { ...prev };
      if (action) next[studentProfileId] = { action };
      else delete next[studentProfileId];
      return next;
    });

    if (action) markSelected(studentProfileId);
  }

  function handleConfirmDemotion() {
    if (!demotionFor) return;
    if (!demotionClassId) {
      toast.error(t("selectDemotionTarget"));
      return;
    }

    setOverrides((prev) => ({
      ...prev,
      [demotionFor.studentProfileId]: { action: "DEMOTED", toClassId: demotionClassId },
    }));
    markSelected(demotionFor.studentProfileId);
    setDemotionFor(null);
    setDemotionClassId("");
  }

  const canExecute =
    !!calcData &&
    !!calcData.targetAcademicYear &&
    selectedStudents.length > 0 &&
    !preflightBlocked &&
    !executePromotions.isPending;

  function pushUrl(next: { classId?: string; yearId?: string; targetYearId?: string }) {
    const params = new URLSearchParams();
    const cls = next.classId ?? selectedClass;
    const yr = next.yearId ?? selectedYear;
    const target = next.targetYearId ?? selectedTargetYear;
    if (cls) params.set("classId", cls);
    if (yr) params.set("academicYearId", yr);
    if (target) params.set("toAcademicYearId", target);
    window.history.pushState({}, "", `?${params.toString()}`);
  }

  function handleClassChange(value: string) {
    setSelectedClass(value);
    pushUrl({ classId: value });
  }

  function handleYearChange(value: string) {
    setSelectedYear(value);
    // The previous target year may not start after the new source year.
    setSelectedTargetYear("");
    pushUrl({ yearId: value, targetYearId: "" });
  }

  function handleTargetYearChange(value: string) {
    setSelectedTargetYear(value);
    pushUrl({ targetYearId: value });
  }

  function handleRollNumberPolicyChange(value: string) {
    setRollNumberPolicy(value === "SEQUENTIAL" ? "SEQUENTIAL" : "PRESERVE");
  }

  function translateReason(reason: PromotionReason): string {
    try {
      return tReason(reason.code, reason.params as Record<string, string | number>);
    } catch {
      return reason.message;
    }
  }

  function statusLabel(action: PromotionAction): string {
    const labels: Record<PromotionAction, string> = {
      PROMOTED: t("status.promoted"),
      RETAINED: t("status.retained"),
      CONDITIONAL_PROMOTED: t("status.conditionalPromoted"),
      GRADUATED: t("status.graduated"),
      DEMOTED: t("status.demoted"),
      TRANSFERRED: t("status.transferred"),
    };
    return labels[action] ?? action;
  }

  async function handleExecutePromotions() {
    if (!calcData || !calcData.targetAcademicYear) return;

    if (selectedStudents.length === 0) {
      toast.error(t("noStudentsSelected"));
      return;
    }

    // A manual action on a student who is not in the batch would be silently
    // dropped by the server, so surface it instead of losing the decision.
    if (orphanOverrides.length > 0) {
      toast.error(t("overrideNotSelected", { count: orphanOverrides.length }));
      return;
    }

    const exitCount = selectedStudents.filter((s) => s.exits).length;
    const confirmMsg = exitCount
      ? t("confirmExecuteWithExits", {
          count: selectedStudents.length,
          fromYear: calcData.academicYear.label,
          toYear: calcData.targetAcademicYear.label,
          exits: exitCount,
        })
      : t("confirmExecuteSelected", {
          count: selectedStudents.length,
          fromYear: calcData.academicYear.label,
          toYear: calcData.targetAcademicYear.label,
        });
    if (!confirm(confirmMsg)) return;

    try {
      const result = await executePromotions.mutateAsync({
        fromAcademicYearId: calcData.academicYear.id,
        toAcademicYearId: calcData.targetAcademicYear.id,
        classId: calcData.class.id,
        rollNumberPolicy,
        studentProfileIds: selectedStudents.map((s) => s.studentProfileId),
        overrides: selectedStudents.flatMap((student) => {
          const override = overrides[student.studentProfileId];
          if (!override) return [];
          return [
            {
              studentProfileId: student.studentProfileId,
              action: override.action,
              // Only a demotion names a target class; a transfer must not.
              toClassId: override.toClassId ?? null,
            },
          ];
        }),
      });
      toast.success(
        t("executeSuccess", {
          count: result.promotions.length,
          year: result.toAcademicYear.label,
        })
      );
      setSelectionTouched(false);
      setOverrides({});
      setIssuedByStudent({});
      setExecutionResult(result);
      refetch();
    } catch {
      // The mutation hook surfaces the error toast and field-level details.
    }
  }

  /**
   * Issue one document per student in a single batch.
   *
   * Graduates and transfers get different documents — a transfer certificate
   * records a departure to another school, a character certificate records the
   * conduct of a student who completed here — so the caller names the type.
   */
  async function handleIssueCertificates(
    certificateType: BulkCertificateType,
    studentProfileIds: string[]
  ) {
    if (studentProfileIds.length === 0) return;

    setIssuingType(certificateType);
    try {
      const result = await bulkIssueCertificates.mutateAsync({
        studentProfileIds,
        certificateType,
        // An exit is dated by the batch, so its document is dated the same day.
        issueDate: executionResult?.exitDate,
        purpose:
          certificateType === "TRANSFER" ? t("transferCertificatePurpose") : undefined,
      });

      setIssuedByStudent((previous) => {
        const next = { ...previous };
        for (const certificate of result.issued) {
          next[certificate.studentProfileId] = certificate;
        }
        return next;
      });

      if (result.issued.length > 0) {
        toast.success(t("certificatesIssued", { count: result.issued.length }));
      }

      if (result.skipped.length > 0) {
        // Reported, never swallowed: a skipped student still holds no document
        // and someone has to decide what happens to them.
        toast.warning(t("certificatesSkipped", { count: result.skipped.length }), {
          description: result.skipped.map((entry) => entry.studentName).join(", "),
        });
      }
    } catch {
      // The mutation surfaces the error toast and field-level detail.
    } finally {
      setIssuingType(null);
    }
  }

  async function handleExportRoster() {
    if (!resolvedStudents.length) return;
    const rows = resolvedStudents.map((student) => ({
      studentName: student.studentName,
      studentId: student.studentId,
      rollNumber: student.rollNumber || "-",
      overallPercentage: student.metrics.overallPercentage,
      attendance: student.metrics.attendanceTracked
        ? `${student.metrics.attendanceRate}%`
        : t("attendanceNotTracked"),
      failedSubjects: student.metrics.failedSubjects.join(", ") || t("none"),
      status: statusLabel(student.action),
      targetClass:
        student.action === "TRANSFERRED"
          ? t("leftSchool")
          : student.exits
            ? t("graduatedFinalClass")
            : student.targetClassName ||
              (student.action === "DEMOTED" ? t("lowerClass") : nextClassName),
      reason: student.reasons.map(translateReason).join("; "),
    }));

    const result = await exportData({
      title: t("title"),
      columns: [
        { header: t("student"), key: "studentName", width: 26 },
        { header: t("studentId"), key: "studentId", width: 14 },
        { header: t("rollNo"), key: "rollNumber", width: 12 },
        { header: t("average"), key: "overallPercentage", width: 12 },
        { header: t("attendance"), key: "attendance", width: 12 },
        { header: t("failedSubjects"), key: "failedSubjects", width: 26 },
        { header: t("statusLabel"), key: "status", width: 18 },
        { header: t("targetClass"), key: "targetClass", width: 20 },
        { header: t("evaluationReason"), key: "reason", width: 46 },
      ],
      data: rows,
    });

    if (result.success) {
      toast.success(t("exportedExcel"));
      return;
    }
    toast.error(t("exportFailed"));
  }

  // ---------------------------------------------------------------------------
  // Filter options
  // ---------------------------------------------------------------------------
  const classOptions = useMemo(
    () => classes.map((cls) => ({ value: cls.id, label: cls.name })),
    [classes]
  );

  const sourceYearOptions = useMemo(
    () =>
      (academicYears ?? []).map((year) => ({
        value: year.id,
        label: year.label ?? year.yearId ?? year.id,
      })),
    [academicYears]
  );

  const targetYearOptions = useMemo(
    () =>
      (calcData?.targetAcademicYearOptions ?? [])
        .filter((year) => year.isValidTarget)
        .map((year) => ({
          value: year.id,
          label: year.isClosed ? t("closedYearOption", { label: year.label }) : year.label,
        })),
    [calcData, t]
  );

  const hasTargetYear = !!calcData?.targetAcademicYear;
  const summary = calcData?.summary;

  const sourceClassNumber = calcData?.class.classNumber ?? null;

  /**
   * A demotion must go *down*, so only classes below the source class are
   * offered — highest first, because that is the usual destination. The server
   * re-validates this; the filter exists so the operator cannot pick a value
   * that is guaranteed to be rejected.
   */
  const lowerClassOptions = useMemo(
    () =>
      classes
        .filter(
          (cls) =>
            sourceClassNumber !== null &&
            typeof cls.classNumber === "number" &&
            cls.classNumber < sourceClassNumber
        )
        .sort((a, b) => (b.classNumber ?? 0) - (a.classNumber ?? 0))
        .map((cls) => ({ value: cls.id, label: cls.name })),
    [classes, sourceClassNumber]
  );

  const columns = useMemo(
    () => [
      {
        key: "student",
        header: t("student"),
        cell: (student: RosterRow) => (
          <div>
            <p className="font-semibold text-foreground text-sm leading-tight">
              {student.studentName}
            </p>
            <p className="text-xs text-muted-foreground font-mono">{student.studentId}</p>
          </div>
        ),
      },
      {
        key: "rollNumber",
        header: t("rollNo"),
        cell: (student: RosterRow) => (
          <span className="font-mono text-sm font-medium">{student.rollNumber || "-"}</span>
        ),
      },
      {
        key: "average",
        header: t("average"),
        cell: (student: RosterRow) => {
          const value = student.metrics.overallPercentage;
          return (
            <div className="flex items-center gap-2.5">
              <Progress value={value} className="w-20 h-2" />
              <span
                className={`text-xs font-bold ${
                  value >= 70
                    ? "text-emerald-600 dark:text-emerald-400"
                    : value >= 40
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {value}%
              </span>
            </div>
          );
        },
      },
      {
        key: "attendance",
        header: t("attendance"),
        cell: (student: RosterRow) =>
          student.metrics.attendanceTracked ? (
            <span
              className={`text-xs font-semibold ${
                student.metrics.attendanceRate >= student.metrics.minimumAttendance
                  ? "text-foreground"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {student.metrics.attendanceRate}%
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t("attendanceNotTracked")}</span>
          ),
      },
      {
        key: "failedSubjects",
        header: t("failedSubjects"),
        cell: (student: RosterRow) =>
          student.metrics.failedSubjectsCount > 0 ? (
            <div className="flex flex-wrap gap-1">
              {student.metrics.failedSubjects.map((subject) => (
                <Badge
                  key={subject}
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
              {t("none")}
            </span>
          ),
      },
      {
        key: "status",
        header: t("statusLabel"),
        cell: (student: RosterRow) => (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className={STATUS_ICON_CLASS[student.action]}>
                {STATUS_ICON[student.action]}
              </span>
              <ERPStatusPill
                status={statusLabel(student.action)}
                variant={STATUS_PILL_VARIANT[student.action]}
              />
            </div>
            {student.overridden && (
              <div className="flex items-center gap-1 text-[11px] text-primary">
                <PencilLine className="h-3 w-3" />
                {t("manualOverride")}
              </div>
            )}
          </div>
        ),
      },
      {
        key: "targetClass",
        header: t("targetClass"),
        cell: (student: RosterRow) => (
          <div className="space-y-1">
            <Badge
              variant="outline"
              className="text-xs font-medium border-primary/20 bg-primary/5 text-primary"
            >
              {student.action === "TRANSFERRED"
                ? t("leftSchool")
                : student.exits
                  ? t("graduatedFinalClass")
                  : student.targetClassName ||
                    // A demotion whose class could not be resolved must never
                    // fall back to the source class — that would read as "no
                    // move" for a student who is moving down.
                    (student.action === "DEMOTED" ? t("lowerClass") : student.currentClass)}
            </Badge>
            {student.insufficientData && (
              <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                <Info className="h-3 w-3" />
                {t("insufficientDataFlag")}
              </div>
            )}
          </div>
        ),
      },
      {
        key: "reason",
        header: t("evaluationReason"),
        cell: (student: RosterRow) => (
          <div className="max-w-md space-y-0.5">
            {student.reasons.map((reason, index) => (
              <p key={`${reason.code}-${index}`} className="text-xs text-muted-foreground">
                {translateReason(reason)}
              </p>
            ))}
            {student.placementSource === "profile" && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                {t("legacyPlacementFlag")}
              </p>
            )}
            {student.requiresReExam && (
              <Badge
                variant="outline"
                className="mt-1 text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
              >
                {t("reExamPermitted")}
              </Badge>
            )}
          </div>
        ),
      },
      {
        key: "actions",
        header: t("manualAction"),
        headerClassName: "text-right",
        className: "text-right",
        cell: (student: RosterRow) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("manualAction")}
                className="text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                {t("setActionFor", { name: student.studentName })}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {OVERRIDE_ACTIONS.map((action) => (
                <DropdownMenuItem
                  key={action}
                  disabled={student.action === action && !!overrides[student.studentProfileId]}
                  onClick={() => handleSetOverride(student.studentProfileId, action)}
                  className="gap-2 text-xs"
                >
                  <span className={STATUS_ICON_CLASS[action]}>{STATUS_ICON[action]}</span>
                  {statusLabel(action)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={lowerClassOptions.length === 0}
                onClick={() => handleSetOverride(student.studentProfileId, "DEMOTED")}
                className="gap-2 text-xs"
              >
                <TrendingDown className="h-3 w-3 text-muted-foreground" />
                {t("demoteAction")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!overrides[student.studentProfileId]}
                onClick={() => handleSetOverride(student.studentProfileId, null)}
                className="gap-2 text-xs"
              >
                <RotateCcw className="h-3 w-3" />
                {t("clearOverride")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, tReason, overrides]
  );

  const hasFilters = !!selectedClass && !!selectedYear;

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
          <p className="text-sm text-muted-foreground mt-1.5 ml-1">{t("description")}</p>
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
              disabled={!canExecute}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm gap-2 font-medium"
            >
              {executePromotions.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("promoting")}
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" />
                  {t("executeSelected", { count: selectedStudents.length })}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Scope: source class, source session, target session */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-xs border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              {t("selectClass")}
            </CardTitle>
            <CardDescription className="text-xs">{t("selectClassDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <AppDropdown
              value={selectedClass}
              onChange={handleClassChange}
              options={classOptions}
              placeholder={t("selectClassPlaceholder")}
              searchable
              searchPlaceholder={t("searchClassPlaceholder")}
              noOptionsText={t("noOptions")}
            />
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-primary" />
              {t("selectAcademicYear")}
            </CardTitle>
            <CardDescription className="text-xs">
              {t("selectAcademicYearDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AppDropdown
              value={selectedYear}
              onChange={handleYearChange}
              options={sourceYearOptions}
              placeholder={t("selectAcademicYearPlaceholder")}
              searchable
              searchPlaceholder={t("searchYearPlaceholder")}
              noOptionsText={t("noOptions")}
            />
          </CardContent>
        </Card>

        <Card
          className={
            hasTargetYear
              ? "shadow-xs border-border/60"
              : "shadow-xs border-amber-500/40 bg-amber-500/5"
          }
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              {t("selectTargetYear")}
            </CardTitle>
            <CardDescription className="text-xs">
              {t("selectTargetYearDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <AppDropdown
              value={selectedTargetYear}
              onChange={handleTargetYearChange}
              options={targetYearOptions}
              placeholder={t("selectTargetYearPlaceholder")}
              disabled={!hasFilters}
              searchable
              searchPlaceholder={t("searchYearPlaceholder")}
              noOptionsText={t("noTargetYearOptions")}
            />
            {calcData?.targetAcademicYear?.isSuggested && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Info className="h-3 w-3" />
                {t("targetYearSuggested")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Blocking: no target academic year exists */}
      {calcData?.requiresTargetYearSelection && (
        <Card className="border-rose-500/40 bg-rose-500/5 shadow-none">
          <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 p-5">
            <div className="p-3 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-sm font-semibold text-foreground">{t("noTargetYearTitle")}</h3>
              <p className="text-xs text-muted-foreground">{t("noTargetYearDescription")}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => router.push("/academic-year")}
            >
              <CalendarRange className="h-4 w-4" />
              {t("goToAcademicYears")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Terminal class notice */}
      {calcData?.isTerminalClass && (
        <Card className="border-indigo-500/30 bg-indigo-500/5 shadow-none">
          <CardContent className="flex items-start gap-4 p-5">
            <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
              <Award className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">{t("terminalClassTitle")}</h3>
              <p className="text-xs text-muted-foreground">
                {t("terminalClassDescription", { className: calcData.class.name })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data-quality warnings */}
      {calcData &&
        (calcData.warnings.legacyPlacement.length > 0 ||
          calcData.warnings.insufficientData.length > 0) && (
          <Card className="border-amber-500/40 bg-amber-500/5 shadow-none">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="p-3 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-sm font-semibold text-foreground">{t("warningsTitle")}</h3>
                {calcData.warnings.legacyPlacement.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("legacyPlacementWarning", {
                      count: calcData.warnings.legacyPlacement.length,
                    })}
                  </p>
                )}
                {calcData.warnings.insufficientData.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("insufficientDataWarning", {
                      count: calcData.warnings.insufficientData.length,
                    })}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Results */}
      {calcData && (
        <div className="space-y-6">
          {/* Post-run: the exits owe a document. */}
          {exitedStudents.length > 0 && (
            <Card className="border-indigo-500/30 bg-indigo-500/5 shadow-none">
              <CardHeader className="pb-3 border-b border-indigo-500/20">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                      <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      {t("exitDocumentsTitle", { count: exitedStudents.length })}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {t("exitDocumentsDescription", {
                        date: executionResult?.exitDate
                          ? formatDateWithSettings(executionResult.exitDate, settings)
                          : "",
                        remaining: pendingCertificates.length,
                      })}
                    </CardDescription>
                  </div>

                  {canIssueCertificates && pendingCertificates.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {pendingTransferred.length > 0 && (
                        <Button
                          size="sm"
                          className="gap-1.5"
                          disabled={issuingType !== null}
                          onClick={() =>
                            void handleIssueCertificates(
                              "TRANSFER",
                              pendingTransferred.map((student) => student.studentProfileId)
                            )
                          }
                        >
                          {issuingType === "TRANSFER" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <LogOut className="h-3.5 w-3.5" />
                          )}
                          {t("issueTransferCertificates", { count: pendingTransferred.length })}
                        </Button>
                      )}
                      {pendingGraduated.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={issuingType !== null}
                          onClick={() =>
                            void handleIssueCertificates(
                              "CHARACTER",
                              pendingGraduated.map((student) => student.studentProfileId)
                            )
                          }
                        >
                          {issuingType === "CHARACTER" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Award className="h-3.5 w-3.5" />
                          )}
                          {t("issueCharacterCertificates", { count: pendingGraduated.length })}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-2">
                {exitedStudents.map((student) => {
                  const certificate = issuedByStudent[student.studentProfileId];
                  const documentType =
                    student.status === "TRANSFERRED" ? "TRANSFER" : "CHARACTER";

                  return (
                    <div
                      key={student.studentProfileId}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border border-border/60 bg-background/70 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {student.studentName}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {student.studentId}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                        <ERPStatusPill
                          status={statusLabel(student.status)}
                          variant={student.status === "TRANSFERRED" ? "subtle" : "indigo"}
                        />

                        {certificate ? (
                          <>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {certificate.certificateNumber}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              disabled={printingId === certificate.id}
                              onClick={() => {
                                void printCertificate(certificate, certificate.student);
                              }}
                            >
                              {printingId === certificate.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Printer className="h-3.5 w-3.5" />
                              )}
                              {t("printCertificate")}
                            </Button>
                          </>
                        ) : canIssueCertificates ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            disabled={issuingType !== null}
                            onClick={() =>
                              void handleIssueCertificates(documentType, [student.studentProfileId])
                            }
                          >
                            <FileText className="h-3.5 w-3.5" />
                            {documentType === "TRANSFER"
                              ? t("issueTransferCertificate")
                              : t("issueCharacterCertificate")}
                          </Button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            {t("certificateNotIssued")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {!canIssueCertificates && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
                    <ShieldAlert className="h-3 w-3" />
                    {t("noCertificatePermissionHint")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Executive action banner */}
          <div className="relative overflow-hidden rounded-lg border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t("calculationComplete")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("nextClass")}:{" "}
                    <strong className="text-foreground">
                      {calcData.isTerminalClass ? t("graduatedFinalClass") : nextClassName}
                    </strong>
                  </span>
                  {hasTargetYear && (
                    <span className="text-xs text-muted-foreground">
                      {t("targetYear")}:{" "}
                      <strong className="text-foreground">{targetYearLabel}</strong>
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-foreground tracking-tight">
                  {hasTargetYear
                    ? t("readyToPromoteSelected", {
                        count: selectedStudents.length,
                        total: calcData.totalStudents,
                        year: targetYearLabel ?? "",
                      })
                    : t("noTargetYearTitle")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("executionDescription", {
                    year: targetYearLabel ?? t("graduatedFinalClass"),
                  })}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                <Button
                  size="lg"
                  onClick={handleExecutePromotions}
                  disabled={!canExecute}
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
                      {t("executeSelected", { count: selectedStudents.length })}
                      <ArrowRight className="h-4 w-4 ml-0.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Summary metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
                      ? t("passingRate", {
                          rate: Math.round(
                            (calcData.eligibleCount / calcData.totalStudents) * 100
                          ),
                        })
                      : t("passingRate", { rate: 0 })}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs border-amber-500/20 bg-amber-500/5">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    {t("conditionalPromotion")}
                  </p>
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-1">
                    {calcData.conditionalCount}
                  </div>
                  <p className="text-xs text-amber-700/70 dark:text-amber-400/70 mt-1">
                    {t("reExamRequiredLabel")}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs border-rose-500/20 bg-rose-500/5">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                    {t("retainedInGrade")}
                  </p>
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-1">
                    {calcData.retainedCount}
                  </div>
                  <p className="text-xs text-rose-700/70 dark:text-rose-400/70 mt-1">
                    {t("requiresRepetition")}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <XCircle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs border-indigo-500/20 bg-indigo-500/5">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                    {t("graduating")}
                  </p>
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 mt-1">
                    {calcData.graduatedCount}
                  </div>
                  <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70 mt-1">
                    {t("leavingRoster")}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Award className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs border-border/60">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("transferredOut")}
                  </p>
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
                    {summary?.transferred ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{t("leavingRoster")}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted text-muted-foreground">
                  <LogOut className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Criteria + roll number policy */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="shadow-xs border-border/60 lg:col-span-2">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  {t("activePromotionCriteria")}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                    <p className="text-xs font-medium text-muted-foreground">{t("minAttendance")}</p>
                    <p className="text-lg font-bold text-foreground mt-0.5">
                      {calcData.promotionRule.minimumAttendance}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("minOverallAverage")}
                    </p>
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
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("maxFailedSubjects")}
                    </p>
                    <p className="text-lg font-bold text-foreground mt-0.5">
                      {calcData.promotionRule.maxFailedSubjects}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("conditionalPromotion")}
                    </p>
                    <p className="text-lg font-bold text-foreground mt-0.5">
                      {calcData.promotionRule.allowConditionalPromotion ? t("yes") : t("no")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-xs border-border/60">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-base font-semibold">{t("rollNumberPolicy")}</CardTitle>
                <CardDescription className="text-xs">
                  {t("rollNumberPolicyDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <AppDropdown
                  value={rollNumberPolicy}
                  onChange={handleRollNumberPolicyChange}
                  options={[
                    { value: "PRESERVE", label: t("rollNumberPolicyPreserve") },
                    { value: "SEQUENTIAL", label: t("rollNumberPolicySequential") },
                  ]}
                  searchable={false}
                />
              </CardContent>
            </Card>
          </div>

          {/* Roster */}
          <RolloverPreflightPanel
            report={preflight.data}
            isChecking={preflight.isFetching}
            onRecheck={() => preflight.refetch()}
            scope="promotion"
            contextNote={
              preflight.data
                ? tPreflight("studentsScanned", {
                    count: preflight.data.studentsConsidered,
                  })
                : null
            }
          />

          <ERPDataTable<RosterRow>
            title={t("studentEligibilityBreakdown")}
            subtitle={t("eligibilityDescription")}
            data={resolvedStudents}
            columns={columns}
            keyExtractor={(student) => student.studentProfileId}
            searchPlaceholder={t("searchStudents")}
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            selectedIds={selectedIds}
            onSelectionChange={(ids) => {
              setSelectionTouched(true);
              setSelectedIds(ids);
            }}
            page={page}
            pageSize={pageSize}
            totalCount={resolvedStudents.length}
            pageSizeOptions={[10, 20, 50, 100]}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            isLoading={isLoading}
            paginationLabels={{
              rowsPerPage: t("rowsPerPage"),
              range: (start, end, total) => t("rangeOf", { start, end, total }),
              previous: t("previous"),
              next: t("next"),
            }}
            secondaryAction={
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleExportRoster}
                  disabled={!resolvedStudents.length}
                >
                  <Download className="h-4 w-4" />
                  {t("exportRoster")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setSelectionTouched(true);
                    setSelectedIds(resolvedStudents.map((s) => s.studentProfileId));
                  }}
                  disabled={!resolvedStudents.length}
                >
                  {t("selectAll")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setSelectionTouched(true);
                    setSelectedIds([]);
                  }}
                  disabled={selectedIds.length === 0}
                >
                  {t("clearSelection")}
                </Button>
              </div>
            }
            emptyState={
              <div className="flex flex-col items-center justify-center gap-1 py-4">
                <GraduationCap className="h-6 w-6 text-muted-foreground/60" />
                <span className="text-xs font-medium">{t("emptyRoster")}</span>
                <span className="text-[11px] text-muted-foreground/60">
                  {t("emptyRosterHint")}
                </span>
              </div>
            }
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground px-1">
            <span>
              {t("selectedCount", {
                selected: selectedStudents.length,
                total: calcData.totalStudents,
              })}
            </span>
            <span className="flex items-center gap-1.5">
              {isFetching && !isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              {t("summaryFooter", {
                advancing: summary?.advancing ?? 0,
                exiting: summary?.exiting ?? 0,
                reExam: summary?.requiringReExam ?? 0,
              })}
            </span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasFilters && (
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

      {isLoading && hasFilters && (
        <div className="space-y-6" aria-busy="true">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Card key={i} className="shadow-xs border-border/60">
                <CardContent className="p-5 space-y-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-36" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Demotion target picker — a demotion is incomplete without a class. */}
      <Dialog
        open={!!demotionFor}
        onOpenChange={(open) => {
          if (!open) {
            setDemotionFor(null);
            setDemotionClassId("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              {t("demotionDialogTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("demotionDialogDescription", {
                name: demotionFor?.studentName ?? "",
                className: calcData?.class.name ?? "",
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t("demotionTargetClass")}
            </label>
            <AppDropdown
              value={demotionClassId}
              onChange={setDemotionClassId}
              options={lowerClassOptions}
              placeholder={t("selectDemotionTarget")}
              searchable
              noOptionsText={t("noLowerClasses")}
            />
            <p className="text-[11px] text-muted-foreground">{t("demotionHint")}</p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDemotionFor(null);
                setDemotionClassId("");
              }}
            >
              {t("cancel")}
            </Button>
            <Button size="sm" onClick={handleConfirmDemotion} disabled={!demotionClassId}>
              <TrendingDown className="h-3.5 w-3.5" />
              {t("confirmDemotion")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
