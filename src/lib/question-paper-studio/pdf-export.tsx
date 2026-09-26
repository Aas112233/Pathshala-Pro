import { createElement } from "react";
import type { ExamPaperStudioModel as ExamPaper } from "@/types/exam-studio";
import { adaptPaperForPdf } from "./exam-paper-adapter";
import { downloadBlob } from "@/lib/download-blob";

// ponytail: @react-pdf/renderer stays out of the page bundle until first export
let rendererPromise: Promise<typeof import("@react-pdf/renderer")> | null = null;
const loadPdfRenderer = () => (rendererPromise ??= import("@react-pdf/renderer"));

/**
 * Exam paper PDF exporter using @react-pdf/renderer.
 * Replaces html2canvas + jsPDF with react-pdf for accurate layout preservation.
 *
 * @param elementId - Retained for API compatibility with existing callers.
 * @param options.fileName - Download file name.
 * @param options.paper - Exam paper data rendered by ExamPaperPDF.
 * @param options.layoutOverrides - Screen-side layout toggles (two-column,
 *   compact, watermark) merged over the paper's saved layout so the PDF
 *   matches what the user currently sees in the preview.
 */
export async function exportElementToHighResPDF(
  elementId: string,
  options: { fileName: string; paper: ExamPaper; layoutOverrides?: Partial<ExamPaper["layout"]> }
): Promise<{ success: boolean; error?: string }> {
  const { fileName, paper, layoutOverrides } = options;

  try {
    // Single choke point: normalize raw API/DB payloads (or partial objects) into a
    // complete Studio Model so the template never reads undefined (e.g. layout.isRTL).
    const studioPaper = adaptPaperForPdf(
      layoutOverrides && paper && typeof paper === "object"
        ? { ...paper, layout: { ...(paper as any).layout, ...layoutOverrides } }
        : paper
    );
    const [{ pdf }, { ExamPaperPDF }] = await Promise.all([
      loadPdfRenderer(),
      import("./exam-paper-pdf-template"),
    ]);
    const blob = await pdf(createElement(ExamPaperPDF, { paper: studioPaper }) as any).toBlob();
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