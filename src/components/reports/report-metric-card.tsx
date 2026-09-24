"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

interface ReportMetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function ReportMetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
}: ReportMetricCardProps) {
  const t = useTranslations("reports.common");
  const valueText = String(value ?? "");
  // ponytail: length-based shrink keeps long values inside the card without JS measuring
  const valueSizeClass =
    valueText.length <= 10
      ? "text-2xl"
      : valueText.length <= 15
        ? "text-xl"
        : valueText.length <= 22
          ? "text-lg"
          : "text-base";

  return (
    <Card className={cn("min-w-0 overflow-hidden shadow-sm", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="min-w-0 flex-1 break-words text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
      </CardHeader>
      <CardContent className="min-w-0">
        <div
          title={valueText}
          className={cn("min-w-0 break-all font-bold leading-tight", valueSizeClass)}
        >
          {value}
        </div>
        {description && (
          <CardDescription className="mt-1">{description}</CardDescription>
        )}
        {trend && (
          <p
            className={cn(
              "mt-2 text-xs",
              trend.isPositive
                ? "text-[var(--status-success-text)]"
                : "text-[var(--status-error-text)]"
            )}
          >
            {trend.isPositive ? "+" : "-"}
            {Math.abs(trend.value)}
            {t("trendFromLastPeriod")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
