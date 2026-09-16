"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Users,
  Wallet,
  FileSpreadsheet,
  FileText,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useProfitLoss } from "@/hooks/use-queries";
import { useTenantFormatting, useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";
import { usePDFExport } from "@/hooks/use-pdf-export";
import { useExcelExport } from "@/hooks/use-excel-export";
import {
  buildProfitLossStatement,
  assertProfitLossReconciles,
  type ProfitLossExportInput,
} from "@/lib/profit-loss-export";
import { toast } from "sonner";

export default function ProfitLossPage() {
  const t = useTranslations("accounting.profitLoss");
  const common = useTranslations("common");
  const { formatCurrency, currencySymbol } = useTenantFormatting();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canReadAccounting = hasPermission(perms, "accounting", "read");
  const canWriteAccounting = hasPermission(perms, "accounting", "write");
  const canManageAccounting = hasPermission(perms, "accounting", "manage");
  const { settings } = useTenantSettings();
  const { exportProfitLossPDF } = usePDFExport();
  const { exportData } = useExcelExport({
    fileName: "profit_loss_statement",
    schoolName: settings.name || "Pathshala Pro School",
    schoolAddress: settings.address,
    schoolPhone: settings.phone,
    schoolEmail: settings.email,
  });
  const currentYear = new Date().getFullYear();
  const fiscalYears = Array.from({ length: 5 }, (_, index) => currentYear - 2 + index);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const { data: profitLossResponse, isLoading } = useProfitLoss(selectedYear);
  const pnl = (profitLossResponse as any)?.data;

  const summary = pnl?.summary || {
    totalIncome: 0,
    totalExpenses: 0,
    payrollExpenses: 0,
    operationalExpenses: 0,
    netSurplus: 0,
    profitMargin: 0,
    isProfit: true,
  };

  const incomeBreakdown = pnl?.incomeBreakdown || [];
  const expenseBreakdown = pnl?.expenseBreakdown || [];
  const monthlyTrends = pnl?.monthlyTrends || [];

  const school = {
    name: settings.name || "Pathshala Pro School",
    address: settings.address || "",
    phone: settings.phone || "",
    email: settings.email || "",
    logoUrl: settings.logoUrl,
  };

  const buildStatement = () => {
    const input: ProfitLossExportInput = {
      summary: {
        totalIncome: summary.totalIncome,
        totalExpenses: summary.totalExpenses,
        payrollExpenses: summary.payrollExpenses,
        operationalExpenses: summary.operationalExpenses,
        netSurplus: summary.netSurplus,
        profitMargin: summary.profitMargin,
      },
      incomeBreakdown,
      expenseBreakdown,
      labels: {
        revenue: t("export.revenue"),
        expenses: t("export.expenses"),
        payroll: t("export.payroll"),
        totalRevenue: t("export.totalRevenue"),
        totalExpenses: t("export.totalExpenses"),
        netSurplus: t("export.netSurplus"),
        netDeficit: t("export.netDeficit"),
        section: t("export.section"),
        lineItem: t("export.lineItem"),
        amount: t("export.amount"),
        share: t("export.share"),
      },
    };
    assertProfitLossReconciles(input);
    return buildProfitLossStatement(input);
  };

  const handleExportPDF = async () => {
    try {
      const rows = buildStatement();
      const result = await exportProfitLossPDF({
        school,
        title: t("title"),
        subtitle: t("description"),
        generatedAt: new Date().toLocaleString(),
        dateRangeLabel: t("fiscalYear", { year: selectedYear }),
        filters: [{ label: t("fiscalYear", { year: selectedYear }), value: String(selectedYear) }],
        metrics: [
          { label: t("revenue"), value: formatCurrency(summary.totalIncome), tone: "success" },
          { label: t("salaries"), value: formatCurrency(summary.payrollExpenses), tone: "default" },
          { label: t("operations"), value: formatCurrency(summary.operationalExpenses), tone: "warning" },
          {
            label: t("netSurplus"),
            value: formatCurrency(summary.netSurplus),
            tone: summary.isProfit ? "success" : "danger",
          },
        ],
        columns: {
          section: t("export.section"),
          lineItem: t("export.lineItem"),
          amount: t("export.amount"),
          share: t("export.share"),
        },
        rows,
      });
      if (result.success) {
        toast.success(t("export.pdfExported"));
        return;
      }
      toast.error(t("export.exportFailed"));
    } catch (error: any) {
      toast.error(error?.message || t("export.exportFailed"));
    }
  };

  const handleExportExcel = async () => {
    try {
      const rows = buildStatement();
      const result = await exportData({
        title: t("title"),
        subtitle: t("description"),
        columns: [
          { header: t("export.section"), key: "section", width: 18 },
          { header: t("export.lineItem"), key: "lineItem", width: 34 },
          { header: t("export.amount"), key: "amount", width: 16, alignment: "right", style: "currency" },
          { header: t("export.share"), key: "share", width: 12, alignment: "right" },
        ],
        data: rows,
      });
      if (result.success) {
        toast.success(t("export.excelExported"));
        return;
      }
      toast.error(t("export.exportFailed"));
    } catch (error: any) {
      toast.error(error?.message || t("export.exportFailed"));
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={BarChart3}
      >
        <div className="flex items-center gap-2.5">
          <AppDropdown
            value={String(selectedYear)}
            onChange={(v) => setSelectedYear(parseInt(v, 10))}
            options={fiscalYears.map((y) => ({
              value: String(y),
              label: t("fiscalYear", { year: y })
            }))}
            className="w-44"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="text-xs gap-1.5 h-9"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> {t("export.excel")}
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleExportPDF}
            className="text-xs gap-1.5 h-9"
          >
            <FileText className="h-3.5 w-3.5" /> {t("export.pdf")}
          </Button>
        </div>
      </PageHeader>

      {!isAuthLoading && !canReadAccounting ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">{common("accessRestricted")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{common("noPermission")}</p>
        </div>
      ) : (
        <>

      {/* Executive Financial Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Gross Revenue */}
        <Card className="border border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("revenue")}
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <h3 className="text-2xl font-extrabold text-foreground">
              {formatCurrency(summary.totalIncome)}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {t("revenueCaption")}
            </p>
          </CardContent>
        </Card>

        {/* Staff Payroll Paid */}
        <Card className="border border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("salaries")}
              </span>
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <h3 className="text-2xl font-extrabold text-foreground">
              {formatCurrency(summary.payrollExpenses)}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {t("salariesCaption")}
            </p>
          </CardContent>
        </Card>

        {/* Campus Operational Expenses */}
        <Card className="border border-border/70 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("operations")}
              </span>
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <h3 className="text-2xl font-extrabold text-foreground">
              {formatCurrency(summary.operationalExpenses)}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {t("operationsCaption")}
            </p>
          </CardContent>
        </Card>

        {/* Net Operating Surplus */}
        <Card
          className={`border shadow-xs ${
            summary.isProfit
              ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20"
              : "border-rose-200 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/20"
          }`}
        >
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("netSurplus")}
              </span>
              <div
                className={`p-1.5 rounded-lg ${
                  summary.isProfit
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300"
                }`}
              >
                {summary.isProfit ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <h3
              className={`text-2xl font-extrabold ${
                summary.isProfit ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
              }`}
            >
              {formatCurrency(summary.netSurplus)}
            </h3>
            <p className="text-[11px] font-semibold text-muted-foreground">
              {t("operatingMargin", { margin: summary.profitMargin })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Grids */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Income Breakdown */}
        <Card className="border border-border/70 shadow-xs">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-bold text-foreground">
              {t("revenueBreakdown")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {incomeBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                {t("noRevenueData")}
              </p>
            ) : (
              incomeBreakdown.map((item: any, idx: number) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-foreground">{t("feeType", { type: item.type })}</span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(item.amount)} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                    <div
                      style={{ width: `${item.percentage}%` }}
                      className="h-full bg-emerald-500 rounded-full"
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card className="border border-border/70 shadow-xs">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-bold text-foreground">
              {t("expenditureBreakdown")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {expenseBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                {t("noExpenseData")}
              </p>
            ) : (
              expenseBreakdown.map((item: any, idx: number) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-foreground">{item.category}</span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(item.amount)} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                    <div
                      style={{ width: `${item.percentage}%` }}
                      className="h-full bg-indigo-500 rounded-full"
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* 12-Month Financial Statement Ledger */}
      <Card className="border border-border/70 shadow-xs">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-foreground">
              {t("ledgerTitle", { year: selectedYear })}
            </CardTitle>
            <Badge variant="outline" className="text-xs font-mono">
              {t("monthlyAuditView")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="py-2.5 px-4 text-left">{t("thMonth")}</th>
                  <th className="py-2.5 px-4 text-right">{t("thRevenue", { symbol: currencySymbol })}</th>
                  <th className="py-2.5 px-4 text-right">{t("thSalaries", { symbol: currencySymbol })}</th>
                  <th className="py-2.5 px-4 text-right">{t("thOperations", { symbol: currencySymbol })}</th>
                  <th className="py-2.5 px-4 text-right">{t("thTotalExpenses", { symbol: currencySymbol })}</th>
                  <th className="py-2.5 px-4 text-right">{t("thNetSurplus", { symbol: currencySymbol })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 font-mono">
                {monthlyTrends.map((row: any, idx: number) => {
                  const isPositive = row.netSurplus >= 0;
                  return (
                    <tr key={idx} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-4 font-sans font-semibold text-foreground">
                        {row.month}
                      </td>
                      <td className="py-2.5 px-4 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                        {row.income > 0 ? formatCurrency(row.income) : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground">
                        {row.payroll > 0 ? formatCurrency(row.payroll) : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground">
                        {row.operational > 0 ? formatCurrency(row.operational) : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right text-rose-600 dark:text-rose-400 font-semibold">
                        {row.expenses > 0 ? formatCurrency(row.expenses) : "—"}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-bold ${
                          isPositive
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-rose-700 dark:text-rose-400"
                        }`}
                      >
                        {formatCurrency(row.netSurplus)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
        </>
      )}
    </div>
  );
}
