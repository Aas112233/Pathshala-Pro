import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
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
}

export interface PromotionEligibility {
  studentId: string;
  studentName: string;
  rollNumber: string;
  currentClass: string;
  eligible: boolean;
  action: "PROMOTED" | "RETAINED" | "CONDITIONAL_PROMOTED";
  reasons: string[];
  metrics: {
    overallPercentage: string;
    totalSubjects: number;
    failedSubjectsCount: number;
    failedSubjects: string[];
  };
  subjectDetails: Array<{
    subjectName: string;
    percentage: number;
    status: string;
    grade: string;
  }>;
  suggestedNextClassId?: string | null;
  reExamAllowed: boolean;
}

export interface ClassPromotion {
  id: string;
  tenantId: string;
  studentProfileId: string;
  fromAcademicYearId: string;
  toAcademicYearId: string;
  fromClassId: string;
  toClassId: string;
  status: "PROMOTED" | "RETAINED" | "CONDITIONAL_PROMOTED";
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Subject>) => {
      const response = await api.post<Subject>("/api/subjects", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success("Subject created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create subject");
    },
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Subject> }) => {
      const response = await api.put<Subject>(`/api/subjects/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success("Subject updated successfully");
    },
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/subjects/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success("Subject deleted successfully");
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Exam>) => {
      const response = await api.post<Exam>("/api/exams", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      toast.success("Exam created successfully");
    },
  });
}

export function useUpdateExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Exam> }) => {
      const response = await api.put<Exam>(`/api/exams/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exam updated successfully");
    },
  });
}

export function useDeleteExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/exams/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exam deleted successfully");
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

export function useCreateExamResults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<ExamResult> | Partial<ExamResult>[]) => {
      const response = await api.post<ExamResult[]>("/api/exam-results", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam-results"] });
      toast.success("Exam results saved successfully");
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<PromotionRule>) => {
      const response = await api.post<PromotionRule>("/api/promotion-rules", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotion-rules"] });
      toast.success("Promotion rule created successfully");
    },
  });
}

// Promotion Calculation hooks
export function usePromotionCalculation(classId?: string, academicYearId?: string) {
  return useQuery({
    queryKey: ["promotion-calculation", classId, academicYearId],
    queryFn: async () => {
      if (!classId || !academicYearId) return null;
      const searchParams = new URLSearchParams({ classId, academicYearId });
      const response = await api.get<{
        class: { classId: string; name: string; classNumber: number };
        academicYearId: string;
        promotionRule: PromotionRule;
        totalStudents: number;
        eligibleCount: number;
        retainedCount: number;
        conditionalCount: number;
        students: PromotionEligibility[];
      }>(`/api/promotions/calculate?${searchParams}`);
      return response.data;
    },
    enabled: !!classId && !!academicYearId,
  });
}

export function useExecutePromotions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<ClassPromotion> | Partial<ClassPromotion>[]) => {
      const response = await api.post<ClassPromotion[]>("/api/promotions/execute", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promotion-calculation"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("Promotions executed successfully");
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
