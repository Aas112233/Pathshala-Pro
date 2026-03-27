"use client";

interface ReportPageShellProps {
  filters: React.ReactNode;
  summary?: React.ReactNode;
  metrics?: React.ReactNode;
  insights?: React.ReactNode;
  table: React.ReactNode;
}

export function ReportPageShell({
  filters,
  summary,
  metrics,
  insights,
  table,
}: ReportPageShellProps) {
  return (
    <div className="space-y-6">
      {filters}
      {summary}
      {metrics}
      {insights}
      {table}
    </div>
  );
}
