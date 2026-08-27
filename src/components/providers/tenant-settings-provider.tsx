"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission } from "@/lib/permissions";
import {
  DEFAULT_TENANT_SETTINGS,
  formatCurrencyWithSettings,
  formatCompactCurrencyWithSettings,
  formatDateTimeWithSettings,
  formatDateWithSettings,
  formatTimeWithSettings,
  formatDateRangeWithSettings,
  formatRelativeTimeWithSettings,
  formatAcademicPeriodWithSettings,
  type TenantSettings,
} from "@/lib/tenant-settings";
import type { FormatCurrencyOptions } from "@/lib/currencies";
import type { AcademicYearData } from "@/lib/academic-periods";

interface TenantSettingsContextType {
  settings: TenantSettings;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
  setSettings: (settings: TenantSettings) => void;
}

const TenantSettingsContext = createContext<TenantSettingsContextType | undefined>(undefined);

function getCacheKey(tenantId: string) {
  return `tenant_settings_${tenantId}`;
}

export function TenantSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user, tenantId, isLoading: isAuthLoading } = useAuth();
  const [settings, setSettingsState] = useState<TenantSettings>(DEFAULT_TENANT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const canReadSettings =
    user?.role === "SUPER_ADMIN" ||
    (!!user && user.role !== "SYSTEM_ADMIN" && hasPermission(user.permissions, "settings", "read"));

  const setSettings = useCallback((nextSettings: TenantSettings) => {
    setSettingsState(nextSettings);
    if (typeof window !== "undefined" && nextSettings.tenantId) {
      localStorage.setItem(getCacheKey(nextSettings.tenantId), JSON.stringify(nextSettings));
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    if (!tenantId || !canReadSettings) {
      setSettingsState(DEFAULT_TENANT_SETTINGS);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/settings", { credentials: "include" });
      if (response.ok) {
        const result = await response.json();
        if (result.data) {
          setSettings(result.data);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch tenant settings in background:", err);
    } finally {
      setIsLoading(false);
    }
  }, [canReadSettings, setSettings, tenantId]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!tenantId || !canReadSettings) {
      setSettingsState(DEFAULT_TENANT_SETTINGS);
      setIsLoading(false);
      return;
    }

    const cachedSettings = localStorage.getItem(getCacheKey(tenantId));
    if (cachedSettings) {
      try {
        setSettingsState(JSON.parse(cachedSettings) as TenantSettings);
        setIsLoading(false);
      } catch {
        localStorage.removeItem(getCacheKey(tenantId));
      }
    }

    void refreshSettings();
  }, [canReadSettings, isAuthLoading, refreshSettings, tenantId]);

  const value = useMemo(
    () => ({
      settings,
      isLoading,
      refreshSettings,
      setSettings,
    }),
    [isLoading, refreshSettings, setSettings, settings]
  );

  return (
    <TenantSettingsContext.Provider value={value}>
      {children}
    </TenantSettingsContext.Provider>
  );
}

export function useTenantSettings() {
  const context = useContext(TenantSettingsContext);
  if (!context) {
    throw new Error("useTenantSettings must be used within a TenantSettingsProvider");
  }
  return context;
}

export function useTenantFormatting() {
  const { settings } = useTenantSettings();

  return {
    settings,
    currencyCode: settings.currency || "BDT",
    currencySymbol: settings.currencySymbol || "৳",
    timezone: settings.timezone || "Asia/Dhaka",
    dateFormat: settings.dateFormat || "DD/MM/YYYY",
    timeFormat: settings.timeFormat || "24h",
    firstDayOfWeek: settings.firstDayOfWeek || "sunday",
    academicYearStart: settings.academicYearStart || "january",
    formatDate: (date: Date | string | null | undefined, formatOverride?: string) =>
      formatDateWithSettings(date, settings, formatOverride),
    formatTime: (date: Date | string | null | undefined, timeFormatOverride?: string) =>
      formatTimeWithSettings(date, settings, timeFormatOverride),
    formatDateTime: (date: Date | string | null | undefined) =>
      formatDateTimeWithSettings(date, settings),
    formatDateRange: (startDate: Date | string, endDate: Date | string) =>
      formatDateRangeWithSettings(startDate, endDate, settings),
    formatRelativeTime: (date: Date | string | null | undefined) =>
      formatRelativeTimeWithSettings(date),
    formatCurrency: (amount: number, options?: FormatCurrencyOptions) =>
      formatCurrencyWithSettings(amount, settings, options),
    formatCompactCurrency: (amount: number, options?: FormatCurrencyOptions) =>
      formatCompactCurrencyWithSettings(amount, settings, options),
    formatAcademicPeriod: (year: AcademicYearData | string | null | undefined, prefix?: string) =>
      formatAcademicPeriodWithSettings(year, settings, prefix),
  };
}
