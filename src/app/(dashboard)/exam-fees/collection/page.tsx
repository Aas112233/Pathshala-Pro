"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppDropdown } from "@/components/ui/app-dropdown";
import { Card, CardContent } from "@/components/ui/card";
import { ERPDataTable } from "@/components/ui/erp-data-table";
import { ERPFormSection, ERPFormField } from "@/components/ui/erp-form-layout";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useTenantFormatting, useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { useAcademicYearContext } from "@/components/providers/academic-year-provider";
import { useAuth } from "@/components/providers/auth-provider";
import {
  useExamFeeDue,
  useCollectExamFee,
  useBulkCollectExamFee,
  type ExamFeeStudentRow,
} from "@/hooks/use-exam-fees";
import { DEFAULT_PAYMENT_METHODS } from "@/lib/tenant-settings";
import { getMethodPostingRules } from "@/lib/payment-method-routing";
import { hasPermission, getEffectivePermissions, FEE_DESK_TIER } from "@/lib/permissions";
import { toast } from "sonner";
import { addCurrency, roundCurrency } from "@/lib/math-utils";
import { fuzzyFilter, cn } from "@/lib/utils";
import {
  Users,
  User,
  Receipt,
  Wallet,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Building2,
  CreditCard,
  Search,
  Layers,
} from "lucide-react";

const EMPTY_ARRAY: any[] = [];

/**
 * Exam fee collection desk.
 *
 * Two tiers on one page, matching the existing fee module's shape:
 *   - Single counter collection (student picked one at a time, `fee-pos` tier)
 *   - Class x Section batch collection (`fee-bulk` tier)
 *
 * Every amount shown here is computed SERVER-SIDE and arrives as a fixed-2dp
 * string (`/api/exam-fees/due`). The client only sums for display and never
 * derives a payable from a rate — the authoritative figure is re-derived in
 * `exam-fee-service.ts` inside the collecting transaction.
 *
 * Zero pre-selection (AGENTS rule 15): exam, class, section, student and
 * payment method all start empty, and submit stays disabled until the cashier
 * has made each choice explicitly.
 */
