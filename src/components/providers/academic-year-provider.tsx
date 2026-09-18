"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
import { isCurrentAcademicYear } from "@/lib/academic-periods";

export interface AcademicYearOption {
  id: string;
  yearId?: string;
  label?: string;
  startDate: string;
  endDate: string;
  isClosed?: boolean;
}

interface AcademicYearContextType {
  academicYears: AcademicYearOption[];
  selectedAcademicYearId: string;
  setSelectedAcademicYearId: (id: string) => void;
  activeAcademicYear: AcademicYearOption | null;
  isLoading: boolean;
}

const AcademicYearContext = createContext<AcademicYearContextType | undefined>(undefined);

function getCacheKey(tenantId: string) {
  return `academic_year_${tenantId}`;
}

function resolveDefaultYearId(years: AcademicYearOption[]): string {
  const current = years.find((y) => isCurrentAcademicYear(y.startDate, y.endDate));
  if (current) return current.id;
  const open = years.find((y) => !y.isClosed);
  return open?.id || years[0]?.id || "";
}

export function AcademicYearProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { user, tenantId, isLoading: isAuthLoading } = useAuth();
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [selectedAcademicYearId, setSelectedId] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!tenantId || !user || user.role === "SYSTEM_ADMIN") {
      setAcademicYears([]);
      setSelectedId("");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadAcademicYears() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/academic-years?limit=100", { credentials: "include" });
        if (!response.ok) {
          throw new Error("Failed to fetch academic years");
        }
        const result = await response.json();
        const years: AcademicYearOption[] = Array.isArray(result?.data) ? result.data : [];
        if (cancelled) return;

        setAcademicYears(years);

        let cachedId = "";
        try {
          cachedId = localStorage.getItem(getCacheKey(tenantId as string)) || "";
        } catch {
          cachedId = "";
        }

        const cachedYear = cachedId ? years.find((y) => y.id === cachedId) : undefined;
        const nextId = cachedYear ? cachedId : resolveDefaultYearId(years);
        setSelectedId(nextId);
        if (nextId) {
          try {
            localStorage.setItem(getCacheKey(tenantId as string), nextId);
          } catch {
            // localStorage unavailable — selection stays in memory
          }
          try {
            document.cookie = `pathshala_academic_year=${nextId}; path=/; max-age=31536000; SameSite=Lax`;
          } catch {
            // cookie unavailable
          }
        }
      } catch {
        if (!cancelled) {
          setAcademicYears([]);
          setSelectedId("");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadAcademicYears();

    return () => {
      cancelled = true;
    };
  }, [tenantId, user, isAuthLoading]);

  const setSelectedAcademicYearId = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (typeof window !== "undefined") {
        if (tenantId) {
          try {
            localStorage.setItem(getCacheKey(tenantId), id);
          } catch {
            // localStorage unavailable — selection stays in memory
          }
        }
        try {
          document.cookie = `pathshala_academic_year=${id}; path=/; max-age=31536000; SameSite=Lax`;
        } catch {
          // cookie unavailable
        }
      }
      // AGENTS rule 7: Invalidate academic domains across the app on session switch
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["timetables"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["class-fee-structures"] });
    },
    [tenantId, queryClient]
  );

  const activeAcademicYear = useMemo(
    () => academicYears.find((y) => y.id === selectedAcademicYearId) || null,
    [academicYears, selectedAcademicYearId]
  );

  const value = useMemo(
    () => ({
      academicYears,
      selectedAcademicYearId,
      setSelectedAcademicYearId,
      activeAcademicYear,
      isLoading,
    }),
    [academicYears, selectedAcademicYearId, setSelectedAcademicYearId, activeAcademicYear, isLoading]
  );

  return (
    <AcademicYearContext.Provider value={value}>
      {children}
    </AcademicYearContext.Provider>
  );
}

export function useOptionalAcademicYearContext() {
  return useContext(AcademicYearContext);
}

export function useAcademicYearContext() {
  const context = useContext(AcademicYearContext);
  if (!context) {
    throw new Error("useAcademicYearContext must be used within an AcademicYearProvider");
  }
  return context;
}
