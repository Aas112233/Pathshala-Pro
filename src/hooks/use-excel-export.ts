"use client";

import { useCallback } from "react";
import { saveAs } from "file-saver";
import { exportToExcel, ReportTemplates, type ExcelExportOptions, type ExcelColumn } from "@/lib/excel-exporter";

interface UseExcelExportOptions {
  fileName?: string;
  schoolName?: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
}

interface ExportParams {
  title: string;
  subtitle?: string;
  columns: ExcelColumn[];
  data: any[];
  dateRange?: { from: string; to: string };
  footerNotes?: string[];
}

export function useExcelExport(options: UseExcelExportOptions = {}) {
  const {
    fileName = "report",
    schoolName = "Pathshala Pro School",
    schoolAddress,
    schoolPhone,
    schoolEmail,
  } = options;

  const exportData = useCallback(async (params: ExportParams) => {
    try {
      const exportOptions: ExcelExportOptions = {
        title: params.title,
        subtitle: params.subtitle,
        schoolName,
        schoolAddress,
        schoolPhone,
        schoolEmail,
        reportDate: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        dateRange: params.dateRange,
        columns: params.columns,
        data: params.data,
        footerNotes: params.footerNotes,
        showLogo: true,
      };

      const buffer = await exportToExcel(exportOptions);
      const blob = new Blob([new Uint8Array(buffer)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
      saveAs(blob, `${fileName}_${timestamp}.xlsx`);
      
      return { success: true };
    } catch (error) {
      console.error("Excel export error:", error);
      return { success: false, error };
    }
  }, [fileName, schoolName, schoolAddress, schoolPhone, schoolEmail]);

  const exportFeeReport = useCallback(async (
    data: any[],
    dateRange?: { from: string; to: string }
  ) => {
    const template = ReportTemplates.feeReport(data, {
      schoolName,
      schoolAddress,
      schoolPhone,
      schoolEmail,
      dateRange,
      subtitle: "Comprehensive fee collection and outstanding analysis",
    });
    
    return exportData({
      title: template.title,
      subtitle: template.subtitle,
      columns: template.columns,
      data: template.data,
      dateRange,
      footerNotes: template.footerNotes,
    });
  }, [exportData, schoolName, schoolAddress, schoolPhone, schoolEmail]);

  const exportAttendanceReport = useCallback(async (
    data: any[],
    dateRange?: { from: string; to: string }
  ) => {
    const template = ReportTemplates.attendanceReport(data, {
      schoolName,
      schoolAddress,
      schoolPhone,
      schoolEmail,
      dateRange,
      subtitle: "Student attendance patterns and defaulter analysis",
    });
    
    return exportData({
      title: template.title,
      subtitle: template.subtitle,
      columns: template.columns,
      data: template.data,
      dateRange,
      footerNotes: template.footerNotes,
    });
  }, [exportData, schoolName, schoolAddress, schoolPhone, schoolEmail]);

  const exportStudentReport = useCallback(async (
    data: any[],
    dateRange?: { from: string; to: string }
  ) => {
    const template = ReportTemplates.studentReport(data, {
      schoolName,
      schoolAddress,
      schoolPhone,
      schoolEmail,
      dateRange,
      subtitle: "Student enrollment and demographic overview",
    });
    
    return exportData({
      title: template.title,
      subtitle: template.subtitle,
      columns: template.columns,
      data: template.data,
      dateRange,
      footerNotes: template.footerNotes,
    });
  }, [exportData, schoolName, schoolAddress, schoolPhone, schoolEmail]);

  const exportExamReport = useCallback(async (
    data: any[],
    dateRange?: { from: string; to: string }
  ) => {
    const template = ReportTemplates.examReport(data, {
      schoolName,
      schoolAddress,
      schoolPhone,
      schoolEmail,
      dateRange,
      subtitle: "Exam results and student performance analysis",
    });
    
    return exportData({
      title: template.title,
      subtitle: template.subtitle,
      columns: template.columns,
      data: template.data,
      dateRange,
      footerNotes: template.footerNotes,
    });
  }, [exportData, schoolName, schoolAddress, schoolPhone, schoolEmail]);

  return {
    exportData,
    exportFeeReport,
    exportAttendanceReport,
    exportStudentReport,
    exportExamReport,
  };
}
