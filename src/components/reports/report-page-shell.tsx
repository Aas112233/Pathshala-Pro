"use client";

interface ReportPageShellProps {
  filters?: React.ReactNode;
  summary?: React.ReactNode;
  metrics?: React.ReactNode;
  insights?: React.ReactNode;
  table?: React.ReactNode;
  children?: React.ReactNode;
}

export function ReportPageShell({
  filters,
  summary,
  metrics,
  insights,
  table,
  children,
}: ReportPageShellProps) {
  return (
    <div className="space-y-6">
      {children ?? (
        <>
          {filters}
          {summary}
          {metrics}
          {insights}
          {table}
        </>
      )}
    </div>
  );
}
