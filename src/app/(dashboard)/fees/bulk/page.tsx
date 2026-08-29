"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { useAcademicYears } from "@/hooks/use-queries";
import {
  Users,
  Wallet,
  Building2,
  CheckCircle2,
  Loader2,
  Receipt,
  Sparkles,
  CreditCard,
  Smartphone,
  Calendar,
  Search,
  X,
} from "lucide-react";

import { ACADEMIC_MONTHS, MONTH_NAMES, SHORT_MONTH_NAMES } from "@/lib/constants";
import { useAuth } from "@/components/providers/auth-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";

interface StudentRowState {
  id: string;
  studentId: string;
  rollNumber: string;
  firstName: string;
  lastName: string;
  classId: string;
  className: string;
  sectionName?: string;
  baseMonthlyFee: number;
  discountAmount: number;
  annualTotalDue: number;
  amountPaidSoFar: number;
  paidMonthsCount: number;
  unpaidMonthsCount: number;
  remainingDue: number;
  targetMonthLabel: string;
  isAlreadyPaidForTargetMonth: boolean;
  amountToPay: number;
  isSelected: boolean;
  existingVoucherId?: string;
}

const EMPTY_ARRAY: any[] = [];

export default function BulkFeeEntryPage() {
  const router = useRouter();
  const t = useTranslations("bulkFees");
  const qc = useQueryClient();
  const { formatCurrency, currencySymbol } = useTenantFormatting();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canReadFees = hasPermission(perms, "fees", "read");
  const canWriteFees = hasPermission(perms, "fees", "write");
  const canManageFees = hasPermission(perms, "fees", "manage");

  // 1. Academic Years
  const { data: ayResponse } = useAcademicYears();
  const academicYears = ayResponse?.data || EMPTY_ARRAY;
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const activeYearId = selectedYearId || academicYears[0]?.id || "";
  const selectedYear = academicYears.find((ay: any) => ay.id === activeYearId);

  // 2. Classes query
  const { data: classesResponse } = useQuery({
    queryKey: ["classes-bulk-fee"],
    queryFn: async () => {
      const res = await fetch("/api/classes?limit=100&isActive=true", { credentials: "include" });
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });
  const classes = (classesResponse as any)?.data || EMPTY_ARRAY;

  // Filter State
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(new Date().getMonth());
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Set default class once classes are loaded
  useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  const selectedClass = classes.find((c: any) => c.id === selectedClassId);
  const availableSections = selectedClass?.sections || EMPTY_ARRAY;

  // 3. Query Students for Selected Class & Section
  const { data: studentsData, isLoading: isLoadingStudents } = useQuery({
    queryKey: ["students-for-bulk-fee", selectedClassId, selectedSectionId],
    queryFn: async () => {
      if (!selectedClassId) return { data: [] };
      const p = new URLSearchParams({
        classId: selectedClassId,
        limit: "200",
        status: "ACTIVE",
      });
      if (selectedSectionId) p.set("sectionId", selectedSectionId);
      const res = await fetch(`/api/students?${p.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load students");
      return res.json();
    },
    enabled: !!selectedClassId,
  });
  const rawStudents = (studentsData as any)?.data || EMPTY_ARRAY;

  // 4. Query Class Fee Structure for selected class
  const { data: structureData } = useQuery({
    queryKey: ["class-fee-structure-bulk", selectedClassId, activeYearId],
    queryFn: async () => {
      if (!selectedClassId) return null;
      const res = await fetch(
        `/api/fees/structures?classId=${selectedClassId}&academicYearId=${activeYearId}`,
        { credentials: "include" }
      );
      if (!res.ok) return null;
      const json = await res.json();
      return json.data?.[0] || null;
    },
    enabled: !!selectedClassId,
  });

  const classStandardMonthlyFee =
    structureData?.totalMonthlyFee || structureData?.tuitionFee || 2500;

  // 5. Query Open Vouchers for this Class
  const { data: vouchersData } = useQuery({
    queryKey: ["vouchers-bulk-class", selectedClassId, activeYearId],
    queryFn: async () => {
      if (!selectedClassId) return { data: [] };
      const res = await fetch(`/api/fees?limit=300`, {
        credentials: "include",
      });
      if (!res.ok) return { data: [] };
      return res.json();
    },
    enabled: !!selectedClassId,
  });
  const openVouchers = (vouchersData as any)?.data || EMPTY_ARRAY;

  // 6. Query Concessions
  const { data: concessionsData } = useQuery({
    queryKey: ["concessions-bulk"],
    queryFn: async () => {
      const res = await fetch("/api/fees/concessions?limit=500", { credentials: "include" });
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });
  const concessions = (concessionsData as any)?.data || EMPTY_ARRAY;

  // User modifications state (amounts and selections)
  const [userAmounts, setUserAmounts] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // Reset local edits when class, section or month filter changes
  useEffect(() => {
    setUserAmounts({});
    setSelectedIds({});
  }, [selectedClassId, selectedSectionId, selectedMonthIndex]);

  // Derived 12-Month Roster in useMemo
  const roster: StudentRowState[] = useMemo(() => {
    if (!rawStudents.length) return [];

    const openVouchersMap = new Map<string, any>(
      openVouchers.map((v: any) => [v.studentProfileId, v])
    );
    const concessionMap = new Map<string, any>(
      concessions.map((c: any) => [c.studentProfileId, c])
    );

    return rawStudents.map((s: any) => {
      const voucher = openVouchersMap.get(s.id);
      const conc = concessionMap.get(s.id);

      const baseMonthlyFee = classStandardMonthlyFee;
      let monthlyDiscount = 0;

      if (conc) {
        if (conc.discountType === "PERCENTAGE") {
          monthlyDiscount = Math.round(((baseMonthlyFee * conc.discountValue) / 100) * 100) / 100;
        } else {
          monthlyDiscount = Math.min(conc.discountValue, baseMonthlyFee);
        }
      }

      const netMonthly = Math.max(0, baseMonthlyFee - monthlyDiscount);
      const annualTotalDue = voucher ? voucher.totalDue : netMonthly * 12;
      const amountPaidSoFar = voucher ? voucher.amountPaid || 0 : 0;
      const remainingDue = voucher
        ? voucher.balance
        : Math.max(0, annualTotalDue - amountPaidSoFar);

      const paidMonthsCount = Math.min(12, Math.floor(amountPaidSoFar / (netMonthly || 1)));
      const unpaidMonthsCount = Math.max(0, 12 - paidMonthsCount);

      // Which month is being paid next for this student
      const nextMonthIndex = Math.min(11, paidMonthsCount);
      const targetMonthLabel = MONTH_NAMES[nextMonthIndex] || t("monthFallback");
      const isAlreadyPaidForTargetMonth = paidMonthsCount > selectedMonthIndex;

      // Default amount to pay = 0 unless user enters an amount or clicks an auto-fill button
      const amountToPay =
        userAmounts[s.id] !== undefined ? userAmounts[s.id] : 0;

      // Default selection = false (unselected) unless user checks them or clicks Select All
      const isSelected =
        selectedIds[s.id] !== undefined ? selectedIds[s.id] : false;

      return {
        id: s.id,
        studentId: s.studentId || "N/A",
        rollNumber: s.rollNumber || "—",
        firstName: s.firstName || "",
        lastName: s.lastName || "",
        classId: s.classId,
        className: s.class?.name || selectedClass?.name || "Class",
        sectionName: s.section?.name,
        baseMonthlyFee,
        discountAmount: monthlyDiscount,
        annualTotalDue,
        amountPaidSoFar,
        paidMonthsCount,
        unpaidMonthsCount,
        remainingDue,
        targetMonthLabel,
        isAlreadyPaidForTargetMonth,
        amountToPay,
        isSelected,
        existingVoucherId: voucher?.id,
      };
    });
  }, [
    rawStudents,
    classStandardMonthlyFee,
    openVouchers,
    concessions,
    userAmounts,
    selectedIds,
    selectedClass,
    selectedMonthIndex,
  ]);

  // Filtered Roster by Search Query
  const displayedRoster = useMemo(() => {
    if (!searchQuery.trim()) return roster;
    const q = searchQuery.toLowerCase().trim();
    return roster.filter((r) => {
      const fullName = `${r.firstName} ${r.lastName}`.toLowerCase();
      const studentId = (r.studentId || "").toLowerCase();
      const rollNumber = (r.rollNumber || "").toLowerCase();
      const section = (r.sectionName || "").toLowerCase();
      return (
        fullName.includes(q) ||
        studentId.includes(q) ||
        rollNumber.includes(q) ||
        section.includes(q)
      );
    });
  }, [roster, searchQuery]);

  // Bulk Payment Mutation
  const bulkCollectMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/fees/bulk-collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to record bulk payments");
      }
      return json.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["students-for-bulk-fee"] });
      qc.invalidateQueries({ queryKey: ["vouchers-bulk-class"] });
      qc.invalidateQueries({ queryKey: ["fees"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setUserAmounts({});
      setSelectedIds({});
      toast.success(
        t("success", { amount: formatCurrency(data.totalCollected), count: data.studentsCount })
      );
    },
    onError: (err: any) => {
      toast.error(err.message || t("submitFailed"));
    },
  });

  // Table Helpers
  const selectedRows = roster.filter((r) => r.isSelected && r.amountToPay > 0);
  const isAllSelected = roster.length > 0 && roster.every((r) => r.isSelected);
  const totalCollecting = selectedRows.reduce(
    (sum, r) => sum + (Number(r.amountToPay) || 0),
    0
  );

  const toggleSelectAll = () => {
    const nextVal = !isAllSelected;
    const nextSelected: Record<string, boolean> = {};
    const nextAmounts: Record<string, number> = { ...userAmounts };

    roster.forEach((r) => {
      nextSelected[r.id] = nextVal;
      if (nextVal) {
        if (!nextAmounts[r.id] || nextAmounts[r.id] === 0) {
          const netMonthly = r.baseMonthlyFee - r.discountAmount;
          nextAmounts[r.id] = Math.min(netMonthly, r.remainingDue);
        }
      } else {
        nextAmounts[r.id] = 0;
      }
    });

    setSelectedIds(nextSelected);
    setUserAmounts(nextAmounts);
  };

  const toggleRow = (id: string) => {
    const student = roster.find((r) => r.id === id);
    const currentSelected = selectedIds[id] !== undefined ? selectedIds[id] : false;
    const nextSelected = !currentSelected;

    setSelectedIds((prev) => ({ ...prev, [id]: nextSelected }));

    if (nextSelected && (!userAmounts[id] || userAmounts[id] === 0) && student) {
      const netMonthly = student.baseMonthlyFee - student.discountAmount;
      setUserAmounts((prev) => ({
        ...prev,
        [id]: Math.min(netMonthly, student.remainingDue),
      }));
    } else if (!nextSelected) {
      setUserAmounts((prev) => ({ ...prev, [id]: 0 }));
    }
  };

  const updateAmountToPay = (id: string, amount: number) => {
    setUserAmounts((prev) => ({ ...prev, [id]: amount }));
    setSelectedIds((prev) => ({ ...prev, [id]: amount > 0 }));
  };

  const autoFillSelectedMonth = () => {
    const newAmounts: Record<string, number> = {};
    const newSelected: Record<string, boolean> = {};
    roster.forEach((r) => {
      const netMonthly = r.baseMonthlyFee - r.discountAmount;
      if (r.paidMonthsCount <= selectedMonthIndex) {
        newAmounts[r.id] = Math.min(netMonthly, r.remainingDue);
        newSelected[r.id] = true;
      } else {
        newAmounts[r.id] = 0;
        newSelected[r.id] = false;
      }
    });
    setUserAmounts(newAmounts);
    setSelectedIds(newSelected);
    toast.info(t("autoMonthToast", { month: MONTH_NAMES[selectedMonthIndex] }));
  };

  const autoFillUpToSelectedMonth = () => {
    const newAmounts: Record<string, number> = {};
    const newSelected: Record<string, boolean> = {};
    roster.forEach((r) => {
      const netMonthly = r.baseMonthlyFee - r.discountAmount;
      const unpaidMonthsNeeded = Math.max(0, selectedMonthIndex + 1 - r.paidMonthsCount);
      const duesUpToMonth = Math.min(unpaidMonthsNeeded * netMonthly, r.remainingDue);
      newAmounts[r.id] = duesUpToMonth;
      newSelected[r.id] = duesUpToMonth > 0;
    });
    setUserAmounts(newAmounts);
    setSelectedIds(newSelected);
    toast.info(t("autoDueToast", { month: MONTH_NAMES[selectedMonthIndex] }));
  };

  const autoFillFullYearRemaining = () => {
    const newAmounts: Record<string, number> = {};
    const newSelected: Record<string, boolean> = {};
    roster.forEach((r) => {
      newAmounts[r.id] = r.remainingDue;
      newSelected[r.id] = r.remainingDue > 0;
    });
    setUserAmounts(newAmounts);
    setSelectedIds(newSelected);
    toast.info(t("autoFullToast"));
  };

  const currentMonthName = MONTH_NAMES[selectedMonthIndex];

  const handleSubmitBulk = async () => {
    if (!selectedRows.length) {
      toast.error(t("selectError"));
      return;
    }

    const payload = {
      academicYearId: activeYearId,
      classId: selectedClassId,
      sectionId: selectedSectionId || undefined,
      paymentMethod,
      feeType: `${currentMonthName} Fee (12-Month Ledger)`,
      payments: selectedRows.map((r) => ({
        studentProfileId: r.id,
        amountPaid: Number(r.amountToPay) || 0,
        feeVoucherId: r.existingVoucherId || undefined,
        note: `Bulk Class Payment for ${currentMonthName} (${paymentMethod}) - 12 Months Ledger`,
      })),
    };

    await bulkCollectMutation.mutateAsync(payload);
  };

  const paymentModes = [
    { id: "CASH", label: "Cash", icon: Wallet },
    { id: "BANK_TRANSFER", label: "Bank Transfer", icon: Building2 },
    { id: "POS_CARD", label: "Card / POS", icon: CreditCard },
    { id: "EASYPAISA", label: "EasyPaisa", icon: Smartphone },
    { id: "JAZZCASH", label: "JazzCash", icon: Smartphone },
  ];

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={Users}
      >
        {canWriteFees && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/fees/collection")}
            className="gap-1.5 text-xs font-semibold rounded-lg border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 shadow-xs"
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>{t("singlePos")}</span>
          </Button>
        )}
      </PageHeader>

      {!isAuthLoading && !canReadFees ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Access restricted</h2>
          <p className="mt-2 text-sm text-muted-foreground">You do not have permission to view fees.</p>
        </div>
      ) : (
        <>

      {/* Top Filter Selection Card */}
      <Card className="border border-border shadow-none rounded-lg">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Academic Year */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{t("academicYear")}</Label>
              <select
                value={activeYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {academicYears.map((ay: any) => (
                  <option key={ay.id} value={ay.id}>
                    {ay.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Class */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">{t("selectClass")}</Label>
              <select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setSelectedSectionId("");
                }}
                className="w-full h-9 px-3 rounded-lg border border-primary bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {classes.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Section */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{t("sectionOptional")}</Label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-xs"
              >
                <option value="">{t("allSections")}</option>
                {availableSections.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    Section {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Fee Month */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-primary flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> {t("targetMonth")}
              </Label>
              <select
                value={selectedMonthIndex}
                onChange={(e) => setSelectedMonthIndex(Number(e.target.value))}
                className="w-full h-9 px-3 rounded-lg border border-primary bg-primary/5 text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx}>
                    {t("month")} {idx + 1}: {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{t("paymentMode")}</Label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-input bg-background text-xs font-semibold"
              >
                {paymentModes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Class Overview Metric Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
              {t("classMonthlyRate")}
            </p>
            <p className="text-base font-bold text-emerald-600 font-mono mt-0.5">
              {formatCurrency(classStandardMonthlyFee)} {t("perMonth")}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono">
              {t("total12Month", { amount: formatCurrency(classStandardMonthlyFee * 12) })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
              Total Enrolled Students
            </p>
            <p className="text-base font-bold text-foreground font-mono mt-0.5">
              {roster.length} Students
            </p>
            <p className="text-[10px] text-muted-foreground">
              {selectedClass?.name || "Class"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
              {t("selectedToCollect", { month: currentMonthName })}
            </p>
            <p className="text-base font-bold text-primary font-mono mt-0.5">
              {selectedRows.length} {t("students")} ({formatCurrency(totalCollecting)})
            </p>
            <p className="text-[10px] text-primary font-semibold">
              via {paymentMethod}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Class Student Roster Spreadsheet Table */}
      <Card className="border border-border shadow-none rounded-lg overflow-hidden">
        <div className="p-3.5 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-muted/10">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="h-8 text-xs font-semibold"
            >
              {isAllSelected ? t("deselectAll") : t("selectAll")}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={autoFillSelectedMonth}
              className="h-8 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
            >
              <Calendar className="h-3.5 w-3.5" />
              {t("autoFillMonth", { month: currentMonthName })}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={autoFillUpToSelectedMonth}
              className="h-8 text-xs font-semibold"
            >
              {t("autoFillDue", { month: currentMonthName })}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={autoFillFullYearRemaining}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              {t("autoFillFull")}
            </Button>
          </div>

          {/* Student Search Box */}
          <div className="relative min-w-[220px] sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-7 text-xs bg-background rounded-lg border-input focus:ring-primary w-full"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3">{t("roll")}</th>
                <th className="py-3 px-4">{t("studentName")}</th>
                <th className="py-3 px-3">{t("monthlyRate")}</th>
                <th className="py-3 px-3">{t("paidToDate")}</th>
                <th className="py-3 px-3 font-bold text-primary">{t("collectingFor")}</th>
                <th className="py-3 px-3 font-bold text-foreground">{t("remainingDues")}</th>
                <th className="py-3 px-4 font-bold text-foreground w-44">
                  {t("payingAmount", { currency: currencySymbol })}
                </th>
                <th className="py-3 px-3 text-right">{t("status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoadingStudents ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    {t("loadingStudents")}
                  </td>
                </tr>
              ) : roster.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="font-semibold text-xs text-foreground">
                      {t("noStudents")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {t("tryClass")}
                    </p>
                  </td>
                </tr>
              ) : displayedRoster.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <Search className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="font-semibold text-xs text-foreground">
                      {t("noMatching", { term: searchQuery })}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t("trySearch")}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchQuery("")}
                      className="mt-2 h-7 text-xs text-primary font-semibold"
                    >
                      {t("clearSearch")}
                    </Button>
                  </td>
                </tr>
              ) : (
                displayedRoster.map((row) => (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      row.isSelected
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-muted/30 opacity-70"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={row.isSelected}
                        onChange={() => toggleRow(row.id)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                    </td>

                    {/* Roll Number */}
                    <td className="py-3 px-3 font-mono font-bold text-muted-foreground">
                      {row.rollNumber}
                    </td>

                    {/* Student Name */}
                    <td className="py-3 px-4 font-bold text-foreground">
                      <div>
                        <span>
                          {row.firstName} {row.lastName}
                        </span>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {t("id")} {row.studentId}{" "}
                          {row.sectionName && `• ${t("sectionShort")} ${row.sectionName}`}
                        </p>
                      </div>
                    </td>

                    {/* Monthly Base Fee */}
                    <td className="py-3 px-3 font-mono text-muted-foreground">
                      {formatCurrency(row.baseMonthlyFee - row.discountAmount)}
                      {row.discountAmount > 0 && (
                        <span className="text-[10px] text-emerald-600 block">
                          (-{formatCurrency(row.discountAmount)} {t("scholarship")})
                        </span>
                      )}
                    </td>

                    {/* Paid to Date */}
                    <td className="py-3 px-3 font-mono">
                      {row.amountPaidSoFar > 0 ? (
                        <div>
                          <span className="text-emerald-600 font-bold">
                            {formatCurrency(row.amountPaidSoFar)}
                          </span>
                          <p className="text-[10px] text-emerald-600 font-semibold">
                            {row.paidMonthsCount}/12 Mo (
                            {MONTH_NAMES.slice(0, row.paidMonthsCount).map((m) => m.slice(0, 3)).join(", ")}
                            ) {t("paid")}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{t("noPaid", { currency: currencySymbol })}</span>
                      )}
                    </td>

                    {/* Collecting For Month Badge */}
                    <td className="py-3 px-3">
                      {row.isAlreadyPaidForTargetMonth ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold border-emerald-300 text-emerald-700 bg-emerald-50"
                        >
                          {currentMonthName} {t("paid")}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-bold border-primary text-primary bg-primary/10"
                        >
                          {row.targetMonthLabel}
                        </Badge>
                      )}
                    </td>

                    {/* Remaining Dues */}
                    <td className="py-3 px-3 font-mono font-bold text-rose-600">
                      <div>
                        <span>{formatCurrency(row.remainingDue)}</span>
                        <p className="text-[10px] text-muted-foreground font-normal">
                          {t("unpaidMonths", { count: row.unpaidMonthsCount })}
                        </p>
                      </div>
                    </td>

                    {/* Paying Amount Input */}
                    <td className="py-2.5 px-4">
                      <Input
                        type="number"
                        min="0"
                        placeholder={t("amountPlaceholder")}
                        value={row.amountToPay === 0 ? "" : row.amountToPay}
                        onChange={(e) =>
                          updateAmountToPay(
                            row.id,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="h-8 text-xs font-mono font-bold w-36 bg-background border-input focus:ring-primary"
                      />
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 text-right">
                      {row.amountToPay >= row.remainingDue && row.remainingDue > 0 ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                          {t("clearAll")}
                        </Badge>
                      ) : row.amountToPay > 0 ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold border-primary text-primary bg-primary/10"
                        >
                          {t("collect")}
                        </Badge>
                      ) : row.isAlreadyPaidForTargetMonth ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] text-emerald-700 bg-emerald-100"
                        >
                          {t("paid")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          {t("skip")}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-4 left-4 right-4 md:left-72 md:right-8 bg-card/95 backdrop-blur-md border border-border shadow-xl rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 z-40">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-xs">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">
              {t("summary", { month: currentMonthName })}
            </p>
            <p className="text-sm font-bold text-foreground">
              {t("collecting")}{" "}
              <span className="text-emerald-600 font-mono">
                {formatCurrency(totalCollecting)}
              </span>{" "}
              {t("for")}{" "}
              <span className="text-primary">
                {selectedRows.length} {t("students")}
              </span>{" "}
              via {paymentMethod}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/fees")}
            className="text-xs"
          >
            {t("cancel")}
          </Button>
          {canWriteFees && (
            <Button
              onClick={handleSubmitBulk}
              disabled={
                bulkCollectMutation.isPending || selectedRows.length === 0
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 px-6 h-10 rounded-lg shadow-sm"
            >
              {bulkCollectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("recording")}
                  {t("recording")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> {t("collectFees", { month: currentMonthName, count: selectedRows.length })}
                  {selectedRows.length})
                </>
              )}
            </Button>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}
