"use client";

import { useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import { downloadBlob } from "@/lib/download-blob";
import {
  StudentIDCardTemplate,
  MarkSheetTemplate,
  ReportCardTemplate,
  BatchReportCardDocument,
  FeeVoucherPDFDocument,
  TransportManifestPDFDocument,
  SalaryPayslipDocument,
  BatchSalaryPayslipPDFDocument,
  LibraryIssueSlipDocument,
  HostelManifestPDFDocument,
  StudentReportTemplate,
  FeeReportTemplate,
  AttendanceReportTemplate,
  ExamReportTemplate,
  type PdfFilterItem,
  type BatchStudentResult,
  type FeeVoucherPDFData,
  type TransportManifestPDFData,
  type ManifestStudent,
  type SalaryPayslipPDFData,
  type LibraryIssueSlipData,
  type HostelManifestPDFData,
  type HostelResident,
} from "@/lib/pdf-templates";

export type {
  FeeVoucherPDFData,
  TransportManifestPDFData,
  ManifestStudent,
  SalaryPayslipPDFData,
  LibraryIssueSlipData,
  HostelManifestPDFData,
  HostelResident,
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
  const generatePDF = useCallback(async (document: React.ReactElement, fileName: string) => {
    try {
      const blob = await pdf(document).toBlob();
      downloadBlob(blob, fileName);
      return { success: true };
    } catch (error) {
      console.error("PDF generation error:", error);
      return { success: false, error };
    }
  }, []);

  const exportStudentIDCard = useCallback(async (
    student: StudentInfo,
    school: SchoolInfo,
    academicYear: string
  ) => {
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
    const document = <StudentReportTemplate {...params} />;
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
    const document = <FeeReportTemplate {...params} />;
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
    const document = <AttendanceReportTemplate {...params} />;
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
    const document = <ExamReportTemplate {...params} />;
    return generatePDF(document, "Exam_Report.pdf");
  }, [generatePDF]);

  const exportBatchReportCardsPDF = useCallback(async (params: {
    school: SchoolInfo;
    students: BatchStudentResult[];
    fileName?: string;
  }) => {
    const document = <BatchReportCardDocument school={params.school} students={params.students} />;
    const fileName = params.fileName || `Class_Report_Cards_${Date.now()}.pdf`;
    return generatePDF(document, fileName);
  }, [generatePDF]);

  const exportFeeVouchersPDF = useCallback(async (
    vouchers: FeeVoucherPDFData[],
    fileName?: string
  ) => {
    const document = <FeeVoucherPDFDocument vouchers={vouchers} />;
    const name = fileName || `Fee_Vouchers_${Date.now()}.pdf`;
    return generatePDF(document, name);
  }, [generatePDF]);

  const exportTransportManifestPDF = useCallback(async (
    manifest: TransportManifestPDFData,
    fileName?: string
  ) => {
    const document = <TransportManifestPDFDocument manifest={manifest} />;
    const name = fileName || `Transport_Manifest_${manifest.routeName.replace(/\s+/g, "_")}.pdf`;
    return generatePDF(document, name);
  }, [generatePDF]);

  const exportSalaryPayslipPDF = useCallback(async (
    data: SalaryPayslipPDFData,
    fileName?: string
  ) => {
    const document = <SalaryPayslipDocument data={data} />;
    const name = fileName || `Payslip_${data.staffId}_${data.month}_${data.year}.pdf`;
    return generatePDF(document, name);
  }, [generatePDF]);

  const exportBatchPayslipsPDF = useCallback(async (
    payslips: SalaryPayslipPDFData[],
    fileName?: string
  ) => {
    const document = <BatchSalaryPayslipPDFDocument payslips={payslips} />;
    const name = fileName || `Batch_Payslips_${Date.now()}.pdf`;
    return generatePDF(document, name);
  }, [generatePDF]);

  const exportLibrarySlipPDF = useCallback(async (
    data: LibraryIssueSlipData,
    fileName?: string
  ) => {
    const document = <LibraryIssueSlipDocument data={data} />;
    const name = fileName || `Library_Slip_${data.slipNumber || Date.now()}.pdf`;
    return generatePDF(document, name);
  }, [generatePDF]);

  const exportHostelManifestPDF = useCallback(async (
    data: HostelManifestPDFData,
    fileName?: string
  ) => {
    const document = <HostelManifestPDFDocument data={data} />;
    const name = fileName || `Hostel_Manifest_${data.hostelName.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
    return generatePDF(document, name);
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
  };
}

export function usePDFPreview() {
  const getPreviewURL = useCallback(async (document: React.ReactElement) => {
    try {
      const blob = await pdf(document).toBlob();
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error("PDF preview error:", error);
      return null;
    }
  }, []);

  return { getPreviewURL };
}

