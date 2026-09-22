"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantFormatting, useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { usePDFExport, type FeeVoucherPDFData } from "@/hooks/use-pdf-export";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { toast } from "sonner";
import { ACADEMIC_MONTHS } from "@/lib/constants";
import { addCurrency, roundCurrency } from "@/lib/math-utils";
import { formatStudentName, fuzzyFilter } from "@/lib/utils";
import { DEFAULT_PAYMENT_METHODS } from "@/lib/tenant-settings";
import { useAuth } from "@/components/providers/auth-provider";
import { useAcademicYearContext } from "@/components/providers/academic-year-provider";
import { hasPermission, getEffectivePermissions } from "@/lib/permissions";
import Link from "next/link";
import {
  CreditCard,
  Search,
  User,
  Receipt,
  Printer,
  CheckCircle2,
  ArrowRight,
  Wallet,
  Loader2,
  X,
  Phone,
  Calendar,
  TrendingUp,
  Sparkles,
  Building2,
  Smartphone,
  History,
  AlertTriangle,
  Settings,
} from "lucide-react";

export default function FeeCollectionPage() {
  const t = useTranslations("collection");
  const tCommon = useTranslations("common");
  const tMonths = useTranslations("months");
  const qc = useQueryClient();
  const { formatCurrency, formatDate, currencySymbol } = useTenantFormatting();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const { selectedAcademicYearId: activeYearId, activeAcademicYear, academicYears } = useAcademicYearContext();
  const activeAcademicYearLabel =
    academicYears.find((y) => y.id === activeYearId)?.label ||
    activeAcademicYear?.label ||
    String(new Date().getFullYear());
  const perms = getEffectivePermissions(authUser?.role as string, (authUser as any)?.permissions, (authUser as any)?.accessLevel);
  const canReadFees = hasPermission(perms, "fees", "read");
  const canWriteFees = hasPermission(perms, "fees", "write");
  const canManageFees = hasPermission(perms, "fees", "manage");
  const { exportFeeVouchersPDF } = usePDFExport();
  const { run: runPayment, isPending: isGuardedPayment } = useSubmitGuard();

  // Search & Student Selection State
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [selectedVoucherIds, setSelectedVoucherIds] = useState<string[]>([]);
  const [invoicesTab, setInvoicesTab] = useState<"pending" | "paid">("pending");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Clear any legacy session storage key on mount to guarantee fresh start
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("pos_last_selected_student");
      } catch {}
    }
  }, []);

  // Billing period state: multi-month selection (empty by default until student is selected)
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [inspectingPaidMonth, setInspectingPaidMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Cashier Payment Form State
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [cashTendered, setCashTendered] = useState<string>("");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [walletAmount, setWalletAmount] = useState<string>("");
  const [autoApplyWallet, setAutoApplyWallet] = useState<boolean>(false);
  const [chequeNumber, setChequeNumber] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState<string>("");
  const [lastPaymentResult, setLastPaymentResult] = useState<any | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  // 1. Search Students
  const { data: studentsData, isLoading: isSearching } = useQuery({
    queryKey: ["students", "fee-collection", searchTerm],
    queryFn: async () => {
      const p = new URLSearchParams({ limit: "15" });
      if (searchTerm.trim()) p.set("search", searchTerm.trim());
      const res = await fetch(`/api/students?${p.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to search students");
      return res.json();
    },
  });
  const rawStudentsList: any[] = (studentsData as any)?.data ?? [];
  const studentsList = useMemo(() => {
    if (!searchTerm.trim()) return rawStudentsList;
    return fuzzyFilter(rawStudentsList, searchTerm, (s: any) => {
      const name = formatStudentName(s.firstName, s.lastName, s.firstNameBn, s.lastNameBn);
      return `${name} ${s.rollNumber || ""} ${s.studentId || ""}`;
    });
  }, [rawStudentsList, searchTerm]);

  // 2. Fetch Vouchers for Selected Student (Scoped to active academic year)
  const { data: studentVouchersData, isLoading: isLoadingVouchers } = useQuery({
    queryKey: ["vouchers", "student", selectedStudent?.id, activeYearId],
    queryFn: async () => {
      if (!selectedStudent?.id) return { data: [] };
      const p = new URLSearchParams({
        studentProfileId: selectedStudent.id,
        limit: "50",
      });
      if (activeYearId) p.set("academicYearId", activeYearId);
      const res = await fetch(`/api/fees?${p.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || "Failed to fetch student vouchers");
      }
      return res.json();
    },
    enabled: !!selectedStudent?.id,
  });
  const allStudentVouchers = (studentVouchersData as any)?.data ?? [];
  const unpaidVouchers = allStudentVouchers.filter(
    (v: any) => v.status === "PENDING" || v.status === "PARTIAL" || v.status === "OVERDUE"
  );
  const paidVouchers = allStudentVouchers.filter(
    (v: any) => v.status === "PAID" || v.balance <= 0
  );

  // Map vouchers by discrete billing month for schedule rendering & duplicate checks
  const vouchersByMonth = useMemo(() => {
    const map = new Map<number, any>();
    for (const v of allStudentVouchers) {
      if (v.billingMonth) {
        map.set(v.billingMonth, v);
      }
    }
    return map;
  }, [allStudentVouchers]);

  // 3. Fetch Student Class Fee Structure (for direct on-the-spot collection)
  const { data: studentClassStructureData } = useQuery({
    queryKey: ["class-fee-structures", "student-class", selectedStudent?.classId, activeYearId],
    queryFn: async () => {
      if (!selectedStudent?.classId) return null;
      const p = new URLSearchParams({ classId: selectedStudent.classId });
      if (activeYearId) p.set("academicYearId", activeYearId);
      const res = await fetch(`/api/fees/structures?${p.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data?.[0] || null;
    },
    enabled: !!selectedStudent?.classId,
  });

  // 3b. Fetch Recorded Transaction Receipts for Selected Student
  const { data: studentTxData, isLoading: isLoadingStudentTx } = useQuery({
    queryKey: ["transactions", "student", selectedStudent?.id],
    queryFn: async () => {
      if (!selectedStudent?.id) return { data: [] };
      const res = await fetch(`/api/transactions?studentProfileId=${selectedStudent.id}&limit=20`, {
        credentials: "include",
      });
      if (!res.ok) return { data: [] };
      return res.json();
    },
    enabled: !!selectedStudent?.id,
  });
  const studentTransactions: any[] = (studentTxData as any)?.data ?? [];

  const standardMonthlyFee =
    studentClassStructureData?.totalMonthlyFee || studentClassStructureData?.tuitionFee || 0;
  const hasFeeStructure = !!studentClassStructureData && standardMonthlyFee > 0;

  // 4. Fetch Recent Today Transactions
  const { data: recentTxData, isLoading: isLoadingRecent } = useQuery({
    queryKey: ["transactions", "today-cashier"],
    queryFn: async () => {
      const res = await fetch("/api/transactions?limit=10", { credentials: "include" });
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });
  const recentTransactions = (recentTxData as any)?.data ?? [];
  const todayTotalCollected = recentTransactions.reduce(
    (sum: number, tx: any) => addCurrency(sum, tx.amountPaid || 0),
    0
  );

  // 12-Month Annual Ledger Calculations for Selected Student
  const annualCalculations = useMemo(() => {
    if (!selectedStudent) {
      return {
        baseMonthly: 0,
        totalPaid: 0,
        annualTotalDue: 0,
        remainingDue: 0,
        paidMonthsCount: 0,
        unpaidMonthsCount: 0,
      };
    }
    const baseMonthly = standardMonthlyFee;
    const totalPaid = allStudentVouchers.reduce(
      (s: number, v: any) => addCurrency(s, v.amountPaid || 0),
      0
    );
    const annualTotalDue = roundCurrency(baseMonthly * 12);
    const remainingDue = roundCurrency(Math.max(0, annualTotalDue - totalPaid));
    const paidMonthsCount = baseMonthly > 0 ? Math.min(12, Math.floor(totalPaid / baseMonthly)) : 0;
    const unpaidMonthsCount = Math.max(0, 12 - paidMonthsCount);

    return {
      baseMonthly,
      totalPaid,
      annualTotalDue,
      remainingDue,
      paidMonthsCount,
      unpaidMonthsCount,
    };
  }, [selectedStudent, standardMonthlyFee, allStudentVouchers]);

  // Chronological list of unpaid month indices (0..11)
  const unpaidMonthIndices = useMemo(() => {
    if (!selectedStudent) return [];
    const list: number[] = [];
    for (let i = 0; i < 12; i++) {
      const mNum = i + 1;
      const mV = vouchersByMonth.get(mNum);
      const isPaid = mV
        ? (mV.status === "PAID" || mV.balance <= 0)
        : (annualCalculations.baseMonthly > 0 ? i < annualCalculations.paidMonthsCount : false);
      if (!isPaid) {
        list.push(i);
      }
    }
    return list;
  }, [selectedStudent, vouchersByMonth, annualCalculations.paidMonthsCount, annualCalculations.baseMonthly]);

  // 5. Payment Mutation using Direct 1-Step POS API
  const collectPaymentMutation = useMutation({
    mutationFn: async ({
      voucherId,
      voucherIds,
      studentProfileId,
      amount,
      method,
      note,
      billingMonth,
      billingMonths,
      billingYear,
      walletAmount,
      autoApplyWallet,
      chequeNumber,
      reference,
    }: {
      voucherId?: string;
      voucherIds?: string[];
      studentProfileId: string;
      amount: number;
      method: string;
      note?: string;
      billingMonth?: number;
      billingMonths?: number[];
      billingYear?: number;
      walletAmount?: number;
      autoApplyWallet?: boolean;
      chequeNumber?: string;
      reference?: string;
    }) => {
      const payload = {
        feeVoucherId: voucherId || undefined,
        feeVoucherIds: voucherIds || undefined,
        studentProfileId,
        amountPaid: amount,
        paymentMethod: method,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
        note: note || `POS Counter Collection (${method})`,
        academicYearId: activeYearId || undefined,
        billingMonth,
        billingMonths,
        billingYear,
        walletAmount: walletAmount || undefined,
        autoApplyWallet: autoApplyWallet || undefined,
        chequeNumber: chequeNumber || undefined,
        reference: reference || undefined,
      };

      const res = await fetch("/api/fees/collect-direct", {
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
          "Failed to record payment";
        throw new Error(errorMsg);
      }
      return json.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["vouchers"] });
      qc.invalidateQueries({ queryKey: ["fees"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });

      setLastPaymentResult(data.transaction || data);
      setIsSuccessModalOpen(true);
      toast.success(t("paymentSuccess"));
      setPaymentAmount("");
      setCashTendered("");
      setPaymentNote("");
      setWalletAmount("");
      setAutoApplyWallet(false);
      setChequeNumber("");
      setPaymentReference("");
      setSelectedMonths([]);
    },
    onError: (err: any) => {
      toast.error(err.message || t("paymentError"));
    },
  });

  // Calculate selected total balance from vouchers
  const selectedTotalBalance = useMemo(() => {
    if (!selectedStudent) return 0;
    if (unpaidVouchers.length > 0 && selectedVoucherIds.length > 0) {
      return unpaidVouchers
        .filter((v: any) => selectedVoucherIds.includes(v.id))
        .reduce((sum: number, v: any) => addCurrency(sum, v.balance || 0), 0);
    }
    return annualCalculations.baseMonthly;
  }, [selectedStudent, unpaidVouchers, selectedVoucherIds, annualCalculations.baseMonthly]);

  // Handle student selection
  const handleSelectStudent = (student: any) => {
    setSelectedStudent(student);
    setIsSearchDropdownOpen(false);
    setSearchTerm("");
    setLastPaymentResult(null);
    setSelectedVoucherIds([]);
    setSelectedMonths([]);
    setInspectingPaidMonth(null);
    setPaymentAmount("");
    setCashTendered("");
    setPaymentNote("");
    setWalletAmount("");
    setAutoApplyWallet(false);
    setChequeNumber("");
    setPaymentReference("");
    setInvoicesTab("pending");
  };

  const handleClearStudent = () => {
    setSelectedStudent(null);
    setLastPaymentResult(null);
    setSelectedVoucherIds([]);
    setSelectedMonths([]);
    setInspectingPaidMonth(null);
    setPaymentAmount("");
    setCashTendered("");
    setPaymentNote("");
    setWalletAmount("");
    setAutoApplyWallet(false);
    setChequeNumber("");
    setPaymentReference("");
    setSearchTerm("");
    setIsSearchDropdownOpen(false);
    setInvoicesTab("pending");
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  // Initial default: select first unpaid month or current month if unpaid
  useEffect(() => {
    if (selectedStudent?.id && !isLoadingVouchers) {
      const curM = new Date().getMonth();
      if (unpaidMonthIndices.includes(curM)) {
        setSelectedMonths([curM]);
        const mV = vouchersByMonth.get(curM + 1);
        if (mV && mV.balance > 0) {
          setPaymentAmount(String(mV.balance));
          setSelectedVoucherIds([mV.id]);
        } else {
          setPaymentAmount(String(annualCalculations.baseMonthly));
          setSelectedVoucherIds([]);
        }
      } else if (unpaidMonthIndices.length > 0) {
        const firstUnpaid = unpaidMonthIndices[0];
        setSelectedMonths([firstUnpaid]);
        const mV = vouchersByMonth.get(firstUnpaid + 1);
        if (mV && mV.balance > 0) {
          setPaymentAmount(String(mV.balance));
          setSelectedVoucherIds([mV.id]);
        } else {
          setPaymentAmount(String(annualCalculations.baseMonthly));
          setSelectedVoucherIds([]);
        }
      } else {
        setSelectedMonths([]);
        setSelectedVoucherIds([]);
        setPaymentAmount("");
      }
    }
  }, [selectedStudent?.id, isLoadingVouchers]);

  // Toggle selection on a month (click again deselects, supports multi-month)
  const handleToggleMonth = (idx: number) => {
    const mNum = idx + 1;
    const mV = vouchersByMonth.get(mNum);
    const isPaid = mV
      ? (mV.status === "PAID" || mV.balance <= 0)
      : (idx < annualCalculations.paidMonthsCount);

    if (isPaid) {
      setInspectingPaidMonth((prev) => (prev === idx ? null : idx));
      return;
    }

    setInspectingPaidMonth(null);
    setSelectedMonths((prev) => {
      const next = prev.includes(idx)
        ? prev.filter((m) => m !== idx) // Click again deselects!
        : [...prev, idx].sort((a, b) => a - b); // Multi-month select

      let total = 0;
      const vIds: string[] = [];
      for (const m of next) {
        const num = m + 1;
        const v = vouchersByMonth.get(num);
        if (v && v.balance > 0) {
          total = addCurrency(total, v.balance);
          vIds.push(v.id);
        } else {
          total = addCurrency(total, annualCalculations.baseMonthly);
        }
      }
      setSelectedVoucherIds(vIds);
      setPaymentAmount(total > 0 ? String(total) : "");
      return next;
    });
  };

  // Quick Pay Presets handler: selects upcoming unpaid months and computes total
  const handleApplyPreset = (count: number | "full") => {
    setInspectingPaidMonth(null);
    const targetIndices = count === "full"
      ? unpaidMonthIndices
      : unpaidMonthIndices.slice(0, count);

    if (targetIndices.length === 0) {
      toast.info(t("allFeesCleared"));
      return;
    }

    setSelectedMonths(targetIndices);

    let total = 0;
    const vIds: string[] = [];
    for (const m of targetIndices) {
      const num = m + 1;
      const v = vouchersByMonth.get(num);
      if (v && v.balance > 0) {
        total = addCurrency(total, v.balance);
        vIds.push(v.id);
      } else {
        total = addCurrency(total, annualCalculations.baseMonthly);
      }
    }
    setSelectedVoucherIds(vIds);
    setPaymentAmount(total > 0 ? String(total) : "");
  };

  const handlePay = () => {
    if (!selectedStudent) {
      toast.error(t("selectStudentError"));
      return;
    }
    const hasUnbilledSelected = selectedMonths.some((m) => !vouchersByMonth.has(m + 1));
    if (hasUnbilledSelected && !hasFeeStructure) {
      toast.error(
        t("noFeeStructureAlert", {
          className: selectedStudent.class?.name || t("general"),
          academicYear: activeAcademicYearLabel,
        })
      );
      return;
    }
    const payNum = parseFloat(paymentAmount || String(selectedTotalBalance));
    if (isNaN(payNum) || payNum <= 0) {
      toast.error(t("validAmountError"));
      return;
    }
    const walletNum = parseFloat(walletAmount) || 0;
    const splitArgs = {
      walletAmount: walletNum > 0 ? walletNum : undefined,
      autoApplyWallet: autoApplyWallet || undefined,
      chequeNumber: chequeNumber.trim() || undefined,
      reference: paymentReference.trim() || undefined,
    };

    if (selectedMonths.length > 1) {
      void runPayment(async () => {
        await collectPaymentMutation.mutateAsync({
          studentProfileId: selectedStudent.id,
          amount: payNum,
          method: paymentMethod,
          note: paymentNote,
          billingMonths: selectedMonths.map((m) => m + 1),
          billingYear: selectedYear,
          voucherIds: selectedVoucherIds,
          chequeNumber: splitArgs.chequeNumber,
          reference: splitArgs.reference,
        });
      });
    } else if (selectedMonths.length === 1) {
      const mIdx = selectedMonths[0];
      const targetMonthVoucher = vouchersByMonth.get(mIdx + 1);
      const isTargetPaid = targetMonthVoucher && (targetMonthVoucher.status === "PAID" || targetMonthVoucher.balance <= 0);

      if (isTargetPaid) {
        toast.error(t("monthAlreadyPaid", { month: tMonths(ACADEMIC_MONTHS[mIdx]?.key) }));
        return;
      }

      void runPayment(async () => {
        await collectPaymentMutation.mutateAsync({
          voucherId: targetMonthVoucher?.id || selectedVoucherIds[0] || undefined,
          studentProfileId: selectedStudent.id,
          amount: payNum,
          method: paymentMethod,
          note: paymentNote,
          billingMonth: mIdx + 1,
          billingYear: selectedYear,
          ...splitArgs,
        });
      });
    } else {
      const targetVoucherId = selectedVoucherIds[0] || undefined;
      void runPayment(async () => {
        await collectPaymentMutation.mutateAsync({
          voucherId: targetVoucherId,
          studentProfileId: selectedStudent.id,
          amount: payNum,
          method: paymentMethod,
          note: paymentNote,
          billingYear: selectedYear,
          ...splitArgs,
        });
      });
    }
  };

  const handlePrint3PartChallan = (voucher: any) => {
    const pdfData: FeeVoucherPDFData = {
      // School identity must come from tenant settings — a challan PDF bearing
      // another institution's name is a data-integrity and branding failure.
      schoolName: settings.name || "School",
      schoolCode: settings.schoolCode,
      schoolAddress: settings.address,
      currencySymbol: currencySymbol || settings.currencySymbol || "$",
      voucherId: voucher.voucherId || `VOUCH-${voucher.id.slice(0, 8)}`,
      issueDate: formatDate(voucher.createdAt || new Date()),
      dueDate: formatDate(voucher.dueDate || new Date()),
      studentName: `${selectedStudent?.firstName} ${selectedStudent?.lastName}`,
      studentId: selectedStudent?.studentId || selectedStudent?.id || "N/A",
      rollNumber: selectedStudent?.rollNumber || "01",
      className: selectedStudent?.class?.name || "General",
      sectionName: selectedStudent?.section?.name,
      feeType: voucher.feeType || "Tuition",
      academicYear: voucher.academicYear?.label || "2026-2027",
      baseAmount: voucher.baseAmount || voucher.totalDue || 0,
      discountAmount: voucher.discountAmount || 0,
      arrears: voucher.arrears || 0,
      lateFine: voucher.lateFine || 0,
      totalDue: voucher.totalDue || voucher.balance || 0,
    };

    exportFeeVouchersPDF([pdfData], `Challan_${pdfData.voucherId}.pdf`);
    toast.success(t("downloadChallan"));
  };

  const payNum = parseFloat(paymentAmount) || 0;
  const cashNum = parseFloat(cashTendered) || 0;
  // Cents-precise change: 10.1 - 10 floats to 0.09999999999999964, which a
  // rupee/paisa display would render as 0.10 anyway but a comparison or
  // receipt total would not.
  const changeDue = Math.max(0, roundCurrency(cashNum - payNum));

  // Collection is possible when the student has unpaid vouchers OR the annual
  // ledger still shows a remaining balance. In the latter case the backend
  // auto-creates the annual fee voucher on-the-spot, so the terminal must not
  // be locked just because no invoice row exists yet.
  const hasOutstandingDue = !!selectedStudent && (unpaidVouchers.length > 0 || annualCalculations.remainingDue > 0);
  const fullPayable = selectedStudent
    ? (unpaidVouchers.length > 0 ? selectedTotalBalance : annualCalculations.remainingDue)
    : 0;
  const hasUnbilledSelected = selectedMonths.some((m) => !vouchersByMonth.has(m + 1));
  const canCollectCurrentSelection = !hasUnbilledSelected || hasFeeStructure;

  const { settings } = useTenantSettings();
  const configuredMethods = useMemo(() => {
    const list = settings.paymentMethods && settings.paymentMethods.length > 0
      ? settings.paymentMethods
      : DEFAULT_PAYMENT_METHODS;
    return list.filter((m) => m.isActive);
  }, [settings.paymentMethods]);

  const paymentModes = useMemo(() => {
    const modes = configuredMethods.map((m) => {
      let icon = Smartphone;
      let color = "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800";

      if (m.type === "CASH" || m.code === "CASH") {
        icon = Wallet;
        color = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
      } else if (m.type === "BANK" || m.code === "BANK_TRANSFER") {
        icon = Building2;
        color = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
      } else if (m.type === "CHEQUE" || m.code === "CHEQUE") {
        icon = Receipt;
        color = "bg-muted text-muted-foreground border-border";
      } else if (m.code === "POS_CARD") {
        icon = CreditCard;
      }

      return {
        id: m.code,
        label: m.name,
        icon,
        color,
        isCash: m.type === "CASH" || m.code === "CASH",
        instructions: m.instructions,
      };
    });
    // Advance wallet as tender: full-wallet or split with the selected method.
    modes.push({
      id: "WALLET_CREDIT",
      label: t("walletMethod"),
      icon: Wallet,
      color: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800",
      isCash: false,
      instructions: t("walletMethodHint"),
    });
    return modes;
  }, [configuredMethods, t]);

  const ONLINE_METHOD_CODES = ["DIGITAL", "ONLINE", "BANK", "BANK_TRANSFER", "POS_CARD", "CARD", "EASYPAISA", "JAZZCASH", "BKASH", "NAGAD", "UPI"];
  const showReferenceInput = ONLINE_METHOD_CODES.includes(paymentMethod);
  const showSplitBox = selectedStudent && paymentMethod !== "WALLET_CREDIT" && paymentMethod !== "CHEQUE" && selectedMonths.length <= 1;

  const currentMode = paymentModes.find((m) => m.id === paymentMethod);
  const isCashMode = currentMode?.isCash ?? (paymentMethod === "CASH");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader title={t("title")} description={t("description")}>
        {selectedStudent && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearStudent}
            className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> {t("clearStudent")}
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

      {/* ─────────────────── 1. Instant Student Search Bar ─────────────────── */}
      <div className="relative">
        <div className="flex items-center gap-3 p-2 bg-card rounded-lg border border-primary/20 shadow-none focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-colors">
          <div className="pl-3 text-muted-foreground">
            <Search className="h-5 w-5 text-primary" />
          </div>
          <Input
            ref={searchInputRef}
            type="text"
            placeholder={t("searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsSearchDropdownOpen(true);
            }}
            onFocus={() => setIsSearchDropdownOpen(true)}
            className="border-0 shadow-none focus-visible:ring-0 text-sm h-10 px-0 bg-transparent placeholder:text-muted-foreground/60"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setIsSearchDropdownOpen(false);
              }}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Live Autocomplete Dropdown */}
        {isSearchDropdownOpen && searchTerm.trim().length > 0 && (
          <Card className="absolute top-full left-0 right-0 mt-2 z-50 shadow-xl border-border max-h-80 overflow-y-auto">
            <CardContent className="p-2 space-y-1">
              {isSearching ? (
                <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> {t("searching")}
                </div>
              ) : studentsList.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  {t("noStudentsFound", { term: searchTerm })}
                </div>
              ) : (
                studentsList.map((st: any) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleSelectStudent(st)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-primary/5 transition-colors text-left group border border-transparent hover:border-primary/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {st.firstName?.charAt(0)}
                        {st.lastName?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                          {st.firstName} {st.lastName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {t("idLabel")} <span className="font-mono">{st.studentId || st.id.slice(0, 6)}</span> • {t("rollLabel")}{" "}
                          <span className="font-mono">{st.rollNumber || "—"}</span> • {t("classLabel")}{" "}
                          {st.class?.name || t("general")} {st.section?.name ? `(${st.section.name})` : ""}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[11px] font-semibold gap-1 text-primary">
                      {t("select")} <ArrowRight className="h-3 w-3" />
                    </Badge>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ─────────────────── 2. Main Cashier Counter Area ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Student Dossier & Invoices (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {!selectedStudent ? (
            /* Prompt to Select Student */
            <Card className="border-dashed border-2 border-border/80 bg-card/40 p-12 text-center">
              <div className="max-w-md mx-auto space-y-3">
                <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <User className="h-8 w-8" />
                </div>
                <h3 className="text-base font-bold text-foreground">{t("noStudentSelected")}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("noStudentSelectedDesc")}
                </p>
              </div>
            </Card>
          ) : (
            /* Active Student Details & Vouchers */
            <div className="space-y-4">
              {/* Student Header Card */}
              <Card className="border-border shadow-none bg-card">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-base font-bold shadow-xs">
                      {selectedStudent.firstName?.charAt(0)}
                      {selectedStudent.lastName?.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-foreground">
                          {selectedStudent.firstName} {selectedStudent.lastName}
                        </h2>
                        <Badge variant="secondary" className="text-[10px]">
                          {selectedStudent.status || t("active")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("classLabel")} <span className="font-semibold text-foreground">{selectedStudent.class?.name || t("general")}</span>
                        {selectedStudent.section?.name && ` (${selectedStudent.section.name})`} • Roll:{" "}
                        <span className="font-mono font-semibold text-foreground">{selectedStudent.rollNumber || "—"}</span> • ID:{" "}
                        <span className="font-mono">{selectedStudent.studentId || selectedStudent.id.slice(0, 6)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {selectedStudent.guardianPhone && (
                      <div className="text-right hidden sm:block">
                        <p className="text-[11px] text-muted-foreground">{t("guardianContact")}</p>
                        <p className="text-xs font-mono font-bold text-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" /> {selectedStudent.guardianPhone}
                        </p>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearStudent}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
                      title={t("clearStudent")}
                    >
                      <X className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{t("clearStudent")}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Missing Fee Structure Warning Banner */}
              {!hasFeeStructure && selectedStudent && (
                <div className="p-3.5 rounded-lg border border-amber-300/80 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">
                        {t("noFeeStructureAlert", {
                          className: selectedStudent.class?.name || t("general"),
                          academicYear: activeAcademicYearLabel,
                        })}
                      </p>
                    </div>
                  </div>
                  <Link href="/fees/structures" className="shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] font-semibold border-amber-400/80 hover:bg-amber-100/50 dark:hover:bg-amber-900/50 gap-1.5"
                    >
                      <Settings className="h-3 w-3" /> {t("configureFeeStructure")}
                    </Button>
                  </Link>
                </div>
              )}

              {/* 12-Month Academic Year Tuition Ledger Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="border-border shadow-xs">
                  <CardContent className="p-3 text-center">
                    <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                      {t("academicYearTotal")}
                    </p>
                    {isLoadingVouchers ? (
                      <div className="py-1 space-y-1">
                        <Skeleton className="h-5 w-24 mx-auto" />
                        <Skeleton className="h-3 w-16 mx-auto" />
                      </div>
                    ) : (
                      <>
                        <p className="text-base font-bold text-foreground font-mono mt-0.5">
                          {formatCurrency(annualCalculations.annualTotalDue)}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {formatCurrency(annualCalculations.baseMonthly)} {t("perMonth")}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border shadow-xs">
                  <CardContent className="p-3 text-center">
                    <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                      {t("paidToDate")}
                    </p>
                    {isLoadingVouchers ? (
                      <div className="py-1 space-y-1">
                        <Skeleton className="h-5 w-24 mx-auto" />
                        <Skeleton className="h-3 w-16 mx-auto" />
                      </div>
                    ) : (
                      <>
                        <p className="text-base font-bold text-emerald-600 font-mono mt-0.5">
                          {formatCurrency(annualCalculations.totalPaid)}
                        </p>
                        <p className="text-[10px] text-emerald-600 font-semibold">
                          {t("monthsCleared", { count: annualCalculations.paidMonthsCount })}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border shadow-xs">
                  <CardContent className="p-3 text-center">
                    <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                      {t("remainingUnpaid")}
                    </p>
                    {isLoadingVouchers ? (
                      <div className="py-1 space-y-1">
                        <Skeleton className="h-5 w-24 mx-auto" />
                        <Skeleton className="h-3 w-16 mx-auto" />
                      </div>
                    ) : (
                      <>
                        <p className="text-base font-bold text-rose-600 font-mono mt-0.5">
                          {formatCurrency(annualCalculations.remainingDue)}
                        </p>
                        <p className="text-[10px] text-rose-600 font-semibold">
                          {t("monthsPending", { count: annualCalculations.unpaidMonthsCount })}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* 12-Month Visual Schedule & Quick Preset Selector */}
              <Card className="border border-border shadow-none rounded-lg">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-primary" /> {t("schedule")}
                      </h3>
                      {selectedMonths.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] font-semibold text-primary">
                          {t("monthsSelected", { count: selectedMonths.length })}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground font-semibold">
                      {t("monthsPaid", { count: annualCalculations.paidMonthsCount })}
                    </span>
                  </div>

                  {/* 12 Months Interactive Grid with Skeletons */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {isLoadingVouchers ? (
                      Array.from({ length: 12 }).map((_, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg border border-border bg-muted/20 space-y-2 animate-pulse text-center">
                          <Skeleton className="h-3.5 w-12 mx-auto rounded" />
                          <Skeleton className="h-3 w-14 mx-auto rounded" />
                          <Skeleton className="h-4 w-10 mx-auto rounded-md" />
                        </div>
                      ))
                    ) : (
                      ACADEMIC_MONTHS.map((month, idx) => {
                        const mNum = idx + 1;
                        const mVoucher = vouchersByMonth.get(mNum);
                        const isPaid = mVoucher
                          ? (mVoucher.status === "PAID" || mVoucher.balance <= 0)
                          : (idx < annualCalculations.paidMonthsCount);
                        const isPartial = mVoucher && mVoucher.status === "PARTIAL" && mVoucher.balance > 0;
                        const isSelected = selectedMonths.includes(idx);
                        const isInspecting = inspectingPaidMonth === idx;

                        return (
                          <button
                            key={month.key}
                            type="button"
                            onClick={() => handleToggleMonth(idx)}
                            className={`p-2 rounded-lg border text-center transition-all cursor-pointer relative ${
                              isInspecting
                                ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-100/50 dark:bg-emerald-950/60 shadow-xs"
                                : isSelected
                                ? "ring-2 ring-primary border-primary bg-primary/10 shadow-xs"
                                : isPaid
                                ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 hover:border-emerald-400"
                                : isPartial
                                ? "border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 hover:border-amber-400"
                                : "border-border bg-muted/20 hover:bg-muted/40"
                            }`}
                            title={isPaid ? `${t("paid")} - ${t("clickToDeselect")}` : isSelected ? t("clickToDeselect") : t("unpaid")}
                          >
                            {isSelected && (
                              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
                            )}
                            <p className="text-xs font-bold text-foreground">{tMonths(month.key)}</p>
                            <p className="text-[10px] font-mono mt-0.5">
                              {formatCurrency(mVoucher?.balance ?? (isPaid ? 0 : annualCalculations.baseMonthly))}
                            </p>
                            <span
                              className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-md mt-1 ${
                                isPaid
                                  ? "text-emerald-700 bg-emerald-100 dark:bg-emerald-900/60 dark:text-emerald-300"
                                  : isPartial
                                  ? "text-amber-700 bg-amber-100 dark:bg-amber-900/60 dark:text-amber-300"
                                  : isSelected
                                  ? "text-primary bg-primary/20 font-black"
                                  : "text-muted-foreground bg-muted"
                              }`}
                            >
                              {isPaid ? t("paid") : isPartial ? t("partial") : isSelected ? t("dueNow") : t("unpaid")}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Quick Preset Buttons for Cashier */}
                  <div className="pt-2 border-t border-border flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {t("quickPresets")}
                    </span>
                    {isLoadingVouchers ? (
                      <div className="flex gap-2 py-1">
                        <Skeleton className="h-7 w-20 rounded-lg" />
                        <Skeleton className="h-7 w-20 rounded-lg" />
                        <Skeleton className="h-7 w-20 rounded-lg" />
                      </div>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={unpaidMonthIndices.length === 0}
                          onClick={() => handleApplyPreset(1)}
                          className="h-7 text-[11px] px-2.5 rounded-lg border-primary/40 text-primary hover:bg-primary/10"
                        >
                          {t("oneMonth")} ({formatCurrency(annualCalculations.baseMonthly * 1)})
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={unpaidMonthIndices.length < 2}
                          onClick={() => handleApplyPreset(2)}
                          className="h-7 text-[11px] px-2.5 rounded-lg"
                        >
                          {t("twoMonths")} ({formatCurrency(annualCalculations.baseMonthly * 2)})
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={unpaidMonthIndices.length < 3}
                          onClick={() => handleApplyPreset(3)}
                          className="h-7 text-[11px] px-2.5 rounded-lg"
                        >
                          {t("threeMonths")} ({formatCurrency(annualCalculations.baseMonthly * 3)})
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={unpaidMonthIndices.length < 6}
                          onClick={() => handleApplyPreset(6)}
                          className="h-7 text-[11px] px-2.5 rounded-lg"
                        >
                          {t("sixMonths")} ({formatCurrency(annualCalculations.baseMonthly * 6)})
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={unpaidMonthIndices.length === 0}
                          onClick={() => handleApplyPreset("full")}
                          className="h-7 text-[11px] px-2.5 rounded-lg font-bold border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30"
                        >
                          {t("fullRemaining")} ({formatCurrency(annualCalculations.remainingDue)})
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Cleared Month Banner (if user clicks an already-paid month to inspect) */}
              {inspectingPaidMonth !== null && (() => {
                const inspVoucher = vouchersByMonth.get(inspectingPaidMonth + 1);
                return (
                  <div className="p-3.5 rounded-lg border border-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40 dark:border-emerald-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                          {t("monthFeeCleared", { month: tMonths(ACADEMIC_MONTHS[inspectingPaidMonth]?.key) })}
                        </p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                          {inspVoucher?.voucherId ? `Voucher #${inspVoucher.voucherId} • ` : ""}
                          Total Paid: {formatCurrency(inspVoucher?.amountPaid || inspVoucher?.totalDue || annualCalculations.baseMonthly)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {inspVoucher && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePrint3PartChallan(inspVoucher)}
                          className="h-7 text-[11px] gap-1 px-2.5 border-emerald-400 text-emerald-800 hover:bg-emerald-100 dark:text-emerald-300 dark:border-emerald-700"
                        >
                          <Printer className="h-3 w-3" /> {t("printReceipt")}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInspectingPaidMonth(null)}
                        className="h-7 w-7 p-0 text-emerald-800 hover:text-emerald-950"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })()}

              {/* Invoices & Paid History Card */}
              <Card className="border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInvoicesTab("pending")}
                        className={`text-xs font-bold px-2.5 py-1 rounded-md transition-all ${
                          invoicesTab === "pending"
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t("pendingInvoices")} ({unpaidVouchers.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setInvoicesTab("paid")}
                        className={`text-xs font-bold px-2.5 py-1 rounded-md transition-all ${
                          invoicesTab === "paid"
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t("paidReceiptsHistory")} ({paidVouchers.length})
                      </button>
                    </div>

                    {invoicesTab === "pending" && (
                      <p className="text-[11px] text-muted-foreground">
                        {t("totalDue")} <span className="font-bold text-foreground font-mono">{formatCurrency(annualCalculations.remainingDue)}</span>
                      </p>
                    )}
                  </div>

                  {isLoadingVouchers ? (
                    <div className="space-y-2 py-4">
                      <Skeleton className="h-12 w-full rounded-xl" />
                      <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                  ) : invoicesTab === "pending" ? (
                    unpaidVouchers.length === 0 ? (
                      unpaidMonthIndices.length === 0 ? (
                        <div className="text-center py-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                          <CheckCircle2 className="h-7 w-7 text-emerald-600 mx-auto" />
                          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                            {t("allFeesCleared")}
                          </p>
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                            {t("noOutstanding")}
                          </p>
                        </div>
                      ) : standardMonthlyFee > 0 ? (
                        <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                <Sparkles className="h-4 w-4 text-primary" /> {t("currentMonthRate")}
                              </h4>
                              <p className="text-[11px] text-muted-foreground">
                                {t("classLabel")} {selectedStudent.class?.name || t("general")} • {t("standardSchedule")}
                              </p>
                            </div>
                            <span className="text-base font-bold font-mono text-emerald-600">
                              {formatCurrency(standardMonthlyFee)}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground pt-1 border-t border-primary/15">
                            {t("directReady")}
                          </p>
                        </div>
                      ) : (
                        <div className="text-center py-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-1.5" />
                          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                            {t("allFeesCleared")}
                          </p>
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                            {t("noOutstanding")}
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="space-y-2">
                        {unpaidVouchers.map((v: any) => {
                          const isSelected = selectedVoucherIds.includes(v.id);
                          return (
                            <div
                              key={v.id}
                              className={`p-3 rounded-lg border flex items-center justify-between gap-3 transition-colors ${
                                isSelected ? "border-primary bg-primary/5" : "border-border bg-card"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedVoucherIds((p) => [...p, v.id]);
                                    } else {
                                      setSelectedVoucherIds((p) => p.filter((id) => id !== v.id));
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs font-mono text-foreground">
                                      {v.voucherId || `VOUCH-${v.id.slice(0, 6)}`}
                                    </span>
                                    <Badge variant="secondary" className="text-[10px]">
                                      {v.feeType || t("tuition")}
                                    </Badge>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {t("due")} {formatDate(v.dueDate)} • {t("base")} {formatCurrency(v.baseAmount || v.totalDue)}
                                    {v.arrears > 0 && ` • ${t("arrears")} +${formatCurrency(v.arrears)}`}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5">
                                <div className="text-right">
                                  <p className="text-xs font-bold text-destructive font-mono">
                                    {t("due")} {formatCurrency(v.balance || 0)}
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handlePrint3PartChallan(v)}
                                  className="h-7 text-[11px] gap-1 px-2 border-primary/30 text-primary hover:bg-primary/10 dark:border-primary/50"
                                  title={t("printChallan")}
                                >
                                  <Printer className="h-3 w-3" /> {t("challan")}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    /* Paid Vouchers & Recorded Receipts Tab */
                    <div className="space-y-3">
                      {paidVouchers.length === 0 && studentTransactions.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">
                          {t("noPaidHistory")}
                        </p>
                      ) : (
                        <>
                          {paidVouchers.map((v: any) => (
                            <div
                              key={v.id}
                              className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between gap-3"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs font-mono text-foreground">
                                    {v.voucherId}
                                  </span>
                                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-[10px]">
                                    {t("paid")}
                                  </Badge>
                                  {v.billingMonth && (
                                    <span className="text-[10px] text-muted-foreground font-semibold">
                                      ({tMonths(ACADEMIC_MONTHS[v.billingMonth - 1]?.key)} {v.billingYear})
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {t("base")} {formatCurrency(v.baseAmount || v.totalDue)} • {t("paid")} {formatCurrency(v.amountPaid)}
                                </p>
                              </div>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePrint3PartChallan(v)}
                                className="h-7 text-[11px] gap-1 px-2.5 border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-300"
                              >
                                <Printer className="h-3 w-3" /> {t("challan")}
                              </Button>
                            </div>
                          ))}

                          {studentTransactions.length > 0 && (
                            <div className="pt-2 border-t border-border">
                              <p className="text-[11px] font-bold text-foreground mb-2 flex items-center gap-1.5">
                                <History className="h-3.5 w-3.5 text-primary" /> {t("recentReceipts")}
                              </p>
                              <div className="divide-y divide-border/50 text-xs">
                                {studentTransactions.map((tx: any) => (
                                  <div key={tx.id} className="py-2 flex items-center justify-between gap-2">
                                    <div>
                                      <p className="font-mono font-bold text-foreground text-[11px]">
                                        #{tx.receiptNumber}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">
                                        {tx.paymentMethod} • {formatDate(tx.timestamp)}
                                      </p>
                                    </div>
                                    <span className="font-bold text-emerald-600 font-mono text-xs">
                                      +{formatCurrency(tx.amountPaid)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Right Column: POS Payment Terminal & Quick Cashier Register (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Payment Terminal */}
          <Card className="border-border shadow-sm bg-card">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-600" /> {t("cashierTerminal")}
                </h3>
                {fullPayable > 0 && (
                  <Badge variant="outline" className="font-mono text-xs font-bold text-destructive border-destructive/30">
                    {t("due")} {formatCurrency(fullPayable)}
                  </Badge>
                )}
              </div>

              {/* Target Billing Period Indicator */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase">{t("billingPeriod")}</p>
                    <p className="text-xs font-bold text-foreground">
                      {selectedMonths.length === 0
                        ? t("noMonthsSelected")
                        : selectedMonths.length === 1
                        ? `${tMonths(ACADEMIC_MONTHS[selectedMonths[0]]?.key)} ${selectedYear}`
                        : `${t("monthsSelected", { count: selectedMonths.length })} (${tMonths(ACADEMIC_MONTHS[selectedMonths[0]]?.key)} – ${tMonths(ACADEMIC_MONTHS[selectedMonths[selectedMonths.length - 1]]?.key)} ${selectedYear})`}
                    </p>
                  </div>
                </div>
                {selectedMonths.length > 0 ? (
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary font-mono font-bold">
                    {t("monthsCount", { count: selectedMonths.length })}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    {t("noMonthsSelected")}
                  </Badge>
                )}
              </div>

              {/* 1. Quick Pay Amount Presets */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground flex justify-between">
                  <span>{t("paymentAmount")}</span>
                  {fullPayable > 0 && (
                    <span className="text-muted-foreground text-[11px]">
                      {t("max")} {formatCurrency(fullPayable)}
                    </span>
                  )}
                </label>

                {fullPayable > 0 && (
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleApplyPreset("full")}
                      className={`flex-1 text-[11px] h-7 font-bold ${
                        selectedMonths.length === unpaidMonthIndices.length && unpaidMonthIndices.length > 0
                          ? "border-primary bg-primary/10 text-primary"
                          : ""
                      }`}
                    >
                      {t("payFull")} ({formatCurrency(fullPayable)})
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPaymentAmount(String(roundCurrency(fullPayable / 2)))}
                      className={`text-[11px] h-7 font-medium ${
                        paymentAmount === String(roundCurrency(fullPayable / 2))
                          ? "border-primary bg-primary/10 text-primary"
                          : ""
                      }`}
                    >
                      {t("payHalf")}
                    </Button>
                  </div>
                )}

                <div className="relative">
                  <Input
                    type="number"
                    placeholder={t("amountReceived")}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    disabled={!selectedStudent || (unpaidMonthIndices.length === 0 && selectedVoucherIds.length === 0)}
                    className="h-11 text-base font-mono font-bold pr-12"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    {currencySymbol}
                  </div>
                </div>
              </div>

              {/* 2. Payment Method Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{t("paymentMethod")}</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {paymentModes.map((mode) => {
                    const Icon = mode.icon;
                    const isSelected = paymentMethod === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setPaymentMethod(mode.id)}
                        className={`p-2 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                            : "border-border bg-card hover:bg-muted/40 text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-[11px] truncate max-w-full">{mode.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2b. Cheque number (required for CHEQUE) */}
              {paymentMethod === "CHEQUE" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">{t("chequeNumber")} *</label>
                  <Input
                    type="text"
                    placeholder={t("chequeNumberPlaceholder")}
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    disabled={!selectedStudent}
                    className="h-9 text-sm font-mono"
                  />
                </div>
              )}

              {/* 2c. External reference (required for online methods) */}
              {showReferenceInput && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">{t("paymentReference")} *</label>
                  <Input
                    type="text"
                    placeholder={t("paymentReferencePlaceholder")}
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    disabled={!selectedStudent}
                    className="h-9 text-sm font-mono"
                  />
                </div>
              )}

              {/* 2d. Split tender: advance-wallet leg */}
              {showSplitBox && (
                <div className="p-3 rounded-lg border border-violet-200/80 bg-violet-50/40 dark:bg-violet-950/20 dark:border-violet-800/60 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">{t("walletSplitTitle")}</span>
                    <label className="flex items-center gap-1.5 text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoApplyWallet}
                        onChange={(e) => setAutoApplyWallet(e.target.checked)}
                        disabled={!selectedStudent}
                        className="h-3.5 w-3.5 accent-violet-600"
                      />
                      {t("autoApplyWallet")}
                    </label>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    placeholder={t("walletAmountPlaceholder")}
                    value={walletAmount}
                    onChange={(e) => setWalletAmount(e.target.value)}
                    disabled={!selectedStudent || autoApplyWallet}
                    className="h-9 text-sm font-mono font-bold"
                  />
                </div>
              )}

              {/* 3. Cash Calculator (if cash) */}              {isCashMode && (
                <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">{t("cashHanded")}</span>
                    {payNum > 0 && (
                      <span className="font-mono text-muted-foreground">
                        {t("due")} {formatCurrency(payNum)}
                      </span>
                    )}
                  </div>

                  <Input
                    type="number"
                    placeholder={t("cashPlaceholder")}
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    disabled={!selectedStudent || (unpaidMonthIndices.length === 0 && selectedVoucherIds.length === 0)}
                    className="h-9 text-sm font-mono font-bold"
                  />

                  {cashNum > 0 && payNum > 0 && (
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-border/50">
                      <span className="text-muted-foreground">{t("changeToGive")}</span>
                      <span
                        className={`text-sm font-mono font-black ${
                          changeDue >= 0 ? "text-emerald-600" : "text-destructive"
                        }`}
                      >
                        {formatCurrency(changeDue)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 4. Payment Note */}
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground font-medium">
                  {t("noteRemarks")}
                </label>
                <Input
                  type="text"
                  placeholder={t("notePlaceholder")}
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  disabled={!selectedStudent || (unpaidMonthIndices.length === 0 && selectedVoucherIds.length === 0)}
                  className="h-8 text-xs"
                />
              </div>

              {/* 5. Big Collect Payment Action Button */}
              {canWriteFees && (
                <Button
                  type="button"
                  onClick={handlePay}
                  disabled={
                    !selectedStudent ||
                    !paymentAmount ||
                    payNum <= 0 ||
                    !canCollectCurrentSelection ||
                    isGuardedPayment ||
                    collectPaymentMutation.isPending
                  }
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm gap-2 shadow-sm rounded-lg transition-all disabled:opacity-50"
                >
                  {collectPaymentMutation.isPending || isGuardedPayment ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> {t("recordingPayment")}
                    </>
                  ) : !selectedStudent ? (
                    <>
                      <User className="h-4 w-4" /> {t("selectStudentPrompt")}
                    </>
                  ) : !canCollectCurrentSelection ? (
                    <>
                      <AlertTriangle className="h-4 w-4" /> {t("feeStructureRequired")}
                    </>
                  ) : selectedMonths.length > 1 ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> {t("collectAmount", { amount: formatCurrency(payNum) })} ({t("monthsCount", { count: selectedMonths.length })})
                    </>
                  ) : selectedMonths.length === 1 ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> {t("collectAmount", { amount: formatCurrency(payNum) })}
                    </>
                  ) : unpaidMonthIndices.length === 0 && selectedVoucherIds.length === 0 ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> {t("allFeesCleared")}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> {t("collectAmount", { amount: payNum > 0 ? formatCurrency(payNum) : t("paymentFallback") })}
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Today's Cashier Drawer Stream */}
          <Card className="border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-bold text-foreground">{t("todayStream")}</h4>
                </div>
                <Badge variant="outline" className="text-[11px] font-mono font-bold text-emerald-600">
                  {formatCurrency(todayTotalCollected)}
                </Badge>
              </div>

              {isLoadingRecent ? (
                <div className="space-y-2 py-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : recentTransactions.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-4">
                  {t("noPayments")}
                </p>
              ) : (
                <div className="divide-y divide-border/40 text-xs">
                  {recentTransactions.slice(0, 5).map((tx: any) => (
                    <div key={tx.id} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate text-[11px]">
                          {tx.feeVoucher?.studentProfile
                            ? `${tx.feeVoucher.studentProfile.firstName} ${tx.feeVoucher.studentProfile.lastName}`
                            : `Receipt #${tx.receiptNumber}`}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {tx.paymentMethod} • {formatDate(tx.timestamp)}
                        </p>
                      </div>
                      <span className="font-bold text-emerald-600 font-mono text-xs shrink-0">
                        +{formatCurrency(tx.amountPaid)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─────────────────── 3. Payment Success & Print Modal ─────────────────── */}
      {isSuccessModalOpen && lastPaymentResult && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <Card className="w-full max-w-md border-border shadow-xl bg-card">
            <CardContent className="p-6 text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">{t("paymentCollected")}</h3>
                <p className="text-xs text-muted-foreground">
                  {t("receiptIssued", { number: lastPaymentResult.receiptNumber })}
                </p>
              </div>

              <div className="p-3 bg-muted/30 rounded-lg border border-border text-left space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("amountPaid")}</span>
                  <span className="font-bold text-emerald-600 font-mono text-sm">
                    {formatCurrency(lastPaymentResult.amountPaid)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("paymentMode")}</span>
                  <span className="font-semibold text-foreground font-mono">
                    {lastPaymentResult.paymentMethod}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("transactionRef")}</span>
                  <span className="font-mono text-muted-foreground text-[10px]">
                    {lastPaymentResult.transactionId}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    window.print();
                  }}
                  className="gap-1.5 text-xs font-semibold"
                >
                  <Printer className="h-3.5 w-3.5" /> {t("thermalPrint")}
                </Button>

                <Button
                  onClick={() => {
                    setIsSuccessModalOpen(false);
                    handleClearStudent();
                  }}
                  className="bg-primary text-primary-foreground gap-1.5 text-xs font-semibold"
                >
                  {t("nextStudent")} <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
            </Card>
        </div>
      )}
        </>
      )}
    </div>
  );
}
