"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

/**
 * Exam-fee data hooks.
 *
 * Query keys follow the AGENTS rule 7 hierarchy: the base entity noun is index
 * 0 and every active filter rides along, so invalidating `["exam-fees"]`
 * refreshes both the POS desk and the bulk grid.
 *
 * No financial arithmetic happens in these hooks or their callers — all of it
 * is server-side in `@/lib/exam-fee-service`. Amounts arrive as fixed-2dp
 * strings and are only ever formatted for display.
 */

export interface ExamFeeClassRow {
  classId: string;
  className: string;
  feeAmount: string;
  isFeeApplicable: boolean;
  isChargeable: boolean;
}

export interface ExamFeeStudentRow {
  studentProfileId: string;
  studentId: string;
  rollNumber: string;
  name: string;
  nameBn: string | null;
  classId: string;
  className: string;
  sectionId: string | null;
  sectionName: string | null;
  grossAmount: string;
  discountAmount: string;
  netPayable: string;
  outstanding: string;
  isPaid: boolean;
  existingVoucherId: string | null;
  existingVoucherStatus: string | null;
}

export interface ExamFeeDueResponse {
  exam: {
    id: string;
    examId: string;
    name: string;
    type: string;
    startDate: string;
    endDate: string;
    academicYearId: string;
    academicYearMatchesSelection: boolean;
  };
  classes: ExamFeeClassRow[];
  students: ExamFeeStudentRow[];
  totals: {
    grossAmount: string;
    discountAmount: string;
    netPayable: string;
    outstandingAmount: string;
    paidCount: number;
    unpaidCount: number;
    studentCount: number;
  };
}

export interface ExamFeeCollectPayload {
  examId: string;
  studentProfileId: string;
  amountPaid: number;
  paymentMethod: string;
  receiptNumber?: string;
  chequeNumber?: string;
  reference?: string;
  note?: string;
  allowAdvanceToWallet?: boolean;
}

export interface ExamFeeBulkPayload {
  examId: string;
  classId: string;
  sectionId?: string;
  paymentMethod: string;
  chequeNumber?: string;
  reference?: string;
  note?: string;
  allowAdvanceToWallet?: boolean;
  payments: Array<{ studentProfileId: string; amountPaid: number }>;
}

export interface ExamFeeBulkResult {
  exam: { id: string; name: string; examId: string };
  classId: string;
  totalRequested: number;
  succeededCount: number;
  failedCount: number;
  totalCollected: string;
  receipts: Array<{
    feeVoucherId: string;
    voucherId: string;
    receiptNumber: string;
    amountPaid: string;
    appliedToInvoice: string;
    excessToWallet: string;
    newBalance: string;
    status: string;
    voucherCreated: boolean;
  }>;
  failures: Array<{
    studentProfileId: string;
    amountPaid: number;
    reason: string;
  }>;
}

export function useExamFeeDue(params: {
  examId: string;
  classId?: string;
  sectionId?: string;
  search?: string;
}) {
  const { examId, classId, sectionId, search } = params;
  return useQuery<ExamFeeDueResponse>({
    queryKey: ["exam-fees", { examId, classId: classId || "", sectionId: sectionId || "", search: search || "" }],
    queryFn: async () => {
      const p = new URLSearchParams({ examId });
      if (classId) p.set("classId", classId);
      if (sectionId) p.set("sectionId", sectionId);
      if (search) p.set("search", search);
      const res = await fetch(`/api/exam-fees/due?${p.toString()}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || json?.error) {
        throw new Error(json?.error?.message || "Failed to load exam fee position");
      }
      return json.data as ExamFeeDueResponse;
    },
    enabled: !!examId,
  });
}

export function useCollectExamFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ExamFeeCollectPayload) => {
      const res = await fetch("/api/exam-fees/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json?.error) {
        // Rule 11: surface the real reason, including field-level detail from
        // the API's "[Field '<field>', Code: <code>] <message>" formatting.
        const detail = json?.error?.details?.[0]?.message;
        const err = new Error(json?.error?.message || "Failed to collect exam fee") as Error & {
          details?: Array<{ field?: string; code?: string; message: string }>;
        };
        if (detail) err.details = json.error.details;
        throw err;
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exam-fees"] });
      // An exam fee is a real AR movement: every fee-facing surface must
      // reflect it, not just the exam module.
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useBulkCollectExamFee() {
  const queryClient = useQueryClient();
  const t = useTranslations("examFees");
  return useMutation({
    mutationFn: async (payload: ExamFeeBulkPayload) => {
      const res = await fetch("/api/exam-fees/bulk-collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json?.error) {
        const err = new Error(json?.error?.message || "Failed to collect exam fees") as Error & {
          details?: Array<{ field?: string; code?: string; message: string }>;
        };
        if (json?.error?.details) err.details = json.error.details;
        throw err;
      }
      return json.data as ExamFeeBulkResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["exam-fees"] });
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      // A partial batch is a real outcome, not a silent success: say plainly
      // how many landed and how many did not. The per-row reasons are already
      // carried on `result.failures` and rendered by the page.
      if (result.failedCount > 0) {
        toast.error(
          t("bulkPartial", {
            succeeded: result.succeededCount,
            failed: result.failedCount,
            total: result.totalRequested,
          })
        );
      }
    },
  });
}
