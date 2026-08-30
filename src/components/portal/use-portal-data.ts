"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export interface PortalData {
  role: "STUDENT" | "PARENT";
  school: { name: string; logoUrl?: string | null; currencySymbol?: string | null } | null;
  student: any;
  timetable: any[];
  today: string;
  homework: any[];
  exams: any[];
  attendance: { records: any[]; percentage: number | null };
  fees: any[];
  totalDue: number;
  transactions: any[];
  results: any[];
}

export function usePortalData() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId");
  const [data, setData] = useState<PortalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";
    fetch(`/api/portal/me${query}`, { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error(json?.message || "Unable to load portal data");
        return json?.data as PortalData;
      })
      .then((next) => { setData(next); setError(null); })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Unable to load portal data");
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [studentId]);

  return { data, isLoading, error };
}

export function formatPortalDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

export function formatPortalCurrency(value: number, symbol = "") {
  return `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
