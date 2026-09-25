import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api-client";
import type { ExecutePromotionsInput } from "@/lib/schemas";
import { toast } from "sonner";

export interface Subject {
  id: string;
  tenantId: string;
  subjectId: string;
  name: string;
  code: string;
  category: "COMPULSORY" | "ELECTIVE" | "OPTIONAL";
  maxMarks: number;
  passMarks: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Exam {
  id: string;
  tenantId: string;
  examId: string;
  academicYearId: string;
  name: string;
  type: "MID_TERM" | "FINAL" | "UNIT_TEST" | "ANNUAL";
  startDate: string;
  endDate: string;
  isPublished: boolean;
  totalMarks: number;
  passPercentage: number;
  academicYear?: {
    yearId: string;
    label: string;
  };
  subjects?: Array<{
    id?: string;
    examId?: string;
    subjectId: string;
    maxMarks: number;
    passMarks: number;
    subject?: {
      subjectId: string;
      name: string;
      code: string;
    };
  }>;
  /** Eligible classes derived server-side via ClassSubject intersection. */
  classIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export type ExamListResponse = Exam[];

export interface ExamResult {
  id: string;
  tenantId: string;
  studentProfileId: string;
  academicYearId: string;
  examId: string;
  subjectId: string;
  maxMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade: string;
  gradePoint: number;
  status: "PASS" | "FAIL" | "ABSENT";
  reExamAllowed: boolean;
  studentProfile?: {
    studentId: string;
    firstName: string;
    lastName: string;
    rollNumber: string;
  };
  exam?: {
    examId: string;
    name: string;
    type: string;
  };
  subject?: {
    subjectId: string;
    name: string;
    code: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PromotionRule {
  id: string;
  tenantId: string;
  academicYearId: string;
  classId: string;
  minimumAttendance: number;
  minimumOverallPercentage: number;
  minimumPerSubject: number;
  maxFailedSubjects: number;
  allowConditionalPromotion: boolean;
  autoPromote: boolean;
  nextClassId?: string | null;
  nextClassName?: string | null;
  isActive: boolean;
  academicYear?: {
    yearId: string;
    label: string;
  };
  class?: {
    classId: string;
    name: string;
    classNumber: number;
  };
  nextClass?: {
    id: string;
    classId: string;
    name: string;
    classNumber: number;
  } | null;
}

export type PromotionAction =
  | "PROMOTED"
  | "RETAINED"
  | "CONDITIONAL_PROMOTED"
  | "GRADUATED"
  | "DEMOTED"
  | "TRANSFERRED";

export type PromotionReasonCode =
  | "MEETS_CRITERIA"
  | "FAILED_SUBJECTS"
  | "LOW_OVERALL"
  | "LOW_ATTENDANCE"
  | "NO_EXAM_RESULTS"
  | "CONDITIONAL_ELIGIBLE"
  | "GRADUATED_FINAL_CLASS"
  | "RETAINED_FINAL_CLASS"
  | "MANUAL_OVERRIDE"
  | "TRANSFERRED_OUT";

/**
 * A structured reason returned by the promotion engine. `code` + `params` are
 * meant for translation; `message` is an English fallback.
 */
export interface PromotionReason {
  code: PromotionReasonCode;
  params: Record<string, string | number>;
  message: string;
}

export interface PromotionMetrics {
  overallPercentage: number;
  totalSubjects: number;
  failedSubjectsCount: number;
  failedSubjects: string[];
  attendanceRate: number;
  attendanceTracked: boolean;
  attendancePresentDays: number;
  attendanceTotalDays: number;
  minimumAttendance: number;
  minimumOverallPercentage: number;
  minimumPerSubject: number;
  maxFailedSubjects: number;
}

export interface PromotionSubjectDetail {
  subjectId: string;
  subjectName: string;
  percentage: number;
  status: string;
  grade: string;
  isFailed: boolean;
}

export interface PromotionDecisionView {
  id: string;
  studentProfileId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  currentClass: string;
  currentClassId: string;
  fromClassId: string;
  fromClassName: string;

  action: PromotionAction;
  eligible: boolean;
  advances: boolean;
  repeats: boolean;
  exits: boolean;
  requiresReExam: boolean;
  insufficientData: boolean;
  isTerminalClass: boolean;

  targetClassId: string;
  targetClassName: string | null;
  suggestedNextClassId: string | null;
  suggestedNextClassName: string | null;

  reasons: PromotionReason[];
  metrics: PromotionMetrics;
  subjectDetails: PromotionSubjectDetail[];
  placementSource: "session" | "profile";
}

export interface PromotionSummary {
  total: number;
  promoted: number;
  conditionalPromoted: number;
  retained: number;
  graduated: number;
  demoted: number;
  transferred: number;
  advancing: number;
  exiting: number;
  requiringReExam: number;
  insufficientData: number;
}

export interface PromotionAcademicYearOption {
  id: string;
  yearId: string;
  label: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  isSource: boolean;
  isValidTarget: boolean;
}

export interface PromotionCalculationResult {
  class: { id: string; classId: string; name: string; classNumber: number };
  academicYear: {
    id: string;
    yearId: string;
    label: string;
    startDate: string;
    isClosed: boolean;
  };
  targetAcademicYear: {
    id: string;
    yearId: string;
    label: string;
    startDate: string;
    isClosed: boolean;
    isSuggested: boolean;
  } | null;
  targetAcademicYearOptions: PromotionAcademicYearOption[];
  /** No later academic year exists; the operator must create or pick one. */
  requiresTargetYearSelection: boolean;

  nextClass: { id: string; classId: string; name: string; classNumber: number } | null;
  isTerminalClass: boolean;

  promotionRule: {
    id: string;
    minimumAttendance: number;
    minimumOverallPercentage: number;
    minimumPerSubject: number;
    maxFailedSubjects: number;
    allowConditionalPromotion: boolean;
    autoPromote: boolean;
    nextClassId: string | null;
    nextClassName: string | null;
  };

  summary: PromotionSummary;
  totalStudents: number;
  eligibleCount: number;
  retainedCount: number;
  conditionalCount: number;
  graduatedCount: number;

  warnings: {
    legacyPlacement: Array<{
      studentProfileId: string;
      studentName: string;
      message: string;
    }>;
    insufficientData: Array<{
      studentProfileId: string;
      studentName: string;
      message: string;
    }>;
  };

  students: PromotionDecisionView[];
}

export interface ExecutePromotionsResult {
  fromAcademicYear: { id: string; label: string };
  toAcademicYear: { id: string; label: string };
  fromClass: { id: string; name: string; classNumber: number };
  rollNumberPolicy: "PRESERVE" | "SEQUENTIAL";
  decidedAt: string;
  exitDate: string;
  summary: PromotionSummary;
  warnings: {
    legacyPlacement: Array<{ studentProfileId: string; studentName: string; message: string }>;
    insufficientData: Array<{ studentProfileId: string; studentName: string; message: string }>;
    provisionalRollNumbers: number;
    targetEnrollmentsCreated: number;
  };
  promotions: ClassPromotion[];
}

export interface ClassPromotion {
  id: string;
  tenantId: string;
  studentProfileId: string;
  fromAcademicYearId: string;
  toAcademicYearId: string;
  fromClassId: string;
  toClassId: string;
  status: PromotionAction;
  reason?: string;
  reExamRequired: boolean;
  decidedBy: string;
  decidedAt: string;
  studentProfile?: {
    studentId: string;
    firstName: string;
    lastName: string;
    rollNumber: string;
  };
  fromClass?: {
    classId: string;
    name: string;
  };
  toClass?: {
    classId: string;
    name: string;
  };
}

/**
 * One pre-flight finding.
 *
 * `code` + `params` are the translatable pair; `message` is the server's
 * English fallback and is only used if a code has no translation. `subject`
 * identifies what the finding is about so the UI can deep-link to the row.
 */
export interface PreflightFinding {
  code: string;
  severity: "blocker" | "warning";
  subject: { kind: "year" | "class" | "student"; id: string; label: string };
  params: Record<string, string | number>;
  message: string;
}

export interface PreflightReport {
  canProceed: boolean;
  blockers: PreflightFinding[];
  warnings: PreflightFinding[];
  counts: { blockers: number; warnings: number };
  countsByCode: Partial<Record<string, number>>;
  truncatedCodes: string[];
}

export interface PromotionPreflightResult extends PreflightReport {
  scope: "promotion";
  fromAcademicYear: { id: string; label: string; isClosed: boolean };
  toAcademicYear: { id: string; label: string; isClosed: boolean };
  class: { id: string; name: string; classNumber: number };
  studentsConsidered: number;
}

export interface YearClosePreflightResult extends PreflightReport {
  scope: "yearClose";
  year: { id: string; label: string; startDate: string; isClosed: boolean };
  scan: { students: number; truncated: boolean };
}

// Subject hooks
export function useSubjects(params?: { isActive?: boolean }) {
  return useQuery({
    queryKey: ["subjects", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.isActive !== undefined) {
        searchParams.set("isActive", params.isActive.toString());
      }
      const response = await api.get<Subject[]>(`/api/subjects?${searchParams}`);
      return response.data;
    },
  });
}

export function useCreateSubject() {
  const t = useTranslations("exams");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Subject>) => {
      const response = await api.post<Subject>("/api/subjects", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success(t("subjectCreated"));
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create subject");
    },
  });
}

export function useUpdateSubject() {
  const t = useTranslations("exams");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Subject> }) => {
      const response = await api.put<Subject>(`/api/subjects/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success(t("subjectUpdated"));
    },
    onError: (error: any) => {
      const description = error?.details?.[0]?.message;
      toast.error(error?.message || "Failed to update subject", {
        description: description !== error?.message ? description : undefined,
      });
    },
  });
}

export function useDeleteSubject() {
  const t = useTranslations("exams");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/subjects/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success(t("subjectDeleted"));
    },
    onError: (error: any) => {
      const description = error?.details?.[0]?.message;
      toast.error(error?.message || "Failed to delete subject", {
        description: description !== error?.message ? description : undefined,
      });
    },
  });
}

// Exam hooks
export function useExams(params?: { academicYearId?: string; type?: string }) {
  return useQuery({
    queryKey: ["exams", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.academicYearId) searchParams.set("academicYearId", params.academicYearId);
      if (params?.type) searchParams.set("type", params.type);
      const response = await api.get<Exam[]>(`/api/exams?${searchParams}`);
      return response.data as Exam[];
    },
  });
}

export function useExam(id: string) {
  return useQuery({
    queryKey: ["exam", id],
    queryFn: async () => {
      const response = await api.get<Exam>(`/api/exams/${id}`);
      return response.data as Exam;
    },
    enabled: !!id,
  });
}

export function useCreateExam() {
  const t = useTranslations("exams");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Exam>) => {
      const response = await api.post<Exam>("/api/exams", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      toast.success(t("examCreated"));
    },
    onError: (error: any) => {
      const description = error?.details?.[0]?.message;
      toast.error(error?.message || "Failed to create exam", {
        description: description !== error?.message ? description : undefined,
      });
    },
  });
}

export function useUpdateExam() {
  const t = useTranslations("exams");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Exam> }) => {
      const response = await api.put<Exam>(`/api/exams/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success(t("examUpdated"));
    },
    onError: (error: any) => {
      const description = error?.details?.[0]?.message;
      toast.error(error?.message || "Failed to update exam", {
        description: description !== error?.message ? description : undefined,
      });
    },
  });
}

