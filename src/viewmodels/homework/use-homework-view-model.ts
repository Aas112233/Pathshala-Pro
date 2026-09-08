"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { appToast as toast } from "@/lib/notifications/toast";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-fetch";

export function useHomeworkViewModel(filters: { classId?: string; search?: string; page?: number } = {}) {
  const t = useTranslations("homework");
  const { classId, search, page = 1 } = filters;
  const qc = useQueryClient();
  const queryKey = ["homeworks", { classId: classId || "", search: search || "", page }] as const;

  const qs = new URLSearchParams({ page: String(page), limit: "20", ...(search ? { search } : {}), ...(classId ? { classId } : {}) }).toString();

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetch(`/api/homeworks?${qs}`, { credentials: "include" }).then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to fetch");
      return j;
    }),
  });

  const homeworks = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: (p: any) => apiPost("/api/homeworks", p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["homeworks"] });
      toast.success(t("createSuccess"));
    },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...p }: any) => apiPut(`/api/homeworks/${id}`, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["homeworks"] });
      toast.success(t("updateSuccess"));
    },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/homeworks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["homeworks"] });
      toast.success(t("deleteSuccess"));
    },
    onError: (e: any) => toast.error(e?.message || t("error")),
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
  const t = useTranslations("homework");
  const qc = useQueryClient();
  const queryKey = ["homeworkSubmissions", homeworkId] as const;
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => apiGet(`/api/homeworks/${homeworkId}/submissions`),
    enabled: !!homeworkId,
  });
  const submissions = (data as any)?.data ?? (Array.isArray(data) ? data : []);

  const gradeMutation = useMutation({
    mutationFn: ({ id, grade, remarks }: any) => apiPut(`/api/homework-submissions/${id}`, { grade, remarks, status: "GRADED" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["homeworkSubmissions", homeworkId] });
      toast.success(t("gradedSuccess"));
    },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });

  return { submissions, isLoading, error: error as Error | null, gradeSubmission: (id: string, d: any) => gradeMutation.mutateAsync({ id, ...d }) };
}

