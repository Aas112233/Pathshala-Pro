"use client";

import { useCallback } from "react";
import { NextIntlClientProvider, useLocale, useMessages } from "next-intl";
import { downloadBlob } from "@/lib/download-blob";
import { formatDateWithSettings } from "@/lib/tenant-settings";
// Type-only: erased at build, costs zero bundle bytes. The template
// *components* are NOT imported here — they load on click via loadPdfTemplates.
import type {
  PdfFilterItem,
  PdfMetricItem,
  PdfCommonLabels,
  BatchStudentResult,
  FeeVoucherPDFData,
  TransportManifestPDFData,
  ManifestStudent,
  SalaryPayslipPDFData,
  LibraryIssueSlipData,
  HostelManifestPDFData,
  HostelResident,
  TransferCertificateData,
  CharacterCertificateData,
  BonafideCertificateData,
  ExamAdmitCardData,
  TranscriptData,
  StaffIDCardData,
  LibraryClearanceData,
  TimetableReportData,
  InventoryStockItem,
  ProfitLossReportTemplateProps,
} from "@/lib/pdf-templates";

// @react-pdf/renderer + all templates + Urdu/Hindi/Bengali font packs are
// ~1MB of client JS. They used to ship with all 22 pages importing this hook;
// now they split into a chunk that loads on the first export click only.
type PdfRendererModule = typeof import("@react-pdf/renderer");
type PdfTemplatesModule = typeof import("@/lib/pdf-templates");

let rendererPromise: Promise<PdfRendererModule> | null = null;
let templatesPromise: Promise<PdfTemplatesModule> | null = null;

const loadPdfRenderer = () => (rendererPromise ??= import("@react-pdf/renderer"));
const loadPdfTemplates = () => (templatesPromise ??= import("@/lib/pdf-templates"));

// Batch ceiling: one giant in-browser document freezes low-end phones and can
// OOM the tab. Files split into Part 1..N instead (same convention as the
// bulk-collect API's max-100 rule).
export const MAX_BATCH_PDF_RECORDS = 100;

function chunkRecords<T>(items: T[], size: number): T[][] {
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size) parts.push(items.slice(i, i + size));
  return parts;
}

function partFileName(baseName: string, index: number, total: number): string {
  if (total <= 1) return baseName;
  return baseName.replace(/\.pdf$/i, "") + `_Part${index + 1}of${total}.pdf`;
}

export type {
  FeeVoucherPDFData,
  TransportManifestPDFData,
  ManifestStudent,
  SalaryPayslipPDFData,
  LibraryIssueSlipData,
  HostelManifestPDFData,
  HostelResident,
  TransferCertificateData,
  CharacterCertificateData,
  BonafideCertificateData,
  ExamAdmitCardData,
  TranscriptData,
  StaffIDCardData,
  LibraryClearanceData,
  TimetableReportData,
  InventoryStockItem,
};

interface SchoolInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
}

interface StudentInfo {
  name: string;
  admissionNumber: string;
  rollNumber: string;
  className: string;
  section: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup?: string;
  guardianName: string;
  guardianContact: string;
  address?: string;
  photoUrl?: string;
}

interface Mark {
  subject: string;
  subjectCode: string;
  maxMarks: number;
  obtainedMarks: number;
  passMarks: number;
  grade: string;
  gradePoint: number;
  remarks?: string;
}

interface TermResult {
  termName: string;
  subjects: Mark[];
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade: string;
  rank?: number;
  totalStudents?: number;
}

interface AttendanceRecord {
  month: string;
  present: number;
  total: number;
}

interface CoCurricularActivity {
  activity: string;
  grade: string;
  remarks?: string;
}

interface StudentReportRecord {
  admissionNumber: string;
  studentName: string;
  className: string;
  section: string;
  rollNumber: string;
  gender: string;
  status: string;
  admissionDate: string;
  guardianName: string;
  contactNumber: string;
  [key: string]: string | number;
}

interface FeeReportRecord {
  voucherNumber: string;
  studentName: string;
  className: string;
  section: string;
  amount: string;
  paidAmount: string;
  dueAmount: string;
  status: string;
  paymentMethod: string;
  date: string;
  [key: string]: string | number;
}

interface AttendanceReportRecord {
  rollNumber: string;
  studentName: string;
  className: string;
  section: string;
  presentDays: number;
  absentDays: number;
  totalDays: number;
  attendancePercentage: string;
  status: string;
  [key: string]: string | number;
}

