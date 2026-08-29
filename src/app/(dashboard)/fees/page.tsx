"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { ERPMetricCard } from "@/components/ui/erp-metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Receipt,
  Plus,
  Trash2,
  Printer,
  CreditCard,
  CheckCircle2,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Percent,
  Calendar,
  Wallet,
  Settings,
  HelpCircle,
  Users,
} from "lucide-react";
import { useFees, useDeleteFee, useAcademicYears } from "@/hooks/use-queries";
import { useQuery } from "@tanstack/react-query";
import {
  useClassFeeStructures,
  useStudentConcessions,
  useCreateClassFeeStructure,
  useUpdateClassFeeStructure,
} from "@/hooks/use-fee-structures";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatStudentName } from "@/lib/utils";
import { usePDFExport, type FeeVoucherPDFData } from "@/hooks/use-pdf-export";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";

export default function FeesPage() {
  const t = useTranslations("fees");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canReadFees = hasPermission(perms, "fees", "read");
  const canWriteFees = hasPermission(perms, "fees", "write");
  const canManageFees = hasPermission(perms, "fees", "manage");
  const [activeTab, setActiveTab] = useState("vouchers");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [showGuideBanner, setShowGuideBanner] = useState(true);

  const { formatCurrency, formatDate, currencySymbol } = useTenantFormatting();
  const { exportFeeVouchersPDF } = usePDFExport();

  // Queries
  const { data: feesResponse, isLoading: isLoadingFees } = useFees({
    page,
    limit: 20,
    search: search || undefined,
    ...(status && { filters: { status } }),
  });
  const rawFees = feesResponse?.data || [];
  const totalCount =
    (feesResponse as any)?.pagination?.total ||
    (feesResponse as any)?.meta?.total ||
    rawFees.length;

  const { data: ayResponse } = useAcademicYears();
  const academicYears = ayResponse?.data || [];
  const activeYearId = academicYears[0]?.id || "";

  const { data: structuresResponse, isLoading: isLoadingStructures } =
    useClassFeeStructures(activeYearId);
  const feeStructures = structuresResponse?.data || [];

  const { data: concessionsResponse, isLoading: isLoadingConcessions } =
    useStudentConcessions();
  const concessions = concessionsResponse?.data || [];

  const { data: classesResponse } = useQuery({
    queryKey: ["classes-fees-hub"],
    queryFn: async () => {
      const res = await fetch("/api/classes?limit=100", { credentials: "include" });
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });
  const classesList = (classesResponse as any)?.data || [];

  const deleteMutation = useDeleteFee();

  // KPI Calculations
  const totalInvoiced = rawFees.reduce((s: number, v: any) => s + (v.totalDue || 0), 0);
  const totalCollected = rawFees.reduce((s: number, v: any) => s + (v.amountPaid || 0), 0);
  const totalBalanceDue = rawFees.reduce((s: number, v: any) => s + (v.balance || 0), 0);
  const collectionRate =
    totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 100;

  const handleDelete = (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success(t("deleteSuccess")),
      onError: (err: any) => toast.error(err.message || t("deleteError")),
    });
  };

  const handlePrint3PartChallan = (voucher: any) => {
    const student = voucher.studentProfile;
    const pdfData: FeeVoucherPDFData = {
      schoolName: "Pathshala Pro Academy",
      currencySymbol: currencySymbol || "$",
      voucherId: voucher.voucherId || `VOUCH-${voucher.id.slice(0, 8)}`,
      issueDate: formatDate(voucher.createdAt || new Date()),
      dueDate: formatDate(voucher.dueDate || new Date()),
      studentName: student
        ? formatStudentName(
            student.firstName,
            student.lastName,
            student.firstNameBn,
            student.lastNameBn
          )
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
    toast.success(t("downloadChallan"));
  };

  // Columns for Vouchers Table
  const voucherColumns: ColumnDef<any>[] = [
    {
      accessorKey: "voucherId",
      header: t("voucherNumber"),
      cell: ({ getValue }) => (
        <span className="font-mono font-bold text-xs text-foreground">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "student",
      header: tCommon("students"),
      cell: ({ row }) => {
        const student = row.original.studentProfile;
        return student ? (
          <div>
            <p className="font-bold text-xs text-foreground">
              {formatStudentName(
                student.firstName,
                student.lastName,
                student.firstNameBn,
                student.lastNameBn
              )}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t("rollLabel")} {student.rollNumber || "—"} • {t("classLabel")} {student.class?.name || "—"}
            </p>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        );
      },
    },
    {
      accessorKey: "feeType",
      header: t("feeType"),
      cell: ({ getValue }) => (
        <Badge variant="secondary" className="text-[10px]">
          {getValue<string>() || t("tuition")}
        </Badge>
      ),
    },
    {
      accessorKey: "totalDue",
      header: t("totalDue"),
      cell: ({ getValue }) => (
        <span className="font-mono font-semibold text-xs text-foreground">
          {formatCurrency(getValue<number>())}
        </span>
      ),
    },
    {
      accessorKey: "amountPaid",
      header: t("paid"),
      cell: ({ getValue }) => (
        <span className="font-mono font-semibold text-xs text-emerald-600">
          {formatCurrency(getValue<number>())}
        </span>
      ),
    },
    {
      accessorKey: "balance",
      header: t("balance"),
      cell: ({ getValue }) => {
        const bal = getValue<number>();
        return (
          <span
            className={`font-mono font-bold text-xs ${
              bal > 0 ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {formatCurrency(bal)}
          </span>
        );
      },
    },
    {
      accessorKey: "dueDate",
      header: t("dueDate"),
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{formatDate(getValue<string>())}</span>
      ),
    },
    {
      accessorKey: "status",
      header: tCommon("status"),
      cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
    },
    {
      id: "actions",
      header: tCommon("actions"),
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePrint3PartChallan(item)}
              className="h-7 px-2 text-[11px] gap-1 border-primary/30 text-primary hover:bg-primary/10 dark:border-primary/50"
              title={t("printChallan")}
            >
              <Printer className="h-3 w-3" /> {t("challan")}
            </Button>
            {canManageFees && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(item.id)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                title={t("deleteVoucher")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* ─────────────────── Page Header with Direct Action ─────────────────── */}
      <PageHeader
        title={t("title")}
        description={t("description")}
      >
        <div className="flex flex-wrap items-center gap-2">
          {canWriteFees && (
            <Button
              size="sm"
              onClick={() => router.push("/fees/collection")}
              className="h-9 gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>{t("singlePosCounter")}</span>
            </Button>
          )}

          {canWriteFees && (
            <Button
              size="sm"
              onClick={() => router.push("/fees/bulk")}
              className="h-9 gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold"
            >
              <Users className="h-3.5 w-3.5" />
              <span>{t("bulkClassEntry")}</span>
            </Button>
          )}

          {canWriteFees && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/fees/structures")}
              className="h-9 gap-1.5 rounded-lg text-xs font-semibold border-border shadow-xs"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{t("tabRates")}</span>
            </Button>
          )}
        </div>
      </PageHeader>

      {!isAuthLoading && !canReadFees ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Access restricted</h2>
          <p className="mt-2 text-sm text-muted-foreground">You do not have permission to view fees.</p>
        </div>
      ) : (
        <>

      {/* ─────────────────── Friendly 2-Option Fee Collection Guide ─────────────────── */}
      {showGuideBanner && (
        <Card className="border-border bg-card">
          <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <Receipt className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  {t("guideWays")}
                  <Badge variant="outline" className="text-[10px] bg-background">{t("guideBadge")}</Badge>
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{t("guideSingle")}</span> •{" "}
                  <span className="font-semibold text-foreground">{t("guideBulk")}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGuideBanner(false)}
                className="h-7 text-[11px] text-muted-foreground"
              >
                {t("dismiss")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─────────────────── KPI Overview Metric Cards ─────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ERPMetricCard
          title={t("totalInvoiced")}
          value={formatCurrency(totalInvoiced)}
          isLoading={isLoadingFees}
          breakdowns={[
            { label: t("activeVouchers"), count: totalCount, percentage: 100, color: "indigo" },
          ]}
          actionLabel={tCommon("all")}
          onAction={() => setActiveTab("vouchers")}
        />

        <ERPMetricCard
          title={t("totalCollected")}
          value={formatCurrency(totalCollected)}
          isLoading={isLoadingFees}
          breakdowns={[
            {
              label: t("recoveryRate"),
              count: `${collectionRate}%`,
              percentage: collectionRate,
              color: "emerald",
            },
          ]}
          actionLabel={t("openPos")}
          onAction={() => router.push("/fees/collection")}
        />

        <ERPMetricCard
          title={t("outstandingDues")}
          value={formatCurrency(totalBalanceDue)}
          isLoading={isLoadingFees}
          breakdowns={[
            {
              label: t("pending"),
              count: `${100 - collectionRate}%`,
              percentage: 100 - collectionRate,
              color: "rose",
            },
          ]}
        />

        <ERPMetricCard
          title={t("configuredClasses")}
          value={feeStructures.length.toString()}
          unit={t("classes")}
          isLoading={isLoadingStructures}
          breakdowns={[
            {
              label: t("activeConcessions"),
              count: concessions.length,
              percentage: 100,
              color: "cyan",
            },
          ]}
          actionLabel={t("configureStructures")}
          onAction={() => router.push("/fees/structures")}
        />
      </div>

      {/* ─────────────────── Main Tabbed Interface ─────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="vouchers" className="text-xs font-semibold rounded-lg gap-1.5">
            <Receipt className="h-3.5 w-3.5" /> {t("tabVouchers")} ({totalCount})
          </TabsTrigger>
          <TabsTrigger value="rates" className="text-xs font-semibold rounded-lg gap-1.5">
            <Layers className="h-3.5 w-3.5" /> {t("tabRates")} ({feeStructures.length})
          </TabsTrigger>
          <TabsTrigger value="concessions" className="text-xs font-semibold rounded-lg gap-1.5">
            <Percent className="h-3.5 w-3.5" /> {t("tabConcessions")} ({concessions.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Vouchers Table */}
        <TabsContent value="vouchers" className="space-y-4">
          <Card className="border-border">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                  <Input
                    placeholder={t("searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-9 px-3 text-xs rounded-md border border-input bg-background"
                  >
                    <option value="">{t("allStatuses")}</option>
                    <option value="PENDING">{t("pending")}</option>
                    <option value="PARTIAL">{t("partial")}</option>
                    <option value="PAID">{t("paid")}</option>
                    <option value="OVERDUE">{t("overdue")}</option>
                  </select>

                  {canWriteFees && (
                    <Button
                      size="sm"
                      onClick={() => router.push("/fees/bulk")}
                      className="h-9 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                    >
                      <Users className="h-3.5 w-3.5" /> {t("bulkClassEntry")}
                    </Button>
                  )}
                </div>
              </div>

              <DataTable
                columns={voucherColumns}
                data={rawFees}
                isLoading={isLoadingFees}
                pagination={(feesResponse as any)?.pagination}
                onPageChange={setPage}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Class Fee Rates */}
        <TabsContent value="rates" className="space-y-4">
          <Card className="border-border">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div>
                  <h3 className="text-sm font-bold text-foreground">{t("tuitionSchedule")}</h3>
                  <p className="text-xs text-muted-foreground">{t("tuitionScheduleDesc")}</p>
                </div>
                {canWriteFees && (
                  <Button
                    size="sm"
                    onClick={() => router.push("/fees/structures")}
                    className="text-xs gap-1.5"
                  >
                    <Settings className="h-3.5 w-3.5" /> {t("configureStructures")}
                  </Button>
                )}
              </div>

              {isLoadingStructures ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  {tCommon("loading")}
                </p>
              ) : feeStructures.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <Layers className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-xs font-semibold text-foreground">
                    {t("noSchedules")}
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                    {t("noSchedulesDesc")}
                  </p>
                  {canWriteFees && (
                    <Button
                      size="sm"
                      onClick={() => router.push("/fees/structures")}
                      className="mt-2 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      Set Class Rates Now
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {feeStructures.map((st: any) => (
                    <Card
                      key={st.id}
                      className="border-border hover:border-primary/50 transition-colors"
                    >
                      <CardContent className="p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-foreground">
                            {st.class?.name || t("classLabel")}
                          </span>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {st.billingCycle || "MONTHLY"}
                          </Badge>
                        </div>
                        <div className="pt-1 border-t border-border flex items-baseline justify-between">
                          <span className="text-xs text-muted-foreground">{t("tuitionFee")}</span>
                          <span className="font-bold font-mono text-emerald-600 text-sm">
                            {formatCurrency(st.tuitionFee)}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                          <span>{t("totalMonthly")}</span>
                          <span className="font-bold font-mono text-foreground text-xs">
                            {formatCurrency(st.totalMonthlyFee || st.tuitionFee)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Student Concessions */}
        <TabsContent value="concessions" className="space-y-4">
          <Card className="border-border">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div>
                  <h3 className="text-sm font-bold text-foreground">{t("activeConcessions")}</h3>
                  <p className="text-xs text-muted-foreground">{t("activeConcessionsDesc")}</p>
                </div>
                {canWriteFees && (
                  <Button
                    size="sm"
                    onClick={() => router.push("/fees/structures")}
                    className="text-xs gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t("manageConcessionsBtn")}
                  </Button>
                )}
              </div>

              {isLoadingConcessions ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  {tCommon("loading")}
                </p>
              ) : concessions.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-8">
                  {t("noConcessions")}
                </p>
              ) : (
                <div className="divide-y divide-border/50 text-xs">
                  {concessions.map((c: any) => (
                    <div key={c.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-foreground">
                          {c.studentProfile?.firstName} {c.studentProfile?.lastName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {t("classLabel")} {c.studentProfile?.class?.name || "—"} • {t("typeLabel")} {c.concessionType}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="font-mono text-xs text-emerald-600 border-emerald-300"
                      >
                        {c.discountType === "PERCENTAGE"
                          ? `${c.discountValue}% ${t("off")}`
                          : `-${formatCurrency(c.discountValue)}`}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </>
      )}
    </div>
  );
}
