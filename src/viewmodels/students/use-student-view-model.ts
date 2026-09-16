"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { studentsApi } from "@/lib/api-client";
import type { PaginationParams } from "@/types/api";
import type { StudentProfile } from "@/types/entities";
import { appToast as toast } from "@/lib/notifications/toast";
import { useAcademicYearContext } from "@/components/providers/academic-year-provider";

export type StudentViewMode = "table" | "grid";
// Aligned with Prisma StudentStatus: ACTIVE | INACTIVE | GRADUATED | TRANSFERRED
export type StudentStatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "GRADUATED" | "TRANSFERRED";

export interface StudentFilters {
  search: string;
  status: StudentStatusFilter;
  gender: "ALL" | "MALE" | "FEMALE" | "OTHER";
  classId: string;
  sectionId: string;
  groupId: string;
}

export interface StudentViewModel {
  // State
  students: StudentProfile[];
  isLoading: boolean;
  isFetching: boolean;
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
  filters: StudentFilters;
  viewMode: StudentViewMode;
  selectedStudent: StudentProfile | null;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
  selectedIds: Set<string>;

  // Actions
  setFilters: (filters: Partial<StudentFilters>) => void;
  resetFilters: () => void;
  setViewMode: (mode: StudentViewMode) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSort: (by: string, order?: "asc" | "desc") => void;
  setSelectedStudent: (student: StudentProfile | null) => void;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  clearSelection: () => void;
  refresh: () => void;

  // CRUD Operations
  createStudent: (data: CreateStudentDTO) => Promise<void>;
  updateStudent: (id: string, data: UpdateStudentDTO) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;
}

export interface CreateStudentDTO {
  rollNumber?: string;
  firstName: string;
  lastName: string;
  firstNameBn?: string;
  lastNameBn?: string;
  guardianName: string;
  guardianContact: string;
  guardianEmail?: string;
  fatherName?: string;
  motherName?: string;
  emergencyContact?: string;
  birthCertificateNo?: string;
  bloodGroup?: string;
  gender: string;
  status: string;
  profilePictureUrl?: string;
  driveFileId?: string;
  dateOfBirth?: string;
  address?: string;
  classId?: string;
  groupId?: string;
  sectionId?: string;
}

export interface UpdateStudentDTO extends Partial<CreateStudentDTO> {
  id: string;
}

