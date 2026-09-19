"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { CLASS_TEMPLATE_PRESETS } from "@/lib/schemas";

export interface TemplateOption {
  code: string;
  label: string;
  description: string;
  count: string;
  isBuiltIn: boolean;
  stats: { classes: number; sections: number; groups: number; subjects: number };
}

const BUILT_IN_CODES = CLASS_TEMPLATE_PRESETS as unknown as string[];

/**
 * Template options for signup wizards. Prefers live platform data (so
 * superadmin-created or deactivated templates take effect immediately) and
 * falls back to the built-in code presets when the API is unreachable.
 * Built-ins keep their translated labels; custom templates use stored text.
 */
export function useOnboardingTemplateOptions() {
  const t = useTranslations("onboarding");

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-templates-public"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding-templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      const json = await res.json();
      return (json.data ?? []) as Array<{
        code: string;
        label: string | null;
        description: string | null;
        isBuiltIn: boolean;
        stats: TemplateOption["stats"];
      }>;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const builtInFallback: TemplateOption[] = BUILT_IN_CODES.map((code) => ({
    code,
    label: t(`templates.${code}.label`),
    description: t(`templates.${code}.description`),
    count: t(`templates.${code}.count`),
    isBuiltIn: true,
    stats: { classes: 0, sections: 0, groups: 0, subjects: 0 },
  }));

  // Empty (all deactivated or unreachable table) also falls back — the
  // wizard must always offer something provisionable.
  if (!data || data.length === 0) return { options: builtInFallback, isLoading };

  const options: TemplateOption[] = data.map((row) => {
    const builtIn = BUILT_IN_CODES.includes(row.code);
    return {
      code: row.code,
      label: row.label ?? (builtIn ? t(`templates.${row.code}.label`) : row.code),
      description:
        row.description ?? (builtIn ? t(`templates.${row.code}.description`) : ""),
      count: builtIn && !row.label
        ? t(`templates.${row.code}.count`)
        : `${row.stats.classes} Classes`,
      isBuiltIn: row.isBuiltIn,
      stats: row.stats,
    };
  });

  return { options, isLoading };
}
