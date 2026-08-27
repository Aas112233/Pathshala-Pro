"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, CreditCard, Wallet, Landmark, ArrowUpRight } from "lucide-react";
import { useBankAccounts } from "@/hooks/use-queries";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { AddAccountModal } from "@/components/accounting/add-account-modal";
import { useTranslations } from "next-intl";

export default function AccountsPage() {
  const t = useTranslations();
  const { formatCurrency } = useTenantFormatting();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { data: accountsResponse, isLoading } = useBankAccounts();
  const accounts = (accountsResponse as any)?.data || [];

  const totalLiquidity = accounts.reduce((acc: number, a: any) => acc + (a.currentBalance || 0), 0);

  const accountTypeLabel = (type: string) => {
    switch (type) {
      case "CHECKING":
        return t("accounting.accounts.accountTypeChecking");
      case "SAVINGS":
        return t("accounting.accounts.accountTypeSavings");
      case "PETTY_CASH":
        return t("accounting.accounts.accountTypePettyCash");
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title={t("accounting.accounts.title")}
        description={t("accounting.accounts.description")}
        icon={Landmark}
      >
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          {t("accounting.accounts.addAccount")}
        </Button>
      </PageHeader>

      {/* Summary Card */}
      <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-indigo-300 font-semibold">
              {t("accounting.accounts.totalLiquidBalance")}
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight">
              {formatCurrency(totalLiquidity)}
            </h2>
            <p className="text-xs text-indigo-200/80">
              {t("accounting.accounts.acrossAccounts", { count: accounts.length })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="border-indigo-400/30 text-white hover:bg-white/10 text-xs gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> {t("accounting.accounts.linkNewAccount")}
            </Button>
          </div>
        </div>
      </div>

      {/* Accounts Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-40 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="border border-dashed border-border py-12 text-center">
          <CardContent className="space-y-3">
            <Landmark className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">{t("accounting.accounts.noAccountsTitle")}</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {t("accounting.accounts.noAccountsDescription")}
              </p>
            </div>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> {t("accounting.accounts.addFirstAccount")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc: any) => (
            <Card key={acc.id} className="border border-border/80 shadow-xs hover:border-primary/50 transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                      {acc.accountType === "PETTY_CASH" ? (
                        <Wallet className="h-4 w-4" />
                      ) : (
                        <Building2 className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-foreground">
                        {acc.accountName}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">{acc.bankName}</p>
                    </div>
                  </div>

                  <Badge variant="outline" className="text-[10px] font-mono">
                    {accountTypeLabel(acc.accountType)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="p-3 bg-muted/30 rounded-xl border border-border/40 space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                    {t("accounting.accounts.accountIban")}
                  </span>
                  <p className="font-mono text-xs font-semibold text-foreground truncate">
                    {acc.accountNumber}
                  </p>
                  {acc.branchName && (
                    <p className="text-[11px] text-muted-foreground">{acc.branchName}</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">{t("accounting.accounts.currentBalance")}</span>
                  <span className="text-base font-extrabold text-foreground">
                    {formatCurrency(acc.currentBalance)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddAccountModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}
