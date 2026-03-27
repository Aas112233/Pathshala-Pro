import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "@/lib/api-client";
import type { PaginationParams } from "@/types/api";
import type { CreateUserPayload, UpdateUserPayload } from "@/types/users";

interface QueryHookOptions {
  enabled?: boolean;
}

// Students hooks
export function useStudents(params?: PaginationParams, options?: QueryHookOptions) {
  return useQuery({
    queryKey: ["students", params],
    queryFn: () => studentsApi.list(params),
    enabled: options?.enabled ?? true,
  });
}

export function useStudent(id: string) {
  return useQuery({
    queryKey: ["student", id],
    queryFn: () => studentsApi.get(id),
    enabled: !!id,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => studentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

export function useUpdateStudent(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => studentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student", id] });
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
export function useAcademicYears(params?: PaginationParams) {
  return useQuery({
    queryKey: ["academicYears", params],
    queryFn: () => academicYearsApi.list(params),
  });
}

export function useAcademicYear(id: string) {
  return useQuery({
    queryKey: ["academicYear", id],
    queryFn: () => academicYearsApi.get(id),
    enabled: !!id,
  });
}

export function useCreateAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => academicYearsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academicYears"] });
    },
  });
}

export function useUpdateAcademicYear(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => academicYearsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academicYears"] });
      queryClient.invalidateQueries({ queryKey: ["academicYear", id] });
    },
  });
}

export function useDeleteAcademicYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => academicYearsApi.delete(id),
    onSuccess: () => {
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

// Transactions hooks
export function useTransactions(params?: PaginationParams, options?: QueryHookOptions) {
  return useQuery({
    queryKey: ["transactions", params],
    queryFn: () => transactionsApi.list(params),
    enabled: options?.enabled ?? true,
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
export function useAttendance(params?: PaginationParams) {
  return useQuery({
    queryKey: ["attendance", params],
    queryFn: () => attendanceApi.list(params),
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

// Auth hooks
export function useLogin() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
  });
}
