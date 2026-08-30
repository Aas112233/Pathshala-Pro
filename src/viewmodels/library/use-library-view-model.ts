// @ts-nocheck
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiPost, apiPut, apiDelete } from "@/lib/api-fetch";

export function useBooksViewModel(search = "", category = "", page = 1) {
  const qc = useQueryClient();
  const queryKey = ["books", { search, category, page }] as const;

  const qs = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(search ? { search } : {}),
    ...(category ? { category } : {}),
  }).toString();

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetch(`/api/library/books?${qs}`, { credentials: "include" }).then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to fetch books");
      return j;
    }),
  });

  const books = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: (p: any) => apiPost("/api/library/books", p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["books"] }); toast.success(t("bookCreated")); },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...p }: any) => apiPut(`/api/library/books/${id}`, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["books"] }); toast.success(t("bookUpdated")); },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/library/books/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["books"] }); toast.success(t("bookDeleted")); },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });

  return {
    books, pagination, isLoading, error: error as Error | null,
    createBook: (d: any) => createMutation.mutateAsync(d),
    updateBook: (id: string, d: any) => updateMutation.mutateAsync({ id, ...d }),
    deleteBook: (id: string) => deleteMutation.mutateAsync(id),
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}

export function useBookIssuesViewModel(search = "", status = "", page = 1) {
  const qc = useQueryClient();
  const queryKey = ["bookIssues", { search, status, page }] as const;
  const qs = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
  }).toString();

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetch(`/api/library/issues?${qs}`, { credentials: "include" }).then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to fetch issues");
      return j;
    }),
  });

  const issues = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const issueMutation = useMutation({
    mutationFn: (p: any) => apiPost("/api/library/issues", p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["books"] }); qc.invalidateQueries({ queryKey: ["bookIssues"] }); toast.success(t("bookIssued")); },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });

  const returnMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/api/library/issues/${id}/return`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["books"] }); qc.invalidateQueries({ queryKey: ["bookIssues"] }); toast.success(t("bookReturned")); },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });

  return {
    issues, pagination, isLoading, error: error as Error | null,
    issueBook: (d: any) => issueMutation.mutateAsync(d),
    returnBook: (id: string) => returnMutation.mutateAsync(id),
    isMutating: issueMutation.isPending || returnMutation.isPending,
  };
}

