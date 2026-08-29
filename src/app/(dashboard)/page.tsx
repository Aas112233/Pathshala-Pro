"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import {
  useStudents,
  useStaff,
  useFees,
  useTransactions,
  useAttendance,
  useAcademicYears,
} from "@/hooks/use-queries";
import { hasPermission } from "@/lib/permissions";
import {
  GraduationCap,
  Users,
  Receipt,
  Plus,
  Calendar,
  Download,
  CreditCard,
  CheckCircle2,
  ChevronRight,
  Layers,
  ArrowRight,
  Megaphone,
  Pin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ERPMetricCard } from "@/components/ui/erp-metric-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ERPDataTable,
  ERPUserCell,
  ERPStatusPill,
  type ColumnDef,
} from "@/components/ui/erp-data-table";
import { TopSheet } from "@/components/ui/top-sheet";
import { NoticeDetailModal } from "@/components/notices/notice-detail-modal";

export default function DashboardPage() {
  const t = useTranslations();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const {
    formatDate,
    formatCurrency,
    formatCompactCurrency,
    formatAcademicPeriod,
    currencySymbol,
  } = useTenantFormatting();

  const [selectedStudentIds, setSelectedStudentIds] = useState<(string | number)[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [isNoticesLoading, setIsNoticesLoading] = useState(true);
  const [viewingNotice, setViewingNotice] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
    const fetchDashboardNotices = async () => {
      try {
        const res = await fetch("/api/notices?activeOnly=true");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setNotices(json.data.slice(0, 4));
        }
      } catch {
        // Silent catch for dashboard notice feed
      } finally {
        setIsNoticesLoading(false);
      }
    };
    void fetchDashboardNotices();
  }, []);

  // Permissions & Queries
  const canReadStudents =
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN" ||
    (!!user && user.role !== "SYSTEM_ADMIN" && hasPermission(user.permissions, "students", "read"));
  const canReadStaff =
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN" ||
    (!!user && user.role !== "SYSTEM_ADMIN" && hasPermission(user.permissions, "staff", "read"));
  const canReadFees =
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN" ||
    (!!user && user.role !== "SYSTEM_ADMIN" && hasPermission(user.permissions, "fees", "read"));
  const canReadAcademic =
    user?.role === "ADMIN" ||
    user?.role === "SUPER_ADMIN" ||
    (!!user && user.role !== "SYSTEM_ADMIN" && hasPermission(user.permissions, "academic", "read"));

  const queryEnabled = !isAuthLoading && !!user;

  // Real Database Queries
  const {
    data: studentsResponse,
    isLoading: isStudentsLoading,
  } = useStudents(
    { page: 1, limit: 10 },
    { enabled: queryEnabled && canReadStudents }
  );

  const {
    data: staffResponse,
    isLoading: isStaffLoading,
  } = useStaff(
    { page: 1, limit: 1 },
    { enabled: queryEnabled && canReadStaff }
  );

  const {
    data: feesResponse,
    isLoading: isFeesLoading,
  } = useFees(
    { page: 1, limit: 100 },
    { enabled: queryEnabled && canReadFees }
  );

  const {
    data: transactionsResponse,
    isLoading: isTransactionsLoading,
  } = useTransactions(
    { page: 1, limit: 5 },
    { enabled: queryEnabled && canReadFees }
  );

  const {
    data: attendanceResponse,
    isLoading: isAttendanceLoading,
  } = useAttendance(
    { page: 1, limit: 100 },
    { enabled: queryEnabled }
  );

  const { data: academicYearsData } = useAcademicYears(
    { page: 1, limit: 10 },
    { enabled: queryEnabled && canReadAcademic }
  );

  const isKpiLoading = isStudentsLoading || isStaffLoading || isFeesLoading;

  const totalStudents = (studentsResponse as any)?.pagination?.totalCount ?? 0;
  const totalStaff = (staffResponse as any)?.pagination?.totalCount ?? 0;
  const totalFeesCount = (feesResponse as any)?.pagination?.totalCount ?? 0;
  const recentStudents = (studentsResponse as any)?.data || [];
  const recentTransactions = (transactionsResponse as any)?.data || [];
  const feeVouchersList = (feesResponse as any)?.data || [];
  const attendanceList = (attendanceResponse as any)?.data || [];

  // Calculate real financial volume from database vouchers
  const totalInvoicedSum = feeVouchersList.reduce((acc: number, v: any) => acc + (v.totalDue || 0), 0);
  const totalCollectedSum = feeVouchersList.reduce((acc: number, v: any) => acc + (v.amountPaid || 0), 0);
  const totalBalanceDue = feeVouchersList.reduce((acc: number, v: any) => acc + (v.balance || 0), 0);

  // Calculate real daily attendance counts
  const presentCount = attendanceList.filter((a: any) => a.status === "PRESENT").length;
  const absentCount = attendanceList.filter((a: any) => a.status === "ABSENT").length;
  const attendanceTotal = attendanceList.length;
  const attendanceRate = attendanceTotal > 0 ? ((presentCount / attendanceTotal) * 100).toFixed(1) : null;

  // Derive current academic session
  const activeYear = (academicYearsData as any)?.data?.find((y: any) => !y.isClosed) || (academicYearsData as any)?.data?.[0];
  const academicSessionLabel = activeYear
    ? formatAcademicPeriod(activeYear, t("academicPeriods.session"))
    : formatAcademicPeriod(null, t("academicPeriods.session"));

  // Real Student DataTable Columns
  const studentColumns: ColumnDef<any>[] = [
    {
      key: "student",
      header: t("students.tableColumns.name"),
      cell: (row) => {
        const initials = `${row.firstName?.[0] || ""}${row.lastName?.[0] || ""}`.toUpperCase();
        return (
          <ERPUserCell
            name={`${row.firstName} ${row.lastName}`}
            subtitle={`ID: ${row.studentId} • Roll #${row.rollNumber}`}
            initials={initials || "ST"}
          />
        );
      },
    },
    {
      key: "class",
      header: t("students.tableColumns.class"),
      cell: (row) => (
        <span className="font-semibold text-xs text-foreground">
          {row.class?.name || "Class"} {row.section ? `(${row.section?.name})` : ""}
        </span>
      ),
    },
    {
      key: "admissionDate",
      header: t("students.tableColumns.admissionDate"),
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.admissionDate ? formatDate(row.admissionDate) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: t("common.status"),
      cell: (row) => (
        <ERPStatusPill
          status={row.status || "ACTIVE"}
          variant={row.status === "ACTIVE" ? "emerald" : "subtle"}
        />
      ),
    },
    {
      key: "action",
      header: "",
      className: "text-right",
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/students/${row.id}`)}
          className="h-7 px-2 text-xs text-primary hover:text-primary gap-1"
        >
          <span>View</span>
          <ArrowRight className="h-3 w-3" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Command bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {t("dashboard.title")}
            </h2>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {academicSessionLabel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {mounted ? formatDate(new Date()) : ""}
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-lg text-xs font-medium"
            onClick={() => router.push("/attendance")}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>{t("dashboard.markAttendanceShort")}</span>
          </Button>

          <Button
            size="sm"
            className="h-9 gap-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
            onClick={() => router.push("/students")}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t("dashboard.addStudent")}</span>
          </Button>
        </div>
      </div>

      {/* ─────────────────── Live Relational KPI Metrics ─────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ERPMetricCard
          title={t("dashboard.totalStudents")}
          value={totalStudents.toLocaleString()}
          unit="Students"
          isLoading={isKpiLoading}
          breakdowns={[
            { label: t("dashboard.activeEnrolled"), count: totalStudents, percentage: 100, color: "emerald" },
            { label: t("dashboard.attendanceToday"), count: attendanceRate ? `${attendanceRate}%` : "—", percentage: Number(attendanceRate) || 0, color: "indigo" },
          ]}
          actionLabel={t("students.title")}
          onAction={() => router.push("/students")}
        />

        <ERPMetricCard
          title={t("dashboard.staffMembers")}
          value={totalStaff.toLocaleString()}
          unit="Staff"
          isLoading={isKpiLoading}
          breakdowns={[
            { label: t("dashboard.teachingFaculty"), count: totalStaff, percentage: 100, color: "indigo" },
          ]}
          actionLabel={t("staff.title")}
          onAction={() => router.push("/staff")}
        />

        <ERPMetricCard
          title={t("dashboard.feeCollection")}
          value={totalCollectedSum > 0 ? formatCompactCurrency(totalCollectedSum) : `${currencySymbol} 0`}
          unit={`${totalFeesCount} Vouchers`}
          isLoading={isKpiLoading}
          breakdowns={[
            {
              label: t("dashboard.collected"),
              count: formatCompactCurrency(totalCollectedSum),
              percentage: totalInvoicedSum > 0 ? Math.round((totalCollectedSum / totalInvoicedSum) * 100) : 100,
              color: "emerald",
            },
            {
              label: t("dashboard.outstanding"),
              count: formatCompactCurrency(totalBalanceDue),
              percentage: totalInvoicedSum > 0 ? Math.round((totalBalanceDue / totalInvoicedSum) * 100) : 0,
              color: "rose",
            },
          ]}
          actionLabel={t("nav.feeVouchers")}
          onAction={() => router.push("/fees")}
        />

        <ERPMetricCard
          title={t("attendance.stats.attendanceRate")}
          value={attendanceRate ? `${attendanceRate}%` : "—"}
          unit={t("dateTime.relative.today")}
          isLoading={isKpiLoading}
          breakdowns={[
            { label: t("dashboard.markedPresent"), count: presentCount || "—", percentage: Number(attendanceRate) || 0, color: "emerald" },
            { label: t("dashboard.markedAbsent"), count: absentCount || 0, percentage: 5, color: "rose" },
          ]}
          actionLabel={t("dashboard.markAttendance")}
          onAction={() => router.push("/attendance")}
        />
      </div>

      {/* Fees + quick links */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Recent collections */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-lg border border-border/80 bg-card p-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">
                  {t("dashboard.liveFeeCollection")}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/transactions")}
                className="h-7 text-xs text-muted-foreground hover:text-primary gap-1"
              >
                <span>{t("dashboard.fullLedger")}</span>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>

            {isTransactionsLoading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">
                <Receipt className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p>{t("dashboard.noTransactions")}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/fees")}
                  className="mt-3 text-xs"
                >
                  {t("nav.feeVouchers")}
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/40 mt-1">
                {recentTransactions.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {tx.feeVoucher?.studentProfile
                            ? `${tx.feeVoucher.studentProfile.firstName} ${tx.feeVoucher.studentProfile.lastName}`
                            : `Receipt #${tx.receiptNumber}`}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {tx.paymentMethod} • {formatDate(tx.timestamp)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-bold text-foreground">
                        +{formatCurrency(tx.amountPaid)}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {tx.transactionId}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 mt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("dashboard.reconciled")}</span>
            <span className="font-semibold text-foreground">
              {t("dashboard.totalCollected")}: {formatCurrency(totalCollectedSum)}
            </span>
          </div>
        </div>

        {/* Quick links */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-lg border border-border/80 bg-card p-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">
                  {t("dashboard.quickLinks")}
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 mt-3">
              {[
                {
                  title: t("dashboard.attendanceFast"),
                  desc: t("dashboard.attendanceFastDesc"),
                  icon: Calendar,
                  path: "/attendance",
                },
                {
                  title: t("dashboard.invoicing"),
                  desc: t("dashboard.invoicingDesc"),
                  icon: Receipt,
                  path: "/fees",
                },
                {
                  title: t("dashboard.gradeCards"),
                  desc: t("dashboard.gradeCardsDesc"),
                  icon: GraduationCap,
                  path: "/exams",
                },
                {
                  title: t("dashboard.payroll"),
                  desc: t("dashboard.payrollDesc"),
                  icon: Users,
                  path: "/salary",
                },
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => router.push(item.path)}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-foreground transition-colors">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs font-medium"
              onClick={() => router.push("/reports/fees")}
            >
              <Download className="h-3.5 w-3.5 mr-2" />
              {t("dashboard.downloadReports")}
            </Button>
          </div>
        </div>
      </div>

      {/* Notices */}
      <div className="rounded-lg border border-border/80 bg-card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Megaphone className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {t("announcements.latestFeedTitle")}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {t("announcements.latestFeedSubtitle")}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/notices")}
            className="h-7 text-xs text-primary hover:text-primary gap-1"
          >
            <span>{t("dashboard.viewNoticeboard")}</span>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>

        {isNoticesLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : notices.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            <Megaphone className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground/40" />
            <p>{t("dashboard.noNotices")}</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-4">
            {notices.map((n) => {
              const isUrgent = n.priority === "URGENT";
              const isGlobal = n.scope === "GLOBAL";

              return (
                <div
                  key={n.id}
                  onClick={() => setViewingNotice(n)}
                  className={`flex flex-col justify-between p-3.5 rounded-lg border cursor-pointer transition-colors group ${
                    n.isPinned
                      ? "border-primary/30 bg-primary/[0.03]"
                      : "border-border/70 hover:border-primary/40"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1">
                        {n.isPinned && (
                          <span className="flex items-center gap-0.5 text-[10px] font-medium uppercase text-primary">
                            <Pin className="h-3 w-3" /> Pinned
                          </span>
                        )}
                        {isUrgent && (
                          <span className="text-[10px] font-medium uppercase text-destructive">
                            Urgent
                          </span>
                        )}
                        {!n.isPinned && !isUrgent && (
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {n.category}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {n.publishDate ? formatDate(n.publishDate) : ""}
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-foreground line-clamp-1">
                      {n.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                      {n.content}
                    </p>
                  </div>

                  <div className="pt-2 mt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="truncate">{n.authorName || "Administration"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Student enrollments */}
      <div>
        <ERPDataTable<any>
          title={t("dashboard.studentEnrollments")}
          subtitle={`${t("dashboard.recentAdmissions")} · ${academicSessionLabel}`}
          data={recentStudents}
          columns={studentColumns}
          keyExtractor={(row) => row.id}
          searchPlaceholder={t("students.searchPlaceholder")}
          selectedIds={selectedStudentIds}
          onSelectionChange={setSelectedStudentIds}
          filterLabel={t("common.filter")}
          actionLabel={t("dashboard.viewAllStudents")}
          onActionClick={() => router.push("/students")}
        />
      </div>

      {/* Notice detail */}
      <NoticeDetailModal
        isOpen={!!viewingNotice}
        onClose={() => setViewingNotice(null)}
        notice={viewingNotice}
      />
    </div>
  );
}
