"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { appToast as toast } from "@/lib/notifications/toast";
import type { PaginationMeta } from "@/types/api";

export interface TransportVehicle {
  id: string;
  tenantId?: string;
  vehicleNo: string;
  type?: string;
  capacity: number;
  driverName?: string | null;
  driverPhone?: string | null;
  isActive?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  _count?: {
    allocations: number;
  };
}

export interface TransportRoute {
  id: string;
  tenantId?: string;
  name: string;
  stops: string[];
  vehicleId?: string | null;
  vehicle?: TransportVehicle | null;
  monthlyFee: number;
  isActive?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  _count?: {
    allocations: number;
  };
}

export interface TransportAllocation {
  id: string;
  tenantId?: string;
  studentProfileId: string;
  studentProfile?: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
  } | null;
  routeId: string;
  route?: TransportRoute | null;
  stopName: string;
  monthlyFee: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export type TransportPagination = PaginationMeta;

export interface TransportApiResponse<T> {
  data: T;
  pagination?: TransportPagination | null;
  message?: string;
  details?: Array<{ field?: string; code?: string; message: string }>;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return fallback;
}

async function qFetch<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "include" });
  const j = await r.json();
  if (!r.ok) throw new Error(j.message || "Failed");
  return j as T;
}

export function useVehiclesViewModel(search = "", page = 1) {
  const t = useTranslations("transport");
  const qc = useQueryClient();
  const queryKey = ["transportVehicles", { search, page }] as const;
  const qs = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(search ? { search } : {}),
  }).toString();
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => qFetch<TransportApiResponse<TransportVehicle[]>>(`/api/transport/vehicles?${qs}`),
  });
  const vehicles: TransportVehicle[] = data?.data ?? [];
  const pagination: PaginationMeta | undefined = data?.pagination ?? undefined;

  const createMutation = useMutation({
    mutationFn: (payload: Partial<TransportVehicle>) =>
      fetch("/api/transport/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.message);
        return j.data as TransportVehicle;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transportVehicles"] });
      toast.success(t("vehicleCreated"));
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e, t("error"))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...p }: Partial<TransportVehicle> & { id: string }) =>
      fetch(`/api/transport/vehicles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(p),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.message);
        return j.data as TransportVehicle;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transportVehicles"] });
      toast.success(t("vehicleUpdated"));
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e, t("error"))),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/transport/vehicles/${id}`, { method: "DELETE", credentials: "include" }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.message);
        return j;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transportVehicles"] });
      toast.success(t("vehicleDeleted"));
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e, t("error"))),
  });

  return {
    vehicles,
    pagination,
    isLoading,
    error: error as Error | null,
    createVehicle: (d: Partial<TransportVehicle>) => createMutation.mutateAsync(d),
    updateVehicle: (id: string, d: Partial<TransportVehicle>) => updateMutation.mutateAsync({ id, ...d }),
    deleteVehicle: (id: string) => deleteMutation.mutateAsync(id),
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}

export function useRoutesViewModel(search = "", page = 1) {
  const t = useTranslations("transport");
  const qc = useQueryClient();
  const queryKey = ["transportRoutes", { search, page }] as const;
  const qs = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(search ? { search } : {}),
  }).toString();
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => qFetch<TransportApiResponse<TransportRoute[]>>(`/api/transport/routes?${qs}`),
  });
  const routes: TransportRoute[] = data?.data ?? [];
  const pagination: PaginationMeta | undefined = data?.pagination ?? undefined;

  const createMutation = useMutation({
    mutationFn: (p: Partial<TransportRoute>) =>
      fetch("/api/transport/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(p),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.details?.[0]?.message || j.message);
        return j.data as TransportRoute;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transportRoutes"] });
      toast.success(t("routeCreated"));
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e, t("error"))),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...p }: Partial<TransportRoute> & { id: string }) =>
      fetch(`/api/transport/routes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(p),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.message);
        return j.data as TransportRoute;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transportRoutes"] });
      toast.success(t("routeUpdated"));
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e, t("error"))),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/transport/routes/${id}`, { method: "DELETE", credentials: "include" }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.message);
        return j;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transportRoutes"] });
      toast.success(t("routeDeleted"));
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e, t("error"))),
  });

  return {
    routes,
    pagination,
    isLoading,
    error: error as Error | null,
    createRoute: (d: Partial<TransportRoute>) => createMutation.mutateAsync(d),
    updateRoute: (id: string, d: Partial<TransportRoute>) => updateMutation.mutateAsync({ id, ...d }),
    deleteRoute: (id: string) => deleteMutation.mutateAsync(id),
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}

export function useAllocationsViewModel(search = "", routeId = "", page = 1) {
  const t = useTranslations("transport");
  const qc = useQueryClient();
  const queryKey = ["transportAllocations", { search, routeId, page }] as const;
  const qs = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(search ? { search } : {}),
    ...(routeId ? { routeId } : {}),
  }).toString();
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => qFetch<TransportApiResponse<TransportAllocation[]>>(`/api/transport/allocations?${qs}`),
  });
  const allocations: TransportAllocation[] = data?.data ?? [];
  const pagination: PaginationMeta | undefined = data?.pagination ?? undefined;

  const createMutation = useMutation({
    mutationFn: (p: Partial<TransportAllocation>) =>
      fetch("/api/transport/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(p),
      }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.details?.[0]?.message || j.message);
        return j.data as TransportAllocation;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transportAllocations"] });
      toast.success(t("allocatedSuccess"));
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e, t("error"))),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/transport/allocations/${id}`, { method: "DELETE", credentials: "include" }).then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.message);
        return j;
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transportAllocations"] });
      toast.success(t("vacatedSuccess"));
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e, t("error"))),
  });

  return {
    allocations,
    pagination,
    isLoading,
    error: error as Error | null,
    createAllocation: (d: Partial<TransportAllocation>) => createMutation.mutateAsync(d),
    deleteAllocation: (id: string) => deleteMutation.mutateAsync(id),
    isMutating: createMutation.isPending || deleteMutation.isPending,
  };
}
