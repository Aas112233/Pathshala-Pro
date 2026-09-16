import { createElement } from "react";
import { pdf } from "@react-pdf/renderer";
import type { ExamPaperStudioModel as ExamPaper } from "@/types/exam-studio";
import { ExamPaperPDF } from "./exam-paper-pdf-template";
import { downloadBlob } from "@/lib/download-blob";

/**
 * Exam paper PDF exporter using @react-pdf/renderer.
 * Replaces html2canvas + jsPDF with react-pdf for accurate layout preservation.
 *
 * @param elementId - Retained for API compatibility with existing callers.
 * @param options.fileName - Download file name.
 * @param options.paper - Exam paper data rendered by ExamPaperPDF.
 */
export async function exportElementToHighResPDF(
  elementId: string,
  options: { fileName: string; paper: ExamPaper }
): Promise<{ success: boolean; error?: string }> {
  const { fileName, paper } = options;

  try {
    const blob = await pdf(createElement(ExamPaperPDF, { paper }) as any).toBlob();
    downloadBlob(blob, fileName);
    return { success: true };
  } catch (err: any) {
    console.error("PDF Export Error:", err);
    return { success: false, error: err?.message || "Failed to generate PDF" };
  }
}

/**
 * Print Window Trigger — falls back to the browser print dialog.
 */
export function triggerPrintWindow(elementId: string = "exam-paper-canvas-root"): void {
  try {
    window.print();
  } catch (e) {
    console.warn("Print failed, falling back", e);
    window.print();
  }
}