export function useDeleteExam() {
  const t = useTranslations("exams");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/exams/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success(t("examDeleted"));
    },
    onError: (error: any) => {
      const description = error?.details?.[0]?.message;
      toast.error(error?.message || "Failed to delete exam", {
        description: description !== error?.message ? description : undefined,
      });
    },
  });
}

// Exam Result hooks
export function useExamResults(params?: { examId?: string; studentProfileId?: string; academicYearId?: string }) {
  return useQuery({
    queryKey: ["exam-results", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.examId) searchParams.set("examId", params.examId);
      if (params?.studentProfileId) searchParams.set("studentProfileId", params.studentProfileId);
      if (params?.academicYearId) searchParams.set("academicYearId", params.academicYearId);
      const response = await api.get<ExamResult[]>(`/api/exam-results?${searchParams}`);
      return response.data;
    },
  });
}

// Promotion Rule hooks
export function usePromotionRules(params?: { academicYearId?: string; classId?: string }) {
  return useQuery({
    queryKey: ["promotion-rules", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.academicYearId) searchParams.set("academicYearId", params.academicYearId);
      if (params?.classId) searchParams.set("classId", params.classId);
      const response = await api.get<PromotionRule[]>(`/api/promotion-rules?${searchParams}`);
      return response.data;
    },
  });
}

