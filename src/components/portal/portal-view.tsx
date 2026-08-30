"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CalendarDays, CheckCircle2, Download, ExternalLink, FileText, FileUp, GraduationCap, Receipt, Send, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Empty, Loading, PortalCard } from "@/components/portal/portal-shell";
import { formatPortalCurrency, formatPortalDate, usePortalData } from "@/components/portal/use-portal-data";

type Section = "student-dashboard" | "homework" | "timetable" | "results" | "parent-dashboard" | "fees";
type T = (key: string, values?: Record<string, string | number>) => string;
const h = React.createElement;

export function PortalView({ section }: { section: Section }) {
  const t = useTranslations("portal") as unknown as T;
  const { data, isLoading, error } = usePortalData();
  if (isLoading) return h(Loading);
  if (!data) return h(Empty, null, error || t("noData"));
  if (section === "homework") return h(Homework, { data, t });
  if (section === "timetable") return h(Timetable, { data, t });
  if (section === "results") return h(Results, { data, t });
  if (section === "parent-dashboard") return h(ParentDashboard, { data, t });
  if (section === "fees") return h(Fees, { data, t });
  return h(StudentDashboard, { data, t });
}

function Card({ children, className }: { children?: React.ReactNode; className?: string }) {
  return h(PortalCard, { className }, children);
}

function Metric({ icon: Icon, label, value, hint, href }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; hint: string; href?: string }) {
  const content = h("div", null,
    h("div", { className: "flex items-center justify-between" }, h("p", { className: "text-xs font-semibold uppercase text-muted-foreground" }, label), h(Icon, { className: "h-5 w-5 text-primary" })),
    h("p", { className: "mt-3 text-3xl font-bold" }, value),
    h("p", { className: "mt-1 text-xs text-muted-foreground" }, hint),
  );
  return h(Card, null, href ? h(Link, { href, className: "block" }, content) : content);
}

function StudentDashboard({ data, t }: { data: any; t: T }) {
  const today = data.timetable.filter((item: any) => item.dayOfWeek === data.today);
  const pending = data.homework.filter((item: any) => !item.submissions?.[0] || ["PENDING", "LATE"].includes(item.submissions[0].status));
  const name = `${data.student.firstName} ${data.student.lastName}`;
  const className = `${data.student.class?.name || ""}${data.student.section?.name ? ` · ${data.student.section.name}` : ""}`;
  const exams = data.exams.slice(0, 5).map((exam: any) => h("div", { key: exam.id, className: "flex items-center justify-between border-b py-3 last:border-0" }, h("span", { className: "font-medium" }, exam.name), h("span", { className: "text-sm text-muted-foreground" }, formatPortalDate(exam.startDate))));
  return h("div", { className: "space-y-6" },
    h("div", null, h("p", { className: "text-sm text-muted-foreground" }, t("student.greeting")), h("h1", { className: "text-2xl font-bold" }, name), h("p", { className: "text-sm text-muted-foreground" }, className)),
    h("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4" },
      h(Metric, { icon: CheckCircle2, label: t("attendance.title"), value: data.attendance.percentage == null ? "—" : `${data.attendance.percentage}%`, hint: t("attendance.last90") }),
      h(Metric, { icon: FileText, label: t("homework.pending"), value: pending.length, hint: t("viewAll"), href: "/student/homework" }),
      h(Metric, { icon: GraduationCap, label: t("exams.upcoming"), value: data.exams.length, hint: t("exams.published") }),
      h(Metric, { icon: CalendarDays, label: t("timetable.today"), value: today.length, hint: t("viewTimetable"), href: "/student/timetable" }),
    ),
    h(Card, null, h("h2", { className: "mb-4 text-lg font-semibold" }, t("exams.upcomingTitle")), data.exams.length ? exams : h(Empty, null, t("exams.none"))),
  );
}

function ParentDashboard({ data, t }: { data: any; t: T }) {
  const name = `${data.student.firstName} ${data.student.lastName}`;
  const symbol = data.school?.currencySymbol || "";
  const latest = data.results[0];
  const payments = data.transactions.slice(0, 5).map((payment: any) => h("div", { key: payment.id, className: "flex items-center justify-between border-b py-3 last:border-0" }, h("span", null, payment.receiptNumber), h("span", { className: "font-semibold text-emerald-600" }, formatPortalCurrency(payment.amountPaid, symbol))));
  return h("div", { className: "space-y-6" },
    h("div", null, h("p", { className: "text-sm text-muted-foreground" }, t("parent.overview")), h("h1", { className: "text-2xl font-bold" }, name)),
    h("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" },
      h(Metric, { icon: Wallet, label: t("fees.balance"), value: formatPortalCurrency(data.totalDue, symbol), hint: t("fees.viewDetails"), href: "/parent/fees" }),
      h(Metric, { icon: CheckCircle2, label: t("attendance.title"), value: data.attendance.percentage == null ? "—" : `${data.attendance.percentage}%`, hint: t("attendance.last90") }),
      h(Metric, { icon: FileText, label: t("results.latest"), value: latest?.exam?.name || t("results.none"), hint: latest ? `${latest.grade} · ${latest.obtainedMarks}/${latest.maxMarks}` : "" }),
    ),
    h(Card, null, h("h2", { className: "mb-4 text-lg font-semibold" }, t("fees.recentPayments")), payments.length ? payments : h(Empty, null, t("fees.noPayments"))),
  );
}

