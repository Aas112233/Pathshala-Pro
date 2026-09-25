"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { ERPDataTable, type ColumnDef as ERPColumnDef } from "@/components/ui/erp-data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TenantDateInput } from "@/components/ui/tenant-date-input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { dayAttendanceRate } from "@/lib/attendance-rate";
import {
  CalendarCheck,
  Plus,
  Pencil,
  Trash2,
  Users,
  UserCheck,
  UserX,
  TrendingUp,
  Filter,
  Download
} from "lucide-react";
import { useAttendance, useDeleteAttendance } from "@/hooks/use-queries";

import { toast } from "sonner";
import { cn, formatStudentName } from "@/lib/utils";
import { MarkAttendanceModal } from "@/components/attendance/mark-attendance-modal";
import { FastAttendanceGrid } from "@/components/attendance/fast-attendance-grid";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";

export default function AttendancePage() {
  const t = useTranslations('attendance');
  const common = useTranslations("common");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");
  const [viewType, setViewType] = useState<"all" | "students" | "staff">("all");
  const [activeTab, setActiveTab] = useState<"grid" | "records">("grid");
  const [isMarkAttendanceOpen, setIsMarkAttendanceOpen] = useState(false);
  const { formatDate } = useTenantFormatting();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canRead = hasPermission(perms, "attendance", "read");
  const canWrite = hasPermission(perms, "attendance", "write");
  const canManage = hasPermission(perms, "attendance", "manage");

  const { data, isLoading } = useAttendance({
    page,
    limit: pageSize,
    search: search || undefined,
    ...(date && { filters: { date } }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
    ...(status && { filters: { status } }),
  });

  const deleteMutation = useDeleteAttendance();

  const handleDelete = (id: string) => {
    if (!confirm(t('confirmDelete'))) return;

    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success(t('deleteSuccess'));
      },
      onError: (err) => {
        toast.error(err.message || t('deleteError'));
      },
    });
  };

  // One variant per status in `ATTENDANCE_STATUSES`. `HOLIDAY` is deliberately
  // `outline` like `LEAVE`: neither is a judgement on the student, so neither
  // should wear the red that means "absent".
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "PRESENT": return "default";
      case "ABSENT": return "destructive";
      case "LATE": return "secondary";
      case "HALF_DAY": return "secondary";
      case "EXCUSED": return "outline";
      case "LEAVE": return "outline";
      case "HOLIDAY": return "outline";
      default: return "outline";
    }
  };

  const columns: ERPColumnDef<any>[] = [
    {
      key: "date",
      header: t('tableColumns.date'),
      cell: (row) => formatDate(row.date),
    },
    {
      key: "type",
      header: t('tableColumns.type'),
      cell: (row) => (
        <Badge variant="outline">
          {row.studentProfile ? t('type.student') : t('type.staff')}
        </Badge>
      ),
    },
    {
      key: "name",
      header: t('tableColumns.name'),
      cell: (row) => {
        const student = row.studentProfile;
        const staff = row.staffProfile;
        const name = student
          ? formatStudentName(student.firstName, student.lastName, student.firstNameBn, student.lastNameBn)
          : staff
          ? `${staff.firstName} ${staff.lastName}`
          : "-";
        return <span className="font-medium">{name}</span>;
      },
    },
    {
      key: "id",
      header: t('tableColumns.id'),
      cell: (row) => {
        const student = row.studentProfile;
        const staff = row.staffProfile;
        const primary = student?.rollNumber || staff?.staffId || "-";
        const secondary =
          student?.studentId && student.studentId !== student?.rollNumber
            ? student.studentId
            : null;
        return (
          <span className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{primary}</span>
            {secondary && <span className="ml-1.5 text-xs">({secondary})</span>}
          </span>
        );
      },
    },
    {
      key: "status",
      header: t('tableColumns.status'),
      cell: (row) => (
        <Badge variant={getStatusBadgeVariant(row.status)}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: "note",
      header: t('tableColumns.note'),
      cell: (row) => (
        <span className="text-sm text-muted-foreground max-w-[200px] truncate">
          {row.note || "-"}
        </span>
      ),
    },
    {
      key: "markedBy",
      header: t('tableColumns.markedBy'),
      cell: (row) => (
        <span className="text-sm">
          {row.markedBy?.name || "-"}
        </span>
      ),
    },
    {
      key: "actions",
      header: t('tableColumns.actions'),
      cell: (row) => (
        <div className="flex items-center gap-1">
          {canWrite && (
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleDelete(row.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const attendanceData = ("data" in (data || {})) ? (data as any).data : [];
  const pagination = "pagination" in (data || {}) ? (data as any).pagination : undefined;

  // Calculate stats
  const today = new Date().toISOString().split('T')[0];
  const todayRecords = attendanceData.filter((r: any) => r.date.startsWith(today));
  // The shared definition, so a closed day reports "—" instead of 0% and a late
  // arrival counts as attended — the same rule the promotion engine applies.
  // `presentCount` is therefore attended days, which keeps it consistent with the
  // rate; it only diverges from a raw register count when half-days or excused
  // leave are on file, and those count as not attended by the shared policy.
  const todayAttendance = dayAttendanceRate(
    todayRecords.map((r: any) => ({ status: r.status }))
  );
  const presentCount = todayAttendance.presentDays;
  const absentCount = todayRecords.filter((r: any) => r.status === "ABSENT").length;
  const attendanceRate = todayAttendance.rate;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={CalendarCheck}
      >
        <div className="flex items-center gap-2">
          <div className="bg-muted p-1 rounded-lg flex items-center gap-1 border border-border">
            <Button
              size="sm"
              variant={activeTab === "grid" ? "default" : "ghost"}
              onClick={() => setActiveTab("grid")}
              className="h-8 text-xs font-semibold"
            >
              {t("dailyGrid")}
            </Button>
            <Button
              size="sm"
              variant={activeTab === "records" ? "default" : "ghost"}
              onClick={() => setActiveTab("records")}
              className="h-8 text-xs font-semibold"
            >
              {t("historicalLogs")}
            </Button>
          </div>
          {canWrite && (
            <Button onClick={() => setIsMarkAttendanceOpen(true)} className="h-9">
              <Plus className="mr-2 h-4 w-4" />
              {t('markAttendance')}
            </Button>
          )}
        </div>
      </PageHeader>

      {!canRead && !isAuthLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">{common("noPermission")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="mb-1 h-8 w-14" />
                ) : (
                  <p className="text-2xl font-bold">{pagination?.totalCount || 0}</p>
                )}
                <p className="text-sm text-muted-foreground">{t('stats.totalRecords')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <UserCheck className="h-6 w-6 text-green-600" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="mb-1 h-8 w-14" />
                ) : (
                  <p className="text-2xl font-bold text-green-600">{presentCount}</p>
                )}
                <p className="text-sm text-green-600">{t('stats.presentToday')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <UserX className="h-6 w-6 text-red-600" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="mb-1 h-8 w-14" />
                ) : (
                  <p className="text-2xl font-bold text-red-600">{absentCount}</p>
                )}
                <p className="text-sm text-red-600">{t('stats.absentToday')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="mb-1 h-8 w-14" />
                ) : (
                  <p className="text-2xl font-bold text-blue-600">
                    {attendanceRate === null ? "—" : `${attendanceRate}%`}
                  </p>
                )}
                <p className="text-sm text-blue-600">{t('stats.attendanceRate')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {activeTab === "grid" ? (
        <FastAttendanceGrid />
      ) : (
        <>
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    placeholder={t('searchPlaceholder')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('viewType.all')}:</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant={viewType === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewType("all")}
                  >
                    {t('viewType.all')}
                  </Button>
                  <Button
                    variant={viewType === "students" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewType("students")}
                  >
                    {t('viewType.students')}
                  </Button>
                  <Button
                    variant={viewType === "staff" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewType("staff")}
                  >
                    {t('viewType.staff')}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">{t('dateRange.from')}:</label>
                  <TenantDateInput
                    value={startDate}
                    onChange={setStartDate}
                    className="w-[180px]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">{t('dateRange.to')}:</label>
                  <TenantDateInput
                    value={endDate}
                    onChange={setEndDate}
                    className="w-[180px]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">{t('tableColumns.status')}:</label>
                  <Select
                    value={status || "__ALL__"}
                    onValueChange={(value) => setStatus(value === "__ALL__" ? "" : value)}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder={t('filters.status.all')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ALL__">{t('filters.status.all')}</SelectItem>
                      <SelectItem value="PRESENT">{t('filters.status.present')}</SelectItem>
                      <SelectItem value="ABSENT">{t('filters.status.absent')}</SelectItem>
                      <SelectItem value="LATE">{t('filters.status.late')}</SelectItem>
                      <SelectItem value="HALF_DAY">{t('filters.status.halfDay')}</SelectItem>
                      <SelectItem value="EXCUSED">{t('filters.status.excused')}</SelectItem>
                      <SelectItem value="LEAVE">{t('filters.status.leave')}</SelectItem>
                      <SelectItem value="HOLIDAY">{t('filters.status.holiday')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(search || startDate || endDate || status) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setStartDate("");
                      setEndDate("");
                      setStatus("");
                    }}
                  >
                    {t('filters.clearFilters')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Data Table — ERPDataTable (rule 2) */}
          <ERPDataTable
            data={attendanceData}
            columns={columns}
            keyExtractor={(row) => row.id}
            page={pagination?.currentPage || page}
            pageSize={pagination?.pageSize || pageSize}
            totalCount={pagination?.totalCount || 0}
            onPageChange={setPage}
            onPageSizeChange={(size) => setPageSize(size)}
            isLoading={isLoading}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={t('searchPlaceholder')}
            emptyState={<div className="py-12 text-center text-sm text-muted-foreground">{common('noResults')}</div>}
          />
        </>
      )}
        </>
      )}

      {/* Mark Attendance Modal */}
      <MarkAttendanceModal
        isOpen={isMarkAttendanceOpen}
        onClose={() => setIsMarkAttendanceOpen(false)}
      />
    </div>
  );
}
