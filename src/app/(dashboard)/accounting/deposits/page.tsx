"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ERPMetricCard } from "@/components/ui/erp-metric-card";
import { ERPDataTable, type ColumnDef } from "@/components/ui/erp-data-table";
import { ArrowRightLeft, Landmark, Plus } from "lucide-react";
import { useBankAccounts, useDeposits, useDepositSummary } from "@/hooks/use-queries";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { RecordDepositSheet } from "@/components/accounting/record-deposit-sheet";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";

function depositAmount(row: any): number {
  return Number(row.totalDebit ?? row.totalCredit ?? 0);
}

function depositRoute(row: any): { from: string; to: string } {
  const lines = Array.isArray(row.lineItems) ? row.lineItems : [];
  const debit = lines.find((l: any) => Number(l.debitAmount ?? 0) > 0);
  const credit = lines.find((l: any) => Number(l.creditAmount ?? 0) > 0);
  const to = debit?.account?.code ? `${debit.account.code}` : "";
  const from = credit?.account?.code ? `${credit.account.code}` : "";
  if (from || to) return { from, to };
  const m = typeof row.narration === "string" ? row.narration.match(/(\d{3,6})\s*→\s*(\d{3,6})/) : null;
  return { from: m?.[1] ?? "", to: m?.[2] ?? "" };
}

export default function DepositsPage() {
  const t = useTranslations();
  const { formatCurrency, formatDate } = useTenantFormatting();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canReadAccounting = hasPermission(perms, "accounting", "read");
  const canWriteAccounting = hasPermission(perms, "accounting", "write");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isDepositOpen, setIsDepositOpen] = useState(false);

  const { data: depositsResponse, isLoading } = useDeposits({ page, limit: pageSize });
  const deposits = (depositsResponse as any)?.data || [];
  const pagination = (depositsResponse as any)?.pagination;
  const totalCount = pagination?.totalCount ?? deposits.length;

  const { data: accountsResponse } = useBankAccounts();
  const accounts = (accountsResponse as any)?.data || [];

  const { data: summaryResponse } = useDepositSummary();
  const summary = (summaryResponse as any)?.data || {};
  const undeposited = Number(summary.undeposited ?? 0);

  const totalVolume = useMemo(
    () => deposits.reduce((acc: number, d: any) => acc + depositAmount(d), 0),
    [deposits]
  );

  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        key: "entryNumber",
        header: t("accounting.deposits.colVoucher"),
        cell: (row) => (
          <span className="font-mono text-xs font-bold text-primary">{row.entryNumber}</span>
        ),
      },
      {
        key: "route",
        header: t("accounting.deposits.colRoute"),
        cell: (row) => {
          const { from, to } = depositRoute(row);
          return (
            <span className="font-mono text-xs font-semibold text-foreground">
              {from || "—"}
              <ArrowRightLeft className="mx-1.5 inline h-3 w-3 text-muted-foreground" />
              {to || "—"}
            </span>
          );
        },
      },
      {
        key: "bankReference",
        header: t("accounting.deposits.colBankRef"),
        cell: (row) => (
          <span className="font-mono text-xs font-semibold text-foreground">
            {row.reference && row.reference !== row.entryNumber ? row.reference : "—"}
          </span>
        ),
      },
      {
        key: "narration",
        header: t("accounting.deposits.colNarration"),
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{row.narration || "—"}</p>
          </div>
        ),
      },
      {
        key: "postingDate",
        header: t("accounting.deposits.colDate"),
        cell: (row) => (
          <span className="text-xs text-muted-foreground">{formatDate(row.postingDate)}</span>
        ),
      },
      {
        key: "amount",
        header: t("accounting.deposits.colAmount"),
        className: "text-right",
        cell: (row) => (
          <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
            {formatCurrency(depositAmount(row))}
          </span>
        ),
      },
    ],
    [t, formatCurrency, formatDate]
  );

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title={t("accounting.deposits.title")}
        description={t("accounting.deposits.pageDescription")}
        icon={Landmark}
      >
        {canWriteAccounting && (
          <Button onClick={() => setIsDepositOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("accounting.deposits.recordDeposit")}
          </Button>
        )}
      </PageHeader>

      {!isAuthLoading && !canReadAccounting ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">{t("common.accessRestricted")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("common.noPermission")}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ERPMetricCard
              title={t("accounting.deposits.undepositedCash")}
              value={formatCurrency(undeposited)}
              unit={t("accounting.deposits.undepositedHint")}
              isLoading={isLoading}
            />
            <ERPMetricCard
              title={t("accounting.deposits.totalDeposited")}
              value={formatCurrency(totalVolume)}
              unit={t("accounting.deposits.pageCount", { count: totalCount })}
              isLoading={isLoading}
            />
            <ERPMetricCard
              title={t("accounting.deposits.depositCount")}
              value={String(totalCount)}
              unit={t("accounting.deposits.entriesUnit")}
              isLoading={isLoading}
            />
            <ERPMetricCard
              title={t("accounting.deposits.avgDeposit")}
              value={formatCurrency(deposits.length > 0 ? totalVolume / deposits.length : 0)}
              unit={t("accounting.deposits.perEntryUnit")}
              isLoading={isLoading}
            />
          </div>

          <ERPDataTable<any>
            title={t("accounting.deposits.tableTitle")}
            subtitle={t("accounting.deposits.showingRecords", { count: deposits.length })}
            data={deposits}
            columns={columns}
            keyExtractor={(row) => row.id}
            isLoading={isLoading}
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            pageSizeOptions={[10, 20, 50, 100]}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            actionLabel={canWriteAccounting ? t("accounting.deposits.recordDeposit") : undefined}
            onActionClick={canWriteAccounting ? () => setIsDepositOpen(true) : undefined}
            emptyState={
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-foreground">{t("accounting.deposits.emptyTitle")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("accounting.deposits.emptyHint")}</p>
                {canWriteAccounting && (
                  <Button onClick={() => setIsDepositOpen(true)} className="mt-4 gap-2" size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    {t("accounting.deposits.recordDeposit")}
                  </Button>
                )}
              </div>
            }
          />
        </>
      )}

      <RecordDepositSheet
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        accounts={accounts}
      />
    </div>
  );
}
