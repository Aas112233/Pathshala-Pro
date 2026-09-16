import React from "react";
import { pdf } from "@react-pdf/renderer";
import { StudentPerformanceOverview } from "@/lib/student-performance";
import { StudentPerformancePDF } from "./performance-pdf-template";
import { downloadBlob } from "@/lib/download-blob";

/**
 * Student Performance PDF Exporter using @react-pdf/renderer.
 * Generates comprehensive performance analytics reports.
 *
 * @param performance - Student performance data
 * @param fileName - Download file name
 */
export async function exportStudentPerformancePDF(
  performance: StudentPerformanceOverview,
  fileName: string = "Student-Performance-Report.pdf"
): Promise<{ success: boolean; error?: string }> {
  const studentName = `${performance.student.firstName} ${performance.student.lastName}`.trim() || "Student";
  const studentRollNumber = performance.student.rollNumber || "N/A";

  try {
    const element = React.createElement(StudentPerformancePDF, {
      performance,
      studentName,
      studentRollNumber,
    });
    const blob = await pdf(element as any).toBlob();

    if (!blob) {
      throw new Error("PDF generation returned empty blob");
    }

    downloadBlob(blob, fileName);
    return { success: true };
  } catch (err: any) {
    console.error("Performance PDF Export Error:", err);
    return { success: false, error: err?.message || "Failed to generate performance report" };
  }
}

/**
 * Print Window Trigger for performance reports
 */
export function triggerPerformancePrintWindow(): void {
  try {
    window.print();
  } catch (e) {
    console.warn("Print failed, falling back", e);
    window.print();
  }
}