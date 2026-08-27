"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useHealthViewModel(search = "", page = 1) {
  const qc = useQueryClient();
  const queryKey = ["healthRecords", { search, page }] as const;
  const qs = new URLSearchParams({ page: String(page), limit: "20", ...(search ? { search } : {}) }).toString();
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const r = await fetch(`/api/health-records?${qs}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch health records");
      return r.json();
    },
  });
  const records = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: async (p: any) => {
      const r = await fetch("/api/health-records", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(p) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to create");
      return j.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["healthRecords"] }); toast.success("Health record added"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...p }: any) => {
      const r = await fetch(`/api/health-records/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(p) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to update");
      return j.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["healthRecords"] }); toast.success("Health record updated"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/health-records/${id}`, { method: "DELETE", credentials: "include" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to delete");
      return j;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["healthRecords"] }); toast.success("Health record deleted"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  return {
    records,
    pagination,
    isLoading,
    error: error as Error | null,
    createRecord: (d: any) => createMutation.mutateAsync(d),
    updateRecord: (id: string, d: any) => updateMutation.mutateAsync({ id, ...d }),
    deleteRecord: (id: string) => deleteMutation.mutateAsync(id),
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
