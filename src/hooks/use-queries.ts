import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  studentsApi,
  usersApi,
  academicYearsApi,
  feesApi,
  transactionsApi,
  staffApi,
  salaryApi,
  attendanceApi,
  examsApi,
  authApi,
  expensesApi,
  expenseCategoriesApi,
  bankAccountsApi,
  feeHeadsApi,
  chartAccountsApi,
  profitLossApi,
  depositsApi,
  feeFineApi,
} from "@/lib/api-client";
import type { PaginationParams, SearchParams } from "@/types/api";
import type { CreateUserPayload, UpdateUserPayload } from "@/types/users";
import type { CreateStudentDTO, UpdateStudentDTO } from "@/viewmodels/students/use-student-view-model";

interface QueryHookOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

// Notices hook — shared key so the banner, header bell, login dialog and
// dashboard feed dedupe to one cached request instead of 4 raw fetches.
export function useNotices(
  params?: { activeOnly?: boolean; priority?: string; limit?: number },
  options?: QueryHookOptions
) {
  const keyParams = {
    ...(params?.activeOnly ? { activeOnly: true as const } : {}),
    ...(params?.priority ? { priority: params.priority } : {}),
    ...(params?.limit ? { limit: params.limit } : {}),
  };
  const qs = new URLSearchParams();
  if (params?.activeOnly) qs.set("activeOnly", "true");
  if (params?.priority) qs.set("priority", params.priority);
  if (params?.limit) qs.set("limit", String(params.limit));
  const queryString = qs.toString();
  return useQuery({
    queryKey: ["notices", keyParams],
    queryFn: async () => {
      const res = await fetch(`/api/notices${queryString ? `?${queryString}` : ""}`, {
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Failed to load notices");
      }
      return (json.data ?? []) as any[];
    },
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
    placeholderData: keepPreviousData,
  });
}

// ──────────────── Academic Structure Hooks (Standardized Hierarchical Keys) ────
export function useClasses(
  params?: { limit?: number; isActive?: boolean; page?: number; search?: string },
  options?: QueryHookOptions
) {
  const keyParams = {
    ...(params?.limit ? { limit: params.limit } : {}),
    ...(params?.isActive !== undefined ? { isActive: params.isActive } : {}),
    ...(params?.page ? { page: params.page } : {}),
    ...(params?.search ? { search: params.search } : {}),
  };
  return useQuery({
    queryKey: ["classes", keyParams],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.isActive !== undefined) qs.set("isActive", String(params.isActive));
      if (params?.page) qs.set("page", String(params.page));
      if (params?.search) qs.set("search", params.search);
      const res = await fetch(`/api/classes${qs.toString() ? `?${qs.toString()}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data?.items || json.data || []) as any[];
    },
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

export function useSections(
  params?: { classId?: string; groupId?: string; limit?: number; page?: number; search?: string },
  options?: QueryHookOptions
) {
  const keyParams = {
    ...(params?.classId ? { classId: params.classId } : {}),
    ...(params?.groupId ? { groupId: params.groupId } : {}),
    ...(params?.limit ? { limit: params.limit } : {}),
    ...(params?.page ? { page: params.page } : {}),
    ...(params?.search ? { search: params.search } : {}),
  };
  return useQuery({
    queryKey: ["sections", keyParams],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.classId) qs.set("classId", params.classId);
      if (params?.groupId) qs.set("groupId", params.groupId);
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.page) qs.set("page", String(params.page));
      if (params?.search) qs.set("search", params.search);
      const res = await fetch(`/api/sections${qs.toString() ? `?${qs.toString()}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data?.items || json.data || []) as any[];
    },
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

export function useGroups(
  params?: { classId?: string; limit?: number; page?: number; search?: string },
  options?: QueryHookOptions
) {
  const keyParams = {
    ...(params?.classId ? { classId: params.classId } : {}),
    ...(params?.limit ? { limit: params.limit } : {}),
    ...(params?.page ? { page: params.page } : {}),
    ...(params?.search ? { search: params.search } : {}),
  };
  return useQuery({
    queryKey: ["groups", keyParams],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.classId) qs.set("classId", params.classId);
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.page) qs.set("page", String(params.page));
      if (params?.search) qs.set("search", params.search);
      const res = await fetch(`/api/groups${qs.toString() ? `?${qs.toString()}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data?.items || json.data || []) as any[];
    },
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

export function useSubjects(
  params?: { classId?: string; limit?: number; page?: number; search?: string },
  options?: QueryHookOptions
) {
  const keyParams = {
    ...(params?.classId ? { classId: params.classId } : {}),
    ...(params?.limit ? { limit: params.limit } : {}),
    ...(params?.page ? { page: params.page } : {}),
    ...(params?.search ? { search: params.search } : {}),
  };
  return useQuery({
    queryKey: ["subjects", keyParams],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.classId) qs.set("classId", params.classId);
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.page) qs.set("page", String(params.page));
      if (params?.search) qs.set("search", params.search);
      const res = await fetch(`/api/subjects${qs.toString() ? `?${qs.toString()}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data?.items || json.data || []) as any[];
    },
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

// Students hooks
export function useStudents(
  params?: SearchParams & {
    classId?: string;
    sectionId?: string;
    groupId?: string;
    status?: string;
  },
  options?: QueryHookOptions
) {
  return useQuery({
    queryKey: ["students", params],
    queryFn: () => studentsApi.list(params),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

export function useStudent(id: string) {
  return useQuery({
    queryKey: ["students", id],
    queryFn: () => studentsApi.get(id),
    enabled: !!id,
  });
}

export function useStudentPerformance(id: string, academicYearId?: string) {
  return useQuery({
    queryKey: ["students", "performance", id, academicYearId],
    queryFn: () => studentsApi.getPerformance(id, academicYearId),
    enabled: !!id,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStudentDTO) => studentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

export function useUpdateStudent(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateStudentDTO) => studentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["students", id] });
    },
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => studentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

// Users hooks
export function useUsers(params?: PaginationParams, options?: QueryHookOptions) {
  return useQuery({
    queryKey: ["users", params],
    queryFn: () => usersApi.list(params),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ["user", id],
    queryFn: () => usersApi.get(id),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserPayload) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useUpdateUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateUserPayload) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user", id] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

// Academic Years hooks
export function useAcademicYears(params?: PaginationParams, options?: QueryHookOptions) {
  return useQuery({
    queryKey: ["academic-years", params],
    queryFn: () => academicYearsApi.list(params),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

export function useAcademicYear(id: string) {
  return useQuery({
    queryKey: ["academic-years", id],
    queryFn: () => academicYearsApi.get(id),
    enabled: !!id,
  });
}

export function useCreateAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => academicYearsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      queryClient.invalidateQueries({ queryKey: ["academicYears"] });
    },
  });
}

export function useUpdateAcademicYear(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => academicYearsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      queryClient.invalidateQueries({ queryKey: ["academicYears"] });
    },
  });
}

export function useDeleteAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => academicYearsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      queryClient.invalidateQueries({ queryKey: ["academicYears"] });
    },
  });
}

