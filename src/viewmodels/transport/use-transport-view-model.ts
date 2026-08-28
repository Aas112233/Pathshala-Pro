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

export function useVehiclesViewModel(search = "", page = 1) {
  const qc = useQueryClient();
  const queryKey = ["transportVehicles", { search, page }] as const;
  const qs = new URLSearchParams({ page: String(page), limit: "20", ...(search ? { search } : {}) }).toString();
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: () => qFetch(`/api/transport/vehicles?${qs}`) });
  const vehicles = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: (payload: any) => fetch("/api/transport/vehicles", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j.data; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transportVehicles"] }); toast.success("Vehicle added"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...p }: any) => fetch(`/api/transport/vehicles/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(p) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j.data; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transportVehicles"] }); toast.success("Vehicle updated"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/transport/vehicles/${id}`, { method: "DELETE", credentials: "include" }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transportVehicles"] }); toast.success("Vehicle deleted"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  return {
    vehicles, pagination, isLoading, error: error as Error | null,
    createVehicle: (d: any) => createMutation.mutateAsync(d),
    updateVehicle: (id: string, d: any) => updateMutation.mutateAsync({ id, ...d }),
    deleteVehicle: (id: string) => deleteMutation.mutateAsync(id),
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}

export function useRoutesViewModel(search = "", page = 1) {
  const qc = useQueryClient();
  const queryKey = ["transportRoutes", { search, page }] as const;
  const qs = new URLSearchParams({ page: String(page), limit: "20", ...(search ? { search } : {}) }).toString();
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: () => qFetch(`/api/transport/routes?${qs}`) });
  const routes = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: (p: any) => fetch("/api/transport/routes", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(p) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.details?.[0]?.message || j.message); return j.data; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transportRoutes"] }); toast.success("Route added"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...p }: any) => fetch(`/api/transport/routes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(p) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j.data; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transportRoutes"] }); toast.success("Route updated"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/transport/routes/${id}`, { method: "DELETE", credentials: "include" }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transportRoutes"] }); toast.success("Route deleted"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  return {
    routes, pagination, isLoading, error: error as Error | null,
    createRoute: (d: any) => createMutation.mutateAsync(d),
    updateRoute: (id: string, d: any) => updateMutation.mutateAsync({ id, ...d }),
    deleteRoute: (id: string) => deleteMutation.mutateAsync(id),
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}

export function useAllocationsViewModel(search = "", routeId = "", page = 1) {
  const qc = useQueryClient();
  const queryKey = ["transportAllocations", { search, routeId, page }] as const;
  const qs = new URLSearchParams({ page: String(page), limit: "20", ...(search ? { search } : {}), ...(routeId ? { routeId } : {}) }).toString();
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: () => qFetch(`/api/transport/allocations?${qs}`) });
  const allocations = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? null;

  const createMutation = useMutation({
    mutationFn: (p: any) => fetch("/api/transport/allocations", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(p) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.details?.[0]?.message || j.message); return j.data; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transportAllocations"] }); toast.success("Student allocated"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/transport/allocations/${id}`, { method: "DELETE", credentials: "include" }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transportAllocations"] }); toast.success("Allocation removed"); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  return {
    allocations, pagination, isLoading, error: error as Error | null,
    createAllocation: (d: any) => createMutation.mutateAsync(d),
    deleteAllocation: (id: string) => deleteMutation.mutateAsync(id),
    isMutating: createMutation.isPending || deleteMutation.isPending,
  };
}