interface ExamReportRecord {
  rollNumber: string;
  studentName: string;
  className: string;
  section: string;
  examName: string;
  subject: string;
  marks: string;
  percentage: string;
  grade: string;
  status: string;
  [key: string]: string | number;
}

export function usePDFExport() {
  const locale = useLocale();
  const messages = useMessages();
  const pdfLabels = (messages as Record<string, unknown> | undefined)?.pdf as
    | { common?: PdfCommonLabels }
    | undefined;
  const commonLabels = pdfLabels?.common;
  const generatePDF = useCallback(async (document: React.ReactElement, fileName: string) => {
    try {
      const { pdf } = await loadPdfRenderer();
      // Render inside the app's locale provider so every template's
      // useTranslations("pdfDocs.*") follows the current app language.
      // (Verified: next-intl context resolves inside react-pdf's reconciler.)
      const localized = (
        <NextIntlClientProvider locale={locale} messages={messages}>
          {document}
        </NextIntlClientProvider>
      );
      const blob = await pdf(localized).toBlob();
      downloadBlob(blob, fileName);
      return { success: true };
    } catch (error) {
      console.error("PDF generation error:", error);
      return { success: false, error };
    }
  }, [locale, messages]);

  const exportStudentIDCard = useCallback(async (
    student: StudentInfo,
    school: SchoolInfo,
    academicYear: string
  ) => {
    const { StudentIDCardTemplate } = await loadPdfTemplates();
    const document = (
      <StudentIDCardTemplate
        student={{
          ...student,
          academicYear,
        }}
        school={school}
      />
    );
    const fileName = `ID_Card_${student.admissionNumber}.pdf`;
    return generatePDF(document, fileName);
  }, [generatePDF]);

  const exportMarkSheet = useCallback(async (
    student: StudentInfo,
    exam: {
      name: string;
      type: string;
      academicYear: string;
      date: string;
    },
    marks: Mark[],
    school: SchoolInfo
  ) => {
    const { MarkSheetTemplate } = await loadPdfTemplates();
    const document = (
      <MarkSheetTemplate
        student={student}
        exam={exam}
        marks={marks}
        school={school}
      />
    );
    const fileName = `MarkSheet_${student.admissionNumber}_${exam.type}.pdf`;
    return generatePDF(document, fileName);
  }, [generatePDF]);

  const exportReportCard = useCallback(async (
    student: StudentInfo,
    academicYear: string,
    terms: TermResult[],
    attendance: AttendanceRecord[],
    coCurricular?: CoCurricularActivity[],
    teacherRemarks?: string,
    principalRemarks?: string,
    school?: SchoolInfo
  ) => {
    const defaultSchool: SchoolInfo = {
      name: "Pathshala Pro School",
      address: "School Address",
      phone: "000-0000000",
      email: "info@school.com",
    };

    const { ReportCardTemplate } = await loadPdfTemplates();
    const document = (
      <ReportCardTemplate
        student={student}
        academicYear={academicYear}
        terms={terms}
        attendance={attendance}
        coCurricular={coCurricular}
        teacherRemarks={teacherRemarks}
        principalRemarks={principalRemarks}
        school={school || defaultSchool}
      />
    );
    const fileName = `ReportCard_${student.admissionNumber}_${academicYear}.pdf`;
    return generatePDF(document, fileName);
  }, [generatePDF]);

  const exportBulkIDCards = useCallback(async (
    students: StudentInfo[],
    school: SchoolInfo,
    academicYear: string
  ) => {
    // One save-dialog per student: beyond MAX the browser blocks downloads and
    // the tab sits in a render loop. Fail fast with a clear message instead.
    if (students.length > MAX_BATCH_PDF_RECORDS) {
      throw new Error(`Bulk ID cards are limited to ${MAX_BATCH_PDF_RECORDS} students per run. Split the selection and retry.`);
    }
    const results = [];
    for (const student of students) {
      const result = await exportStudentIDCard(student, school, academicYear);
      results.push(result);
    }
    return results;
  }, [exportStudentIDCard]);

  const exportStudentReportPDF = useCallback(async (params: {
    school: SchoolInfo;
    dateRangeLabel: string;
    generatedAt: string;
    filters: PdfFilterItem[];
    metrics: {
      totalStudents: number;
      activeStudents: number;
      newAdmissions: number;
      transferredOut: number;
      graduated: number;
    };
    records: StudentReportRecord[];
  }) => {
    const { StudentReportTemplate } = await loadPdfTemplates();
    const document = <StudentReportTemplate {...params} locale={locale} labels={commonLabels} />;
    return generatePDF(document, "Student_Report.pdf");
  }, [generatePDF]);

  const exportFeeReportPDF = useCallback(async (params: {
    school: SchoolInfo;
    dateRangeLabel: string;
    generatedAt: string;
    filters: PdfFilterItem[];
    metrics: {
      totalCollected: string;
      totalPending: string;
      totalOverdue: string;
      collectionRate: string;
    };
    records: FeeReportRecord[];
  }) => {
    const { FeeReportTemplate } = await loadPdfTemplates();
    const document = <FeeReportTemplate {...params} locale={locale} labels={commonLabels} />;
    return generatePDF(document, "Fee_Report.pdf");
  }, [generatePDF]);

  const exportAttendanceReportPDF = useCallback(async (params: {
    school: SchoolInfo;
    dateRangeLabel: string;
    generatedAt: string;
    filters: PdfFilterItem[];
    metrics: {
      averageAttendance: string;
      totalPresent: string;
      totalAbsent: string;
      defaulterCount: string;
    };
    records: AttendanceReportRecord[];
  }) => {
    const { AttendanceReportTemplate } = await loadPdfTemplates();
    const document = <AttendanceReportTemplate {...params} locale={locale} labels={commonLabels} />;
    return generatePDF(document, "Attendance_Report.pdf");
  }, [generatePDF]);

  const exportExamReportPDF = useCallback(async (params: {
    school: SchoolInfo;
    dateRangeLabel: string;
    generatedAt: string;
    filters: PdfFilterItem[];
    metrics: {
      totalExams: string;
      passPercentage: string;
      averageMarks: string;
      topPerformers: string;
    };
    records: ExamReportRecord[];
  }) => {
    const { ExamReportTemplate } = await loadPdfTemplates();
    const document = <ExamReportTemplate {...params} locale={locale} labels={commonLabels} />;
    return generatePDF(document, "Exam_Report.pdf");
  }, [generatePDF]);

  const exportBatchReportCardsPDF = useCallback(async (params: {
    school: SchoolInfo;
    students: BatchStudentResult[];
    fileName?: string;
  }) => {
    try {
      const { BatchReportCardDocument } = await loadPdfTemplates();
      const base = params.fileName || `Class_Report_Cards_${Date.now()}.pdf`;
      const parts = chunkRecords(params.students, MAX_BATCH_PDF_RECORDS);
      if (parts.length === 0) parts.push([]);
      let ok = true;
      for (let i = 0; i < parts.length; i++) {
        const document = <BatchReportCardDocument school={params.school} students={parts[i]} />;
        const r = await generatePDF(document, partFileName(base, i, parts.length));
        ok = ok && r.success;
      }
      return { success: ok, parts: parts.length };
    } catch (error) {
      console.error("PDF generation error:", error);
      return { success: false, error, parts: 0 };
    }
  }, [generatePDF]);

  const exportFeeVouchersPDF = useCallback(async (
    vouchers: FeeVoucherPDFData[],
    fileName?: string
  ) => {
    try {
      const { FeeVoucherPDFDocument } = await loadPdfTemplates();
      const base = fileName || `Fee_Vouchers_${Date.now()}.pdf`;
      const parts = chunkRecords(vouchers, MAX_BATCH_PDF_RECORDS);
      if (parts.length === 0) parts.push([]);
      let ok = true;
      for (let i = 0; i < parts.length; i++) {
        const r = await generatePDF(<FeeVoucherPDFDocument vouchers={parts[i]} />, partFileName(base, i, parts.length));
        ok = ok && r.success;
      }
      return { success: ok, parts: parts.length };
    } catch (error) {
      console.error("PDF generation error:", error);
      return { success: false, error, parts: 0 };
    }
  }, [generatePDF]);

  const exportTransportManifestPDF = useCallback(async (
    manifest: TransportManifestPDFData,
    fileName?: string
  ) => {
    const { TransportManifestPDFDocument } = await loadPdfTemplates();
    const document = <TransportManifestPDFDocument manifest={manifest} />;
    const name = fileName || `Transport_Manifest_${manifest.routeName.replace(/\s+/g, "_")}.pdf`;
    return generatePDF(document, name);
  }, [generatePDF]);

  const exportSalaryPayslipPDF = useCallback(async (
    data: SalaryPayslipPDFData,
    fileName?: string
  ) => {
    const { SalaryPayslipDocument } = await loadPdfTemplates();
    const document = <SalaryPayslipDocument data={data} />;
    const name = fileName || `Payslip_${data.staffId}_${data.month}_${data.year}.pdf`;
    return generatePDF(document, name);
  }, [generatePDF]);

  const exportBatchPayslipsPDF = useCallback(async (
    payslips: SalaryPayslipPDFData[],
    fileName?: string
  ) => {
    try {
      const { BatchSalaryPayslipPDFDocument } = await loadPdfTemplates();
      const base = fileName || `Batch_Payslips_${Date.now()}.pdf`;
      const parts = chunkRecords(payslips, MAX_BATCH_PDF_RECORDS);
      if (parts.length === 0) parts.push([]);
      let ok = true;
      for (let i = 0; i < parts.length; i++) {
        const r = await generatePDF(<BatchSalaryPayslipPDFDocument payslips={parts[i]} />, partFileName(base, i, parts.length));
        ok = ok && r.success;
      }
      return { success: ok, parts: parts.length };
    } catch (error) {
      console.error("PDF generation error:", error);
      return { success: false, error, parts: 0 };
    }
  }, [generatePDF]);

  const exportLibrarySlipPDF = useCallback(async (
    data: LibraryIssueSlipData,
    fileName?: string
  ) => {
    const { LibraryIssueSlipDocument } = await loadPdfTemplates();
    const document = <LibraryIssueSlipDocument data={data} />;
    const name = fileName || `Library_Slip_${data.slipNumber || Date.now()}.pdf`;
    return generatePDF(document, name);
  }, [generatePDF]);

  const exportHostelManifestPDF = useCallback(async (
    data: HostelManifestPDFData,
    fileName?: string
  ) => {
    const { HostelManifestPDFDocument } = await loadPdfTemplates();
    const document = <HostelManifestPDFDocument data={data} />;
    const name = fileName || `Hostel_Manifest_${data.hostelName.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
    return generatePDF(document, name);
  }, [generatePDF]);

  const exportTransferCertificatePDF = useCallback(async (
    school: SchoolInfo,
    data: TransferCertificateData,
    verificationUrl?: string
  ) => {
    const { TransferCertificateTemplate } = await loadPdfTemplates();
    const document = <TransferCertificateTemplate school={school} data={data} verificationUrl={verificationUrl} />;
    return generatePDF(document, `TC_${data.certificateNumber}.pdf`);
  }, [generatePDF]);

  const exportCharacterCertificatePDF = useCallback(async (
    school: SchoolInfo,
    data: CharacterCertificateData,
    verificationUrl?: string
  ) => {
    const { CharacterCertificateTemplate } = await loadPdfTemplates();
    const document = <CharacterCertificateTemplate school={school} data={data} verificationUrl={verificationUrl} />;
    return generatePDF(document, `CC_${data.certificateNumber}.pdf`);
  }, [generatePDF]);

  const exportBonafideCertificatePDF = useCallback(async (
    school: SchoolInfo,
    data: BonafideCertificateData,
    verificationUrl?: string
  ) => {
    const { BonafideCertificateTemplate } = await loadPdfTemplates();
    const document = <BonafideCertificateTemplate school={school} data={data} verificationUrl={verificationUrl} />;
    return generatePDF(document, `Bonafide_${data.certificateNumber}.pdf`);
  }, [generatePDF]);

  const exportExamAdmitCardPDF = useCallback(async (
    school: SchoolInfo,
    data: ExamAdmitCardData,
    verificationUrl?: string
  ) => {
    const { ExamAdmitCardTemplate } = await loadPdfTemplates();
    const document = <ExamAdmitCardTemplate school={school} data={data} verificationUrl={verificationUrl} />;
    return generatePDF(document, `AdmitCard_${data.rollNumber}_${data.examName.replace(/\s+/g, "_")}.pdf`);
  }, [generatePDF]);

  const exportBatchAdmitCardsPDF = useCallback(async (
    school: SchoolInfo,
    cards: ExamAdmitCardData[],
    verificationBaseUrl?: string
  ) => {
    try {
      const { BatchAdmitCardDocument } = await loadPdfTemplates();
      const base = `Batch_AdmitCards_${Date.now()}.pdf`;
      const parts = chunkRecords(cards, MAX_BATCH_PDF_RECORDS);
      if (parts.length === 0) parts.push([]);
      let ok = true;
      for (let i = 0; i < parts.length; i++) {
        const document = <BatchAdmitCardDocument school={school} cards={parts[i]} verificationBaseUrl={verificationBaseUrl} />;
        const r = await generatePDF(document, partFileName(base, i, parts.length));
        ok = ok && r.success;
      }
      return { success: ok, parts: parts.length };
    } catch (error) {
      console.error("PDF generation error:", error);
      return { success: false, error, parts: 0 };
    }
  }, [generatePDF]);

  const exportTranscriptPDF = useCallback(async (
    school: SchoolInfo,
    data: TranscriptData,
    verificationUrl?: string
  ) => {
    const { TranscriptTemplate } = await loadPdfTemplates();
    const document = <TranscriptTemplate school={school} data={data} verificationUrl={verificationUrl} />;
    return generatePDF(document, `Transcript_${data.admissionNumber}.pdf`);
  }, [generatePDF]);

  const exportStaffIDCardsPDF = useCallback(async (
    school: SchoolInfo,
    staff: StaffIDCardData[],
    academicYear?: string,
    verificationBaseUrl?: string
  ) => {
    try {
      const { StaffIDCardTemplate } = await loadPdfTemplates();
      const base = `Staff_ID_Cards_${Date.now()}.pdf`;
      const parts = chunkRecords(staff, MAX_BATCH_PDF_RECORDS);
      if (parts.length === 0) parts.push([]);
      let ok = true;
      for (let i = 0; i < parts.length; i++) {
        const document = <StaffIDCardTemplate school={school} staff={parts[i]} academicYear={academicYear} verificationBaseUrl={verificationBaseUrl} />;
        const r = await generatePDF(document, partFileName(base, i, parts.length));
        ok = ok && r.success;
      }
      return { success: ok, parts: parts.length };
    } catch (error) {
      console.error("PDF generation error:", error);
      return { success: false, error, parts: 0 };
    }
  }, [generatePDF]);

  const exportLibraryClearancePDF = useCallback(async (
    school: SchoolInfo,
    data: LibraryClearanceData,
    verificationUrl?: string
  ) => {
    const { LibraryClearanceTemplate } = await loadPdfTemplates();
    const document = <LibraryClearanceTemplate school={school} data={data} verificationUrl={verificationUrl} />;
    return generatePDF(document, `Clearance_${data.certificateNumber}.pdf`);
  }, [generatePDF]);

  const exportAdmissionFormPDF = useCallback(async (
    school: SchoolInfo,
    academicYear?: string,
    formNumber?: string
  ) => {
    const { AdmissionFormTemplate } = await loadPdfTemplates();
    const document = <AdmissionFormTemplate school={school} academicYear={academicYear} formNumber={formNumber} />;
    return generatePDF(document, `Admission_Form_${academicYear || "2026"}.pdf`);
  }, [generatePDF]);

  const exportTimetablePDF = useCallback(async (
    school: SchoolInfo,
    data: TimetableReportData,
    generatedAt?: string
  ) => {
    const { TimetableReportTemplate } = await loadPdfTemplates();
    const document = <TimetableReportTemplate school={school} data={data} generatedAt={generatedAt} />;
    return generatePDF(document, `Timetable_${data.className.replace(/\s+/g, "_")}_${Date.now()}.pdf`);
  }, [generatePDF]);

  const exportInventoryStockPDF = useCallback(async (
    school: SchoolInfo,
    items: InventoryStockItem[],
    generatedAt?: string
  ) => {
    const { InventoryStockReportTemplate } = await loadPdfTemplates();
    const document = <InventoryStockReportTemplate school={school} items={items} generatedAt={generatedAt || formatDateWithSettings(new Date())} />;
    return generatePDF(document, `Inventory_Stock_${Date.now()}.pdf`);
  }, [generatePDF]);

  const exportProfitLossPDF = useCallback(async (params: {
    school: SchoolInfo;
    title: string;
    subtitle?: string;
    generatedAt: string;
    dateRangeLabel: string;
    filters: PdfFilterItem[];
    metrics: ProfitLossReportTemplateProps["metrics"];
    columns: ProfitLossReportTemplateProps["columns"];
    rows: ProfitLossReportTemplateProps["rows"];
    notes?: string[];
  }) => {
    const { ProfitLossReportTemplate } = await loadPdfTemplates();
    const document = <ProfitLossReportTemplate {...params} labels={commonLabels} />;
    return generatePDF(document, `Profit_Loss_${Date.now()}.pdf`);
  }, [generatePDF]);

  const exportSalaryReportPDF = useCallback(async (params: {
    school: SchoolInfo;
    title: string;
    subtitle?: string;
    generatedAt: string;
    dateRangeLabel: string;
    filters: PdfFilterItem[];
    metrics: PdfMetricItem[];
    records: Array<Record<string, string | number>>;
    notes?: string[];
  }) => {
    const { SalaryReportTemplate } = await loadPdfTemplates();
    const document = <SalaryReportTemplate {...params} labels={commonLabels} />;
    return generatePDF(document, `Salary_Report_${Date.now()}.pdf`);
  }, [generatePDF]);

  const exportFinancialReportPDF = useCallback(async (params: {
    school: SchoolInfo;
    title: string;
    subtitle?: string;
    generatedAt: string;
    dateRangeLabel: string;
    filters: PdfFilterItem[];
    metrics: PdfMetricItem[];
    records: Array<Record<string, string | number>>;
    notes?: string[];
  }) => {
    const { FinancialReportTemplate } = await loadPdfTemplates();
    const document = <FinancialReportTemplate {...params} labels={commonLabels} />;
    return generatePDF(document, `Financial_Report_${Date.now()}.pdf`);
  }, [generatePDF]);

  const exportAdmissionsReportPDF = useCallback(async (params: {
    school: SchoolInfo;
    title: string;
    subtitle?: string;
    generatedAt: string;
    dateRangeLabel: string;
    filters: PdfFilterItem[];
    metrics: PdfMetricItem[];
    records: Array<Record<string, string | number>>;
    notes?: string[];
  }) => {
    const { AdmissionsReportTemplate } = await loadPdfTemplates();
    const document = <AdmissionsReportTemplate {...params} labels={commonLabels} />;
    return generatePDF(document, `Admissions_Report_${Date.now()}.pdf`);
  }, [generatePDF]);

  const exportStatementPDF = useCallback(async (params: {
    school: SchoolInfo;
    title: string;
    subtitle?: string;
    generatedAt: string;
    dateRangeLabel: string;
    filters: PdfFilterItem[];
    metrics: PdfMetricItem[];
    records: Array<Record<string, string | number>>;
    notes?: string[];
  }) => {
    const { StatementReportTemplate } = await loadPdfTemplates();
    const document = <StatementReportTemplate {...params} labels={commonLabels} />;
    return generatePDF(document, `Statement_${Date.now()}.pdf`);
  }, [generatePDF]);

  const exportFeeDaybookPDF = useCallback(async (params: {
    school: SchoolInfo;
    title: string;
    subtitle?: string;
    generatedAt: string;
    dateRangeLabel: string;
    filters: PdfFilterItem[];
    metrics: PdfMetricItem[];
    records: Array<Record<string, string | number>>;
    notes?: string[];
  }) => {
    const { FeeDaybookTemplate } = await loadPdfTemplates();
    const document = <FeeDaybookTemplate {...params} labels={commonLabels} />;
    return generatePDF(document, `Fee_Daybook_${Date.now()}.pdf`);
  }, [generatePDF]);

  return {
    exportStudentIDCard,
    exportMarkSheet,
    exportReportCard,
    exportBulkIDCards,
    exportStudentReportPDF,
    exportFeeReportPDF,
    exportAttendanceReportPDF,
    exportExamReportPDF,
    exportBatchReportCardsPDF,
    exportFeeVouchersPDF,
    exportTransportManifestPDF,
    exportSalaryPayslipPDF,
    exportBatchPayslipsPDF,
    exportLibrarySlipPDF,
    exportHostelManifestPDF,
    exportTransferCertificatePDF,
    exportCharacterCertificatePDF,
    exportBonafideCertificatePDF,
    exportExamAdmitCardPDF,
    exportBatchAdmitCardsPDF,
    exportTranscriptPDF,
    exportStaffIDCardsPDF,
    exportLibraryClearancePDF,
    exportAdmissionFormPDF,
    exportTimetablePDF,
    exportInventoryStockPDF,
    exportProfitLossPDF,
    exportSalaryReportPDF,
    exportFinancialReportPDF,
    exportAdmissionsReportPDF,
    exportStatementPDF,
    exportFeeDaybookPDF,
  };
}

export function usePDFPreview() {
  const locale = useLocale();
  const messages = useMessages();
  const getPreviewURL = useCallback(async (document: React.ReactElement) => {
    try {
      const { pdf } = await loadPdfRenderer();
      const blob = await pdf(
        <NextIntlClientProvider locale={locale} messages={messages}>
          {document}
        </NextIntlClientProvider>
      ).toBlob();
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error("PDF preview error:", error);
      return null;
    }
  }, [locale, messages]);

  return { getPreviewURL };
}

