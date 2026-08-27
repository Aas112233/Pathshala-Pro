"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useLeavesViewModel(filters: { search?: string; status?: string; applicantType?: string; page?: number } = {}) {
  const { search, status, applicantType, page = 1 } = filters;
  const qc = useQueryClient();
  const queryKey = ["leaves", { search: search || "", status: status || "", applicantType: applicantType || "", page }] as const;

  const buildQuery = () => {
    const p = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) p.set("search", search);
    if (status) p.set("status", status);
    if (applicantType) p.set("applicantType", applicantType);
    return p.toString();
  };

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const r = await fetch(`/api/leaves?${buildQuery()}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch leaves");
      return r.json();
    },
  });

  const leaves = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch("/api/leaves", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to create");
      return j.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leaves"] }); toast.success("Leave request submitted"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: any) => {
      const r = await fetch(`/api/leaves/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to update");
      return j.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leaves"] }); toast.success("Leave updated"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/leaves/${id}`, { method: "DELETE", credentials: "include" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to delete");
      return j;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leaves"] }); toast.success("Leave deleted"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  return {
    leaves,
    pagination,
    isLoading,
    error: error as Error | null,
    createLeave: (d: any) => createMutation.mutateAsync(d),
    updateLeave: (id: string, d: any) => updateMutation.mutateAsync({ id, ...d }),
    deleteLeave: (id: string) => deleteMutation.mutateAsync(id),
    approveLeave: (id: string) => updateMutation.mutateAsync({ id, status: "APPROVED" }),
    rejectLeave: (id: string) => updateMutation.mutateAsync({ id, status: "REJECTED" }),
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
