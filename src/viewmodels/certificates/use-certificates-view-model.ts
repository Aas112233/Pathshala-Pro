"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export function useCertificatesViewModel(search = "", certificateType = "", status = "", page = 1) {
  const t = useTranslations("certificates");
  const qc = useQueryClient();
  const queryKey = ["certificates", { search, certificateType, status, page }] as const;
  const qs = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(search ? { search } : {}),
    ...(certificateType ? { certificateType } : {}),
    ...(status ? { status } : {}),
  }).toString();

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const r = await fetch(`/api/certificates?${qs}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch certificates");
      return r.json();
    },
  });

  const certificates = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: async (p: any) => {
      const r = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(p),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to create");
      return j.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certificates"] });
      toast.success("Certificate issued");
    },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...p }: any) => {
      const r = await fetch(`/api/certificates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(p),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to update");
      return j.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certificates"] });
      toast.success("Certificate updated");
    },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/certificates/${id}`, { method: "DELETE", credentials: "include" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to delete");
      return j.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certificates"] });
      toast.success("Certificate deleted");
    },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });

  return {
    certificates,
    pagination,
    isLoading,
    error,
    createCertificate: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateCertificate: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteCertificate: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    revokeCertificate: (id: string) => updateMutation.mutateAsync({ id, status: "REVOKED" }),
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
