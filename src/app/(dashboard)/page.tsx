"use client";

import { PageHeader } from "@/components/shared/page-header";
import { ActionGrid } from "@/components/shared/action-grid";
import {
  LayoutDashboard,
  GraduationCap,
  Receipt,
  Users,
  ArrowLeftRight,
  TrendingUp,
  CalendarCheck,
  BookOpen,
  Wallet,
  CalendarRange,
} from "lucide-react";
import { useStudents, useStaff, useFees, useTransactions } from "@/hooks/use-queries";

export default function DashboardPage() {
  const { data: studentsData } = useStudents({ page: 1, limit: 1 });
  const { data: staffData } = useStaff({ page: 1, limit: 1 });
  const { data: feesData } = useFees({ page: 1, limit: 1 });
  const { data: transactionsData } = useTransactions({ page: 1, limit: 1 });

  const totalStudents = (studentsData as any)?.pagination?.totalCount ?? 0;
  const totalStaff = (staffData as any)?.pagination?.totalCount ?? 0;
  const totalFees = (feesData as any)?.pagination?.totalCount ?? 0;
  const totalTransactions = (transactionsData as any)?.pagination?.totalCount ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Welcome to Pathshala Pro. Overview of your school operations."
        icon={LayoutDashboard}
      />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Students"
          value={totalStudents.toString()}
          icon={GraduationCap}
          trend="Active enrollments"
        />
        <StatCard
          title="Fee Collection"
          value={totalFees.toString()}
          icon={Receipt}
          trend="Total vouchers"
        />
        <StatCard
          title="Staff Members"
          value={totalStaff.toString()}
          icon={Users}
          trend="Active staff"
        />
        <StatCard
          title="Transactions"
          value={totalTransactions.toString()}
          icon={ArrowLeftRight}
          trend="Total payments"
        />
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 text-base font-semibold text-card-foreground">
          Quick Actions
        </h3>
        <ActionGrid
          columns={4}
          items={[
            {
              id: "students",
              label: "Add Student",
              icon: GraduationCap,
            },
            {
              id: "fees",
              label: "Create Voucher",
              icon: Receipt,
            },
            {
              id: "attendance",
              label: "Mark Attendance",
              icon: CalendarCheck,
            },
            {
              id: "exams",
              label: "Enter Marks",
              icon: BookOpen,
            },
            {
              id: "staff",
              label: "Add Staff",
              icon: Users,
            },
            {
              id: "salary",
              label: "Process Payroll",
              icon: Wallet,
            },
            {
              id: "academic-year",
              label: "Manage Year",
              icon: CalendarRange,
            },
            {
              id: "transactions",
              label: "View Payments",
              icon: ArrowLeftRight,
            },
          ]}
        />
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold text-card-foreground">
            Recent Transactions
          </h3>
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Connect to see recent payment activity.
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold text-card-foreground">
            Fee Collection Overview
          </h3>
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Connect to see collection analytics.
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  trend: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-bold text-card-foreground">{value}</p>
      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <TrendingUp className="h-3 w-3" />
        <span>{trend}</span>
      </div>
    </div>
  );
}