function Homework({ data, t }: { data: any; t: T }) {
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [busy, setBusy] = useState<string | null>(null);
  async function submit(id: string) {
    setBusy(id);
    try {
      let attachmentUrl: string | null = null;
      const file = files[id];
      if (file) {
        const form = new FormData();
        form.append("file", file);
        const upload = await fetch("/api/portal/upload", { method: "POST", body: form });
        const uploaded = await upload.json();
        if (!upload.ok) throw new Error(uploaded?.message || t("homework.uploadFailed"));
        attachmentUrl = uploaded.data.webViewLink;
      }
      const response = await fetch(`/api/portal/homework/${id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ remarks: remarks[id] || null, attachmentUrl }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || t("homework.submitFailed"));
      window.location.reload();
    } catch (submitError) {
      window.alert(submitError instanceof Error ? submitError.message : t("homework.submitFailed"));
    } finally {
      setBusy(null);
    }
  }
  const cards = data.homework.map((item: any) => {
    const submission = item.submissions?.[0];
    const canSubmit = submission?.status !== "GRADED";
    const input = canSubmit ? h("div", { className: "mt-5 space-y-3 border-t pt-4" },
      h(Textarea, { value: remarks[item.id] || "", onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setRemarks((current) => ({ ...current, [item.id]: event.target.value })), placeholder: t("homework.remarksPlaceholder") }),
      h("label", { className: "flex cursor-pointer items-center gap-2 text-sm text-muted-foreground" }, h(FileUp, { className: "h-4 w-4" }), files[item.id]?.name || t("homework.chooseFile"), h("input", { type: "file", className: "sr-only", accept: "image/jpeg,image/png,image/webp,application/pdf", onChange: (event: React.ChangeEvent<HTMLInputElement>) => setFiles((current) => ({ ...current, [item.id]: event.target.files?.[0] })) })),
      h(Button, { onClick: () => void submit(item.id), loading: busy === item.id, loadingText: t("homework.submitting") }, h(Send, { className: "mr-2 h-4 w-4" }), t("homework.submit")),
    ) : null;
    return h(Card, { key: item.id }, h("div", { className: "flex justify-between gap-3" }, h("div", null, h("h2", { className: "font-semibold" }, item.title), h("p", { className: "text-xs text-muted-foreground" }, `${item.subject?.name || t("homework.general")} · ${t("homework.due")} ${formatPortalDate(item.dueDate)}`)), h("span", { className: "rounded-full bg-muted px-2 py-1 text-xs" }, submission?.status || t("homework.pendingStatus"))), h("p", { className: "mt-4 whitespace-pre-wrap text-sm text-muted-foreground" }, item.description), item.attachmentUrl ? h("a", { href: item.attachmentUrl, target: "_blank", rel: "noreferrer", className: "mt-3 inline-flex items-center gap-1 text-sm text-primary" }, h(ExternalLink, { className: "h-4 w-4" }), t("homework.openAttachment")) : null, input);
  });
  return h("div", { className: "space-y-6" }, h("div", null, h("h1", { className: "text-2xl font-bold" }, t("homework.title")), h("p", { className: "mt-1 text-sm text-muted-foreground" }, t("homework.description"))), data.homework.length ? h("div", { className: "grid gap-4 lg:grid-cols-2" }, cards) : h(Empty, null, t("homework.none")));
}

function Timetable({ data, t }: { data: any; t: T }) {
  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const periods = Array.from(new Set(data.timetable.map((item: any) => item.periodNumber))).sort((a: any, b: any) => a - b);
  const rows = periods.map((period: any) => h("div", { key: period, className: "grid grid-cols-7 border-b" }, h("div", { className: "p-4 text-sm font-semibold" }, period), days.map((day) => { const item = data.timetable.find((entry: any) => entry.periodNumber === period && entry.dayOfWeek === day); return h("div", { key: day, className: "border-l p-3" }, item ? h("div", { className: "rounded-xl bg-primary/10 p-3" }, h("p", { className: "text-sm font-semibold" }, item.isBreak ? item.breakLabel : item.subject?.name || t("timetable.free")), h("p", { className: "mt-1 text-xs text-muted-foreground" }, `${item.startTime}–${item.endTime}`)) : h("span", { className: "text-sm text-muted-foreground" }, "—")); })));
  return h("div", { className: "space-y-6" }, h("div", null, h("h1", { className: "text-2xl font-bold" }, t("timetable.title")), h("p", { className: "mt-1 text-sm text-muted-foreground" }, t("timetable.description"))), h(Card, { className: "overflow-x-auto p-0" }, h("div", { className: "min-w-[760px]" }, h("div", { className: "grid grid-cols-7 border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground" }, h("div", { className: "p-4" }, t("timetable.period")), days.map((day) => h("div", { key: day, className: "p-4" }, t(`days.${day}`)))), periods.length ? rows : h(Empty, null, t("timetable.empty")))));
}

function Results({ data, t }: { data: any; t: T }) {
  const groups = useMemo(() => Object.entries(data.results.reduce((acc: Record<string, any[]>, result: any) => { const key = result.exam?.id || result.academicYear?.id || "results"; (acc[key] ||= []).push(result); return acc; }, {})), [data.results]);
  const cards = groups.map(([key, values]) => { const results = values as any[]; const max = results.reduce((sum, result) => sum + result.maxMarks, 0); const obtained = results.reduce((sum, result) => sum + result.obtainedMarks, 0); const rows = results.map((result) => h("tr", { key: result.id }, h("td", { className: "py-3 font-medium" }, result.subject?.name), h("td", { className: "py-3" }, `${result.obtainedMarks}/${result.maxMarks}`), h("td", { className: "py-3 font-semibold" }, result.grade), h("td", { className: "py-3" }, result.status))); return h(Card, { key }, h("div", { className: "mb-4 flex items-center justify-between" }, h("div", null, h("h2", { className: "text-lg font-semibold" }, results[0].exam?.name || results[0].academicYear?.label), h("p", { className: "text-sm text-muted-foreground" }, `${t("results.gpa")} ${results.reduce((sum, item) => sum + item.gradePoint, 0) / results.length || 0}`)), h("span", { className: "rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary" }, `${max ? Math.round(obtained / max * 1000) / 10 : 0}%`)), h("div", { className: "overflow-x-auto" }, h("table", { className: "w-full text-left text-sm" }, h("thead", { className: "border-b text-xs uppercase text-muted-foreground" }, h("tr", null, h("th", { className: "py-3" }, t("results.subject")), h("th", { className: "py-3" }, t("results.marks")), h("th", { className: "py-3" }, t("results.grade")), h("th", { className: "py-3" }, t("results.status")))), h("tbody", { className: "divide-y" }, rows)))); });
  return h("div", { className: "space-y-6" }, h("div", null, h("h1", { className: "text-2xl font-bold" }, t("results.title")), h("p", { className: "mt-1 text-sm text-muted-foreground" }, t("results.description"))), cards.length ? cards : h(Empty, null, t("results.none")));
}

function Fees({ data, t }: { data: any; t: T }) {
  const symbol = data.school?.currencySymbol || "";
  const feeRows = data.fees.map((fee: any) => h(
    "tr",
    { key: fee.id },
    h("td", { className: "py-3 font-medium" }, fee.voucherId),
    h("td", { className: "py-3" }, fee.feeType),
    h("td", { className: "py-3" }, formatPortalDate(fee.dueDate)),
    h("td", { className: "py-3" }, formatPortalCurrency(fee.totalDue, symbol)),
    h("td", { className: "py-3" }, fee.status),
  ));
  const payments = data.transactions.map((payment: any) => h(
    "div",
    { key: payment.id, className: "flex items-center justify-between border-b py-3 last:border-0" },
    h("div", { className: "flex items-center gap-3" }, h(Receipt, { className: "h-4 w-4 text-muted-foreground" }), h("span", null, payment.receiptNumber)),
    h("div", { className: "flex items-center gap-3" }, h("span", { className: "font-semibold" }, formatPortalCurrency(payment.amountPaid, symbol)), h(Button, { size: "sm", variant: "ghost", "aria-label": t("fees.downloadReceipt") }, h(Download, { className: "h-4 w-4" }))),
  ));
  const feeTable = h(
    "div",
    { className: "overflow-x-auto" },
    h(
      "table",
      { className: "w-full min-w-[650px] text-left text-sm" },
      h("thead", { className: "border-b text-xs uppercase text-muted-foreground" }, h("tr", null, ["voucher", "type", "dueDate", "amount", "status"].map((key) => h("th", { key, className: "py-3" }, t(`fees.${key}`))))),
      h("tbody", { className: "divide-y" }, feeRows),
    ),
  );
  return h(
    "div",
    { className: "space-y-6" },
    h("div", null, h("h1", { className: "text-2xl font-bold" }, t("fees.title")), h("p", { className: "mt-1 text-sm text-muted-foreground" }, t("fees.description"))),
    h(Card, { className: "bg-primary text-primary-foreground" }, h("p", { className: "text-sm opacity-80" }, t("fees.totalBalance")), h("p", { className: "mt-2 text-3xl font-bold" }, formatPortalCurrency(data.totalDue, symbol))),
    h(Card, null, h("h2", { className: "mb-4 text-lg font-semibold" }, t("fees.vouchers")), feeRows.length ? feeTable : h(Empty, null, t("fees.noVouchers"))),
    h(Card, null, h("h2", { className: "mb-4 text-lg font-semibold" }, t("fees.paymentHistory")), payments.length ? payments : h(Empty, null, t("fees.noPayments"))),
  );
}
