"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function qFetch(url: string) {
  return fetch(url, { credentials: "include" }).then(async (r) => {
    const j = await r.json();
    if (!r.ok) throw new Error(j.message || "Failed");
    return j;
  });
}

export function useHostelsViewModel(search = "", page = 1) {
  const qc = useQueryClient();
  const queryKey = ["hostels", { search, page }] as const;
  const qs = new URLSearchParams({ page: String(page), limit: "20", ...(search ? { search } : {}) }).toString();
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: () => qFetch(`/api/hostels?${qs}`) });
  const hostels = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: (p: any) => fetch("/api/hostels", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(p) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j.data; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostels"] }); toast.success("Hostel added"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...p }: any) => fetch(`/api/hostels/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(p) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j.data; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostels"] }); toast.success("Hostel updated"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/hostels/${id}`, { method: "DELETE", credentials: "include" }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostels"] }); toast.success("Hostel deleted"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
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
  const qc = useQueryClient();
  const queryKey = ["hostelRooms", { hostelId, search, page }] as const;
  const qs = new URLSearchParams({ page: String(page), limit: "20", ...(search ? { search } : {}), ...(hostelId ? { hostelId } : {}) }).toString();
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: () => qFetch(`/api/hostel-rooms?${qs}`) });
  const rooms = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: (p: any) => fetch("/api/hostel-rooms", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(p) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.details?.[0]?.message || j.message); return j.data; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostelRooms"] }); toast.success("Room added"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...p }: any) => fetch(`/api/hostel-rooms/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(p) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j.data; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostelRooms"] }); toast.success("Room updated"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/hostel-rooms/${id}`, { method: "DELETE", credentials: "include" }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostelRooms"] }); toast.success("Room deleted"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
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
  const qc = useQueryClient();
  const queryKey = ["hostelAllocations", { search, hostelId, page }] as const;
  const qs = new URLSearchParams({ page: String(page), limit: "20", ...(search ? { search } : {}), ...(hostelId ? { hostelId } : {}) }).toString();
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: () => qFetch(`/api/hostel-allocations?${qs}`) });
  const allocations = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: (p: any) => fetch("/api/hostel-allocations", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(p) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.details?.[0]?.message || j.message); return j.data; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostelRooms"] }); qc.invalidateQueries({ queryKey: ["hostelAllocations"] }); toast.success("Student allocated"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/hostel-allocations/${id}`, { method: "DELETE", credentials: "include" }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hostelRooms"] }); qc.invalidateQueries({ queryKey: ["hostelAllocations"] }); toast.success("Allocation vacated"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  return {
    allocations, pagination, isLoading, error: error as Error | null,
    createAllocation: (d: any) => createMutation.mutateAsync(d),
    deleteAllocation: (id: string) => deleteMutation.mutateAsync(id),
    isMutating: createMutation.isPending || deleteMutation.isPending,
  };
}
