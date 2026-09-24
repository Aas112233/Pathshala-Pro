"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { salaryApi } from "@/lib/api-client";
import type { SearchParams } from "@/types/api";
import type {
  SalaryLedger,
  SalaryLedgerWithDetails,
  PaymentDTO,
  UpdateSalaryLedgerDTO,
} from "@/types/entities";
import { appToast as toast } from "@/lib/notifications/toast";

export interface ApprovalMetrics {
  pendingCount: number;
  pendingAmount: number;
  approvedCount: number;
  approvedAmount: number;
  disbursedCount: number;
  disbursedAmount: number;
  rejectedCount: number;
}

export interface ApprovalFilters {
  search: string;
  month: string;
  year: string;
  status: string;
  department: string;
  academicYearId: string;
}

export function useSalaryApprovalsViewModel() {
  const t = useTranslations("salary");
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedSalary, setSelectedSalary] = useState<SalaryLedgerWithDetails | null>(null);

  const currentYear = new Date().getFullYear().toString();
  const currentMonth = (new Date().getMonth() + 1).toString();

  const [filters, setFiltersState] = useState<ApprovalFilters>({
    search: "",
    month: currentMonth,
    year: currentYear,
    status: "ALL",
    department: "",
    academicYearId: "",
  });

  const setFilters = useCallback((newFilters: Partial<ApprovalFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
    setPage(1);
  }, []);

  const queryKey = useMemo(
    () => [
      "salary-approvals",
      {
        page,
        limit: 20,
        search: filters.search || undefined,
        month: filters.month || undefined,
        year: filters.year || undefined,
        status: filters.status !== "ALL" ? filters.status : undefined,
        department: filters.department || undefined,
        academicYearId: filters.academicYearId || undefined,
      },
    ],
    [page, filters]
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      salaryApi.listApprovals({
        page,
        limit: 20,
        search: filters.search || undefined,
        month: filters.month || undefined,
        year: filters.year || undefined,
        status: filters.status !== "ALL" ? filters.status : undefined,
        department: filters.department || undefined,
        academicYearId: filters.academicYearId || undefined,
      } as SearchParams),
  });

  const salaryList = useMemo(() => {
    if (!data) return [];
    if ("data" in data && Array.isArray(data.data)) return data.data as SalaryLedger[];
    return [];
  }, [data]);

  const pagination = useMemo(() => {
    if (data && "pagination" in data) return (data as any).pagination;
    return null;
  }, [data]);

  const metrics: ApprovalMetrics = useMemo(() => {
    const defaultMetrics = {
      pendingCount: 0,
      pendingAmount: 0,
      approvedCount: 0,
      approvedAmount: 0,
      disbursedCount: 0,
      disbursedAmount: 0,
      rejectedCount: 0,
    };
    if (data && "metrics" in data) return (data as any).metrics as ApprovalMetrics;
    return defaultMetrics;
  }, [data]);

  // Mutations
  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => salaryApi.approve(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["salary"] });
      toast.success(t("approvals.approveSuccess"));
    },
    onError: (err: any) => {
      toast.error(err.message || t("error"));
      throw err;
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => salaryApi.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["salary"] });
      toast.success(t("approvals.rejectSuccess"));
    },
    onError: (err: any) => {
      toast.error(err.message || t("error"));
      throw err;
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: ({ salaryIds, notes }: { salaryIds: string[]; notes?: string }) =>
      salaryApi.bulkApprove(salaryIds, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["salary"] });
      toast.success(t("approvals.bulkApproveSuccess"));
    },
    onError: (err: any) => {
      toast.error(err.message || t("error"));
      throw err;
    },
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PaymentDTO }) => {
      const updateData: UpdateSalaryLedgerDTO = {
        id,
        paidAmount: data.paidAmount,
        status: "PAID",
        paidAt: data.paymentDate ? new Date(data.paymentDate).toISOString() : new Date().toISOString(),
      };
      return salaryApi.update(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["salary"] });
      toast.success(t("paymentSuccess"));
    },
    onError: (err: any) => {
      toast.error(err.message || t("error"));
      throw err;
    },
  });

  const approveSalary = useCallback(
    async (id: string, notes?: string) => {
      await approveMutation.mutateAsync({ id, notes });
    },
    [approveMutation]
  );

  const rejectSalary = useCallback(
    async (id: string, reason: string) => {
      await rejectMutation.mutateAsync({ id, reason });
    },
    [rejectMutation]
  );

  const bulkApprove = useCallback(
    async (salaryIds: string[], notes?: string) => {
      await bulkApproveMutation.mutateAsync({ salaryIds, notes });
    },
    [bulkApproveMutation]
  );

  const recordPayment = useCallback(
    async (id: string, data: PaymentDTO) => {
      await paymentMutation.mutateAsync({ id, data });
    },
    [paymentMutation]
  );

  return {
    salaryList,
    isLoading,
    error,
    pagination,
    metrics,
    filters,
    selectedSalary,
    setFilters,
    setPage,
    setSelectedSalary,
    refresh: refetch,
    approveSalary,
    rejectSalary,
    bulkApprove,
    recordPayment,
    isApproving: approveMutation.isPending || bulkApproveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isPaying: paymentMutation.isPending,
  };
}
