"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import {
  Receipt,
  CalendarCheck,
  GraduationCap,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface ReportCard {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  color: string;
}

export default function ReportsOverviewPage() {
  const t = useTranslations("reports");

  const reportCards: ReportCard[] = [
    {
      title: t("feeReport.title"),
      description: t("feeReport.description"),
      icon: Receipt,
      href: "/reports/fees",
      color: "bg-green-500",
    },
    {
      title: t("attendanceReport.title"),
      description: t("attendanceReport.description"),
      icon: CalendarCheck,
      href: "/reports/attendance",
      color: "bg-blue-500",
    },
    {
      title: t("studentReport.title"),
      description: t("studentReport.description"),
      icon: GraduationCap,
      href: "/reports/students",
      color: "bg-purple-500",
    },
    {
      title: t("examReport.title"),
      description: t("examReport.description"),
      icon: BookOpen,
      href: "/reports/exams",
      color: "bg-orange-500",
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
              <Card className="group cursor-pointer transition-all hover:shadow-lg hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-lg ${report.color} text-white`}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{report.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {report.description}
                        </CardDescription>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Click to generate {report.title.toLowerCase()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick Info */}
      <Card>
        <CardHeader>
          <CardTitle>Report Module Features</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Date range filtering for all reports
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Export to CSV, Excel, and PDF formats
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Visual charts and analytics
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Class, section, and group-wise breakdowns
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Real-time data processing
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Print-ready report formats
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
