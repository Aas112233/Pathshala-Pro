"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ERPDataTable } from "@/components/ui/erp-data-table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTenantFormatting, useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { usePDFExport } from "@/hooks/use-pdf-export";
import { useAcademicYearContext } from "@/components/providers/academic-year-provider";
import { DEFAULT_PAYMENT_METHODS } from "@/lib/tenant-settings";
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
import { addCurrency, applyPercentage, roundCurrency } from "@/lib/math-utils";
import { fuzzyFilter } from "@/lib/utils";
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
  const tCommon = useTranslations("common");
  const qc = useQueryClient();
  const { formatCurrency, currencySymbol, formatDate } = useTenantFormatting();
  const { settings } = useTenantSettings();
  const { exportFeeVouchersPDF } = usePDFExport();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canReadFees = hasPermission(perms, "fees", "read");
  const canWriteFees = hasPermission(perms, "fees", "write");
  const canManageFees = hasPermission(perms, "fees", "manage");

  // 1. Academic Years (global academic year selection)
  const {
    academicYears,
    selectedAcademicYearId: activeYearId,
  } = useAcademicYearContext();
  const selectedYear = academicYears.find((ay: any) => ay.id === activeYearId);

  // 2. Classes query
  const { data: classesResponse } = useQuery({
    queryKey: ["classes", "bulk-fee"],
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

  const selectedClass = classes.find((c: any) => c.id === selectedClassId);
  const availableSections = selectedClass?.sections || EMPTY_ARRAY;

  // 3. Query Students for Selected Class & Section
  const { data: studentsData, isLoading: isLoadingStudents } = useQuery({
    queryKey: ["students", "bulk-fee", selectedClassId, selectedSectionId],
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
    queryKey: ["class-fee-structures", "bulk", selectedClassId, activeYearId],
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
    queryKey: ["vouchers", "bulk-class", selectedClassId, activeYearId],
    queryFn: async () => {
      if (!selectedClassId) return { data: [] };
      const params = new URLSearchParams({
        classId: selectedClassId,
        limit: "500",
      });
      if (activeYearId) {
        params.set("academicYearId", activeYearId);
      }
      const res = await fetch(`/api/fees?${params.toString()}`, {
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
    queryKey: ["concessions", "bulk"],
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

    const targetMonth = selectedMonthIndex + 1;
    const openVouchersMap = new Map<string, any>();
    for (const v of openVouchers) {
      if (v.billingMonth === targetMonth) {
        openVouchersMap.set(v.studentProfileId, v);
      } else if (!v.billingMonth && v.feeType?.includes("Annual")) {
        if (!openVouchersMap.has(v.studentProfileId)) {
          openVouchersMap.set(v.studentProfileId, v);
        }
      }
    }
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
          monthlyDiscount = applyPercentage(baseMonthlyFee, Number(conc.discountValue));
        } else {
          monthlyDiscount = Math.min(conc.discountValue, baseMonthlyFee);
        }
      }

      const netMonthly = roundCurrency(Math.max(0, baseMonthlyFee - monthlyDiscount));
      const annualTotalDue = voucher ? voucher.totalDue : roundCurrency(netMonthly * 12);
      const amountPaidSoFar = voucher ? voucher.amountPaid || 0 : 0;

      const paidMonthsCount = Math.min(12, Math.floor(amountPaidSoFar / (netMonthly || 1)));
      const unpaidMonthsCount = Math.max(0, 12 - paidMonthsCount);

      // Period-scoped duplicate check: verify if the target month is already cleared
      let isAlreadyPaidForTargetMonth = false;
      let remainingDue = netMonthly;
      if (voucher) {
        if (voucher.billingMonth === targetMonth) {
          isAlreadyPaidForTargetMonth = voucher.status === "PAID" || voucher.balance <= 0;
          remainingDue = isAlreadyPaidForTargetMonth ? 0 : voucher.balance;
        } else if (!voucher.billingMonth && voucher.feeType?.includes("Annual")) {
          isAlreadyPaidForTargetMonth = voucher.status === "PAID" || voucher.balance <= 0 || paidMonthsCount > selectedMonthIndex;
          remainingDue = isAlreadyPaidForTargetMonth ? 0 : Math.min(netMonthly, voucher.balance);
        }
      }

      // Which month is being paid next for this student
      const nextMonthIndex = Math.min(11, paidMonthsCount);
      const targetMonthLabel = MONTH_NAMES[nextMonthIndex] || t("monthFallback");

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

  // Filtered Roster by Search Query with Fuzzy Ranking
  const displayedRoster = useMemo(() => {
    if (!searchQuery.trim()) return roster;
    return fuzzyFilter(roster, searchQuery, (r) => {
      return `${r.firstName} ${r.lastName} ${r.studentId || ""} ${r.rollNumber || ""} ${r.sectionName || ""}`;
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
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        const errorMsg =
          json.message ||
          json.error?.message ||
          (typeof json.error === "string" ? json.error : null) ||
          "Failed to record bulk payments";
        throw new Error(errorMsg);
      }
      return json.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["students", "bulk-fee"] });
      qc.invalidateQueries({ queryKey: ["vouchers", "bulk-class"] });
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

  // Table Helpers - only selectable students can be toggled/selected
  const selectableStudents = roster.filter((r) => !r.isAlreadyPaidForTargetMonth && r.remainingDue > 0);
  const selectedRows = selectableStudents.filter((r) => r.isSelected && r.amountToPay > 0);
  const isAllSelected = selectableStudents.length > 0 && selectableStudents.every((r) => r.isSelected);
  const totalCollecting = selectedRows.reduce(
    (sum, r) => addCurrency(sum, Number(r.amountToPay) || 0),
    0
  );

  const toggleSelectAll = () => {
    const nextVal = !isAllSelected;
    const nextSelected: Record<string, boolean> = { ...selectedIds };
    const nextAmounts: Record<string, number> = { ...userAmounts };

    roster.forEach((r) => {
      if (r.isAlreadyPaidForTargetMonth || r.remainingDue <= 0) {
        nextSelected[r.id] = false;
        nextAmounts[r.id] = 0;
        return;
      }
      nextSelected[r.id] = nextVal;
      if (nextVal) {
        if (!nextAmounts[r.id] || nextAmounts[r.id] === 0) {
          const netMonthly = roundCurrency(r.baseMonthlyFee - r.discountAmount);
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
    if (!student || student.isAlreadyPaidForTargetMonth || student.remainingDue <= 0) return;
    const currentSelected = selectedIds[id] !== undefined ? selectedIds[id] : false;
    const nextSelected = !currentSelected;

    setSelectedIds((prev) => ({ ...prev, [id]: nextSelected }));

    if (nextSelected && (!userAmounts[id] || userAmounts[id] === 0)) {
      const netMonthly = roundCurrency(student.baseMonthlyFee - student.discountAmount);
      setUserAmounts((prev) => ({
        ...prev,
        [id]: Math.min(netMonthly, student.remainingDue),
      }));
    } else if (!nextSelected) {
      setUserAmounts((prev) => ({ ...prev, [id]: 0 }));
    }
  };

  const updateAmountToPay = (id: string, amount: number) => {
    const student = roster.find((r) => r.id === id);
    if (student && (student.isAlreadyPaidForTargetMonth || student.remainingDue <= 0)) return;
    setUserAmounts((prev) => ({ ...prev, [id]: amount }));
    setSelectedIds((prev) => ({ ...prev, [id]: amount > 0 }));
  };

  // ERPDataTable selection bridge — replicates toggleRow's auto-fill of the
  // default amount when a row becomes selected.
  const handleSelectionChange = (ids: (string | number)[]) => {
    const idSet = new Set(ids.map(String));
    const nextSelected: Record<string, boolean> = {};
    const nextAmounts: Record<string, number> = { ...userAmounts };
    roster.forEach((r) => {
      if (r.isAlreadyPaidForTargetMonth || r.remainingDue <= 0) {
        nextSelected[r.id] = false;
        nextAmounts[r.id] = 0;
        return;
      }
      const sel = idSet.has(r.id);
      nextSelected[r.id] = sel;
      if (sel && (!nextAmounts[r.id] || nextAmounts[r.id] === 0)) {
        const netMonthly = roundCurrency(r.baseMonthlyFee - r.discountAmount);
        nextAmounts[r.id] = Math.min(netMonthly, r.remainingDue);
      } else if (!sel) {
        nextAmounts[r.id] = 0;
      }
    });
    setSelectedIds(nextSelected);
    setUserAmounts(nextAmounts);
  };

  const bulkColumns: import("@/components/ui/erp-data-table").ColumnDef<StudentRowState>[] = [
    {
      key: "roll",
      header: t("roll"),
      headerClassName: "py-3 px-3",
      cell: (row) => (
        <span className="font-mono font-bold text-muted-foreground">{row.rollNumber}</span>
      ),
    },
    {
      key: "studentName",
      header: t("studentName"),
      headerClassName: "py-3 px-4",
      cell: (row) => (
        <div className="font-bold text-foreground">
          <span>{row.firstName} {row.lastName}</span>
          <p className="text-[10px] text-muted-foreground font-mono">
            {t("id")} {row.studentId}{" "}
            {row.sectionName && `• ${t("sectionShort")} ${row.sectionName}`}
          </p>
        </div>
      ),
    },
    {
      key: "monthlyRate",
      header: t("monthlyRate"),
      headerClassName: "py-3 px-3",
      cell: (row) => (
        <span className="font-mono text-muted-foreground">
          {formatCurrency(roundCurrency(row.baseMonthlyFee - row.discountAmount))}
          {row.discountAmount > 0 && (
            <span className="text-[10px] text-emerald-600 block">
              (-{formatCurrency(row.discountAmount)} {t("scholarship")})
            </span>
          )}
        </span>
      ),
    },
    {
      key: "paidToDate",
      header: t("paidToDate"),
      headerClassName: "py-3 px-3",
      cell: (row) =>
        row.amountPaidSoFar > 0 ? (
          <div className="font-mono">
            <span className="text-emerald-600 font-bold">{formatCurrency(row.amountPaidSoFar)}</span>
            <p className="text-[10px] text-emerald-600 font-semibold">
              {row.paidMonthsCount}/12 Mo ({MONTH_NAMES.slice(0, row.paidMonthsCount).map((m) => m.slice(0, 3)).join(", ")}) {t("paid")}
            </p>
          </div>
        ) : (
          <span className="font-mono text-muted-foreground">{t("noPaid", { currency: currencySymbol })}</span>
        ),
    },
    {
      key: "collectingFor",
      header: t("collectingFor"),
      headerClassName: "py-3 px-3 font-bold text-primary",
      cell: (row) =>
        row.isAlreadyPaidForTargetMonth ? (
          <Badge variant="outline" className="text-[10px] font-semibold border-emerald-300 text-emerald-700 bg-emerald-50">
            {currentMonthName} {t("paid")}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] font-bold border-primary text-primary bg-primary/10">
            {row.targetMonthLabel}
          </Badge>
        ),
    },
    {
      key: "remainingDues",
      header: t("remainingDues"),
      headerClassName: "py-3 px-3 font-bold text-foreground",
      cell: (row) => (
        <div className="font-mono font-bold text-rose-600">
          <span>{formatCurrency(row.remainingDue)}</span>
          <p className="text-[10px] text-muted-foreground font-normal">
            {t("unpaidMonths", { count: row.unpaidMonthsCount })}
          </p>
        </div>
      ),
    },
    {
      key: "payingAmount",
      header: t("payingAmount", { currency: currencySymbol }),
      headerClassName: "py-3 px-4 font-bold text-foreground w-44",
      cell: (row) => (
        <Input
          type="number"
          min="0"
          disabled={row.isAlreadyPaidForTargetMonth || row.remainingDue <= 0}
          placeholder={row.isAlreadyPaidForTargetMonth ? t("paid") : t("amountPlaceholder")}
          value={row.amountToPay === 0 ? "" : row.amountToPay}
          onChange={(e) => updateAmountToPay(row.id, parseFloat(e.target.value) || 0)}
          className="h-8 text-xs font-mono font-bold w-36 bg-background border-input focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        />
      ),
    },
    {
      key: "status",
      header: t("status"),
      headerClassName: "py-3 px-3 text-right",
      className: "text-right",
      cell: (row) =>
        row.amountToPay >= row.remainingDue && row.remainingDue > 0 ? (
          <Badge variant="outline" className="text-[10px] font-semibold border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300">
            {t("clearAll")}
          </Badge>
        ) : row.amountToPay > 0 ? (
          <Badge variant="outline" className="text-[10px] font-semibold border-primary text-primary bg-primary/10">
            {t("collect")}
          </Badge>
        ) : row.isAlreadyPaidForTargetMonth ? (
          <Badge variant="secondary" className="text-[10px] text-emerald-700 bg-emerald-100">
            {t("paid")}
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">{t("skip")}</Badge>
        ),
    },
  ];

  const autoFillSelectedMonth = () => {
    const newAmounts: Record<string, number> = {};
    const newSelected: Record<string, boolean> = {};
    roster.forEach((r) => {
      const netMonthly = roundCurrency(r.baseMonthlyFee - r.discountAmount);
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
      const netMonthly = roundCurrency(r.baseMonthlyFee - r.discountAmount);
      const unpaidMonthsNeeded = Math.max(0, selectedMonthIndex + 1 - r.paidMonthsCount);
      const duesUpToMonth = Math.min(roundCurrency(unpaidMonthsNeeded * netMonthly), r.remainingDue);
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

  const handleDownloadChallans = async () => {
    if (!selectedRows.length) { toast.error(t("selectError")); return; }
    const vouchers = selectedRows.map((r)=>({
      schoolName: settings.name || "Pathshala Pro School",
      schoolAddress: settings.address, schoolCode: (settings as any).schoolCode,
      currencySymbol, voucherId: r.existingVoucherId || `VCH-${r.studentId}-${Date.now().toString().slice(-5)}`,
      issueDate: formatDate(new Date()), dueDate: formatDate(new Date(Date.now()+7*86400000)),
      studentName: `${r.firstName} ${r.lastName}`, studentId: r.studentId, rollNumber: r.rollNumber,
      className: r.className, sectionName: r.sectionName, feeType: `${currentMonthName} Fee`,
      academicYear: selectedYear?.label || new Date().getFullYear().toString(),
      baseAmount: r.baseMonthlyFee, discountAmount: r.discountAmount, arrears: 0, totalDue: r.amountToPay,
    }));
    const res = await exportFeeVouchersPDF(vouchers as any);
    if(res.success) toast.success(t("challansDownloaded")); else toast.error(t("pdfFailed"));
  };

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
      month: selectedMonthIndex + 1,
      year: new Date().getFullYear(),
      feeType: "TUITION",
      payments: selectedRows.map((r) => ({
        studentProfileId: r.id,
        amountPaid: Number(r.amountToPay) || 0,
        feeVoucherId: r.existingVoucherId || undefined,
        note: `Bulk Class Payment for ${currentMonthName} (${paymentMethod})`,
      })),
    };

    await bulkCollectMutation.mutateAsync(payload);
  };

  const configuredMethods = useMemo(() => {
    const list = settings.paymentMethods && settings.paymentMethods.length > 0
      ? settings.paymentMethods
      : DEFAULT_PAYMENT_METHODS;
    return list.filter((m) => m.isActive);
  }, [settings.paymentMethods]);

  const paymentModes = useMemo(() => {
    return configuredMethods.map((m) => {
      let icon = Smartphone;
      if (m.type === "CASH" || m.code === "CASH") icon = Wallet;
      else if (m.type === "BANK" || m.code === "BANK_TRANSFER") icon = Building2;
      else if (m.type === "CHEQUE" || m.code === "CHEQUE") icon = Receipt;
      else if (m.code === "POS_CARD") icon = CreditCard;

      return {
        id: m.code,
        label: m.name,
        icon,
      };
    });
  }, [configuredMethods]);

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
          <h2 className="text-lg font-semibold text-foreground">{tCommon("accessRestricted")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{tCommon("noPermission")}</p>
        </div>
      ) : (
        <>

      {/* Top Filter Selection Card */}
      <Card className="border border-border shadow-none rounded-lg">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Target Class */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">{t("selectClass")}</Label>
              <AppDropdown
                value={selectedClassId}
                onChange={(v) => {
                  setSelectedClassId(v);
                  setSelectedSectionId("");
                }}
                options={classes.map((c: any) => ({ value: c.id, label: c.name }))}
                placeholder={t("selectClass")}
                searchable
              />
            </div>

            {/* Target Section */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{t("sectionOptional")}</Label>
              <AppDropdown
                value={selectedSectionId}
                onChange={(v) => setSelectedSectionId(v)}
                options={[
                  { value: "", label: t("allSections") },
                  ...availableSections.map((s: any) => ({ value: s.id, label: `Section ${s.name}` }))
                ]}
              />
            </div>

            {/* Target Fee Month */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-primary flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> {t("targetMonth")}
              </Label>
              <AppDropdown
                value={String(selectedMonthIndex)}
                onChange={(v) => setSelectedMonthIndex(Number(v))}
                options={MONTH_NAMES.map((m, idx) => ({
                  value: String(idx),
                  label: `${t("month")} ${idx + 1}: ${m}`
                }))}
                searchable
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{t("paymentMode")}</Label>
              <AppDropdown
                value={paymentMethod}
                onChange={(v) => setPaymentMethod(v)}
                options={paymentModes.map((m) => ({ value: m.id, label: m.label }))}
              />
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
              {t("total12Month", { amount: formatCurrency(roundCurrency(classStandardMonthlyFee * 12)) })}
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

        <ERPDataTable<StudentRowState>
          data={displayedRoster}
          keyExtractor={(row) => row.id}
          columns={bulkColumns}
          selectedIds={roster.filter((r) => r.isSelected).map((r) => r.id)}
          onSelectionChange={handleSelectionChange}
          isRowSelectable={(row) => !row.isAlreadyPaidForTargetMonth && row.remainingDue > 0}
          isLoading={isLoadingStudents}
          rowClassName={(row) => (row.isSelected ? "bg-primary/5 hover:bg-primary/10" : "opacity-70")}
          emptyState={
            roster.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-semibold text-xs text-foreground">{t("noStudents")}</p>
                <p className="text-[11px] text-muted-foreground">{t("tryClass")}</p>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <Search className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
                <p className="font-semibold text-xs text-foreground">
                  {t("noMatching", { term: searchQuery })}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t("trySearch")}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="mt-2 h-7 text-xs text-primary font-semibold"
                >
                  {t("clearSearch")}
                </Button>
              </div>
            )
          }
        />
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
          <Button variant="outline" size="sm" onClick={handleDownloadChallans} disabled={selectedRows.length===0} className="gap-1.5 text-xs" title={t("challansTitle")}>
            <Receipt className="h-3.5 w-3.5" />Challans PDF
          </Button>
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
