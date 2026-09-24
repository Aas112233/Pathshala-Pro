"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ERPDataTable, type ColumnDef as ERPColumnDef } from "@/components/ui/erp-data-table";
import { useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { useExcelExport } from "@/hooks/use-excel-export";
import type { ExcelColumn } from "@/lib/excel-exporter";
import { cn } from "@/lib/utils";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface ReportTableProps<TData> {
  title?: string;
  description?: string;
  columns: ColumnDef<TData>[];
  data: TData[];
  isLoading?: boolean;
  showExport?: boolean;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  onPrint?: () => void;
  exportFileName?: string;
  className?: string;
  /** Server-driven pagination. Omit all four to render the rows unpaginated. */
  page?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  /** Stable row identity for React keys; falls back to `row.id` then the index. */
  getRowId?: (row: TData, index: number) => string | number;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

/**
 * Report table.
 *
 * Renders ERPDataTable (AGENTS.md §2) rather than a bare <Table>, which brings
 * the toolbar, skeleton loading, empty state and — critically — the pagination
 * footer with a range counter and page-size picker.
 *
 * Column definitions stay in the TanStack shape the report pages already use
 * (`{ accessorKey, header, cell: ({ getValue }) => … }`) and are adapted here,
 * so adopting ERPDataTable did not require rewriting seven pages' column
 * arrays. All in-repo report cells use only `getValue`, which is what makes the
 * adapter below faithful.
 */
export function ReportTable<TData>({
  title,
  description,
  columns,
  data,
  isLoading = false,
  showExport = true,
  onExportPDF,
  onExportExcel,
  onPrint,
  exportFileName,
  className,
  page = 1,
  pageSize = 20,
  totalCount,
  onPageChange,
  onPageSizeChange,
  getRowId,
  searchValue,
  onSearchChange,
}: ReportTableProps<TData>) {
  const t = useTranslations("reports");
  const tCommon = useTranslations("reports.common");
  const { settings } = useTenantSettings();

  const { exportData } = useExcelExport({
    fileName: exportFileName ?? "report",
    schoolName: settings.name || "Pathshala Pro School",
    schoolAddress: settings.address,
    schoolPhone: settings.phone,
    schoolEmail: settings.email,
  });

  const accessorColumns = columns.filter(
    (col: any) => col.accessorKey || col.accessorFn
  ) as any[];

  const keyOf = (col: any, index: number) =>
    String(col.accessorKey ?? col.id ?? `column_${index}`);

  const valueOf = (col: any, row: any) =>
    col.accessorFn ? col.accessorFn(row) : row[col.accessorKey as string];

  const handleExportExcel = async () => {
    if (!data || data.length === 0) return;

    const excelColumns: ExcelColumn[] = accessorColumns.map((col, index) => {
      const key = keyOf(col, index);
      const firstValue = data
        .map((row: any) => valueOf(col, row))
        .find((value) => value !== null && value !== undefined);
      return {
        header: typeof col.header === "string" ? col.header : (col.id ?? key),
        key,
        style: typeof firstValue === "number" ? "number" : "text",
      };
    });

    const rows = data.map((row: any) => {
      const mapped: Record<string, unknown> = {};
      accessorColumns.forEach((col, index) => {
        mapped[keyOf(col, index)] = valueOf(col, row);
      });
      return mapped;
    });

    const result = await exportData({
      title: title ?? exportFileName ?? "Report",
      columns: excelColumns,
      data: rows,
    });
    if (result.success) {
      toast.success(t("common.exportedExcel"));
    } else {
      toast.error(
        result.error instanceof Error ? result.error.toString() : String(result.error)
      );
    }
  };

  const erpColumns: ERPColumnDef<TData>[] = columns.map((col: any, index) => {
    const key = keyOf(col, index);
    const headerText =
      typeof col.header === "string" ? col.header : (col.id ?? key);

    return {
      key,
      header: headerText,
      cell: (row: TData, rowIndex: number) => {
        const value = valueOf(col, row);
        if (typeof col.cell === "function") {
          // Faithful subset of TanStack's CellContext: every in-repo report cell
          // destructures only `getValue`.
          return col.cell({ getValue: () => value, row: { original: row, index: rowIndex } });
        }
        return value === null || value === undefined ? "" : String(value);
      },
    };
  });

  const exportButtons =
    showExport && (onExportPDF || onExportExcel || onPrint) ? (
      <div className="flex items-center gap-2">
        {onExportPDF && (
          <Button variant="outline" size="sm" onClick={onExportPDF}>
            <FileText className="mr-2 h-4 w-4" />
            {t("actions.exportPDF")}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onExportExcel ?? handleExportExcel}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          {t("actions.exportExcel")}
        </Button>
        {onPrint && (
          <Button variant="outline" size="sm" onClick={onPrint}>
            <Printer className="mr-2 h-4 w-4" />
            {t("actions.print")}
          </Button>
        )}
      </div>
    ) : null;

  return (
    <Card className={cn(className)}>
      {(title || description) && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </CardHeader>
      )}
      <CardContent className={cn(!title && !description && "pt-6")}>
        <ERPDataTable<TData>
          data={data}
          columns={erpColumns}
          keyExtractor={(row, index) =>
            getRowId ? getRowId(row, index) : ((row as any)?.id ?? index)
          }
          isLoading={isLoading}
          className="border-0 shadow-none"
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchPlaceholder={tCommon("searchPlaceholder")}
          secondaryAction={exportButtons}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount ?? data.length}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          paginationLabels={{
            rowsPerPage: tCommon("rowsPerPage"),
            previous: tCommon("previousPage"),
            next: tCommon("nextPage"),
            range: (start, end, total) =>
              tCommon("paginationRange", { start, end, total }),
          }}
          emptyState={
            <div className="flex flex-col items-center justify-center gap-1">
              <span className="text-xs font-medium">{tCommon("noRecordsTitle")}</span>
              <span className="text-[11px] text-muted-foreground/60">
                {tCommon("noRecordsDescription")}
              </span>
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}
