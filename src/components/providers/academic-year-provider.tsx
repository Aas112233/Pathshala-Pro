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
  /** The year the institute stated it is operating in. */
  isCurrent?: boolean;
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

/**
 * Pick the year to open the app in.
 *
 * The tiers mirror `resolveActiveAcademicYear` on the server exactly, so the
 * year the UI shows and the year the API reads for the same tenant cannot
 * disagree — which they could before, when each side inferred it separately
 * from the date range.
 *
 * The list is re-sorted newest-first here rather than relying on the API's
 * `orderBy`, so the choice does not silently depend on response ordering.
 */
function resolveDefaultYearId(years: AcademicYearOption[]): string {
  const newestFirst = [...years].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  // 1. The year the institute stated it is operating in.
  const flagged = newestFirst.find((y) => y.isCurrent && !y.isClosed);
  if (flagged) return flagged.id;

  // 2. Fallback for tenants that have not set the flag yet: the open year whose
  //    range covers today, then the latest open year, then the latest year.
  const current = newestFirst.find((y) => isCurrentAcademicYear(y.startDate, y.endDate));
  if (current) return current.id;
  const open = newestFirst.find((y) => !y.isClosed);
  return open?.id || newestFirst[0]?.id || "";
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
        const response = await fetch("/api/academic-years?limit=500", { credentials: "include" });
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
      // Re-selecting the year already showing must not reload the app: the
      // dropdown fires on every selection, including a no-op one, and a full
      // page load for nothing reads as the app being broken.
      if (id === selectedAcademicYearId) return;

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
      // AGENTS rule 7: Invalidate academic domains across the app on session switch.
      // Every key here is a prefix: ["fees"] also catches ["fees", params].
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      queryClient.invalidateQueries({ queryKey: ["exam-results"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["timetables"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["class-fee-structures"] });
      queryClient.invalidateQueries({ queryKey: ["salary"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["promotion-rules"] });
      queryClient.invalidateQueries({ queryKey: ["promotion-history"] });
      queryClient.invalidateQueries({ queryKey: ["promotion-calculation"] });
      queryClient.invalidateQueries({ queryKey: ["promotion-preflight"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      queryClient.invalidateQueries({ queryKey: ["holidays"] });

      // The cache invalidation above reaches every TanStack Query consumer, but
      // it cannot reach data that was rendered on the server or fetched in a
      // component's own effect. Switching the year changes what every one of
      // those reads means, so the app reloads into the new year rather than
      // leaving half of it pointing at the old one. The cookie and localStorage
      // are written before this line, so the reload opens on the year chosen.
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    },
    [tenantId, queryClient, selectedAcademicYearId]
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
