"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantFormatting } from "@/components/providers/tenant-settings-provider";
import { usePDFExport, type FeeVoucherPDFData } from "@/hooks/use-pdf-export";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { toast } from "sonner";
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
} from "lucide-react";

export default function FeeCollectionPage() {
  const qc = useQueryClient();
  const { formatCurrency, formatDate } = useTenantFormatting();
  const { exportFeeVouchersPDF } = usePDFExport();
  const { run: runPayment, isPending: isGuardedPayment } = useSubmitGuard();

  // Search & Selection State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [selectedVoucherIds, setSelectedVoucherIds] = useState<string[]>([]);

  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [cashTendered, setCashTendered] = useState<string>("");
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [lastPaymentResult, setLastPaymentResult] = useState<any | null>(null);

  // 1. Fetch Students
  const { data: studentsData, isLoading: isSearching } = useQuery({
    queryKey: ["students-fee-collection", searchTerm],
    queryFn: async () => {
      const p = new URLSearchParams({ limit: "15" });
      if (searchTerm.trim()) p.set("search", searchTerm.trim());
      const res = await fetch(`/api/students?${p.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to search students");
      return res.json();
    },
  });
  const studentsList = (studentsData as any)?.data ?? [];

  // 2. Fetch Vouchers for Selected Student
  const { data: studentVouchersData, isLoading: isLoadingVouchers } = useQuery({
    queryKey: ["student-vouchers", selectedStudent?.id],
    queryFn: async () => {
      if (!selectedStudent?.id) return { data: [] };
      const res = await fetch(`/api/fees?studentProfileId=${selectedStudent.id}&limit=50`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch student vouchers");
      return res.json();
    },
    enabled: !!selectedStudent?.id,
  });
  const allStudentVouchers = (studentVouchersData as any)?.data ?? [];
  const unpaidVouchers = allStudentVouchers.filter(
    (v: any) => v.status === "PENDING" || v.status === "PARTIAL" || v.status === "OVERDUE"
  );

  // 3. Payment Mutation
  const collectPaymentMutation = useMutation({
    mutationFn: async ({
      voucherId,
      amount,
      method,
      note,
    }: {
      voucherId: string;
      amount: number;
      method: string;
      note?: string;
    }) => {
      const payload = {
        transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        feeVoucherId: voucherId,
        amountPaid: amount,
        paymentMethod: method,
        receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
        note: note || `POS Counter Collection (${method})`,
      };

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to record payment");
      }
      return json.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["student-vouchers"] });
      qc.invalidateQueries({ queryKey: ["fees"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      setLastPaymentResult(data);
      toast.success("Payment collected and receipt generated!");
      setPaymentAmount("");
      setCashTendered("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to collect payment");
    },
  });

  // Calculate selected balance
  const selectedTotalBalance = useMemo(() => {
    return unpaidVouchers
      .filter((v: any) => selectedVoucherIds.includes(v.id))
      .reduce((sum: number, v: any) => sum + (v.balance || 0), 0);
  }, [unpaidVouchers, selectedVoucherIds]);

  const handleSelectStudent = (student: any) => {
    setSelectedStudent(student);
    setLastPaymentResult(null);
    setPaymentAmount("");
    setCashTendered("");
    // Select all unpaid vouchers by default when student is chosen
    setTimeout(() => {
      setSelectedVoucherIds(unpaidVouchers.map((v: any) => v.id));
    }, 100);
  };

  const handlePay = () => {
    if (!selectedVoucherIds.length) {
      toast.error("Please select at least one fee voucher to pay");
      return;
    }
    const payNum = parseFloat(paymentAmount || String(selectedTotalBalance));
    if (isNaN(payNum) || payNum <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    void runPayment(async () => {
      // Pay the first selected voucher (or loop if multiple)
      const targetVoucherId = selectedVoucherIds[0];
      await collectPaymentMutation.mutateAsync({
        voucherId: targetVoucherId,
        amount: payNum,
        method: paymentMethod,
        note: paymentNote,
      });
    });
  };

  const handlePrint3PartChallan = (voucher: any) => {
    const pdfData: FeeVoucherPDFData = {
      schoolName: "Pathshala Pro Academy",
      currencySymbol: "$",
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
      totalDue: voucher.totalDue || voucher.balance || 0,
    };

    exportFeeVouchersPDF([pdfData], `Challan_${pdfData.voucherId}.pdf`);
    toast.success("Downloading 3-Part Bank Challan PDF...");
  };

  const cashNum = parseFloat(cashTendered) || 0;
  const payNum = parseFloat(paymentAmount || String(selectedTotalBalance)) || 0;
  const changeDue = Math.max(0, cashNum - payNum);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Collection & POS Register"
        description="Search students, verify dues, collect payments, and print 3-part bank challans & thermal receipts."
        icon={CreditCard}
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* ── LEFT COLUMN: Student Search & Selection (4 Cols) ── */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="shadow-xs border-border">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Search className="h-4 w-4 text-primary" />
                Find Student
              </h3>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, roll # or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              {/* Student Results List */}
              <div className="space-y-1.5 max-h-[460px] overflow-y-auto pt-1">
                {isSearching ? (
                  <div className="space-y-2 py-4">
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                  </div>
                ) : studentsList.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    No matching students found
                  </div>
                ) : (
                  studentsList.map((st: any) => {
                    const isSelected = selectedStudent?.id === st.id;
                    return (
                      <div
                        key={st.id}
                        onClick={() => handleSelectStudent(st)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border/70 hover:border-border hover:bg-muted/40 bg-card"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                            {st.firstName?.charAt(0)}
                            {st.lastName?.charAt(0)}
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-bold text-xs text-foreground truncate">
                              {st.firstName} {st.lastName}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Roll #{st.rollNumber || "—"} • {st.class?.name || "Class"}
                            </p>
                          </div>
                        </div>
                        <ArrowRight
                          className={`h-4 w-4 shrink-0 ${
                            isSelected ? "text-primary" : "text-muted-foreground/50"
                          }`}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT COLUMN: Student Ledger & POS Payment Terminal (8 Cols) ── */}
        <div className="lg:col-span-8 space-y-6">
          {!selectedStudent ? (
            <Card className="border-2 border-dashed border-border py-16 text-center">
              <CardContent className="space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <User className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-foreground">Select a Student</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Search and click a student on the left panel to load their outstanding fee vouchers,
                  generate bank deposit challans, and collect cashier payments.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Payment Success & Receipt Ready Banner */}
              {lastPaymentResult && (
                <Card className="border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/30 dark:border-emerald-900 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                          Payment Successful • Receipt #{lastPaymentResult.transaction?.receiptNumber || "REC-OK"}
                        </p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          Transaction ID: <span className="font-mono">{lastPaymentResult.transaction?.transactionId}</span> • Amount: {formatCurrency(lastPaymentResult.transaction?.amountPaid || 0)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.print()}
                      className="gap-1.5 text-xs bg-white dark:bg-slate-900 border-emerald-300 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Print Receipt
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Selected Student Banner */}
              <Card className="border-border shadow-xs bg-linear-to-r from-primary/5 via-background to-background">
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-sm shadow-md">
                      {selectedStudent.firstName?.charAt(0)}
                      {selectedStudent.lastName?.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-black text-foreground">
                          {selectedStudent.firstName} {selectedStudent.lastName}
                        </h2>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {selectedStudent.studentId || "ST-ID"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Class: <span className="font-semibold text-foreground">{selectedStudent.class?.name || "General"}</span>
                        {selectedStudent.section?.name && ` (${selectedStudent.section.name})`} • Roll: <span className="font-semibold text-foreground">#{selectedStudent.rollNumber || "—"}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Outstanding Balance
                    </p>
                    <p className={`text-xl font-black ${unpaidVouchers.length > 0 ? "text-destructive" : "text-emerald-600"}`}>
                      {formatCurrency(
                        unpaidVouchers.reduce((s: number, v: any) => s + (v.balance || 0), 0)
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Outstanding Invoices List */}
              <Card className="border-border shadow-xs">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <Receipt className="h-4 w-4 text-primary" />
                      Pending Fee Vouchers ({unpaidVouchers.length})
                    </h3>
                  </div>

                  {isLoadingVouchers ? (
                    <div className="space-y-2 py-4">
                      <Skeleton className="h-14 w-full rounded-xl" />
                      <Skeleton className="h-14 w-full rounded-xl" />
                    </div>
                  ) : unpaidVouchers.length === 0 ? (
                    <div className="text-center py-8 rounded-xl bg-emerald-50/50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900">
                      <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-1.5" />
                      <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        No outstanding dues!
                      </p>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        All issued fee vouchers for this student are fully settled.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {unpaidVouchers.map((v: any) => {
                        const isSelected = selectedVoucherIds.includes(v.id);
                        return (
                          <div
                            key={v.id}
                            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                              isSelected ? "border-primary/60 bg-primary/5" : "border-border bg-card"
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
                                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs font-mono text-foreground">
                                    {v.voucherId || `VOUCH-${v.id.slice(0, 6)}`}
                                  </span>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {v.feeType || "Tuition"}
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  Due Date: {formatDate(v.dueDate)} • Total: {formatCurrency(v.totalDue || 0)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-xs font-bold text-destructive font-mono">
                                  Due: {formatCurrency(v.balance || 0)}
                                </p>
                                {v.amountPaid > 0 && (
                                  <p className="text-[10px] text-emerald-600 font-mono">
                                    Paid: {formatCurrency(v.amountPaid)}
                                  </p>
                                )}
                              </div>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePrint3PartChallan(v)}
                                className="h-8 text-xs gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300"
                                title="Print 3-Part Bank Deposit Challan"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                3-Part Challan
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* POS Cashier Register Panel */}
              {unpaidVouchers.length > 0 && (
                <Card className="border-border shadow-md bg-card">
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2 pb-2 border-b border-border">
                      <Wallet className="h-4 w-4 text-emerald-600" />
                      Cashier Payment Terminal
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Payment Method Selector */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">
                          Payment Mode
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {["CASH", "BANK_TRANSFER", "POS_CARD", "EASYPAISA", "JAZZCASH", "CHEQUE"].map(
                            (mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setPaymentMethod(mode)}
                                className={`text-[11px] font-semibold py-2 px-1 rounded-xl border transition-all ${
                                  paymentMethod === mode
                                    ? "bg-primary text-white border-primary shadow-xs"
                                    : "bg-muted/40 border-border text-foreground hover:bg-muted"
                                }`}
                              >
                                {mode.replace("_", " ")}
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      {/* Payment Amount Field */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">
                          Amount Collecting ({formatCurrency(selectedTotalBalance)})
                        </label>
                        <Input
                          type="number"
                          placeholder={String(selectedTotalBalance)}
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          className="h-10 text-sm font-mono font-bold"
                        />
                      </div>

                      {/* Cash Calculator if CASH */}
                      {paymentMethod === "CASH" && (
                        <>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-foreground">
                              Cash Received from Parent
                            </label>
                            <Input
                              type="number"
                              placeholder="e.g. 5000"
                              value={cashTendered}
                              onChange={(e) => setCashTendered(e.target.value)}
                              className="h-10 text-sm font-mono font-bold"
                            />
                          </div>

                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                              Change to Return:
                            </span>
                            <span className="text-lg font-black font-mono text-emerald-700 dark:text-emerald-400">
                              {formatCurrency(changeDue)}
                            </span>
                          </div>
                        </>
                      )}

                      {/* Remarks */}
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">
                          Receipt / Transaction Reference / Note
                        </label>
                        <Input
                          placeholder="Optional transaction reference or cashier remarks..."
                          value={paymentNote}
                          onChange={(e) => setPaymentNote(e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>

                    {/* Collect Action Button */}
                    <div className="pt-2 flex justify-end">
                      <Button
                        size="lg"
                        onClick={handlePay}
                        disabled={collectPaymentMutation.isPending || isGuardedPayment || !selectedVoucherIds.length}
                        aria-busy={collectPaymentMutation.isPending || isGuardedPayment || undefined}
                        className="gap-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                      >
                        {collectPaymentMutation.isPending || isGuardedPayment ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Collect & Record Payment ({formatCurrency(payNum)})
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
