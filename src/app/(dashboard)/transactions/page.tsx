"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { ERPDataTable, type ColumnDef } from "@/components/ui/erp-data-table";
import { ERPMetricCard } from "@/components/ui/erp-metric-card";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TenantDateInput } from "@/components/ui/tenant-date-input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TopSheet } from "@/components/ui/top-sheet";
import {
  ArrowLeftRight,
  Trash2,
  Search,
  RotateCcw,
  Download,
  Wallet,
  Banknote,
  Smartphone,
  Calendar,
  Eye,
  Layers,
  FileSpreadsheet,
  FileText,
  Loader2,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { downloadBlob } from "@/lib/download-blob";
import { useTransactionViewModel } from "@/viewmodels/transactions/use-transaction-view-model";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { useExcelExport } from "@/hooks/use-excel-export";
import { usePDFExport } from "@/hooks/use-pdf-export";
import type { ExcelColumn } from "@/lib/excel-exporter";
import { formatStudentName } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";
import { toast } from "sonner";

export default function TransactionsPage() {
  const t = useTranslations("transactions");
  const tCommon = useTranslations("common");
  const { formatCurrency, formatDate, settings } = useTenantFormatting();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canReadFees = hasPermission(perms, "fees", "read");
  const canManageFees = hasPermission(perms, "fees", "manage");

  const {
    transactions,
    isLoading,
    isFetching,
    pagination,
    filters,
    page,
    pageSize,
    kpis,
    setFilters,
    resetFilters,
    setPage,
    setPageSize,
    deleteTransaction,
    clearCheque,
    isClearing,
    verifyReceipt,
    isVerifying,
  } = useTransactionViewModel();

  const [detail, setDetail] = useState<any | null>(null);
  const [bounceReason, setBounceReason] = useState("");
  const [showBounceBox, setShowBounceBox] = useState(false);
  const [isExportingDaybook, setIsExportingDaybook] = useState(false);
  const [isExportingDaybookPdf, setIsExportingDaybookPdf] = useState(false);
  const { exportFeeDaybookPDF } = usePDFExport();

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await deleteTransaction(id);
    } catch {}
  };

  /**
   * Full-range Fee Collections Daybook. Built server-side because the table
   * export below can only ever hold the page currently in memory — the daybook
   * has to cover every receipt in the selected range.
   */
  const handleExportDaybook = async () => {
    if (isExportingDaybook) return;
    setIsExportingDaybook(true);
    try {
      const params = new URLSearchParams();
      if (filters.fromDate) params.set("startDate", filters.fromDate);
      if (filters.toDate) params.set("endDate", filters.toDate);
      const res = await fetch(`/api/accounting/daybook?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || t("daybookFailed"));
      }
      const blob = await res.blob();
      downloadBlob(blob, `fee-daybook_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(t("daybookExported"));
    } catch (error: any) {
      toast.error(error?.message || t("daybookFailed"));
    } finally {
      setIsExportingDaybook(false);
    }
  };

  const { exportData } = useExcelExport({
    fileName: "transactions",
    schoolName: settings.name || "Pathshala Pro School",
    schoolAddress: settings.address,
    schoolPhone: settings.phone,
    schoolEmail: settings.email,
  });

  /**
   * Full-range Fee Collections Daybook as PDF. Pulls the same server-built row
   * set as the Excel daybook (`?format=json`) so it is never truncated to the
   * page currently loaded in the table.
   */
  const handleExportDaybookPDF = async () => {
    if (isExportingDaybookPdf) return;
    setIsExportingDaybookPdf(true);
    try {
      const params = new URLSearchParams({ format: "json" });
      if (filters.fromDate) params.set("startDate", filters.fromDate);
      if (filters.toDate) params.set("endDate", filters.toDate);
      const res = await fetch(`/api/accounting/daybook?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || t("daybookFailed"));
      }
      const json = await res.json();
      const rows = Array.isArray(json.data) ? json.data : [];
      if (rows.length === 0) {
        toast.error(t("noData"));
        return;
      }

      const totalCollected = rows.reduce(
        (sum: number, row: any) => sum + Number(row.amountPaid || 0),
        0
      );
      const dateRange = `${filters.fromDate || "—"} → ${filters.toDate || "—"}`;

      const result = await exportFeeDaybookPDF({
        school: {
          name: settings.name || "Pathshala Pro School",
          address: settings.address || "",
          phone: settings.phone || "",
          email: settings.email || "",
          logoUrl: settings.logoUrl,
        },
        title: t("title"),
        subtitle: t("daybookExport"),
        generatedAt: new Date().toLocaleString(),
        dateRangeLabel: dateRange,
        filters: [
          {
            label: t("tableColumns.paymentMethod"),
            value: filters.paymentMethod === "ALL" ? t("allStatuses") : filters.paymentMethod,
          },
          { label: t("tableColumns.date"), value: dateRange },
        ],
        metrics: [
          { label: t("kpi.totalTransactions"), value: String(rows.length) },
          { label: t("kpi.totalAmount"), value: formatCurrency(totalCollected), tone: "success" },
        ],
        records: rows.map((row: any) => ({
          sno: row.sno,
          date: row.date,
          voucherNumber: row.voucherNumber,
          studentId: row.studentId,
          studentName: row.studentName,
          className: row.className,
          paymentMode: row.paymentMode,
          receiptNumber: row.receiptNumber,
          amountPaid: formatCurrency(row.amountPaid),
          journalEntryRef: row.journalEntryRef,
        })),
      });

      if (result.success) {
        toast.success(t("daybookPdfExported"));
        return;
      }
      toast.error(t("daybookFailed"));
    } catch (error: any) {
      toast.error(error?.message || t("daybookFailed"));
    } finally {
      setIsExportingDaybookPdf(false);
    }
  };

  const handleExportExcel = async () => {
    if (transactions.length === 0) {
      toast.error(t("noData"));
      return;
    }
    const columns: ExcelColumn[] = [
      { header: t("tableColumns.transactionId"), key: "transactionId" },
      { header: t("tableColumns.receiptNumber"), key: "receiptNumber" },
      { header: t("tableColumns.student"), key: "student" },
      { header: t("tableColumns.feeType"), key: "feeType" },
      { header: t("tableColumns.amount"), key: "amountPaid", style: "currency" },
      { header: t("tableColumns.paymentMethod"), key: "paymentMethod" },
      { header: t("tableColumns.collectedBy"), key: "collectedBy" },
      { header: t("tableColumns.date"), key: "date", style: "date" },
    ];
    const data = transactions.map((r: any) => {
      const s = r.feeVoucher?.studentProfile;
      return {
        transactionId: r.transactionId,
        receiptNumber: r.receiptNumber,
        student: s
          ? formatStudentName(s.firstName, s.lastName, s.firstNameBn, s.lastNameBn)
          : "",
        feeType: r.feeVoucher?.feeType || "",
        amountPaid: Number(r.amountPaid ?? 0),
        paymentMethod: r.paymentMethod,
        collectedBy: r.collectedBy?.name || "",
        date: r.timestamp ? new Date(r.timestamp) : "",
      };
    });
    const result = await exportData({ title: t("title"), columns, data });
    if (result.success) {
      toast.success(t("exportedExcel"));
    } else {
      toast.error(
        result.error instanceof Error ? result.error.message : String(result.error)
      );
    }
  };

  const paymentOptions = [
    { value: "ALL", label: t("allStatuses") || "All Methods" },
    { value: "CASH", label: t("paymentMethods.CASH") },
    { value: "DIGITAL", label: t("paymentMethods.DIGITAL") },
    { value: "BANK_TRANSFER", label: t("paymentMethods.BANK_TRANSFER") },
    { value: "CARD", label: t("paymentMethods.CARD") },
    { value: "CHEQUE", label: t("paymentMethods.CHEQUE") },
    { value: "EASYPAISA", label: t("paymentMethods.EASYPAISA") },
    { value: "JAZZCASH", label: t("paymentMethods.JAZZCASH") },
  ];

  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        key: "transactionId",
        header: t("tableColumns.transactionId"),
        cell: (row) => <span className="font-mono text-xs font-medium">{row.transactionId}</span>,
      },
      {
        key: "receiptNumber",
        header: t("tableColumns.receiptNumber"),
        cell: (row) => <span className="font-mono text-xs">{row.receiptNumber}</span>,
      },
      {
        key: "student",
        header: t("tableColumns.student"),
        cell: (row) => {
          const s = row.feeVoucher?.studentProfile;
          return s ? (
            <span className="text-sm">{formatStudentName(s.firstName, s.lastName, s.firstNameBn, s.lastNameBn)}</span>
          ) : (
            <span className="text-xs text-muted-foreground">{t("notAvailable")}</span>
          );
        },
      },
      {
        key: "feeType",
        header: t("tableColumns.feeType"),
        cell: (row) => <Badge variant="outline" className="text-xs">{row.feeVoucher?.feeType || t("notAvailable")}</Badge>,
      },
      {
        key: "amountPaid",
        header: t("tableColumns.amount"),
        cell: (row) => <span className="font-mono text-sm font-semibold">{formatCurrency(row.amountPaid)}</span>,
      },
      {
        key: "paymentMethod",
        header: t("tableColumns.paymentMethod"),
        cell: (row) => {
          const m = row.paymentMethod as string;
          const color =
            m === "CASH" ? "bg-emerald-500/10 text-emerald-700 border-emerald-200" :
            m === "DIGITAL" || m === "EASYPAISA" || m === "JAZZCASH" ? "bg-sky-500/10 text-sky-700 border-sky-200" :
            "bg-amber-500/10 text-amber-700 border-amber-200";
          return (
            <span className="inline-flex flex-col items-start gap-1">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${color}`}>{m.toLowerCase()}</span>
              {m === "CHEQUE" && row.chequeStatus && (
                <span className="inline-flex items-center rounded-full border border-border px-1.5 py-px text-[10px] font-semibold uppercase text-muted-foreground">
                  {row.chequeStatus === "PENDING" ? t("chequePending") : row.chequeStatus === "CLEARED" ? t("chequeCleared") : t("chequeBounced")}
                </span>
              )}
              {row.verifiedAt ? (
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-500/10 px-1.5 py-px text-[10px] font-semibold uppercase text-emerald-700">
                  {t("verified")}
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        key: "collectedBy",
        header: t("tableColumns.collectedBy"),
        cell: (row) => <span className="text-xs">{row.collectedBy?.name || t("notAvailable")}</span>,
      },
      {
        key: "timestamp",
        header: t("tableColumns.date"),
        cell: (row) => <span className="text-xs text-muted-foreground">{formatDate(row.timestamp)}</span>,
      },
      {
        key: "actions",
        header: t("tableColumns.actions"),
        cell: (row) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetail(row)}>
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {canManageFees ? (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(row.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            ) : null}
          </div>
        ),
        className: "w-[90px]",
      },
    ],
    [t, formatCurrency, formatDate, canManageFees]
  );

  const hasActiveFilters = filters.search || filters.paymentMethod !== "ALL" || filters.fromDate || filters.toDate;

  if (!isAuthLoading && !canReadFees) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} description={t("description")} icon={ArrowLeftRight} />
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">{tCommon("accessRestricted")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{tCommon("noPermission")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} icon={ArrowLeftRight}>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            {t("exportExcel")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportDaybook}
            disabled={isExportingDaybook}
            className="gap-1.5"
          >
            {isExportingDaybook ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5" />
            )}
            {isExportingDaybook ? t("daybookExporting") : t("daybookExport")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportDaybookPDF}
            disabled={isExportingDaybookPdf}
            className="gap-1.5"
          >
            {isExportingDaybookPdf ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            {isExportingDaybookPdf ? t("daybookExporting") : t("daybookPdfExport")}
          </Button>
        </div>
      </PageHeader>

      {/* KPI Grid — next-level financial overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ERPMetricCard title={t("kpi.totalTransactions") || "Total Transactions"} value={kpis.count} subtitle={t("kpi.totalTransactionsSubtitle") || "All time"} icon={Layers} />
        <ERPMetricCard title={t("kpi.totalAmount") || "Total Amount"} value={formatCurrency(kpis.totalAmount)} subtitle={t("kpi.totalAmountSubtitle") || "Filtered period"} icon={Wallet} />
        <ERPMetricCard title={t("kpi.cashTotal") || "Cash"} value={formatCurrency(kpis.cash)} subtitle="CASH" icon={Banknote} />
        <ERPMetricCard title={t("kpi.digitalTotal") || "Digital"} value={formatCurrency(kpis.digital)} subtitle="DIGITAL / Wallets" icon={Smartphone} />
      </div>

      {/* Filters — AppDropdown + date range per AGENTS #4, #8 */}
      <Card className="shadow-sm border-border/80">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={filters.search}
                onChange={(e) => setFilters({ search: e.target.value })}
                className="pl-9 bg-background"
              />
            </div>
            <AppDropdown
              options={paymentOptions}
              value={filters.paymentMethod}
              onChange={(v) => setFilters({ paymentMethod: v as any })}
              placeholder="Payment Method"
              searchable
              noOptionsText="No methods"
            />
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <TenantDateInput value={filters.fromDate} onChange={(v) => setFilters({ fromDate: v })} className="bg-background" />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <TenantDateInput value={filters.toDate} onChange={(v) => setFilters({ toDate: v })} className="bg-background" />
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                {tCommon("reset") || "Reset filters"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ERPDataTable
        data={transactions}
        columns={columns}
        keyExtractor={(r) => r.id}
        isLoading={isLoading || isFetching}
        page={page}
        pageSize={pageSize}
        totalCount={pagination?.totalCount ?? 0}
        pageSizeOptions={[10, 20, 50, 100]}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onRowClick={setDetail}
        searchValue={filters.search}
        onSearchChange={(v) => setFilters({ search: v })}
        searchPlaceholder={t("searchPlaceholder")}
        emptyState={
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">{t("noData") || "No transactions found"}</p>
          </div>
        }
      />

      {/* Detail Drawer — next-level inspection (TopSheet) */}
      <TopSheet
        isOpen={!!detail}
        onClose={() => { setDetail(null); setShowBounceBox(false); setBounceReason(""); }}
        title={detail ? `${detail.receiptNumber} — ${formatCurrency(detail.amountPaid)}` : ""}
        description={detail ? `${detail.paymentMethod} • ${formatDate(detail.timestamp)}` : ""}
        maxWidth="lg"
        footer={detail ? (
          <div className="flex items-center justify-end gap-2">
            {detail.paymentMethod === "CHEQUE" && detail.chequeStatus === "PENDING" && canManageFees && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isClearing}
                  onClick={async () => {
                    try {
                      const updated = await clearCheque({ id: detail.id, data: { status: "CLEARED" } });
                      setDetail((updated as any)?.data?.transaction ?? { ...detail, chequeStatus: "CLEARED", clearedAt: new Date().toISOString() });
                    } catch {}
                  }}
                  className="gap-1.5"
                >
                  {isClearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {t("clearCheque")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isClearing}
                  onClick={() => setShowBounceBox((v) => !v)}
                  className="gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t("bounceCheque")}
                </Button>
              </>
            )}
            {!detail.verifiedAt && ["DIGITAL", "ONLINE", "BANK", "BANK_TRANSFER", "POS_CARD", "CARD", "EASYPAISA", "JAZZCASH", "BKASH", "NAGAD", "UPI"].includes(detail.paymentMethod) && canManageFees && (
              <Button
                variant="outline"
                size="sm"
                disabled={isVerifying}
                onClick={async () => {
                  try {
                    const updated = await verifyReceipt({ id: detail.id });
                    setDetail((updated as any)?.data?.transaction ?? { ...detail, verifiedAt: new Date().toISOString() });
                  } catch {}
                }}
                className="gap-1.5"
              >
                {isVerifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                {t("verifyReceipt")}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => { setDetail(null); setShowBounceBox(false); setBounceReason(""); }}>
              {tCommon("close") || "Close"}
            </Button>
          </div>
        ) : undefined}
      >
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Transaction ID</p>
                <p className="font-mono font-medium">{detail.transactionId}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Receipt</p>
                <p className="font-mono font-medium">{detail.receiptNumber}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Student</p>
                <p className="font-medium">{detail.feeVoucher?.studentProfile ? formatStudentName(detail.feeVoucher.studentProfile.firstName, detail.feeVoucher.studentProfile.lastName) : t("notAvailable")}</p>
                <p className="text-xs text-muted-foreground">{detail.feeVoucher?.voucherId}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="font-mono text-lg font-bold">{formatCurrency(detail.amountPaid)}</p>
                <Badge variant="outline" className="mt-1 capitalize">{detail.paymentMethod.toLowerCase()}</Badge>
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-xs">
              <p className="font-semibold mb-1">Collected By</p>
              <p>{detail.collectedBy?.name} — {detail.collectedBy?.email}</p>
              <p className="text-muted-foreground">{formatDate(detail.timestamp)}</p>
              {detail.note && <p className="mt-2 italic">Note: {detail.note}</p>}
              {detail.chequeNumber && <p className="mt-1 font-mono">{t("chequeNumber")}: {detail.chequeNumber}</p>}
              {detail.reference && <p className="mt-1 font-mono">{t("reference")}: {detail.reference}</p>}
            </div>
            {showBounceBox && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                <p className="text-xs font-semibold text-destructive">{t("confirmBounce")}</p>
                <Input
                  placeholder={t("bounceReasonPlaceholder")}
                  value={bounceReason}
                  onChange={(e) => setBounceReason(e.target.value)}
                  className="h-8 text-xs bg-background"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isClearing}
                  onClick={async () => {
                    try {
                      await clearCheque({ id: detail.id, data: { status: "BOUNCED", reason: bounceReason || undefined } });
                      toast.success(t("chequeBouncedMsg"));
                      setDetail(null);
                    } catch {}
                    setShowBounceBox(false);
                    setBounceReason("");
                  }}
                  className="gap-1.5"
                >
                  {isClearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  {t("bounceCheque")}
                </Button>
              </div>
            )}
          </div>
        )}
      </TopSheet>
    </div>
  );
}
