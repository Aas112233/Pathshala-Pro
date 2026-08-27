"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import {
  Receipt,
  CalendarCheck,
  GraduationCap,
  BookOpen,
  ArrowRight,
  Wallet,
  Landmark,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface ReportCard {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

export default function ReportsOverviewPage() {
  const t = useTranslations("reports");

  const reportCards: ReportCard[] = [
    {
      title: t("feeReport.title"),
      description: t("feeReport.description"),
      icon: Receipt,
      href: "/reports/fees",
    },
    {
      title: t("salaryReport.title"),
      description: t("salaryReport.description"),
      icon: Wallet,
      href: "/reports/salary",
    },
    {
      title: t("financialReport.title"),
      description: t("financialReport.description"),
      icon: Landmark,
      href: "/reports/financial",
    },
    {
      title: t("admissionsReport.title"),
      description: t("admissionsReport.description"),
      icon: UserPlus,
      href: "/reports/admissions",
    },
    {
      title: t("attendanceReport.title"),
      description: t("attendanceReport.description"),
      icon: CalendarCheck,
      href: "/reports/attendance",
    },
    {
      title: t("studentReport.title"),
      description: t("studentReport.description"),
      icon: GraduationCap,
      href: "/reports/students",
    },
    {
      title: t("examReport.title"),
      description: t("examReport.description"),
      icon: BookOpen,
      href: "/reports/exams",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={BookOpen}
      />

      {/* Report Categories Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {reportCards.map((report) => {
          const Icon = report.icon;
          return (
            <Link key={report.href} href={report.href}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {report.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

    </div>
  );
}