/**
 * Close (archive) one academic year.
 *
 * Takes the id as a mutation variable rather than closing over it, because the
 * row action that triggers it is not the row currently being edited — reusing
 * `useUpdateAcademicYear(editingId)` here would fire against whatever year the
 * edit sheet last held.
 */
export function useCloseAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => academicYearsApi.update(id, { isClosed: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      queryClient.invalidateQueries({ queryKey: ["academicYears"] });
    },
  });
}

/**
 * Make one year the year the institute is operating in.
 *
 * Takes the id as a mutation variable rather than closing over it, because the
 * row action that triggers it is not the row currently being edited — reusing
 * `useUpdateAcademicYear(editingId)` here would fire against whatever year the
 * edit sheet last held.
 */
export function useSetCurrentAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => academicYearsApi.update(id, { isCurrent: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      queryClient.invalidateQueries({ queryKey: ["academicYears"] });
    },
  });
}

// Fees hooks
export function useFees(params?: PaginationParams, options?: QueryHookOptions) {
  return useQuery({
    queryKey: ["fees", params],
    queryFn: () => feesApi.list(params),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

export function useFee(id: string) {
  return useQuery({
    queryKey: ["fee", id],
    queryFn: () => feesApi.get(id),
    enabled: !!id,
  });
}

export function useCreateFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => feesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fees"] });
    },
  });
}

export function useUpdateFee(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => feesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      queryClient.invalidateQueries({ queryKey: ["fee", id] });
    },
  });
}

export function useDeleteFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => feesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fees"] });
    },
  });
}

export function useWaiveFine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ voucherId, data }: { voucherId: string; data?: { amount?: number; reason?: string } }) =>
      feeFineApi.waive(voucherId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
    },
  });
}

// Transactions hooks
export function useTransactions(params?: PaginationParams, options?: QueryHookOptions) {
  return useQuery({
    queryKey: ["transactions", params],
    queryFn: () => transactionsApi.list(params),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: ["transaction", id],
    queryFn: () => transactionsApi.get(id),
    enabled: !!id,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => transactionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["fees"] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transactionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["fees"] });
    },
  });
}

// Staff hooks
export function useStaff(params?: PaginationParams, options?: QueryHookOptions) {
  return useQuery({
    queryKey: ["staff", params],
    queryFn: () => staffApi.list(params),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

export function useStaffMember(id: string) {
  return useQuery({
    queryKey: ["staffMember", id],
    queryFn: () => staffApi.get(id),
    enabled: !!id,
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => staffApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
  });
}

export function useUpdateStaff(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => staffApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["staffMember", id] });
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => staffApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
  });
}

// Salary hooks
export function useSalary(params?: PaginationParams) {
  return useQuery({
    queryKey: ["salary", params],
    queryFn: () => salaryApi.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useSalaryLedger(id: string) {
  return useQuery({
    queryKey: ["salaryLedger", id],
    queryFn: () => salaryApi.get(id),
    enabled: !!id,
  });
}

export function useCreateSalary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => salaryApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary"] });
    },
  });
}

