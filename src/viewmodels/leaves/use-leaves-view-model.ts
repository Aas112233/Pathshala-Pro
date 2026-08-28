"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost, apiPut, apiDelete } from "@/lib/api-fetch";

export function useLeavesViewModel(filters: { search?: string; status?: string; applicantType?: string; page?: number } = {}) {
  const { search, status, applicantType, page = 1 } = filters;
  const qc = useQueryClient();
  const queryKey = ["leaves", { search: search || "", status: status || "", applicantType: applicantType || "", page }] as const;

  const qs = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(applicantType ? { applicantType } : {}),
  }).toString();

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetch(`/api/leaves?${qs}`, { credentials: "include" }).then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to fetch leaves");
      return j;
    }),
  });

  const leaves = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: (p: any) => apiPost("/api/leaves", p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leaves"] }); toast.success("Leave request submitted"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...p }: any) => apiPut(`/api/leaves/${id}`, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leaves"] }); toast.success("Leave updated"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/leaves/${id}`),
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
