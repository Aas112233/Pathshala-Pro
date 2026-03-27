"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { salaryApi } from "@/lib/api-client";
import type { SearchParams } from "@/types/api";
import type { 
  SalaryLedger, 
  SalaryLedgerWithDetails, 
  CreateSalaryLedgerDTO, 
  UpdateSalaryLedgerDTO,
  BulkPayrollDTO,
  PaymentDTO,
} from "@/types/entities";
import { toast } from "sonner";

export type SalaryViewMode = "table" | "grid";
export type SalaryStatusFilter = "ALL" | "PENDING" | "PARTIAL" | "PAID";

export interface SalaryFilters {
  search: string;
  month: string;
  year: string;
  status: SalaryStatusFilter;
  department: string;
}

export interface SalaryViewModel {
  // State
  salary: SalaryLedger[];
  isLoading: boolean;
  error: Error | null;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  } | null;

  // Filters & View
  filters: SalaryFilters;
  viewMode: SalaryViewMode;
  selectedSalary: SalaryLedgerWithDetails | null;

  // Actions
  setFilters: (filters: Partial<SalaryFilters>) => void;
  setViewMode: (mode: SalaryViewMode) => void;
  setPage: (page: number) => void;
  setSelectedSalary: (salary: SalaryLedgerWithDetails | null) => void;
  refresh: () => void;

  // CRUD Operations
  createSalary: (data: CreateSalaryLedgerDTO) => Promise<void>;
  updateSalary: (id: string, data: Partial<CreateSalaryLedgerDTO>) => Promise<void>;
  deleteSalary: (id: string) => Promise<void>;
  recordPayment: (id: string, data: PaymentDTO) => Promise<void>;
  processBulkPayroll: (data: BulkPayrollDTO) => Promise<void>;
}

export function useSalaryViewModel(): SalaryViewModel {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<SalaryViewMode>("table");
  const [selectedSalary, setSelectedSalary] = useState<SalaryLedgerWithDetails | null>(null);
  const [filters, setFiltersState] = useState<SalaryFilters>({
    search: "",
    month: "",
    year: "",
    status: "ALL",
    department: "",
  });

  const setFilters = useCallback((newFilters: Partial<SalaryFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
    setPage(1); // Reset to first page when filters change
  }, []);

  const queryKey = useMemo(
    () => [
      "salary",
      {
        page,
        limit: 20,
        search: filters.search || undefined,
        ...(filters.month && { month: filters.month }),
        ...(filters.year && { year: filters.year }),
        ...(filters.status !== "ALL" && { status: filters.status }),
        ...(filters.department && { filters: { department: filters.department } }),
      },
    ],
    [page, filters.search, filters.month, filters.year, filters.status, filters.department]
  );

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () =>
      salaryApi.list({
        page,
        limit: 20,
        search: filters.search || undefined,
        ...(filters.month && { month: filters.month }),
        ...(filters.year && { year: filters.year }),
        ...(filters.status !== "ALL" && { status: filters.status }),
        ...(filters.department && { filters: { department: filters.department } }),
      } as SearchParams),
  });

  const salary = useMemo(
    () => (data && "data" in data ? data.data : []),
    [data]
  );

  const pagination = useMemo(
    () => (data && "pagination" in data ? data.pagination : null),
    [data]
  );

  const createMutation = useMutation({
    mutationFn: (data: CreateSalaryLedgerDTO) => salaryApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary"] });
      toast.success("Salary ledger created successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create salary ledger.");
      throw err;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<CreateSalaryLedgerDTO>) =>
      salaryApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary"] });
      queryClient.invalidateQueries({ queryKey: queryKey });
      toast.success("Salary ledger updated successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update salary ledger.");
      throw err;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => salaryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary"] });
      queryClient.invalidateQueries({ queryKey: queryKey });
      toast.success("Salary ledger deleted successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete salary ledger.");
      throw err;
    },
  });

  // Payment mutation - updates the salary ledger with payment info
  const paymentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PaymentDTO }) => {
      const updateData: UpdateSalaryLedgerDTO = {
        id,
        paidAmount: data.paidAmount,
        status: data.paidAmount >= (salary.find(s => s.id === id)?.netPayable || 0) ? "PAID" : "PARTIAL",
        paidAt: data.paymentDate ? new Date(data.paymentDate).toISOString() : new Date().toISOString(),
      };
      return salaryApi.update(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary"] });
      queryClient.invalidateQueries({ queryKey: queryKey });
      toast.success("Payment recorded successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to record payment.");
      throw err;
    },
  });

  // Bulk payroll mutation
  const bulkPayrollMutation = useMutation({
    mutationFn: async (data: BulkPayrollDTO) => {
      return salaryApi.bulk(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary"] });
      toast.success("Bulk payroll processed successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to process bulk payroll.");
      throw err;
    },
  });

  const createSalary = useCallback(
    async (data: CreateSalaryLedgerDTO) => {
      await createMutation.mutateAsync(data);
    },
    [createMutation]
  );

  const updateSalary = useCallback(
    async (id: string, data: Partial<CreateSalaryLedgerDTO>) => {
      await updateMutation.mutateAsync({ id, ...data });
    },
    [updateMutation]
  );

  const deleteSalary = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation]
  );

  const recordPayment = useCallback(
    async (id: string, data: PaymentDTO) => {
      await paymentMutation.mutateAsync({ id, data });
    },
    [paymentMutation]
  );

  const processBulkPayroll = useCallback(
    async (data: BulkPayrollDTO) => {
      await bulkPayrollMutation.mutateAsync(data);
    },
    [bulkPayrollMutation]
  );

  return {
    // State
    salary,
    isLoading,
    error,
    pagination,

    // Filters & View
    filters,
    viewMode,
    selectedSalary,

    // Actions
    setFilters,
    setViewMode,
    setPage,
    setSelectedSalary,
    refresh: refetch,

    // CRUD Operations
    createSalary,
    updateSalary,
    deleteSalary,
    recordPayment,
    processBulkPayroll,
  };
}
