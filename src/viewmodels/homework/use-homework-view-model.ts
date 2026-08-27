"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useHomeworkViewModel(filters: { classId?: string; search?: string; page?: number } = {}) {
  const { classId, search, page = 1 } = filters;
  const qc = useQueryClient();
  const queryKey = ["homeworks", { classId: classId || "", search: search || "", page }] as const;

  const buildQuery = () => {
    const p = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) p.set("search", search);
    if (classId) p.set("classId", classId);
    return p.toString();
  };

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const r = await fetch(`/api/homeworks?${buildQuery()}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch");
      return r.json();
    },
  });

  const homeworks = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch("/api/homeworks", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to create");
      return j.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["homeworks"] }); toast.success("Homework created"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: any) => {
      const r = await fetch(`/api/homeworks/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to update");
      return j.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["homeworks"] }); toast.success("Homework updated"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/homeworks/${id}`, { method: "DELETE", credentials: "include" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to delete");
      return j;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["homeworks"] }); toast.success("Homework deleted"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  return {
    homeworks,
    pagination,
    isLoading,
    error: error as Error | null,
    createHomework: (d: any) => createMutation.mutateAsync(d),
    updateHomework: (id: string, d: any) => updateMutation.mutateAsync({ id, ...d }),
    deleteHomework: (id: string) => deleteMutation.mutateAsync(id),
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}

export function useSubmissionsViewModel(homeworkId: string) {
  const qc = useQueryClient();
  const queryKey = ["homeworkSubmissions", homeworkId] as const;
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const r = await fetch(`/api/homeworks/${homeworkId}/submissions`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch submissions");
      return r.json();
    },
    enabled: !!homeworkId,
  });
  const submissions = (data as any)?.data ?? [];

  const gradeMutation = useMutation({
    mutationFn: async ({ id, grade, remarks }: any) => {
      const r = await fetch(`/api/homework-submissions/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ grade, remarks, status: "GRADED" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to grade");
      return j.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["homeworkSubmissions", homeworkId] }); toast.success("Graded"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  return { submissions, isLoading, error: error as Error | null, gradeSubmission: (id: string, d: any) => gradeMutation.mutateAsync({ id, ...d }) };
}
