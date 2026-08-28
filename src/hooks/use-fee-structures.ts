"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CreateClassFeeStructureInput,
  UpdateClassFeeStructureInput,
  CreateStudentFeeConcessionInput,
} from "@/lib/schemas";

export interface ClassFeeStructureItem {
  id: string;
  tenantId: string;
  academicYearId: string;
  classId: string;
  tuitionFee: number;
  labFee: number;
  computerFee: number;
  examFee: number;
  sportsFee: number;
  libraryFee: number;
  otherFee: number;
  totalMonthlyFee: number;
  billingCycle: "MONTHLY" | "QUARTERLY" | "BI_ANNUAL" | "ANNUAL";
  notes?: string | null;
  isActive: boolean;
  studentCount: number;
  projectedRevenue: number;
  class: {
    id: string;
    name: string;
    classNumber: number;
  };
  academicYear: {
    id: string;
    label: string;
    isClosed: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface StudentFeeConcessionItem {
  id: string;
  tenantId: string;
  studentProfileId: string;
  concessionType: "SIBLING" | "STAFF_CHILD" | "MERIT" | "NEED_BASED" | "CUSTOM";
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  reason?: string | null;
  isActive: boolean;
  studentProfile: {
    id: string;
    studentId: string;
    rollNumber: string;
    firstName: string;
    lastName: string;
    firstNameBn?: string | null;
    lastNameBn?: string | null;
    class?: { id: string; name: string } | null;
    section?: { id: string; name: string } | null;
  };
  createdAt: string;
  updatedAt: string;
}

export function useClassFeeStructures(academicYearId?: string) {
  return useQuery<{ data: ClassFeeStructureItem[] }>({
    queryKey: ["class-fee-structures", academicYearId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (academicYearId) p.set("academicYearId", academicYearId);
      const res = await fetch(`/api/fees/structures?${p.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load class fee structures");
      return res.json();
    },
  });
}

export function useCreateClassFeeStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateClassFeeStructureInput) => {
      const res = await fetch("/api/fees/structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to save fee structure");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-fee-structures"] });
    },
  });
}

export function useUpdateClassFeeStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateClassFeeStructureInput;
    }) => {
      const res = await fetch(`/api/fees/structures/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to update fee structure");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-fee-structures"] });
    },
  });
}

export function useDeleteClassFeeStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/fees/structures/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to delete fee structure");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-fee-structures"] });
    },
  });
}

export function useStudentConcessions(studentProfileId?: string) {
  return useQuery<{ data: StudentFeeConcessionItem[] }>({
    queryKey: ["student-fee-concessions", studentProfileId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (studentProfileId) p.set("studentProfileId", studentProfileId);
      const res = await fetch(`/api/fees/concessions?${p.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load concessions");
      return res.json();
    },
  });
}

export function useSaveStudentConcession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateStudentFeeConcessionInput) => {
      const res = await fetch("/api/fees/concessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to save student concession");
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-fee-concessions"] });
    },
  });
}
