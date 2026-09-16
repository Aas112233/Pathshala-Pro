"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { calendarApi, holidaysApi } from "@/lib/api-client";
import type { CalendarItem } from "@/lib/calendar-service";

/**
 * Calendar hooks. The base entity key is ["calendar"]; the query window and
 * class scope live in the second slot so switching the global academic year,
 * month or class filters refetches through prefix invalidation.
 */

export interface CalendarQueryParams {
  from: string;
  to: string;
  classId?: string;
  sectionId?: string;
}

export function useCalendarItems(params: CalendarQueryParams, options?: { enabled?: boolean }) {
  return useQuery<CalendarItem[]>({
    queryKey: ["calendar", params],
    queryFn: async () => {
      const response = await calendarApi.list({
        start: params.from,
        end: params.to,
        classId: params.classId,
        sectionId: params.sectionId,
      });
      const data = (response as any)?.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: options?.enabled ?? true,
  });
}

export function useHolidays(academicYearId: string, options?: { enabled?: boolean }) {
  return useQuery<any[]>({
    queryKey: ["holidays", academicYearId],
    queryFn: async () => {
      if (!academicYearId) return [];
      const response = await holidaysApi.list(academicYearId);
      const data = (response as any)?.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: (options?.enabled ?? true) && !!academicYearId,
  });
}

function useInvalidateCalendar() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["calendar"] });
    queryClient.invalidateQueries({ queryKey: ["holidays"] });
  };
}

export function useCreateCalendarEvent() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: (data: any) => calendarApi.create(data),
    onSuccess: invalidate,
  });
}

export function useUpdateCalendarEvent() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => calendarApi.update(id, data),
    onSuccess: invalidate,
  });
}

export function useDeleteCalendarEvent() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: (id: string) => calendarApi.remove(id),
    onSuccess: invalidate,
  });
}

export function useCreateHoliday() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: (data: any) => holidaysApi.create(data),
    onSuccess: invalidate,
  });
}

export function useUpdateHoliday() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => holidaysApi.update(id, data),
    onSuccess: invalidate,
  });
}

export function useDeleteHoliday() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: (id: string) => holidaysApi.remove(id),
    onSuccess: invalidate,
  });
}
