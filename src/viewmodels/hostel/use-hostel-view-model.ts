"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { apiPost, apiPut, apiDelete } from "@/lib/api-fetch";

function qFetch(url: string) {
  return fetch(url, { credentials: "include" }).then(async (r) => {
    const j = await r.json();
    if (!r.ok) throw new Error(j.message || "Failed");
    return j;
  });
}

export function useHostelsViewModel(search = "", page = 1) {
  const t = useTranslations("hostel");
  const tCommon = useTranslations("common");
  const qc = useQueryClient();
  const queryKey = ["hostels", { search, page }] as const;
  const qs = new URLSearchParams({ page: String(page), limit: "20", ...(search ? { search } : {}) }).toString();
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: () => qFetch(`/api/hostels?${qs}`) });
  const hostels = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: (p: any) => apiPost("/api/hostels", p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostels"] }); toast.success(t("hostelCreated")); },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...p }: any) => apiPut(`/api/hostels/${id}`, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostels"] }); toast.success(t("hostelUpdated")); },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/hostels/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostels"] }); toast.success(t("hostelDeleted")); },
    onError: (e: any) => toast.error(e.message || t("error")),
  });

  return {
    hostels, pagination, isLoading, error: error as Error | null,
    createHostel: (d: any) => createMutation.mutateAsync(d),
    updateHostel: (id: string, d: any) => updateMutation.mutateAsync({ id, ...d }),
    deleteHostel: (id: string) => deleteMutation.mutateAsync(id),
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}

export function useHostelRoomsViewModel(hostelId = "", search = "", page = 1) {
  const t = useTranslations("hostel");
  const tCommon = useTranslations("common");
  const qc = useQueryClient();
  const queryKey = ["hostelRooms", { hostelId, search, page }] as const;
  const qs = new URLSearchParams({ page: String(page), limit: "20", ...(search ? { search } : {}), ...(hostelId ? { hostelId } : {}) }).toString();
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: () => qFetch(`/api/hostel-rooms?${qs}`) });
  const rooms = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: (p: any) => apiPost("/api/hostel-rooms", p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostelRooms"] }); toast.success(t("roomCreated")); },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...p }: any) => apiPut(`/api/hostel-rooms/${id}`, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostelRooms"] }); toast.success(t("roomUpdated")); },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/hostel-rooms/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostelRooms"] }); toast.success(t("roomDeleted")); },
    onError: (e: any) => toast.error(e.message || t("error")),
  });

  return {
    rooms, pagination, isLoading, error: error as Error | null,
    createRoom: (d: any) => createMutation.mutateAsync(d),
    updateRoom: (id: string, d: any) => updateMutation.mutateAsync({ id, ...d }),
    deleteRoom: (id: string) => deleteMutation.mutateAsync(id),
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}

export function useHostelAllocationsViewModel(search = "", hostelId = "", page = 1) {
  const t = useTranslations("hostel");
  const tCommon = useTranslations("common");
  const qc = useQueryClient();
  const queryKey = ["hostelAllocations", { search, hostelId, page }] as const;
  const qs = new URLSearchParams({ page: String(page), limit: "20", ...(search ? { search } : {}) }).toString();
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: () => qFetch(`/api/hostel-allocations?${qs}`) });
  const allocations = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: (p: any) => apiPost("/api/hostel-allocations", p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostelRooms"] }); qc.invalidateQueries({ queryKey: ["hostelAllocations"] }); toast.success(t("allocatedSuccess")); },
    onError: (e: any) => toast.error(e?.message || t("error")),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/hostel-allocations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostelRooms"] }); qc.invalidateQueries({ queryKey: ["hostelAllocations"] }); toast.success(t("vacatedSuccess")); },
    onError: (e: any) => toast.error(e.message || t("error")),
  });

  return {
    allocations, pagination, isLoading, error: error as Error | null,
    createAllocation: (d: any) => createMutation.mutateAsync(d),
    deleteAllocation: (id: string) => deleteMutation.mutateAsync(id),
    isMutating: createMutation.isPending || deleteMutation.isPending,
  };
}
