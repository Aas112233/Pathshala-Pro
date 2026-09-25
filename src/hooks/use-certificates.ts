"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { appToast as toast } from "@/lib/notifications/toast";

export type BulkCertificateType =
  | "TRANSFER"
  | "CHARACTER"
  | "BONAFIDE"
  | "STUDY"
  | "MARKSHEET"
  | "OTHER";

export interface BulkIssueCertificatesInput {
  studentProfileIds: string[];
  certificateType: BulkCertificateType;
  issueDate?: string;
  validUntil?: string | null;
  purpose?: string | null;
  remarks?: string | null;
}

/** A student's identifying details, shaped for the certificate templates. */
export interface IssuedCertificateStudent {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  rollNumber: string;
  fatherName: string | null;
  guardianName: string;
  dateOfBirth: string | null;
  admissionDate: string | null;
  className: string | null;
  sectionName: string | null;
}

export interface IssuedCertificate {
  id: string;
  certificateNumber: string;
  certificateType: string;
  issueDate: string;
  validUntil: string | null;
  purpose: string | null;
  status: string;
  studentProfileId: string;
  student: IssuedCertificateStudent;
}

export interface SkippedCertificate {
  studentProfileId: string;
  studentName: string;
  code: string;
  message: string;
}

export interface BulkIssueCertificatesResult {
  certificateType: string;
  issueDate: string;
  issued: IssuedCertificate[];
  skipped: SkippedCertificate[];
}

/**
 * Issues one certificate per student in a single request.
 *
 * The server allocates the numbers, so the client never composes them — a batch
 * that invents its own numbers is how a numbering scheme quietly stops being
 * sequential.
 */
export function useBulkIssueCertificates() {
  const t = useTranslations("certificates");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BulkIssueCertificatesInput) => {
      const response = await fetch("/api/certificates/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input),
      });
      const json = await response.json();
      if (!response.ok) {
        // The route reports field-level detail for a rejected batch (an unknown
        // student, a duplicate, a bad date). Carry it through so the operator
        // sees which student failed rather than only that the batch did.
        const failure = new Error(json.message || t("bulkIssueFailed")) as Error & {
          details?: Array<{ code?: string; message?: string }>;
        };
        failure.details = json.details;
        throw failure;
      }
      return json.data as BulkIssueCertificatesResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
    },
    onError: (error: any) => {
      const description = error?.details?.[0]?.message;
      toast.error(error?.message || t("bulkIssueFailed"), {
        description: description !== error?.message ? description : undefined,
      });
    },
  });
}
