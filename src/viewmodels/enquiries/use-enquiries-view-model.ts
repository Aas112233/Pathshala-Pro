"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export interface EnquiryFilters {
  search: string;
  status: string;
  source: string;
  classAppliedId: string;
}

export function useEnquiriesViewModel() {
  const t = useTranslations("enquiries");
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFiltersState] = useState<EnquiryFilters>({
    search: "",
    status: "",
    source: "",
    classAppliedId: "",
  });
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");

  const setFilters = useCallback((p: Partial<EnquiryFilters>) => {
    setFiltersState((s) => ({ ...s, ...p }));
    setPage(1);
  }, []);

  const queryKey = useMemo(
    () => ["enquiries", { page, limit: 20, ...filters }],
    [page, filters]
  );

  const buildQuery = () => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.source) params.set("source", filters.source);
    if (filters.classAppliedId) params.set("classAppliedId", filters.classAppliedId);
    return params.toString();
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/enquiries?${buildQuery()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch enquiries");
      return res.json();
    },
  });

  const enquiries = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Failed to create");
      return j.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enquiries"] });
      toast.success(t("createSuccess"));
    },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: any) => {
      const res = await fetch(`/api/enquiries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Failed to update");
      return j.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enquiries"] });
      toast.success(t("updateSuccess"));
    },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/enquiries/${id}`, { method: "DELETE", credentials: "include" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Failed to delete");
      return j;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enquiries"] });
      toast.success(t("deleteSuccess"));
    },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });

  const convertMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/enquiries/${id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || "Failed to convert");
      return j.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enquiries"] });
      toast.success(t("convertedSuccess"));
    },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });

  return {
    enquiries,
    pagination,
    isLoading,
    error: error as Error | null,
    filters,
    setFilters,
    page,
    setPage,
    viewMode,
    setViewMode,
    refresh: refetch,
    createEnquiry: (d: any) => createMutation.mutateAsync(d),
    updateEnquiry: (id: string, d: any) => updateMutation.mutateAsync({ id, ...d }),
    deleteEnquiry: (id: string) => deleteMutation.mutateAsync(id),
    convertEnquiry: (id: string) => convertMutation.mutateAsync(id),
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || convertMutation.isPending,
  };
}

