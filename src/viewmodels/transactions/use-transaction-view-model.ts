"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { transactionsApi } from "@/lib/api-client";
import type { PaginationParams } from "@/types/api";
import { appToast as toast } from "@/lib/notifications/toast";

export type PaymentMethodFilter = "ALL" | "CASH" | "DIGITAL" | "BANK_TRANSFER" | "CARD" | "CHEQUE" | "EASYPAISA" | "JAZZCASH";

export interface TransactionFilters {
  search: string;
  paymentMethod: PaymentMethodFilter;
  fromDate: string;
  toDate: string;
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useTransactionViewModel() {
  const t = useTranslations("transactions");
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(20);
  const [filters, setFiltersState] = useState<TransactionFilters>({
    search: "",
    paymentMethod: "ALL",
    fromDate: "",
    toDate: "",
  });

  const debouncedSearch = useDebounced(filters.search, 300);

  const setFilters = useCallback((next: Partial<TransactionFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState({ search: "", paymentMethod: "ALL", fromDate: "", toDate: "" });
    setPage(1);
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  const queryKey = useMemo(
    () => [
      "transactions",
      {
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        paymentMethod: filters.paymentMethod !== "ALL" ? filters.paymentMethod : undefined,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
      },
    ],
    [page, pageSize, debouncedSearch, filters.paymentMethod, filters.fromDate, filters.toDate]
  );

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey,
    queryFn: () => {
      const params: any = {
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
      };
      if (filters.paymentMethod !== "ALL") params.filters = { paymentMethod: filters.paymentMethod };
      if (filters.fromDate) params.startDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;
      // API expects top-level paymentMethod and startDate/endDate, not nested filters for this route
      // Normalize for /api/transactions which reads ?paymentMethod= & ?startDate= & ?endDate=
      const apiParams: any = {
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        paymentMethod: filters.paymentMethod !== "ALL" ? filters.paymentMethod : undefined,
        startDate: filters.fromDate || undefined,
        endDate: filters.toDate || undefined,
      };
      return transactionsApi.list(apiParams as PaginationParams);
    },
    placeholderData: (prev) => prev,
  });

  const transactions = useMemo(() => (data && "data" in data ? (data as any).data : []), [data]);
  const pagination = useMemo(() => (data && "pagination" in data ? (data as any).pagination : null), [data]);

  // KPI derived from current page — for true totals, backend should expose /api/transactions/summary (ponytail: client KPI as interim)
  const kpis = useMemo(() => {
    const totalAmount = transactions.reduce((sum: number, r: any) => sum + (r.amountPaid || 0), 0);
    const cash = transactions.filter((r: any) => r.paymentMethod === "CASH").reduce((s: number, r: any) => s + r.amountPaid, 0);
    const digital = totalAmount - cash;
    return { totalAmount, cash, digital, count: pagination?.totalCount ?? transactions.length };
  }, [transactions, pagination]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => transactionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(t("deleteSuccess"));
    },
    onError: (err: any) => {
      toast.error(err?.message || t("deleteError"));
      throw err;
    },
  });

  const deleteTransaction = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation]
  );

  const clearMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: "CLEARED" | "BOUNCED"; chequeNumber?: string; reason?: string } }) =>
      transactionsApi.clearCheque(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(t("chequeClearedMsg"));
    },
    onError: (err: any) => {
      toast.error(err?.message || t("clearFailed"));
      throw err;
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data?: { reference?: string; reason?: string } }) =>
      transactionsApi.verify(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(t("receiptVerified"));
    },
    onError: (err: any) => {
      toast.error(err?.message || t("verifyFailed"));
      throw err;
    },
  });

  return {
    transactions,
    isLoading,
    isFetching,
    error: error as Error | null,
    pagination,
    filters,
    page,
    pageSize,
    kpis,
    setFilters,
    resetFilters,
    setPage,
    setPageSize,
    refresh: refetch,
    deleteTransaction,
    isDeleting: deleteMutation.isPending,
    clearCheque: clearMutation.mutateAsync,
    isClearing: clearMutation.isPending,
    verifyReceipt: verifyMutation.mutateAsync,
    isVerifying: verifyMutation.isPending,
  };
}
