"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { staffApi } from "@/lib/api-client";
import type { PaginationParams } from "@/types/api";
import type { StaffProfile, CreateStaffDTO, UpdateStaffDTO } from "@/types/entities";
import { toast } from "sonner";

export type StaffViewMode = "table" | "grid";
export type StaffStatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export interface StaffFilters {
  search: string;
  status: StaffStatusFilter;
  department: string;
  gender: "ALL" | "MALE" | "FEMALE" | "OTHER";
}

export interface StaffViewModel {
  // State
  staff: StaffProfile[];
  isLoading: boolean;
  error: Error | null;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  } | null;

  // Filters & View
  filters: StaffFilters;
  viewMode: StaffViewMode;
  selectedStaff: StaffProfile | null;

  // Actions
  setFilters: (filters: Partial<StaffFilters>) => void;
  setViewMode: (mode: StaffViewMode) => void;
  setPage: (page: number) => void;
  setSelectedStaff: (staff: StaffProfile | null) => void;
  refresh: () => void;

  // CRUD Operations
  createStaff: (data: CreateStaffDTO) => Promise<void>;
  updateStaff: (id: string, data: Partial<CreateStaffDTO>) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  toggleStaffStatus: (id: string, isActive: boolean) => Promise<void>;
}

export function useStaffViewModel(): StaffViewModel {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<StaffViewMode>("table");
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [filters, setFiltersState] = useState<StaffFilters>({
    search: "",
    status: "ALL",
    department: "",
    gender: "ALL",
  });

  const setFilters = useCallback((newFilters: Partial<StaffFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
    setPage(1); // Reset to first page when filters change
  }, []);

  const queryKey = useMemo(
    () => [
      "staff",
      {
        page,
        limit: 20,
        search: filters.search || undefined,
        ...(filters.status !== "ALL" && { filters: { status: filters.status } }),
        ...(filters.department && { filters: { department: filters.department } }),
        ...(filters.gender !== "ALL" && { filters: { gender: filters.gender } }),
      },
    ],
    [page, filters.search, filters.status, filters.department, filters.gender]
  );

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () =>
      staffApi.list({
        page,
        limit: 20,
        search: filters.search || undefined,
        ...(filters.status !== "ALL" && { filters: { status: filters.status } }),
        ...(filters.department && { filters: { department: filters.department } }),
        ...(filters.gender !== "ALL" && { filters: { gender: filters.gender } }),
      } as PaginationParams),
  });

  const staff = useMemo(
    () => (data && "data" in data ? data.data : []),
    [data]
  );

  const pagination = useMemo(
    () => (data && "pagination" in data ? data.pagination : null),
    [data]
  );

  const createMutation = useMutation({
    mutationFn: (data: CreateStaffDTO) => staffApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Staff member created successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create staff member.");
      throw err;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<CreateStaffDTO>) =>
      staffApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: queryKey });
      toast.success("Staff member updated successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update staff member.");
      throw err;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => staffApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: queryKey });
      toast.success("Staff member deleted successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete staff member.");
      throw err;
    },
  });

  // Toggle status mutation (activate/deactivate)
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      staffApi.update(id, { isActive }),
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: queryKey });
      toast.success(isActive ? "Staff member activated!" : "Staff member deactivated!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update staff status.");
      throw err;
    },
  });

  const createStaff = useCallback(
    async (data: CreateStaffDTO) => {
      await createMutation.mutateAsync(data);
    },
    [createMutation]
  );

  const updateStaff = useCallback(
    async (id: string, data: Partial<CreateStaffDTO>) => {
      await updateMutation.mutateAsync({ id, ...data });
    },
    [updateMutation]
  );

  const deleteStaff = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation]
  );

  const toggleStaffStatus = useCallback(
    async (id: string, isActive: boolean) => {
      await toggleStatusMutation.mutateAsync({ id, isActive });
    },
    [toggleStatusMutation]
  );

  return {
    // State
    staff,
    isLoading,
    error,
    pagination,

    // Filters & View
    filters,
    viewMode,
    selectedStaff,

    // Actions
    setFilters,
    setViewMode,
    setPage,
    setSelectedStaff,
    refresh: refetch,

    // CRUD Operations
    createStaff,
    updateStaff,
    deleteStaff,
    toggleStaffStatus,
  };
}