export function useCreatePromotionRule() {
  const t = useTranslations("exams");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<PromotionRule>) => {
      const response = await api.post<PromotionRule>("/api/promotion-rules", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotion-rules"] });
      toast.success(t("promotionRuleCreated"));
    },
    onError: (error: any) => {
      const description = error?.details?.[0]?.message;
      toast.error(error?.message || "Failed to create promotion rule", {
        description: description !== error?.message ? description : undefined,
      });
    },
  });
}

export function useUpdatePromotionRule() {
  const t = useTranslations("exams");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PromotionRule> }) => {
      const response = await api.put<PromotionRule>(`/api/promotion-rules/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotion-rules"] });
      toast.success(t("promotionRuleUpdated"));
    },
    onError: (error: any) => {
      const description = error?.details?.[0]?.message;
      toast.error(error?.message || "Failed to update promotion rule", {
        description: description !== error?.message ? description : undefined,
      });
    },
  });
}

export function useDeletePromotionRule() {
  const t = useTranslations("exams");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api/promotion-rules/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotion-rules"] });
      toast.success(t("promotionRuleDeleted"));
    },
    onError: (error: any) => {
      const description = error?.details?.[0]?.message;
      toast.error(error?.message || "Failed to delete promotion rule", {
        description: description !== error?.message ? description : undefined,
      });
    },
  });
}

// Promotion Calculation hooks
export function usePromotionCalculation(
  classId?: string,
  academicYearId?: string,
  toAcademicYearId?: string
) {
  return useQuery({
    queryKey: ["promotion-calculation", classId, academicYearId, toAcademicYearId ?? null],
    queryFn: async () => {
      if (!classId || !academicYearId) return null;
      const searchParams = new URLSearchParams({ classId, academicYearId });
      if (toAcademicYearId) searchParams.set("toAcademicYearId", toAcademicYearId);
      const response = await api.get<PromotionCalculationResult>(
        `/api/promotions/calculate?${searchParams}`
      );
      // This endpoint always returns a single object, never a paginated list.
      return response.data as PromotionCalculationResult;
    },
    enabled: !!classId && !!academicYearId,
  });
}

/**
 * Read-only readiness report for one promotion run.
 *
 * The server runs the same pure checks here that POST /api/promotions/execute
 * enforces, so a cohort that reads as ready here cannot be refused there for a
 * reason the operator could not see. A blocked report is still a successful
 * response (`canProceed: false`), not an error.
 */
export function usePromotionPreflight(
  classId?: string,
  academicYearId?: string,
  toAcademicYearId?: string,
  studentProfileIds?: string[]
) {
  // Sorted so that selecting the same students in a different order does not
  // produce a second cache entry.
  const selection = studentProfileIds?.length
    ? [...studentProfileIds].sort().join(",")
    : "";

  return useQuery({
    queryKey: [
      "promotion-preflight",
      classId,
      academicYearId,
      toAcademicYearId ?? null,
      selection,
    ],
    queryFn: async () => {
      if (!classId || !academicYearId || !toAcademicYearId) return null;
      const searchParams = new URLSearchParams({
        classId,
        academicYearId,
        toAcademicYearId,
      });
      // Only sent for an explicit selection: omitting it means the whole class,
      // while sending it empty would mean "nothing selected".
      if (selection) searchParams.set("studentProfileIds", selection);
      const response = await api.get<PromotionPreflightResult>(
        `/api/promotions/preflight?${searchParams}`
      );
      return response.data as PromotionPreflightResult;
    },
    enabled: !!classId && !!academicYearId && !!toAcademicYearId,
  });
}

/**
 * Readiness report for closing one academic year. Whole-year by nature, so it
 * is not paginated — `scan.truncated` says whether the report is partial.
 */
export function useYearClosePreflight(academicYearId?: string) {
  return useQuery({
    queryKey: ["academic-year-preflight", academicYearId ?? null],
    queryFn: async () => {
      if (!academicYearId) return null;
      const response = await api.get<YearClosePreflightResult>(
        `/api/academic-years/${academicYearId}/preflight`
      );
      return response.data as YearClosePreflightResult;
    },
    enabled: !!academicYearId,
  });
}

export function useExecutePromotions() {
  const t = useTranslations("exams");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ExecutePromotionsInput) => {
      const response = await api.post<ExecutePromotionsResult>("/api/promotions/execute", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotion-calculation"] });
      // The report describes a cohort that has just changed, so it is stale.
      queryClient.invalidateQueries({ queryKey: ["promotion-preflight"] });
      queryClient.invalidateQueries({ queryKey: ["promotion-history"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      toast.success(t("promotionsExecuted"));
    },
    onError: (error: any) => {
      const description = error?.details?.[0]?.message;
      toast.error(error?.message || "Failed to execute promotions", {
        description: description !== error?.message ? description : undefined,
      });
    },
  });
}

export function usePromotionHistory(params?: { studentProfileId?: string; academicYearId?: string }) {
  return useQuery({
    queryKey: ["promotion-history", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.studentProfileId) searchParams.set("studentProfileId", params.studentProfileId);
      if (params?.academicYearId) searchParams.set("academicYearId", params.academicYearId);
      const response = await api.get<ClassPromotion[]>(`/api/promotions/execute?${searchParams}`);
      return response.data;
    },
  });
}
