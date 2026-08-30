// @ts-nocheck
"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { studentsApi } from "@/lib/api-client";
import type { PaginationParams } from "@/types/api";
import type { StudentProfile } from "@/types/entities";
import { toast } from "sonner";

export type StudentViewMode = "table" | "grid";
export type StudentStatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "SUSPENDED";

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

  // Actions
  setFilters: (filters: Partial<StudentFilters>) => void;
  setViewMode: (mode: StudentViewMode) => void;
  setPage: (page: number) => void;
  setSelectedStudent: (student: StudentProfile | null) => void;
  refresh: () => void;

  // CRUD Operations
  createStudent: (data: CreateStudentDTO) => Promise<void>;
  updateStudent: (id: string, data: UpdateStudentDTO) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
}

export interface CreateStudentDTO {
  rollNumber: string;
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

export function useStudentViewModel(): StudentViewModel {
  const t = useTranslations("students");
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<StudentViewMode>("table");
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [filters, setFiltersState] = useState<StudentFilters>({
    search: "",
    status: "ALL",
    gender: "ALL",
    classId: "",
    sectionId: "",
    groupId: "",
  });

  const setFilters = useCallback((newFilters: Partial<StudentFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
    setPage(1); // Reset to first page when filters change
  }, []);

  const queryKey = useMemo(() => {
    const filterParams: Record<string, string> = {};
    if (filters.status !== "ALL") filterParams.status = filters.status;
    if (filters.gender !== "ALL") filterParams.gender = filters.gender;
    if (filters.classId) filterParams.classId = filters.classId;
    if (filters.sectionId) filterParams.sectionId = filters.sectionId;
    if (filters.groupId) filterParams.groupId = filters.groupId;
    return [
      "students",
      {
        page,
        limit: 20,
        search: filters.search || undefined,
        ...(Object.keys(filterParams).length && { filters: filterParams }),
      },
    ];
  }, [page, filters.search, filters.status, filters.gender, filters.classId, filters.sectionId, filters.groupId]);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => {
      const filterParams: Record<string, string> = {};
      if (filters.status !== "ALL") filterParams.status = filters.status;
      if (filters.gender !== "ALL") filterParams.gender = filters.gender;
      if (filters.classId) filterParams.classId = filters.classId;
      if (filters.sectionId) filterParams.sectionId = filters.sectionId;
      if (filters.groupId) filterParams.groupId = filters.groupId;
      return studentsApi.list({
        page,
        limit: 20,
        search: filters.search || undefined,
        ...(Object.keys(filterParams).length && { filters: filterParams }),
      } as PaginationParams);
    },
  });

  const students = useMemo(
    () => (data && "data" in data ? data.data : []),
    [data]
  );

  const pagination = useMemo(
    () => (data && "pagination" in data ? data.pagination : null),
    [data]
  );

  const createMutation = useMutation({
    mutationFn: (data: CreateStudentDTO) => studentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(t("createSuccess"));
    },
    onError: (err: any) => {
      toast.error(err?.message || t("deleteError"));
      throw err;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: UpdateStudentDTO) =>
      studentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: queryKey });
      toast.success(t("updateSuccess"));
    },
    onError: (err: any) => {
      toast.error(err?.message || t("deleteError"));
      throw err;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => studentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: queryKey });
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

  return {
    // State
    students,
    isLoading,
    error,
    pagination,

    // Filters & View
    filters,
    viewMode,
    selectedStudent,

    // Actions
    setFilters,
    setViewMode,
    setPage,
    setSelectedStudent,
    refresh: refetch,

    // CRUD Operations
    createStudent,
    updateStudent,
    deleteStudent,
  };
}

