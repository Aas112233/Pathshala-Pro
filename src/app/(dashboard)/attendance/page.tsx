"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { cn, formatStudentName } from "@/lib/utils";
import { MarkAttendanceModal } from "@/components/attendance/mark-attendance-modal";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";

export default function AttendancePage() {
  const t = useTranslations('attendance');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");
  const [viewType, setViewType] = useState<"all" | "students" | "staff">("all");
  const [isMarkAttendanceOpen, setIsMarkAttendanceOpen] = useState(false);
  const { formatDate } = useTenantFormatting();

  const { data, isLoading } = useAttendance({
    page,
    limit: 20,
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "PRESENT": return "default";
      case "ABSENT": return "destructive";
      case "LATE": return "secondary";
      case "LEAVE": return "outline";
      default: return "outline";
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "date",
      header: t('tableColumns.date'),
      cell: ({ getValue }) => formatDate(getValue<string>()),
    },
    {
      accessorKey: "type",
      header: t('tableColumns.type'),
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.studentProfile ? t('type.student') : t('type.staff')}
        </Badge>
      ),
    },
    {
      accessorKey: "name",
      header: t('tableColumns.name'),
      cell: ({ row }) => {
        const student = row.original.studentProfile;
        const staff = row.original.staffProfile;
        const name = student
          ? formatStudentName(student.firstName, student.lastName, student.firstNameBn, student.lastNameBn)
          : staff
          ? `${staff.firstName} ${staff.lastName}`
          : "-";
        return <span className="font-medium">{name}</span>;
      },
    },
    {
      accessorKey: "id",
      header: t('tableColumns.id'),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.studentProfile?.studentId || row.original.staffProfile?.staffId || "-"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t('tableColumns.status'),
      cell: ({ getValue }) => (
        <Badge variant={getStatusBadgeVariant(getValue<string>())}>
          {getValue<string>()}
        </Badge>
      ),
    },
    {
      accessorKey: "note",
      header: t('tableColumns.note'),
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground max-w-[200px] truncate">
          {getValue<string>() || "-"}
        </span>
      ),
    },
    {
      accessorKey: "markedBy",
      header: t('tableColumns.markedBy'),
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.markedBy?.name || "-"}
        </span>
      ),
    },
    {
      id: "actions",
      header: t('tableColumns.actions'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleDelete(row.original.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const attendanceData = ("data" in (data || {})) ? (data as any).data : [];
  const pagination = "pagination" in (data || {}) ? (data as any).pagination : undefined;

  // Calculate stats
  const today = new Date().toISOString().split('T')[0];
  const todayRecords = attendanceData.filter((r: any) => r.date.startsWith(today));
  const presentCount = todayRecords.filter((r: any) => r.status === "PRESENT").length;
  const absentCount = todayRecords.filter((r: any) => r.status === "ABSENT").length;
  const attendanceRate = todayRecords.length > 0 
    ? Math.round((presentCount / todayRecords.length) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={CalendarCheck}
      >
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            {t('bulkActions.export')}
          </Button>
          <Button onClick={() => setIsMarkAttendanceOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('markAttendance')}
          </Button>
        </div>
      </PageHeader>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pagination?.totalCount || 0}</p>
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
                <p className="text-2xl font-bold text-green-600">{presentCount}</p>
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
                <p className="text-2xl font-bold text-red-600">{absentCount}</p>
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
                <p className="text-2xl font-bold text-blue-600">{attendanceRate}%</p>
                <p className="text-sm text-blue-600">{t('stats.attendanceRate')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-[180px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">{t('dateRange.to')}:</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-[180px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">{t('tableColumns.status')}:</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">{t('filters.status.all')}</option>
                <option value="PRESENT">{t('filters.status.present')}</option>
                <option value="ABSENT">{t('filters.status.absent')}</option>
                <option value="LATE">{t('filters.status.late')}</option>
                <option value="LEAVE">{t('filters.status.leave')}</option>
              </select>
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

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={attendanceData}
        pagination={pagination}
        onPageChange={setPage}
        isLoading={isLoading}
        searchPlaceholder={t('searchPlaceholder')}
      />

      {/* Mark Attendance Modal */}
      <MarkAttendanceModal
        isOpen={isMarkAttendanceOpen}
        onClose={() => setIsMarkAttendanceOpen(false)}
      />
    </div>
  );
}
