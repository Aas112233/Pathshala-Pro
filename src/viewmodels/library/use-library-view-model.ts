"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useBooksViewModel(search = "", category = "", page = 1) {
  const qc = useQueryClient();
  const queryKey = ["books", { search, category, page }] as const;

  const buildQuery = () => {
    const p = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) p.set("search", search);
    if (category) p.set("category", category);
    return p.toString();
  };

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const r = await fetch(`/api/library/books?${buildQuery()}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch books");
      return r.json();
    },
  });

  const books = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch("/api/library/books", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to create");
      return j.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["books"] }); toast.success("Book added"); },
    onError: (e: any) => toast.error(e.message || "Failed to add book"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: any) => {
      const r = await fetch(`/api/library/books/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to update");
      return j.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["books"] }); toast.success("Book updated"); },
    onError: (e: any) => toast.error(e.message || "Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/library/books/${id}`, { method: "DELETE", credentials: "include" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to delete");
      return j;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["books"] }); toast.success("Book deleted"); },
    onError: (e: any) => toast.error(e.message || "Failed to delete"),
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
  const buildQuery = () => {
    const p = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) p.set("search", search);
    if (status) p.set("status", status);
    return p.toString();
  };

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const r = await fetch(`/api/library/issues?${buildQuery()}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch issues");
      return r.json();
    },
  });

  const issues = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const issueMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch("/api/library/issues", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.details?.[0]?.message || j.message || "Failed to issue");
      return j.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["books"] }); qc.invalidateQueries({ queryKey: ["bookIssues"] }); toast.success("Book issued"); },
    onError: (e: any) => toast.error(e.message || "Failed to issue"),
  });

  const returnMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/library/issues/${id}/return`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({}) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to return");
      return j.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["books"] }); qc.invalidateQueries({ queryKey: ["bookIssues"] }); toast.success("Book returned"); },
    onError: (e: any) => toast.error(e.message || "Failed to return"),
  });

  return {
    issues, pagination, isLoading, error: error as Error | null,
    issueBook: (d: any) => issueMutation.mutateAsync(d),
    returnBook: (id: string) => returnMutation.mutateAsync(id),
    isMutating: issueMutation.isPending || returnMutation.isPending,
  };
}
