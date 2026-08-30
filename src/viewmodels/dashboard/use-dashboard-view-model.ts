// @ts-nocheck
"use client";

import { useQuery } from "@tanstack/react-query";
import type { ExecutiveDashboardMetrics } from "@/lib/analytics-service";

export function useExecutiveDashboard(asOfDate: Date = new Date()) {
  const dateStr = asOfDate.toISOString().slice(0, 10);

  const query = useQuery<ExecutiveDashboardMetrics, Error>({
    queryKey: ["executive-dashboard", dateStr],
    queryFn: async () => {
      const res = await fetch(`/api/reports/dashboard?date=${dateStr}`, {
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch executive dashboard metrics (Status: ${res.status})`);
      }

      const json = await res.json();
      return json.data || json;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });

  return {
    metrics: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refresh: () => query.refetch(),
  };
}