const DEFAULT_FILTERS: StudentFilters = {
  search: "",
  status: "ALL",
  gender: "ALL",
  classId: "",
  sectionId: "",
  groupId: "",
};

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useStudentViewModel(): StudentViewModel {
  const t = useTranslations("students");
  const queryClient = useQueryClient();
  const { selectedAcademicYearId } = useAcademicYearContext();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(20);
  const [viewMode, setViewMode] = useState<StudentViewMode>("table");
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [filters, setFiltersState] = useState<StudentFilters>({ ...DEFAULT_FILTERS });
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const debouncedSearch = useDebounced(filters.search, 300);

  const setFilters = useCallback((newFilters: Partial<StudentFilters>) => {
    setFiltersState((prev) => {
      const next = { ...prev, ...newFilters };
      // Cascading: Class → Section/Group reset
      if (newFilters.classId !== undefined && newFilters.classId !== prev.classId) {
        if (!newFilters.sectionId) next.sectionId = "";
        if (!newFilters.groupId) next.groupId = "";
      }
      return next;
    });
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState({ ...DEFAULT_FILTERS });
    setPage(1);
    setSelectedIds(new Set());
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  const setSort = useCallback((by: string, order?: "asc" | "desc") => {
    setSortBy(by);
    setSortOrder((prev) => order ?? (sortBy === by && prev === "asc" ? "desc" : "asc"));
    setPage(1);
  }, [sortBy]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    // filled in after students loaded
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Deterministic queryKey per AGENTS rule 7
  const queryKey = useMemo(() => {
    const filterParams: Record<string, string> = {};
    if (selectedAcademicYearId) filterParams.academicYearId = selectedAcademicYearId;
    if (filters.status !== "ALL") filterParams.status = filters.status;
    if (filters.gender !== "ALL") filterParams.gender = filters.gender;
    if (filters.classId) filterParams.classId = filters.classId;
    if (filters.sectionId) filterParams.sectionId = filters.sectionId;
    if (filters.groupId) filterParams.groupId = filters.groupId;
    return [
      "students",
      {
        academicYearId: selectedAcademicYearId || undefined,
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        sortBy,
        sortOrder,
        ...(Object.keys(filterParams).length && { filters: filterParams }),
      },
    ];
  }, [page, pageSize, debouncedSearch, filters.status, filters.gender, filters.classId, filters.sectionId, filters.groupId, sortBy, sortOrder, selectedAcademicYearId]);

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => {
      const filterParams: Record<string, string> = {};
      if (selectedAcademicYearId) filterParams.academicYearId = selectedAcademicYearId;
      if (filters.status !== "ALL") filterParams.status = filters.status;
      if (filters.gender !== "ALL") filterParams.gender = filters.gender;
      if (filters.classId) filterParams.classId = filters.classId;
      if (filters.sectionId) filterParams.sectionId = filters.sectionId;
      if (filters.groupId) filterParams.groupId = filters.groupId;
      return studentsApi.list({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        sortBy,
        sortOrder,
        ...(Object.keys(filterParams).length && { filters: filterParams }),
      } as PaginationParams);
    },
    placeholderData: (prev) => prev,
  });

  const students = useMemo(
    () => (data && "data" in data ? (data.data as StudentProfile[]) : []),
    [data]
  );

  const pagination = useMemo(
    () => (data && "pagination" in data ? (data.pagination as any) : null),
    [data]
  );

  const doToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === students.length && students.length > 0) return new Set();
      return new Set(students.map((s) => s.id));
    });
  }, [students]);

  const createMutation = useMutation({
    mutationFn: (data: CreateStudentDTO) =>
      studentsApi.create({
        ...(selectedAcademicYearId ? { academicYearId: selectedAcademicYearId } : {}),
        ...data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(t("createSuccess"));
    },
    onError: (err: any) => {
      const msg = err?.message || t("createError") || t("deleteError");
      toast.error(msg);
      throw err;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: UpdateStudentDTO) =>
      studentsApi.update(id, {
        ...(selectedAcademicYearId ? { academicYearId: selectedAcademicYearId } : {}),
        ...data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(t("updateSuccess"));
    },
    onError: (err: any) => {
      toast.error(err?.message || t("updateError") || t("deleteError"));
      throw err;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => studentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(t("deleteSuccess"));
    },
    onError: (err: any) => {
      toast.error(err?.message || t("deleteError"));
      throw err;
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => studentsApi.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setSelectedIds(new Set());
      toast.success(t("deleteSuccess"));
    },
    onError: (err: any) => {
      toast.error(err?.message || t("deleteError"));
      throw err;
    },
  });

  const createStudent = useCallback(
    async (data: CreateStudentDTO) => {
      await createMutation.mutateAsync(data);
    },
    [createMutation]
  );

  const updateStudent = useCallback(
    async (id: string, data: Partial<CreateStudentDTO>) => {
      await updateMutation.mutateAsync({ id, ...data } as UpdateStudentDTO);
    },
    [updateMutation]
  );

  const deleteStudent = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation]
  );

  const bulkDelete = useCallback(
    async (ids: string[]) => {
      await bulkDeleteMutation.mutateAsync(ids);
    },
    [bulkDeleteMutation]
  );

  return {
    // State
    students,
    isLoading,
    isFetching: (isFetching as unknown as boolean) ?? false,
    error: error as Error | null,
    pagination,

    // Filters & View
    filters,
    viewMode,
    selectedStudent,
    page,
    pageSize,
    sortBy,
    sortOrder,
    selectedIds,

    // Actions
    setFilters,
    resetFilters,
    setViewMode,
    setPage,
    setPageSize,
    setSort,
    setSelectedStudent,
    toggleSelect,
    toggleSelectAll: doToggleSelectAll,
    clearSelection,
    refresh: refetch,

    // CRUD Operations
    createStudent,
    updateStudent,
    deleteStudent,
    bulkDelete,
  } as StudentViewModel & { bulkDelete: (ids: string[]) => Promise<void> };
}
