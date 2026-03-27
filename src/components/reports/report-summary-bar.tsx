"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CalendarRange, Clock3, Filter, Rows3 } from "lucide-react";

interface SummaryItem {
  label: string;
  value: string;
}

interface ReportSummaryBarProps {
  dateRangeLabel: string;
  generatedAtLabel: string;
  recordCount: number;
  appliedFilters: SummaryItem[];
  className?: string;
}

export function ReportSummaryBar({
  dateRangeLabel,
  generatedAtLabel,
  recordCount,
  appliedFilters,
  className,
}: ReportSummaryBarProps) {
  return (
    <Card className={cn("border-border/70 bg-card/70 shadow-sm", className)}>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <SummaryChip
            icon={CalendarRange}
            label="Report period"
            value={dateRangeLabel}
          />
          <SummaryChip
            icon={Clock3}
            label="Generated at"
            value={generatedAtLabel}
          />
          <SummaryChip
            icon={Rows3}
            label="Records"
            value={recordCount.toLocaleString()}
          />
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border/80 bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Filter className="h-4 w-4 text-primary" />
            Applied filters
          </div>
          <div className="flex flex-wrap gap-2">
            {appliedFilters.length > 0 ? (
              appliedFilters.map((item) => (
                <Badge
                  key={`${item.label}-${item.value}`}
                  variant="secondary"
                  className="rounded-full bg-background px-3 py-1 text-xs text-foreground"
                >
                  {item.label}: {item.value}
                </Badge>
              ))
            ) : (
              <Badge
                variant="secondary"
                className="rounded-full bg-background px-3 py-1 text-xs text-muted-foreground"
              >
                No extra filters
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background px-3 py-3">
      <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
