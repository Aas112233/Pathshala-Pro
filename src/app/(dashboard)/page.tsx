import { PageHeader } from "@/components/shared/page-header";
import {
  LayoutDashboard,
  GraduationCap,
  Receipt,
  Users,
  ArrowLeftRight,
  TrendingUp,
} from "lucide-react";

export default function DashboardPage() {
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
          value="--"
          icon={GraduationCap}
          trend="Active enrollments"
        />
        <StatCard
          title="Fee Collection"
          value="--"
          icon={Receipt}
          trend="This month"
        />
        <StatCard
          title="Staff Members"
          value="--"
          icon={Users}
          trend="Active staff"
        />
        <StatCard
          title="Transactions"
          value="--"
          icon={ArrowLeftRight}
          trend="This month"
        />
      </div>

      {/* Placeholder sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold text-card-foreground">
            Recent Transactions
          </h3>
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Connect your database to see live data.
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold text-card-foreground">
            Fee Collection Overview
          </h3>
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Connect your database to see live data.
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
