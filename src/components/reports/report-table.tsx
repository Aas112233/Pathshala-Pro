"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
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
  onExportCSV?: () => void;
  onPrint?: () => void;
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
  onExportCSV,
  onPrint,
  className,
}: ReportTableProps<TData>) {
  const t = useTranslations("reports");

  const handleExportCSV = () => {
    if (!data || data.length === 0) return;

    const headers = columns
      .filter((col: any) => col.accessorKey || col.accessorFn)
      .map((col: any) => (col.header as string) || col.accessorKey || "");

    const rows = data.map((row: any) =>
      columns
        .filter((col: any) => col.accessorKey || col.accessorFn)
        .map((col: any) => {
          if (col.accessorFn) {
            return col.accessorFn(row);
          }
          if (col.accessorKey) {
            const key = col.accessorKey as string;
            return row[key];
          }
          return "";
        })
    );

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `report_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
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
                {onExportExcel && (
                  <Button variant="outline" size="sm" onClick={onExportExcel}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    {t("actions.exportExcel")}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={onExportCSV || handleExportCSV}>
                  <Download className="mr-2 h-4 w-4" />
                  {t("actions.exportCSV")}
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
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    {t("common.generating")}
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
                    {columns.map((column: any, columnIndex) => (
                      <TableCell key={columnIndex}>
                        {flexRender(
                          column.cell,
                          { getValue: () => (row as any)[column.accessorKey as string] }
                        )}
                      </TableCell>
                    ))}
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