export function useUpdateSalary(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => salaryApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary"] });
      queryClient.invalidateQueries({ queryKey: ["salaryLedger", id] });
    },
  });
}

export function useDeleteSalary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => salaryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary"] });
    },
  });
}

// Attendance hooks
export function useAttendance(params?: PaginationParams, options?: QueryHookOptions) {
  return useQuery({
    queryKey: ["attendance", params],
    queryFn: () => attendanceApi.list(params),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useAttendanceRecord(id: string) {
  return useQuery({
    queryKey: ["attendanceRecord", id],
    queryFn: () => attendanceApi.get(id),
    enabled: !!id,
  });
}

export function useCreateAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => attendanceApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

export function useUpdateAttendance(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => attendanceApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendanceRecord", id] });
    },
  });
}

export function useDeleteAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => attendanceApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

// Exams hooks
export function useExams(params?: PaginationParams) {
  return useQuery({
    queryKey: ["exams", params],
    queryFn: () => examsApi.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useExamResult(id: string) {
  return useQuery({
    queryKey: ["examResult", id],
    queryFn: () => examsApi.get(id),
    enabled: !!id,
  });
}

export function useCreateExamResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => examsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
    },
  });
}

export function useUpdateExamResult(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => examsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      queryClient.invalidateQueries({ queryKey: ["examResult", id] });
    },
  });
}

export function useDeleteExamResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => examsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
    },
  });
}

// Dashboard summary hook — one aggregate request for the KPI cards,
// replacing the fees-limit-100 + attendance-limit-100 client-side sums.
export function useDashboardSummary(params?: { academicYearId?: string }, options?: QueryHookOptions) {
  return useQuery({
    queryKey: ["dashboard", "summary", params?.academicYearId],
    queryFn: async () => {
      const url = params?.academicYearId
        ? `/api/dashboard/summary?academicYearId=${encodeURIComponent(params.academicYearId)}`
        : "/api/dashboard/summary";
      const res = await fetch(url, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Failed to load dashboard summary");
      }
      return json.data as {
        totalStudents: number;
        totalStaff: number;
        fees: { totalCount: number; totalDue: number; amountPaid: number; balance: number };
        attendance: {
          present: number;
          absent: number;
          total: number;
          /** `null` on a closed day or an unmarked register. */
          rate: number | null;
          isHoliday: boolean;
        };
      };
    },
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

// Auth hooks
export function useLogin() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
  });
}

// Expenses hooks
export function useExpenses(params?: PaginationParams, options?: QueryHookOptions) {
  return useQuery({
    queryKey: ["expenses", params],
    queryFn: () => expensesApi.list(params),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => expensesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["profitLoss"] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["profitLoss"] });
    },
  });
}

// Expense Categories hooks
export function useExpenseCategories() {
  return useQuery({
    queryKey: ["expenseCategories"],
    queryFn: () => expenseCategoriesApi.list(),
  });
}

export function useCreateExpenseCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => expenseCategoriesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenseCategories"] });
    },
  });
}

// Bank Accounts hooks
export function useBankAccounts() {
  return useQuery({
    queryKey: ["bankAccounts"],
    queryFn: () => bankAccountsApi.list(),
  });
}

export function useCreateBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => bankAccountsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
    },
  });
}

// Deposits hooks (cash -> bank CONTRA journals)
export function useDeposits(params?: PaginationParams, options?: QueryHookOptions) {
  return useQuery({
    queryKey: ["deposits", params],
    queryFn: () => depositsApi.list(params),
    ...options,
  });
}

export function useCreateDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { toCode: string; fromCode?: string; amount: number; note?: string; bankReference?: string; receiptRefs?: string }) =>
      depositsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deposits"] });
      queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
    },
  });
}

export function useDepositSummary(params?: { cashCode?: string }, options?: QueryHookOptions) {
  return useQuery({
    queryKey: ["deposits", "summary", params],
    queryFn: () => depositsApi.summary(params),
    ...options,
  });
}

// Chart of accounts hook (base-noun key per AGENTS #7)
export function useChartAccounts(params?: { accountType?: string }, options?: QueryHookOptions) {
  return useQuery({
    queryKey: ["chartAccounts", params],
    queryFn: () => chartAccountsApi.list(params),
    ...options,
  });
}

// Fee Head Accounting hooks
export function useFeeHeadMappings() {
  return useQuery({
    queryKey: ["feeHeadMappings"],
    queryFn: () => feeHeadsApi.list(),
  });
}

export function useSaveFeeHeadMappings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { mappings: Array<{ code: string; accountCode: string }> }) => feeHeadsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feeHeadMappings"] });
    },
  });
}

// Profit & Loss hooks
export function useProfitLoss(year?: number) {
  return useQuery({
    queryKey: ["profitLoss", year],
    queryFn: () => profitLossApi.get(year),
  });
}

