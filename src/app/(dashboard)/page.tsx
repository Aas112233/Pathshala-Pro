"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { useStudents, useStaff, useFees, useTransactions } from "@/hooks/use-queries";
import Link from "next/link";
import {
  GraduationCap,
  Receipt,
  Users,
  ArrowLeftRight,
  CalendarCheck,
  BookOpen,
  Wallet,
  CalendarRange,
  ArrowUpRight,
  Plus,
  Clock,
  Sparkles,
  TrendingUp,
  FilePlus,
} from "lucide-react";

// ─────────────────── Helpers ───────────────────
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

// ─────────────────── Stat Card ───────────────────
function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  accentFrom,
  accentTo,
  href,
  isLoading,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  subtitle: string;
  accentFrom: string;
  accentTo: string;
  href: string;
  isLoading: boolean;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 transition-all duration-300 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5"
    >
      {/* Gradient accent line */}
      <div
        className="absolute inset-x-0 top-0 h-1 opacity-80 transition-opacity group-hover:opacity-100"
        style={{
          background: `linear-gradient(90deg, ${accentFrom}, ${accentTo})`,
        }}
      />

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[13px] font-medium text-muted-foreground tracking-wide">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground tabular-nums">
            {isLoading ? (
              <span className="inline-block h-8 w-16 animate-pulse rounded-md bg-muted" />
            ) : (
              value
            )}
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3 text-emerald-500" />
            {subtitle}
          </p>
        </div>

        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
          style={{
            background: `linear-gradient(135deg, ${accentFrom}18, ${accentTo}18)`,
          }}
        >
          <span style={{ color: accentFrom }}>
            <Icon className="h-5 w-5" />
          </span>
        </div>
      </div>

      {/* Hover arrow */}
      <div className="absolute bottom-4 right-4 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1">
        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

// ─────────────────── Quick Action ───────────────────
function QuickAction({
  label,
  icon: Icon,
  href,
  gradient,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  gradient: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-3 rounded-2xl border border-border/40 bg-card p-5 text-center transition-all duration-300 hover:border-primary/20 hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5"
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
        style={{ background: gradient }}
      >
        <Icon className="h-5 w-5 text-white" />
      </div>
      <span className="text-[13px] font-medium text-foreground leading-tight">
        {label}
      </span>
    </Link>
  );
}

// ─────────────────── Activity Row ───────────────────
function ActivityRow({
  label,
  time,
  icon: Icon,
  color,
}: {
  label: string;
  time: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${color}14` }}
      >
        <span style={{ color }}><Icon className="h-4 w-4" /></span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{label}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
          <Clock className="h-3 w-3" />
          {time}
        </p>
      </div>
    </div>
  );
}

// ─────────────────── Main Dashboard ───────────────────
export default function DashboardPage() {
  const t = useTranslations();
  const { user } = useAuth();
  const { formatDate } = useTenantFormatting();

  const { data: studentsData, isLoading: studentsLoading } = useStudents({ page: 1, limit: 1 });
  const { data: staffData, isLoading: staffLoading } = useStaff({ page: 1, limit: 1 });
  const { data: feesData, isLoading: feesLoading } = useFees({ page: 1, limit: 1 });
  const { data: transactionsData, isLoading: txLoading } = useTransactions({ page: 1, limit: 1 });

  const totalStudents = (studentsData as any)?.pagination?.totalCount ?? 0;
  const totalStaff = (staffData as any)?.pagination?.totalCount ?? 0;
  const totalFees = (feesData as any)?.pagination?.totalCount ?? 0;
  const totalTransactions = (transactionsData as any)?.pagination?.totalCount ?? 0;
  const isLoading = studentsLoading || staffLoading || feesLoading || txLoading;

  const firstName = user?.name?.split(" ")[0] ?? "";

  return (
    <div className="space-y-8 pb-8">
      {/* ───── Compact Greeting ───── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {formatDate(new Date())}
          </p>
        </div>
      </div>

      {/* ───── Stats ───── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t("dashboard.totalStudents")}
          value={totalStudents.toLocaleString()}
          icon={GraduationCap}
          subtitle={t("dashboard.activeEnrollments")}
          accentFrom="#6366f1"
          accentTo="#8b5cf6"
          href="/students"
          isLoading={isLoading}
        />
        <StatCard
          title={t("dashboard.feeCollection")}
          value={totalFees.toLocaleString()}
          icon={Receipt}
          subtitle={t("dashboard.totalVouchers")}
          accentFrom="#f59e0b"
          accentTo="#ef4444"
          href="/fees"
          isLoading={isLoading}
        />
        <StatCard
          title={t("dashboard.staffMembers")}
          value={totalStaff.toLocaleString()}
          icon={Users}
          subtitle={t("dashboard.activeStaff")}
          accentFrom="#10b981"
          accentTo="#06b6d4"
          href="/staff"
          isLoading={isLoading}
        />
        <StatCard
          title={t("dashboard.transactionsCount")}
          value={totalTransactions.toLocaleString()}
          icon={ArrowLeftRight}
          subtitle={t("dashboard.totalPayments")}
          accentFrom="#ec4899"
          accentTo="#8b5cf6"
          href="/transactions"
          isLoading={isLoading}
        />
      </div>

      {/* ───── Activity & Analytics ───── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Activity */}
        <div className="lg:col-span-3 rounded-2xl border border-border/50 bg-card p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-foreground">
              {t("dashboard.recentTransactions")}
            </h2>
            <Link
              href="/transactions"
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          {totalTransactions > 0 ? (
            <div className="divide-y divide-border/50">
              <ActivityRow
                label="Fee payment received"
                time="Recently"
                icon={Receipt}
                color="#f59e0b"
              />
              <ActivityRow
                label="Staff salary processed"
                time="Recently"
                icon={Wallet}
                color="#8b5cf6"
              />
              <ActivityRow
                label="New student enrolled"
                time="Recently"
                icon={GraduationCap}
                color="#6366f1"
              />
              <ActivityRow
                label="Attendance marked"
                time="Recently"
                icon={CalendarCheck}
                color="#10b981"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-52 text-center">
              <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("dashboard.connectToSeeActivity")}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Activity will appear here when data flows in
              </p>
            </div>
          )}
        </div>

        {/* Fee Breakdown */}
        <div className="lg:col-span-2 rounded-2xl border border-border/50 bg-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-foreground">
              {t("dashboard.feeCollectionOverview")}
            </h2>
          </div>

          {totalFees > 0 ? (
            <div className="space-y-5">
              {/* Simulated Donut-ish Visual */}
              <div className="flex items-center justify-center py-4">
                <div className="relative h-36 w-36">
                  <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
                    <circle
                      cx="60" cy="60" r="50"
                      fill="none"
                      stroke="url(#feeGradient)"
                      strokeWidth="8"
                      strokeDasharray="314"
                      strokeDashoffset="80"
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient id="feeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-foreground">{totalFees}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Vouchers</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <LegendPill label="Collected" value="—" color="#10b981" />
                <LegendPill label="Pending" value="—" color="#f59e0b" />
                <LegendPill label="Overdue" value="—" color="#ef4444" />
                <LegendPill label="Cancelled" value="—" color="#94a3b8" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-52 text-center">
              <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                <Receipt className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("dashboard.connectToSeeAnalytics")}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Fee analytics will show here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────── Legend Pill ───────────────────
function LegendPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2.5">
      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{label}</p>
        <p className="text-xs text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}
