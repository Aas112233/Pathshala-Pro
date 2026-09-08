import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFExportOptions {
  fileName?: string;
  format?: 'a4' | 'legal' | 'letter';
  orientation?: 'portrait' | 'landscape';
  scale?: number;
}

/**
 * 300 DPI High-Resolution PDF Exporter using html2canvas & jsPDF
 */
export async function exportElementToHighResPDF(
  elementId: string,
  options: PDFExportOptions = {}
): Promise<{ success: boolean; error?: string }> {
  const {
    fileName = 'Bangladesh-Exam-Paper.pdf',
    format = 'a4',
    orientation = 'portrait',
    scale = 2.5, // 2.5x high DPI resolution for crisp Bengali ligatures
  } = options;

  const targetElement = document.getElementById(elementId);
  if (!targetElement) {
    return { success: false, error: `Element #${elementId} not found` };
  }

  try {
    const originalShadow = targetElement.style.boxShadow;
    const originalTransform = targetElement.style.transform;
    targetElement.style.boxShadow = 'none';

    const canvas = await html2canvas(targetElement, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: targetElement.scrollWidth,
      windowHeight: targetElement.scrollHeight,
    });

    targetElement.style.boxShadow = originalShadow;
    targetElement.style.transform = originalTransform;

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: format,
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    // Add first page
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    // Multi-page handling with page breaks
    while (heightLeft > 5) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    pdf.save(fileName);
    return { success: true };
  } catch (err: any) {
    console.error('PDF Export Error:', err);
    return { success: false, error: err.message || 'Failed to generate PDF' };
  }
}

/**
 * Isolated Clean Printing Engine for Examination Papers
 * Clones target paper container into a sandbox iframe with all Google Bengali fonts loaded,
 * bypassing app dashboard UI and browser zoom scaling for crisp 1:1 hardware prints.
 */
export function triggerPrintWindow(elementId: string = 'exam-paper-canvas-root'): void {
  const targetElement = document.getElementById(elementId);

  if (!targetElement) {
    window.print();
    return;
  }

  // Create isolated hidden iframe for clean printing
  let printFrame = document.getElementById('exam-studio-print-frame') as HTMLIFrameElement | null;
  if (printFrame) {
    document.body.removeChild(printFrame);
  }

  printFrame = document.createElement('iframe');
  printFrame.id = 'exam-studio-print-frame';
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  printFrame.style.visibility = 'hidden';
  document.body.appendChild(printFrame);

  const frameDoc = printFrame.contentDocument || printFrame.contentWindow?.document;
  if (!frameDoc) {
    window.print();
    return;
  }

  // Gather all style and link tags from main document
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((el) => el.outerHTML)
    .join('\n');

  // Build isolated print document
  frameDoc.open();
  frameDoc.write(`
    <!DOCTYPE html>
    <html lang="bn">
    <head>
      <meta charset="utf-8" />
      <title>Exam Paper Print</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Anek+Bangla:wght@400;600;700&family=Hind+Siliguri:wght@400;600;700&family=Noto+Serif+Bengali:wght@400;600;700;800&family=Tiro+Bangla:ital@0;1&family=Amiri:wght@400;700&display=swap" rel="stylesheet">
      ${styles}
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm 12mm;
        }
        *, *::before, *::after {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          background: #ffffff !important;
          color: #000000 !important;
          margin: 0 !important;
          padding: 0 !important;
          font-family: 'Hind Siliguri', 'Noto Serif Bengali', serif;
        }
        .no-print {
          display: none !important;
        }
        #exam-paper-canvas-root,
        #question-paper-print-sheet {
          box-shadow: none !important;
          transform: none !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
        }
        .group:hover .no-print {
          display: none !important;
        }
        [id^="question-card-"],
        .question-item-card {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
      </style>
    </head>
    <body>
      ${targetElement.outerHTML}
    </body>
    </html>
  `);
  frameDoc.close();

  // Wait for fonts and images to load inside the iframe before opening print dialogue
  setTimeout(() => {
    try {
      printFrame?.contentWindow?.focus();
      printFrame?.contentWindow?.print();
    } catch (e) {
      console.warn('Iframe print failed, falling back to window.print()', e);
      window.print();
    }
  }, 400);
}
