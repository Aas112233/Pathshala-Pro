"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { usePDFExport } from "@/hooks/use-pdf-export";
import { useTenantSettings } from "@/components/providers/tenant-settings-provider";
import { formatDateWithSettings } from "@/lib/tenant-settings";
import { toast } from "sonner";

/**
 * The student fields a certificate template can render.
 *
 * Both shapes are accepted on purpose: the certificates page enriches from the
 * `/api/students` list (nested `class`/`section` relations), while the exit
 * workflow receives flat `className`/`sectionName` from the bulk issue
 * response. One printer handles both rather than two that drift.
 */
export interface CertificatePrintStudent {
  id?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  studentId?: string | null;
  admissionNumber?: string | null;
  rollNumber?: string | null;
  fatherName?: string | null;
  guardianName?: string | null;
  dateOfBirth?: string | Date | null;
  admissionDate?: string | Date | null;
  className?: string | null;
  sectionName?: string | null;
  class?: { name?: string | null } | null;
  section?: { name?: string | null } | null;
}

export interface PrintableCertificate {
  id?: string | null;
  certificateNumber: string;
  certificateType?: string | null;
  issueDate?: string | Date | null;
  validUntil?: string | Date | null;
  purpose?: string | null;
  remarks?: string | null;
  academicYear?: string | null;
  studentProfileId?: string | null;
  studentProfile?: CertificatePrintStudent | null;
}

/**
 * Renders and downloads a certificate PDF.
 *
 * Extracted from the certificates page so the promotion exit workflow can print
 * a certificate it has just issued without carrying a second copy of the
 * template-dispatch logic — the two would otherwise diverge the first time a
 * template's required fields changed.
 */
export function useCertificatePrinter(options?: { students?: CertificatePrintStudent[] }) {
  const t = useTranslations("certificates");
  const { settings } = useTenantSettings();
  const {
    exportTransferCertificatePDF,
    exportCharacterCertificatePDF,
    exportBonafideCertificatePDF,
  } = usePDFExport();

  const [printingId, setPrintingId] = useState<string | null>(null);

  const fallbackStudents = options?.students;

  const printCertificate = useCallback(
    async (
      cert: PrintableCertificate,
      studentOverride?: CertificatePrintStudent
    ): Promise<boolean> => {
      const embedded = cert.studentProfile ?? {};
      const student =
        studentOverride ??
        fallbackStudents?.find((candidate) => candidate.id === cert.studentProfileId) ??
        {};

      // A certificate that carries its own student snapshot prints from it;
      // anything it does not carry is filled from the looked-up record. Keeping
      // the precedence in one place stops the two sources from disagreeing
      // field by field.
      const detail = {
        firstName: embedded.firstName || student.firstName || "",
        lastName: embedded.lastName || student.lastName || "",
        fatherName:
          embedded.fatherName || student.fatherName || student.guardianName || embedded.guardianName,
        guardianName: student.guardianName || embedded.guardianName,
        studentId:
          embedded.studentId ||
          student.studentId ||
          embedded.admissionNumber ||
          student.admissionNumber,
        rollNumber: embedded.rollNumber || student.rollNumber,
        className:
          embedded.class?.name || student.class?.name || embedded.className || student.className,
        sectionName:
          embedded.section?.name ||
          student.section?.name ||
          embedded.sectionName ||
          student.sectionName,
        dateOfBirth: student.dateOfBirth || embedded.dateOfBirth,
        admissionDate: student.admissionDate || embedded.admissionDate,
      };

      const school = {
        name: settings.name || "Pathshala Pro School",
        address: settings.address || "",
        phone: settings.phone || "",
        email: settings.email || "",
        logoUrl: settings.logoUrl,
      };

      const verificationUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/verify/certificate/${cert.id || cert.certificateNumber}`
          : undefined;

      const studentName =
        `${detail.firstName} ${detail.lastName}`.trim() || t("defaultStudent");

      const base = {
        certificateNumber: cert.certificateNumber,
        issueDate: cert.issueDate
          ? formatDateWithSettings(cert.issueDate, settings)
          : formatDateWithSettings(new Date(), settings),
        validUntil: cert.validUntil
          ? formatDateWithSettings(cert.validUntil, settings)
          : undefined,
        studentName,
        fatherName: detail.fatherName || undefined,
        admissionNumber: detail.studentId || cert.studentProfileId?.slice(0, 8) || "—",
        rollNumber: detail.rollNumber || "—",
        className: detail.className || "—",
        section: detail.sectionName || undefined,
        academicYear:
          cert.academicYear ||
          (cert.issueDate
            ? String(new Date(cert.issueDate).getFullYear())
            : String(new Date().getFullYear())),
        purpose: cert.purpose || cert.remarks || t("generalPurpose"),
        remarks: cert.remarks || undefined,
      };

      setPrintingId(cert.id ?? cert.certificateNumber);
      try {
        let result: { success?: boolean } | null = null;
        const type = String(cert.certificateType || "BONAFIDE").toUpperCase();

        if (type === "TRANSFER") {
          result = await exportTransferCertificatePDF(
            school,
            {
              ...base,
              admissionDate: detail.admissionDate
                ? formatDateWithSettings(detail.admissionDate, settings)
                : base.issueDate,
              leavingDate: base.validUntil || formatDateWithSettings(new Date(), settings),
              lastClassAttended: base.className,
              dateOfBirth: detail.dateOfBirth
                ? formatDateWithSettings(detail.dateOfBirth, settings)
                : undefined,
              reasonForLeaving: cert.purpose || cert.remarks || t("transferReason"),
              conduct: t("defaultConduct"),
              guardianName: detail.guardianName || undefined,
            },
            verificationUrl
          );
        } else if (type === "CHARACTER") {
          result = await exportCharacterCertificatePDF(
            school,
            {
              ...base,
              sessionFrom: detail.admissionDate
                ? formatDateWithSettings(detail.admissionDate, settings)
                : base.academicYear,
              sessionTo: base.issueDate,
              conduct: cert.remarks?.split(",")[0] || t("defaultConduct"),
              characterRating: t("defaultCharacterRating"),
              attendancePercentage: undefined,
              achievements: cert.remarks || undefined,
            },
            verificationUrl
          );
        } else {
          // BONAFIDE, STUDY, OTHER and MARKSHEET fall back to the bonafide template.
          result = await exportBonafideCertificatePDF(
            school,
            {
              ...base,
              dateOfBirth: detail.dateOfBirth
                ? formatDateWithSettings(detail.dateOfBirth, settings)
                : undefined,
              guardianName: detail.guardianName || undefined,
              purpose: cert.purpose || t("defaultPurpose"),
            },
            verificationUrl
          );
        }

        if (result?.success) {
          toast.success(t("printSuccess"));
          return true;
        }
        toast.error(t("printFailed"));
        return false;
      } catch (error) {
        console.error(error);
        toast.error(t("printFailed"));
        return false;
      } finally {
        setPrintingId(null);
      }
    },
    [
      fallbackStudents,
      settings,
      t,
      exportTransferCertificatePDF,
      exportCharacterCertificatePDF,
      exportBonafideCertificatePDF,
    ]
  );

  return { printCertificate, printingId, isPrinting: printingId !== null };
}
