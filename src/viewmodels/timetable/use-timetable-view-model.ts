"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface TimetableEntry {
  id: string;
  dayOfWeek: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectId: string | null;
  staffProfileId: string | null;
  roomNumber: string | null;
  isBreak: boolean;
  breakLabel: string | null;
  subject?: { id: string; name: string; code: string } | null;
  staffProfile?: { id: string; firstName: string; lastName: string; staffId: string } | null;
}

async function fetchTimetable(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/timetables?${qs}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch timetable");
  const json = await res.json();
  return json.data as TimetableEntry[];
}

export function useTimetableViewModel(filters: {
  classId: string;
  sectionId?: string;
  academicYearId?: string;
}) {
  const { classId, sectionId, academicYearId } = filters;
  const enabled = !!classId;
  const queryKey = ["timetable", classId, sectionId || "", academicYearId || ""] as const;
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      fetchTimetable({
        classId,
        ...(sectionId ? { sectionId } : {}),
        ...(academicYearId ? { academicYearId } : {}),
      }),
    enabled,
  });

  const entries = (data as TimetableEntry[]) ?? [];

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/timetables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to create");
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetable"] });
      toast.success("Period added");
    },
    onError: (e: any) => toast.error(e.message || "Failed to add period"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: any) => {
      const res = await fetch(`/api/timetables/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to update");
      return json.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetable"] });
      toast.success("Period updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/timetables/${id}`, { method: "DELETE", credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to delete");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetable"] });
      toast.success("Period removed");
    },
    onError: (e: any) => toast.error(e.message || "Failed to remove"),
  });

  const createEntry = useCallback((d: any) => createMutation.mutateAsync(d), [createMutation]);
  const updateEntry = useCallback((id: string, d: any) => updateMutation.mutateAsync({ id, ...d }), [updateMutation]);
  const deleteEntry = useCallback((id: string) => deleteMutation.mutateAsync(id), [deleteMutation]);

  return {
    entries,
    isLoading,
    error: error as Error | null,
    refresh: refetch,
    createEntry,
    updateEntry,
    deleteEntry,
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
