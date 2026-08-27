"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
    mutationFn: (p: any) => fetch("/api/inventory/items", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(p) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j.data; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventoryItems"] }); toast.success("Item added"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...p }: any) => fetch(`/api/inventory/items/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(p) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j.data; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventoryItems"] }); toast.success("Item updated"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/inventory/items/${id}`, { method: "DELETE", credentials: "include" }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventoryItems"] }); toast.success("Item deleted"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
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
    mutationFn: (p: any) => fetch("/api/inventory/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(p) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.details?.[0]?.message || j.message); return j.data; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventoryItems"] }); qc.invalidateQueries({ queryKey: ["inventoryTransactions"] }); toast.success("Transaction recorded"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/inventory/transactions/${id}`, { method: "DELETE", credentials: "include" }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventoryItems"] }); qc.invalidateQueries({ queryKey: ["inventoryTransactions"] }); toast.success("Transaction deleted"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  return {
    transactions, pagination, isLoading, error: error as Error | null,
    createTransaction: (d: any) => createMutation.mutateAsync(d),
    deleteTransaction: (id: string) => deleteMutation.mutateAsync(id),
    isMutating: createMutation.isPending || deleteMutation.isPending,
  };
}
