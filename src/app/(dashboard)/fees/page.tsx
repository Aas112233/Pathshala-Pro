"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppDropdown } from "@/components/ui/app-dropdown";
import {
  Receipt,
  Plus,
  Pencil,
  Trash2,
  Printer,
  CreditCard,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { useFees, useDeleteFee } from "@/hooks/use-queries";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatStudentName } from "@/lib/utils";
import { BatchInvoiceModal } from "@/components/fees/batch-invoice-modal";
import { usePDFExport, type FeeVoucherPDFData } from "@/hooks/use-pdf-export";

export default function FeesPage() {
  const t = useTranslations("fees");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const { formatCurrency, formatDate } = useTenantFormatting();
  const { exportFeeVouchersPDF } = usePDFExport();

  const { data, isLoading } = useFees({
    page,
    limit: 20,
    search: search || undefined,
    ...(status && { filters: { status } }),
  });

  const deleteMutation = useDeleteFee();

  const handleDelete = (id: string) => {
    if (!confirm(t("confirmDelete"))) return;

    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success(t("deleteSuccess"));
      },
      onError: (err) => {
        toast.error(err.message || t("deleteError"));
      },
    });
  };

  const handlePrint3PartChallan = (voucher: any) => {
    const student = voucher.studentProfile;
    const pdfData: FeeVoucherPDFData = {
      schoolName: "Pathshala Pro Academy",
      currencySymbol: "$",
      voucherId: voucher.voucherId || `VOUCH-${voucher.id.slice(0, 8)}`,
      issueDate: formatDate(voucher.createdAt || new Date()),
      dueDate: formatDate(voucher.dueDate || new Date()),
      studentName: student
        ? formatStudentName(student.firstName, student.lastName, student.firstNameBn, student.lastNameBn)
        : "Student",
      studentId: student?.studentId || student?.id || "N/A",
      rollNumber: student?.rollNumber || "01",
      className: student?.class?.name || "General",
      sectionName: student?.section?.name,
      feeType: voucher.feeType || "Tuition",
      academicYear: voucher.academicYear?.label || "2026-2027",
      baseAmount: voucher.baseAmount || voucher.totalDue || 0,
      discountAmount: voucher.discountAmount || 0,
      arrears: voucher.arrears || 0,
      totalDue: voucher.totalDue || voucher.balance || 0,
    };

    exportFeeVouchersPDF([pdfData], `Challan_${pdfData.voucherId}.pdf`);
    toast.success("Downloading 3-Part Bank Challan PDF...");
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "voucherId",
      header: t("tableColumns.voucherId"),
      cell: ({ getValue }) => (
        <span className="font-mono font-bold text-xs">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "student",
      header: t("tableColumns.student"),
      cell: ({ row }) => {
        const student = row.original.studentProfile;
        return student ? (
          <span className="font-medium text-xs">
            {formatStudentName(
              student.firstName,
              student.lastName,
              student.firstNameBn,
              student.lastNameBn
            )}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        );
      },
    },
    {
      accessorKey: "academicYear",
      header: t("tableColumns.academicYear"),
      cell: ({ row }) => {
        const year = row.original.academicYear;
        return <span className="text-xs">{year?.label || "—"}</span>;
      },
    },
    {
      accessorKey: "feeType",
      header: t("tableColumns.feeType"),
      cell: ({ getValue }) => (
        <span className="text-xs font-semibold">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "totalDue",
      header: t("tableColumns.totalDue"),
      cell: ({ getValue }) => (
        <span className="font-mono font-semibold text-xs">{formatCurrency(getValue<number>())}</span>
      ),
    },
    {
      accessorKey: "amountPaid",
      header: t("tableColumns.paid"),
      cell: ({ getValue }) => (
        <span className="font-mono text-emerald-600 text-xs">{formatCurrency(getValue<number>())}</span>
      ),
    },
    {
      accessorKey: "balance",
      header: t("tableColumns.balance"),
      cell: ({ row }) => {
        const balance = row.original.balance;
        return (
          <span
            className={`font-mono font-bold text-xs ${
              balance > 0 ? "text-destructive" : "text-emerald-600"
            }`}
          >
            {formatCurrency(balance)}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: t("tableColumns.status"),
      cell: ({ getValue }) => <StatusBadge status={getValue<string>()} domain="fee" />,
    },
    {
      accessorKey: "dueDate",
      header: t("tableColumns.dueDate"),
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{formatDate(getValue<string>())}</span>
      ),
    },
    {
      id: "actions",
      header: t("tableColumns.actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950"
            onClick={() => handlePrint3PartChallan(row.original)}
            title="Download 3-Part Bank Deposit Challan (PDF)"
          >
            <Printer className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:bg-destructive/10"
            onClick={() => handleDelete(row.original.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const pagination =
    "pagination" in (data || {}) ? (data as any).pagination : undefined;

  const rawFees = ("data" in (data || {}) ? (data as any).data : []) as any[];
  const totalInvoiced = rawFees.reduce((s, v) => s + (v.totalDue || 0), 0);
  const totalPaid = rawFees.reduce((s, v) => s + (v.amountPaid || 0), 0);
  const totalOutstanding = rawFees.reduce((s, v) => s + (v.balance || 0), 0);

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={Receipt}
      >
        <div className="flex items-center gap-2.5">
          <Link href="/fees/collection">
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs">
              <CreditCard className="h-4 w-4" />
              Fee Collection POS
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => setIsBatchModalOpen(true)}
            className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
          >
            <Receipt className="h-4 w-4" />
            Batch Invoicing
          </Button>
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            {t("createVoucher")}
          </Button>
        </div>
      </PageHeader>

      {/* KPI Metric Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-xs border-border">
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-foreground">
                {formatCurrency(totalInvoiced)}
              </p>
              <p className="text-xs text-muted-foreground font-medium">Total Invoiced</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border">
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-emerald-600">
                {formatCurrency(totalPaid)}
              </p>
              <p className="text-xs text-muted-foreground font-medium">Total Collected</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border">
          <CardContent className="pt-5 pb-5 flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 rounded-xl">
              <Clock className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-rose-600">
                {formatCurrency(totalOutstanding)}
              </p>
              <p className="text-xs text-muted-foreground font-medium">Outstanding Arrears</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-card shadow-xs">
        <div className="w-56">
          <AppDropdown
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { value: "", label: "All Voucher Statuses" },
              { value: "PENDING", label: "Pending Payment" },
              { value: "PARTIAL", label: "Partially Paid" },
              { value: "PAID", label: "Fully Settled" },
              { value: "OVERDUE", label: "Overdue Dues" },
            ]}
            placeholder="Filter by status..."
          />
        </div>

        {status && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus("");
              setPage(1);
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear Status Filter
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={rawFees}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={setSearch}
        isLoading={isLoading}
        searchPlaceholder={t("searchPlaceholder")}
      />

      <BatchInvoiceModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        onSuccess={() => {
          // Re-fetch fees data
        }}
      />
    </div>
  );
}
