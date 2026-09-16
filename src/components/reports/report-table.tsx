"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { useExcelExport } from "@/hooks/use-excel-export";
import type { ExcelColumn } from "@/lib/excel-exporter";
import { cn } from "@/lib/utils";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";

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
}

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
}: ReportTableProps<TData>) {
  const t = useTranslations("reports");
  const { settings } = useTenantSettings();

  const { exportData } = useExcelExport({
    fileName: exportFileName ?? "report",
    schoolName: settings.name || "Pathshala Pro School",
    schoolAddress: settings.address,
    schoolPhone: settings.phone,
    schoolEmail: settings.email,
  });

  const handleExportExcel = async () => {
    if (!data || data.length === 0) return;

    const accessorColumns = columns.filter(
      (col: any) => col.accessorKey || col.accessorFn
    ) as any[];

    const keyOf = (col: any, index: number) =>
      String(col.accessorKey ?? col.id ?? `column_${index}`);

    const valueOf = (col: any, row: any) =>
      col.accessorFn ? col.accessorFn(row) : row[col.accessorKey as string];

    const excelColumns: ExcelColumn[] = accessorColumns.map((col, index) => {
      const key = keyOf(col, index);
      const firstValue = data
        .map((row: any) => valueOf(col, row))
        .find((value) => value !== null && value !== undefined);
      return {
        header:
          typeof col.header === "string" ? col.header : (col.id ?? key),
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
        result.error instanceof Error
          ? result.error.message
          : String(result.error)
      );
    }
  };

  return (
    <Card className={cn(className)}>
      {(title || showExport) && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              {title && <CardTitle>{title}</CardTitle>}
              {description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </div>
            {showExport && (
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
            )}
          </div>
        </CardHeader>
      )}
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column: any, columnIndex) => (
                  <TableHead key={columnIndex}>
                    {typeof column.header === "function"
                      ? column.header({ column, header: column, table: {} as any })
                      : column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="p-0">
                    <TableSkeleton rows={6} />
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {columns.map((column: any, columnIndex) => {
                      const getVal = () =>
                        column.accessorFn
                          ? column.accessorFn(row)
                          : column.accessorKey
                          ? (row as any)[column.accessorKey as string]
                          : undefined;

                      const cellContext = {
                        getValue: <TValue = unknown,>() => getVal() as TValue,
                        renderValue: <TValue = unknown,>() => getVal() as TValue,
                        row: {
                          original: row,
                          index: rowIndex,
                          getValue: (key: string) => (row as any)[key],
                        },
                        cell: {
                          id: `${rowIndex}_${column.id || column.accessorKey || columnIndex}`,
                          getValue: getVal,
                          row: { original: row, index: rowIndex },
                        },
                        column,
                        table: {} as any,
                      };

                      return (
                        <TableCell key={columnIndex}>
                          {column.cell
                            ? flexRender(column.cell, cellContext)
                            : (getVal() ?? "")}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