export default function ExamFeeCollectionPage() {
  const t = useTranslations("examFees");
  const tCommon = useTranslations("common");
  const { formatCurrency, formatDate, currencySymbol } = useTenantFormatting();
  const { settings } = useTenantSettings();
  const { selectedAcademicYearId } = useAcademicYearContext();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();

  const perms = getEffectivePermissions(
    authUser?.role as string,
    (authUser as any)?.permissions,
    (authUser as any)?.accessLevel
  );
  const canReadFees = hasPermission(perms, "fees", "read");
  const canUsePos = hasPermission(perms, FEE_DESK_TIER.pos, "write");
  const canUseBulk = hasPermission(perms, FEE_DESK_TIER.bulk, "write");

  // 1. Exams for the active academic year
  const { data: examsData, isLoading: isLoadingExams } = useQuery<any[]>({
    queryKey: ["exams", "exam-fee-desk", selectedAcademicYearId],
    queryFn: async () => {
      const p = new URLSearchParams({ limit: "200" });
      if (selectedAcademicYearId) p.set("academicYearId", selectedAcademicYearId);
      const res = await fetch(`/api/exams?${p.toString()}`, { credentials: "include" });
      if (!res.ok) return EMPTY_ARRAY;
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : EMPTY_ARRAY;
    },
    enabled: !!selectedAcademicYearId,
  });
  const exams = examsData ?? EMPTY_ARRAY;

  // 2. Cascade state. All empty by default; each child selector stays disabled
  // until its parent is chosen and resets when the parent changes.
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // 3. Payment form state — method intentionally blank.
  const [paymentMethod, setPaymentMethod] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [note, setNote] = useState("");
  const [allowAdvanceToWallet, setAllowAdvanceToWallet] = useState(false);

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [amountInput, setAmountInput] = useState("");

  // Bulk grid state
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [amountEdits, setAmountEdits] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [lastResult, setLastResult] = useState<any>(null);

  const collectMutation = useCollectExamFee();
  const bulkMutation = useBulkCollectExamFee();

  // Reset every dependent selection when the exam changes — otherwise a
  // student picked under one exam would be collected against another.
  const handleExamChange = (value: string) => {
    setExamId(value);
    setClassId("");
    setSectionId("");
    setSearchTerm("");
    setSelectedStudentId("");
    setAmountInput("");
    setSelectedIds({});
    setAmountEdits({});
    setLastResult(null);
    setPage(1);
  };

  const handleClassChange = (value: string) => {
    setClassId(value);
    setSectionId("");
    setSelectedIds({});
    setAmountEdits({});
    setSelectedStudentId("");
    setAmountInput("");
    setPage(1);
  };

  // 4. Server-computed fee position. Not fetched until an exam is chosen.
  const {
    data: dueData,
    isLoading: isLoadingDue,
    error: dueError,
  } = useExamFeeDue({ examId, classId, sectionId });

  const examClasses = useMemo(() => dueData?.classes ?? EMPTY_ARRAY, [dueData]);
  const students = useMemo(() => dueData?.students ?? EMPTY_ARRAY, [dueData]);
  const totals = dueData?.totals;

  // Sections come from the exam's chargeable classes, so the section list
  // can only ever offer sections that actually exist on this exam.
  const selectedClassMeta = examClasses.find((c) => c.classId === classId);
  const sectionOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of students) {
      if (classId && s.classId !== classId) continue;
      if (s.sectionId && !seen.has(s.sectionId)) {
        seen.set(s.sectionId, s.sectionName || s.sectionId);
      }
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [students, classId]);

  // 5. Payment methods — tenant-configured, never pre-selected.
  const paymentMethods = useMemo(() => {
    const flags = (settings as any)?.paymentMethods;
    const source = Array.isArray(flags) && flags.length > 0 ? flags : DEFAULT_PAYMENT_METHODS;
    return source
      .filter((m: any) => m.isActive !== false)
      .map((m: any) => ({ value: m.code, label: m.label || m.code }));
  }, [settings]);

  const selectedMethodMeta = paymentMethods.find((m) => m.value === paymentMethod);
  const methodRules = selectedMethodMeta
    ? getMethodPostingRules(
        (DEFAULT_PAYMENT_METHODS as any[]).find((m) => m.code === paymentMethod)?.type,
        paymentMethod
      )
    : { isCheque: false, requiresReference: false };

  // 6. Visible students after the local search box.
  const visibleStudents = useMemo(() => {
    if (!searchTerm.trim()) return students;
    return fuzzyFilter(students, searchTerm.trim(), (s: ExamFeeStudentRow) =>
      `${s.name} ${s.studentId} ${s.rollNumber ?? ""}`.trim()
    );
  }, [students, searchTerm]);

  // Amount owed by the picked student, straight from the server row.
  const selectedStudent = useMemo(
    () => students.find((s) => s.studentProfileId === selectedStudentId) ?? null,
    [students, selectedStudentId]
  );

  // Never pre-fill the amount box: the cashier types what the parent is
  // handing over. `outstanding` is shown beside it as the reference figure.
  useEffect(() => {
    setAmountInput("");
  }, [selectedStudentId]);

  const selectedOutstanding = useMemo(
    () => (selectedStudent ? Number(selectedStudent.outstanding) : 0),
    [selectedStudent]
  );
  const amountValue = Number(amountInput || 0);
  const isOverpayment = amountValue > selectedOutstanding && selectedOutstanding > 0;

  const bulkSelectedRows = useMemo(
    () => visibleStudents.filter((s: ExamFeeStudentRow) => selectedIds[s.studentProfileId]),
    [visibleStudents, selectedIds]
  );

  const bulkTotal = useMemo(
    () =>
      bulkSelectedRows.reduce((sum: number, s: ExamFeeStudentRow) => {
        const edited = amountEdits[s.studentProfileId];
        if (edited !== undefined) {
          const n = Number(edited);
          return sum + (Number.isFinite(n) && n > 0 ? n : 0);
        }
        return sum + Number(s.outstanding);
      }, 0),
    [bulkSelectedRows, amountEdits]
  );

  const canSubmitSingle =
    !!examId &&
    !!selectedStudentId &&
    !!paymentMethod &&
    amountValue > 0 &&
    Number.isFinite(amountValue) &&
    (!methodRules.isCheque || chequeNumber.trim().length > 0) &&
    (!methodRules.requiresReference || paymentReference.trim().length > 0) &&
    (!isOverpayment || allowAdvanceToWallet);

  const canSubmitBulk =
    !!examId &&
    !!classId &&
    !!paymentMethod &&
    bulkSelectedRows.length > 0 &&
    (!methodRules.isCheque || chequeNumber.trim().length > 0) &&
    (!methodRules.requiresReference || paymentReference.trim().length > 0);

  // Amount edits are dropped when the grid scope changes so a stale figure can
  // never be submitted against a different roster.
  useEffect(() => {
    setAmountEdits({});
    setSelectedIds({});
  }, [examId, classId, sectionId]);

  const handleSingleSubmit = useCallback(() => {
    if (!canSubmitSingle || !selectedStudent) return;
    collectMutation.mutate(
      {
        examId,
        studentProfileId: selectedStudentId,
        amountPaid: amountValue,
        paymentMethod,
        chequeNumber: chequeNumber.trim() || undefined,
        reference: paymentReference.trim() || undefined,
        note: note.trim() || undefined,
        allowAdvanceToWallet,
      },
      {
        onSuccess: (result: any) => {
          toast.success(t("collectSuccess"), {
            description: `${selectedStudent.name} · ${t("receiptNo", { number: result.receiptNumber })}`,
          });
          setLastResult(result);
          setSelectedStudentId("");
          setAmountInput("");
        },
        onError: (error: any) => {
          const detail = error?.details?.[0]?.message;
          toast.error(error?.message || t("collectError"), {
            description: detail && detail !== error?.message ? detail : undefined,
          });
        },
      }
    );
  }, [
    canSubmitSingle, selectedStudent, collectMutation, examId, selectedStudentId,
    amountValue, paymentMethod, chequeNumber, paymentReference, note, allowAdvanceToWallet, t, tCommon,
  ]);

  const handleBulkSubmit = useCallback(() => {
    if (!canSubmitBulk) return;
    const payments = bulkSelectedRows
      .map((s: ExamFeeStudentRow) => {
        const edited = amountEdits[s.studentProfileId];
        const amount =
          edited !== undefined && edited.trim() !== ""
            ? Number(edited)
            : Number(s.outstanding);
        return { studentProfileId: s.studentProfileId, amountPaid: amount };
      })
      .filter((p) => Number.isFinite(p.amountPaid) && p.amountPaid > 0);

    if (payments.length === 0) {
      toast.error(t("noValidAmounts"));
      return;
    }

    bulkMutation.mutate(
      {
        examId,
        classId,
        sectionId: sectionId || undefined,
        paymentMethod,
        chequeNumber: chequeNumber.trim() || undefined,
        reference: paymentReference.trim() || undefined,
        note: note.trim() || undefined,
        allowAdvanceToWallet,
        payments,
      },
      {
        onSuccess: (result: any) => {
          setLastResult(result);
          if (result.failedCount === 0) {
            toast.success(t("bulkSuccess", { count: result.succeededCount }), {
              description: `${formatCurrency(Number(result.totalCollected))}`,
            });
          }
        },
        onError: (error: any) => {
          const detail = error?.details?.[0]?.message;
          toast.error(error?.message || t("collectError"), {
            description: detail && detail !== error?.message ? detail : undefined,
          });
        },
      }
    );
  }, [
    canSubmitBulk, bulkSelectedRows, amountEdits, bulkMutation, examId, classId, sectionId,
    paymentMethod, chequeNumber, paymentReference, note, allowAdvanceToWallet, formatCurrency, t,
  ]);

  if (isAuthLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} description={t("description")} />
        <TableSkeleton />
      </div>
    );
  }

  if (!canReadFees) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} description={t("description")} />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {tCommon("noPermission")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      {/* ── Cascade selectors: exam → class → section ── */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <ERPFormSection title={t("scope")} description={t("scopeHelp")}>
            <div className="grid gap-4 md:grid-cols-3">
              <ERPFormField label={t("exam")} required>
                <AppDropdown
                  value={examId}
                  onChange={handleExamChange}
                  options={exams.map((e: any) => ({
                    value: e.id,
                    label: `${e.name} (${e.type})`,
                  }))}
                  placeholder={t("selectExam")}
                  searchable
                  searchPlaceholder={t("searchExam")}
                  noOptionsText={t("noExams")}
                  triggerClassName={cn(isLoadingExams && "opacity-60")}
                />
              </ERPFormField>

              <ERPFormField label={t("class")} required>
                <AppDropdown
                  value={classId}
                  onChange={handleClassChange}
                  // Disabled until the exam is chosen (AGENTS rule 5).
                  disabled={!examId || examClasses.length === 0}
                  options={examClasses.map((c) => ({
                    value: c.classId,
                    label: `${c.className} — ${formatCurrency(Number(c.feeAmount))}`,
                  }))}
                  placeholder={!examId ? t("selectExamFirst") : t("selectClass")}
                  noOptionsText={t("noChargeableClasses")}
                />
              </ERPFormField>

              <ERPFormField label={t("section")}>
                <AppDropdown
                  value={sectionId}
                  onChange={(v) => {
                    setSectionId(v);
                    setPage(1);
                  }}
                  disabled={!classId || sectionOptions.length === 0}
                  options={sectionOptions}
                  placeholder={!classId ? t("selectClassFirst") : t("selectSection")}
                  noOptionsText={t("noSections")}
                />
              </ERPFormField>
            </div>

            {/* The exam is billed from its own academic year. If the global
                selector points elsewhere, say so instead of silently billing
                the wrong year's ledger. */}
            {dueData && !dueData.exam.academicYearMatchesSelection && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{t("academicYearMismatch")}</p>
              </div>
            )}

            {/* A listed-but-unpaid class is a configuration state, not an
                empty result set; make the distinction explicit. */}
            {examId && examClasses.length === 0 && !isLoadingDue && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{t("noExamFeeConfigured")}</p>
              </div>
            )}
            {examClasses.some((c) => !c.isChargeable) && (
              <p className="text-xs text-muted-foreground">{t("someClassesNotCharged")}</p>
            )}
          </ERPFormSection>
        </CardContent>
      </Card>

      {examId && (
        <>
          {/* ── Totals ── */}
          {totals && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                icon={<Users className="h-4 w-4" />}
                label={t("students")}
                value={String(totals.studentCount)}
                hint={`${totals.paidCount} ${t("paid")} · ${totals.unpaidCount} ${t("unpaid")}`}
              />
              <MetricCard
                icon={<Receipt className="h-4 w-4" />}
                label={t("netPayable")}
                value={formatCurrency(Number(totals.netPayable))}
                hint={`${t("gross")} ${formatCurrency(Number(totals.grossAmount))}`}
              />
              <MetricCard
                icon={<AlertTriangle className="h-4 w-4" />}
                label={t("outstanding")}
                value={formatCurrency(Number(totals.outstandingAmount))}
                destructive={Number(totals.outstandingAmount) > 0}
              />
              <MetricCard
                icon={<Wallet className="h-4 w-4" />}
                label={t("concessions")}
                value={formatCurrency(Number(totals.discountAmount))}
              />
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* ── Single counter collection ── */}
            <Card className="lg:col-span-1">
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">{t("singleDesk")}</h3>
                </div>

                <ERPFormField label={t("student")} required>
                  <AppDropdown
                    value={selectedStudentId}
                    onChange={setSelectedStudentId}
                    disabled={!examId || students.length === 0}
                    options={visibleStudents.map((s: ExamFeeStudentRow) => ({
                      value: s.studentProfileId,
                      label: `${s.name} · ${s.rollNumber ?? s.studentId}`,
                    }))}
                    placeholder={students.length === 0 ? t("noStudents") : t("selectStudent")}
                    searchable
                    searchPlaceholder={t("searchStudent")}
                    noOptionsText={t("noStudents")}
                  />
                </ERPFormField>

                {selectedStudent && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{selectedStudent.name}</span>
                      <StatusBadge
                        status={selectedStudent.isPaid ? "PAID" : selectedStudent.existingVoucherStatus ?? "PENDING"}
                      />
                    </div>
                    <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <dt>{t("class")}</dt>
                        <dd className="text-foreground">
                          {selectedStudent.className}
                          {selectedStudent.sectionName ? ` · ${selectedStudent.sectionName}` : ""}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>{t("gross")}</dt>
                        <dd className="text-foreground">
                          {formatCurrency(Number(selectedStudent.grossAmount))}
                        </dd>
                      </div>
                      {Number(selectedStudent.discountAmount) > 0 && (
                        <div className="flex justify-between">
                          <dt>{t("concession")}</dt>
                          <dd className="text-foreground">
                            −{formatCurrency(Number(selectedStudent.discountAmount))}
                          </dd>
                        </div>
                      )}
                      <div className="flex justify-between font-medium text-foreground">
                        <dt>{t("outstanding")}</dt>
                        <dd>{formatCurrency(Number(selectedStudent.outstanding))}</dd>
                      </div>
                    </dl>
                  </div>
                )}

                <ERPFormField label={t("amount")} required htmlFor="exam-fee-amount">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {currencySymbol}
                    </span>
                    <Input
                      id="exam-fee-amount"
                      inputMode="decimal"
                      className={cn("pl-7 text-right", isOverpayment && !allowAdvanceToWallet && "border-destructive")}
                      value={amountInput}
                      placeholder="0.00"
                      disabled={!selectedStudentId}
                      onChange={(e) => setAmountInput(e.target.value)}
                    />
                  </div>
                </ERPFormField>

                {isOverpayment && !allowAdvanceToWallet && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p>{t("overpaymentWarning")}</p>
                  </div>
                )}

                <Button
                  className="w-full"
                  disabled={!canSubmitSingle || collectMutation.isPending}
                  onClick={handleSingleSubmit}
                >
                  {collectMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      {t("collecting")}
                    </>
                  ) : (
                    <>
                      <Receipt className="mr-2 h-3.5 w-3.5" />
                      {t("collect")}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* ── Payment method + bulk grid ── */}
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardContent className="space-y-4 pt-6">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">{t("paymentDetails")}</h3>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <ERPFormField label={t("paymentMethod")} required>
                      <AppDropdown
                        value={paymentMethod}
                        onChange={setPaymentMethod}
                        options={paymentMethods}
                        placeholder={t("selectPaymentMethod")}
                        searchable
                        noOptionsText={t("noPaymentMethods")}
                      />
                    </ERPFormField>

                    {methodRules.isCheque && (
                      <ERPFormField label={t("chequeNumber")} required>
                        <Input
                          value={chequeNumber}
                          onChange={(e) => setChequeNumber(e.target.value)}
                          placeholder={t("enterChequeNumber")}
                        />
                      </ERPFormField>
                    )}

                    {methodRules.requiresReference && (
                      <ERPFormField label={t("externalReference")} required>
                        <Input
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          placeholder={t("enterReference")}
                        />
                      </ERPFormField>
                    )}

                    <ERPFormField label={tCommon("notes")}>
                      <Input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={t("notePlaceholder")}
                      />
                    </ERPFormField>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={allowAdvanceToWallet}
                      onChange={(e) => setAllowAdvanceToWallet(e.target.checked)}
                    />
                    <span>{t("allowAdvanceToWallet")}</span>
                  </label>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-4 pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">{t("bulkDesk")}</h3>
                    </div>
                    {bulkSelectedRows.length > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {bulkSelectedRows.length} {t("selected")} · {formatCurrency(roundCurrency(bulkTotal))}
                      </span>
                    )}
                  </div>

                  {dueError ? (
                    <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                      {dueError.message}
                    </div>
                  ) : (
                    <ERPDataTable<ExamFeeStudentRow>
                      data={visibleStudents}
                      keyExtractor={(row) => row.studentProfileId}
                      searchPlaceholder={t("searchStudent")}
                      searchValue={searchTerm}
                      onSearchChange={(v) => {
                        setSearchTerm(v);
                        setPage(1);
                      }}
                      selectedIds={Object.keys(selectedIds).filter((k) => selectedIds[k])}
                      onSelectionChange={(ids) => {
                        const next: Record<string, boolean> = {};
                        for (const id of ids) next[String(id)] = true;
                        setSelectedIds(next);
                      }}
                      // Already-settled students cannot be collected again;
                      // excluding them here stops the "already paid" error
                      // from ever being reachable through the bulk desk.
                      isRowSelectable={(row) => !row.isPaid}
                      page={page}
                      pageSize={pageSize}
                      totalCount={visibleStudents.length}
                      pageSizeOptions={[10, 20, 50, 100]}
                      onPageChange={setPage}
                      onPageSizeChange={(n) => {
                        setPageSize(n);
                        setPage(1);
                      }}
                      paginationLabels={{
                        rowsPerPage: t("pagination.rowsPerPage"),
                        range: (start, end, total) => t("pagination.range", { start, end, total }),
                        previous: t("pagination.previous"),
                        next: t("pagination.next"),
                      }}
                      columns={[
                        {
                          key: "student",
                          header: t("student"),
                          cell: (row: ExamFeeStudentRow) => (
                            <div className="min-w-0">
                              <p className="truncate font-medium">{row.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {row.rollNumber ?? row.studentId}
                              </p>
                            </div>
                          ),
                        },
                        {
                          key: "section",
                          header: t("section"),
                          cell: (row: ExamFeeStudentRow) => (
                            <span className="text-sm text-muted-foreground">
                              {row.sectionName ?? "—"}
                            </span>
                          ),
                        },
                        {
                          key: "gross",
                          header: t("gross"),
                          cell: (row: ExamFeeStudentRow) => (
                            <span className="font-mono text-sm">
                              {formatCurrency(Number(row.grossAmount))}
                            </span>
                          ),
                        },
                        {
                          key: "outstanding",
                          header: t("outstanding"),
                          cell: (row: ExamFeeStudentRow) => (
                            <span className="font-mono text-sm font-medium">
                              {formatCurrency(Number(row.outstanding))}
                            </span>
                          ),
                        },
                        {
                          key: "collect",
                          header: t("amountCollected"),
                          cell: (row: ExamFeeStudentRow) =>
                            row.isPaid ? (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                {t("paid")}
                              </span>
                            ) : (
                              <div className="relative w-[120px]">
                                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                  {currencySymbol}
                                </span>
                                <Input
                                  inputMode="decimal"
                                  className="h-8 pl-6 text-right text-sm"
                                  placeholder={String(row.outstanding)}
                                  value={amountEdits[row.studentProfileId] ?? ""}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setAmountEdits((prev) => ({
                                      ...prev,
                                      [row.studentProfileId]: value,
                                    }));
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            ),
                        },
                        {
                          key: "status",
                          header: tCommon("status"),
                          cell: (row: ExamFeeStudentRow) => (
                            <StatusBadge
                              status={row.isPaid ? "PAID" : row.existingVoucherStatus ?? "PENDING"}
                            />
                          ),
                        },
                      ]}
                      emptyState={
                        <div className="py-10 text-center">
                          <CreditCard className="mx-auto h-8 w-8 text-muted-foreground" />
                          <p className="mt-2 text-sm text-muted-foreground">
                            {t("noStudents")}
                          </p>
                        </div>
                      }
                    />
                  )}

                  {canUseBulk && (
                    <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
                      <p className="text-xs text-muted-foreground">
                        {bulkSelectedRows.length === 0
                          ? t("bulkHint")
                          : `${t("collecting")}: ${formatCurrency(roundCurrency(bulkTotal))}`}
                      </p>
                      <Button
                        disabled={!canSubmitBulk || bulkMutation.isPending}
                        onClick={handleBulkSubmit}
                      >
                        {bulkMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            {t("collecting")}
                          </>
                        ) : (
                          <>
                            <Receipt className="mr-2 h-3.5 w-3.5" />
                            {t("bulkCollect", { count: bulkSelectedRows.length })}
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── Per-row failure reporting ── */}
          {lastResult?.failures?.length > 0 && (
            <Card className="border-destructive/40">
              <CardContent className="space-y-2 pt-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {t("failedCount", { count: lastResult.failedCount })}
                </div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {lastResult.failures.map((f: any, i: number) => (
                    <li key={`${f.studentProfileId}-${i}`}>
                      <Search className="mr-1 inline h-3 w-3" />
                      {f.studentProfileId} — {f.reason}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  destructive?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        <p
          className={cn(
            "mt-2 text-2xl font-semibold tabular-nums",
            destructive && "text-destructive"
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
