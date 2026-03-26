"use client";

import { useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import {
  StudentIDCardTemplate,
  MarkSheetTemplate,
  ReportCardTemplate,
} from "@/lib/pdf-templates";

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
  gender?: string;
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

export function usePDFExport() {
  const generatePDF = useCallback(async (document: React.ReactElement, fileName: string) => {
    try {
      const blob = await pdf(document).toBlob();
      saveAs(blob, fileName);
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

  return {
    exportStudentIDCard,
    exportMarkSheet,
    exportReportCard,
    exportBulkIDCards,
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
