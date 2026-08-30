// @ts-nocheck
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiPost, apiPut, apiDelete } from "@/lib/api-fetch";

function qFetch(url: string) {
  return fetch(url, { credentials: "include" }).then(async (r) => {
    const j = await r.json();
    if (!r.ok) throw new Error(j.message || "Failed");
    return j;
  });
}

export function useInventoryItemsViewModel(search = "", category = "", page = 1) {
  const qc = useQueryClient();
  const queryKey = ["inventoryItems", { search, category, page }] as const;
  const qs = new URLSearchParams({ page: String(page), limit: "20", ...(search ? { search } : {}), ...(category ? { category } : {}) }).toString();
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: () => qFetch(`/api/inventory/items?${qs}`) });
  const items = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: (p: any) => apiPost("/api/inventory/items", p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventoryItems"] }); toast.success(t("itemCreated")); },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...p }: any) => apiPut(`/api/inventory/items/${id}`, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventoryItems"] }); toast.success(t("itemUpdated")); },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/inventory/items/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventoryItems"] }); toast.success(t("itemDeleted")); },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });

  return {
    items, pagination, isLoading, error: error as Error | null,
    createItem: (d: any) => createMutation.mutateAsync(d),
    updateItem: (id: string, d: any) => updateMutation.mutateAsync({ id, ...d }),
    deleteItem: (id: string) => deleteMutation.mutateAsync(id),
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}

export function useInventoryTransactionsViewModel(search = "", page = 1) {
  const qc = useQueryClient();
  const queryKey = ["inventoryTransactions", { search, page }] as const;
  const qs = new URLSearchParams({ page: String(page), limit: "20", ...(search ? { search } : {}) }).toString();
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: () => qFetch(`/api/inventory/transactions?${qs}`) });
  const transactions = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: (p: any) => apiPost("/api/inventory/transactions", p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventoryItems"] }); qc.invalidateQueries({ queryKey: ["inventoryTransactions"] }); toast.success("Transaction recorded"); },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/inventory/transactions/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventoryItems"] }); qc.invalidateQueries({ queryKey: ["inventoryTransactions"] }); toast.success("Transaction deleted"); },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });

  return {
    transactions, pagination, isLoading, error: error as Error | null,
    createTransaction: (d: any) => createMutation.mutateAsync(d),
    deleteTransaction: (id: string) => deleteMutation.mutateAsync(id),
    isMutating: createMutation.isPending || deleteMutation.isPending,
  };
}

