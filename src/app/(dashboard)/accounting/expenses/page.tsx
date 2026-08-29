"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ERPMetricCard } from "@/components/ui/erp-metric-card";
import { ERPDataTable, ERPStatusPill, type ColumnDef } from "@/components/ui/erp-data-table";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Wallet,
  Plus,
  Trash2,
  Receipt,
  Calendar,
  Building2,
  TrendingDown,
  Filter,
  DollarSign,
} from "lucide-react";
import { useExpenses, useExpenseCategories, useDeleteExpense } from "@/hooks/use-queries";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { AddExpenseModal } from "@/components/accounting/add-expense-modal";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";

export default function ExpensesPage() {
  const t = useTranslations();
  const { formatCurrency, formatDate, currencySymbol } = useTenantFormatting();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canReadAccounting = hasPermission(perms, "accounting", "read");
  const canWriteAccounting = hasPermission(perms, "accounting", "write");
  const canManageAccounting = hasPermission(perms, "accounting", "manage");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<(string | number)[]>([]);

  const { data: expensesResponse, isLoading } = useExpenses({
    page,
    limit: 20,
    search: search || undefined,
    ...(selectedCategory && { categoryId: selectedCategory }),
    ...(selectedPaymentMethod && { paymentMethod: selectedPaymentMethod }),
  });

  const { data: categoriesResponse } = useExpenseCategories();
  const categories = (categoriesResponse as any)?.data || [];

  const deleteExpenseMutation = useDeleteExpense();

  const expensesData = (expensesResponse as any)?.data || [];
  const pagination = (expensesResponse as any)?.pagination;

  // Calculate sum of loaded expenses
  const totalVolume = expensesData.reduce((acc: number, exp: any) => acc + (exp.amount || 0), 0);

  const handleDelete = (id: string, expenseNumber: string) => {
    if (!confirm(t("accounting.expenses.deleteConfirm", { expenseNumber }))) return;

    deleteExpenseMutation.mutate(id, {
      onSuccess: () => toast.success(t("accounting.expenses.deleted", { expenseNumber })),
      onError: (err: any) => toast.error(err.message || t("accounting.expenses.deleteFailed")),
    });
  };

  const columns: ColumnDef<any>[] = [
    {
      key: "expenseNumber",
      header: t("accounting.expenses.colVoucher"),
      cell: (row) => (
        <span className="font-mono text-xs font-bold text-primary">
          {row.expenseNumber}
        </span>
      ),
    },
    {
      key: "title",
      header: t("accounting.expenses.colTitlePayee"),
      cell: (row) => (
        <div>
          <p className="text-xs font-semibold text-foreground">{row.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {row.payeeName
              ? t("accounting.expenses.payee", { name: row.payeeName })
              : t("accounting.expenses.directExpense")}{" "}
            {row.receiptNumber ? t("accounting.expenses.billNo", { receiptNumber: row.receiptNumber }) : ""}
          </p>
        </div>
      ),
    },
    {
      key: "category",
      header: t("accounting.expenses.colCategory"),
      cell: (row) => (
        <Badge variant="outline" className="text-[11px] bg-muted/40 font-medium">
          {row.category?.name || t("accounting.expenses.generalCategory")}
        </Badge>
      ),
    },
    {
      key: "amount",
      header: t("accounting.expenses.colAmount"),
      cell: (row) => (
        <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      key: "paymentMethod",
      header: t("accounting.expenses.colMethod"),
      cell: (row) => (
        <ERPStatusPill
          status={row.paymentMethod}
          variant={row.paymentMethod === "BANK" ? "subtle" : "amber"}
        />
      ),
    },
    {
      key: "expenseDate",
      header: t("accounting.expenses.colDate"),
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.expenseDate)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => (
        canManageAccounting ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(row.id, row.expenseNumber)}
            className="h-7 w-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title={t("accounting.expenses.title")}
        description={t("accounting.expenses.description")}
        icon={Wallet}
      >
        <div className="flex items-center gap-2.5">
          {canWriteAccounting && (
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              <Plus className="h-4 w-4" />
              {t("accounting.expenses.recordExpense")}
            </Button>
          )}
        </div>
      </PageHeader>

      {!isAuthLoading && !canReadAccounting ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Access restricted</h2>
          <p className="mt-2 text-sm text-muted-foreground">You do not have permission to view accounting.</p>
        </div>
      ) : (
        <>

      {/* KPI Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ERPMetricCard
          title={t("accounting.expenses.totalExpenses")}
          value={formatCurrency(totalVolume)}
          unit={t("accounting.expenses.vouchersCount", { count: pagination?.totalCount || 0 })}
          isLoading={isLoading}
        />

        <ERPMetricCard
          title={t("accounting.expenses.activeCategories")}
          value={categories.length.toString()}
          unit="Categories"
          isLoading={isLoading}
        />

        <ERPMetricCard
          title={t("accounting.expenses.avgVoucherSize")}
          value={
            expensesData.length > 0
              ? formatCurrency(totalVolume / expensesData.length)
              : `${currencySymbol} 0`
          }
          unit="Avg / Voucher"
          isLoading={isLoading}
        />

        <ERPMetricCard
          title={t("accounting.expenses.cashVsBank")}
          value={t("accounting.expenses.reconciled")}
          isLoading={isLoading}
        />
      </div>

      {/* Filters Bar */}
      <Card className="border border-border/70 shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <Input
                placeholder={t("accounting.expenses.filterPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-9 px-3 rounded-md border border-input bg-background text-xs"
              >
                <option value="">{t("accounting.expenses.allCategories")}</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                className="h-9 px-3 rounded-md border border-input bg-background text-xs"
              >
                <option value="">{t("accounting.expenses.allMethods")}</option>
                <option value="CASH">{t("accounting.expenses.methodCash")}</option>
                <option value="BANK">{t("accounting.expenses.methodBank")}</option>
                <option value="CHEQUE">{t("accounting.expenses.methodCheque")}</option>
                <option value="DIGITAL">{t("accounting.expenses.methodDigital")}</option>
              </select>

              {(search || selectedCategory || selectedPaymentMethod) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("");
                    setSelectedPaymentMethod("");
                  }}
                  className="h-9 text-xs"
                >
                  {t("accounting.expenses.clearFilters")}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DataTable */}
      <ERPDataTable<any>
        title={t("accounting.expenses.tableTitle")}
        subtitle={t("accounting.expenses.showingRecords", { count: expensesData.length })}
        data={expensesData}
        columns={columns}
        keyExtractor={(row) => row.id}
        searchPlaceholder={t("accounting.expenses.filterPlaceholder")}
        selectedIds={selectedExpenseIds}
        onSelectionChange={setSelectedExpenseIds}
        actionLabel={canWriteAccounting ? t("accounting.expenses.recordExpense") : undefined}
        onActionClick={canWriteAccounting ? () => setIsAddModalOpen(true) : undefined}
      />
        </>
      )}

      <AddExpenseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}
