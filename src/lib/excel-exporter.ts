import ExcelJS, { Workbook, Worksheet, Cell } from "exceljs";
import type { Buffer } from "buffer";

export interface ExcelExportOptions {
  title: string;
  subtitle?: string;
  schoolName: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  reportDate?: string;
  dateRange?: { from: string; to: string };
  columns: ExcelColumn[];
  data: any[];
  footerNotes?: string[];
  showLogo?: boolean;
  logoUrl?: string;
}

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  alignment?: "left" | "center" | "right";
  style?: "text" | "number" | "currency" | "date" | "percentage";
}

// Premium color palette
const COLORS = {
  primary: "1E40AF", // Deep blue
  primaryLight: "DBEAFE", // Light blue
  secondary: "64748B", // Slate gray
  accent: "059669", // Emerald green
  background: "F8FAFC", // Light gray background
  border: "E2E8F0", // Border color
  text: "1E293B", // Dark text
  textLight: "64748B", // Light text
  white: "FFFFFF",
  success: "10B981",
  warning: "F59E0B",
  error: "EF4444",
};

const FONTS = {
  header: "Segoe UI Semibold",
  subheader: "Segoe UI Semibold",
  body: "Segoe UI",
  title: "Segoe UI Semibold",
};

export class ExcelExporter {
  private workbook: Workbook;
  private worksheet: Worksheet;

  constructor() {
    this.workbook = new ExcelJS.Workbook();
    this.workbook.creator = "Pathshala Pro";
    this.workbook.lastModifiedBy = "Pathshala Pro Report System";
    this.workbook.created = new Date();
    this.workbook.modified = new Date();
    
    this.worksheet = this.workbook.addWorksheet("Report");
  }

  async generate(options: ExcelExportOptions): Promise<Uint8Array> {
    this.setupWorksheet(options);
    this.addHeader(options);
    this.addTableHeader(options.columns);
    this.addTableData(options.columns, options.data);
    this.addFooter(options);
    this.applyStyles(options.columns);

    const buffer = await this.workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer as ArrayBuffer);
  }

  private setupWorksheet(options: ExcelExportOptions) {
    // Set page setup for print
    this.worksheet.pageSetup = {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.5,
        right: 0.5,
        top: 1.0,
        bottom: 1.0,
        header: 0.5,
        footer: 0.5,
      },
    };

    // Header and footer setup using ExcelJS string format
    // &L = left, &C = center, &R = right, &P = current page, &N = total pages
    this.worksheet.headerFooter = {
      oddHeader: `&L&10&"Segoe UI"&K${COLORS.secondary}${options.schoolName}&C&14&"Segoe UI Semibold"&K${COLORS.primary}${options.title}&R&P of &N`,
      oddFooter: `&L&9&"Segoe UI"&K${COLORS.textLight}Generated: ${new Date().toLocaleString()}&CConfidential&R${options.reportDate || ""}`,
    };
  }

  private addHeader(options: ExcelExportOptions) {
    // Row 1: Logo and School Name
    const logoRow = this.worksheet.getRow(1);
    logoRow.height = 60;

    if (options.showLogo && options.logoUrl) {
      // Logo placeholder (can be enhanced to add actual image)
      const logoCell = logoRow.getCell(1);
      logoCell.value = "🏫";
      logoCell.font = { size: 36 };
      logoCell.alignment = { vertical: "middle", horizontal: "center" };
    }

    // School Name
    const schoolNameCell = logoRow.getCell(options.showLogo ? 2 : 1);
    schoolNameCell.value = options.schoolName.toUpperCase();
    schoolNameCell.font = {
      name: FONTS.title,
      size: 20,
      bold: true,
      color: { argb: `FF${COLORS.primary}` },
    };
    schoolNameCell.alignment = { vertical: "middle", horizontal: "center" };
    
    // Merge cells for school name
    const totalColumns = options.columns.length;
    this.worksheet.mergeCells(1, options.showLogo ? 2 : 1, 1, totalColumns);

    // Row 2: School Address
    const addressRow = this.worksheet.getRow(2);
    addressRow.height = 25;
    const addressCell = addressRow.getCell(1);
    addressCell.value = options.schoolAddress || "";
    addressCell.font = {
      name: FONTS.body,
      size: 10,
      color: { argb: `FF${COLORS.textLight}` },
    };
    addressCell.alignment = { vertical: "middle", horizontal: "center" };
    this.worksheet.mergeCells(2, 1, 2, totalColumns);

    // Row 3: Contact Info
    const contactRow = this.worksheet.getRow(3);
    contactRow.height = 20;
    const contactParts = [];
    if (options.schoolPhone) contactParts.push(`📞 ${options.schoolPhone}`);
    if (options.schoolEmail) contactParts.push(`✉️ ${options.schoolEmail}`);
    
    const contactCell = contactRow.getCell(1);
    contactCell.value = contactParts.join("  |  ");
    contactCell.font = {
      name: FONTS.body,
      size: 9,
      color: { argb: `FF${COLORS.secondary}` },
    };
    contactCell.alignment = { vertical: "middle", horizontal: "center" };
    this.worksheet.mergeCells(3, 1, 3, totalColumns);

    // Row 4: Spacer
    this.worksheet.getRow(4).height = 10;

    // Row 5: Report Title
    const titleRow = this.worksheet.getRow(5);
    titleRow.height = 35;
    const titleCell = titleRow.getCell(1);
    titleCell.value = options.title.toUpperCase();
    titleCell.font = {
      name: FONTS.header,
      size: 16,
      bold: true,
      color: { argb: `FF${COLORS.text}` },
    };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    this.worksheet.mergeCells(5, 1, 5, totalColumns);
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${COLORS.primaryLight}` },
    };
    titleCell.border = {
      top: { style: "thick", color: { argb: `FF${COLORS.primary}` } },
      bottom: { style: "thick", color: { argb: `FF${COLORS.primary}` } },
    };

    // Row 6: Subtitle and Date Range
    if (options.subtitle || options.dateRange) {
      const subtitleRow = this.worksheet.getRow(6);
      subtitleRow.height = 25;
      const subtitleParts = [];
      if (options.subtitle) subtitleParts.push(options.subtitle);
      if (options.dateRange) {
        subtitleParts.push(`Period: ${options.dateRange.from} to ${options.dateRange.to}`);
      }
      
      const subtitleCell = subtitleRow.getCell(1);
      subtitleCell.value = subtitleParts.join(" • ");
      subtitleCell.font = {
        name: FONTS.subheader,
        size: 11,
        italic: true,
        color: { argb: `FF${COLORS.secondary}` },
      };
      subtitleCell.alignment = { vertical: "middle", horizontal: "center" };
      this.worksheet.mergeCells(6, 1, 6, totalColumns);
    }

    // Row 7: Spacer before table
    this.worksheet.getRow(7).height = 15;
  }

  private addTableHeader(columns: ExcelColumn[]) {
    const headerRowIndex = 8;
    const headerRow = this.worksheet.getRow(headerRowIndex);
    headerRow.height = 30;

    columns.forEach((col, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = col.header.toUpperCase();
      cell.font = {
        name: FONTS.header,
        size: 10,
        bold: true,
        color: { argb: `FF${COLORS.white}` },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: `FF${COLORS.primary}` },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: col.alignment || "left",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin", color: { argb: `FF${COLORS.border}` } },
        bottom: { style: "thin", color: { argb: `FF${COLORS.border}` } },
        left: { style: "thin", color: { argb: `FF${COLORS.border}` } },
        right: { style: "thin", color: { argb: `FF${COLORS.border}` } },
      };
    });
  }

  private addTableData(columns: ExcelColumn[], data: any[]) {
    const startRowIndex = 9;

    data.forEach((row, rowIndex) => {
      const currentRowIndex = startRowIndex + rowIndex;
      const currentRow = this.worksheet.getRow(currentRowIndex);
      currentRow.height = 25;

      // Alternating row colors
      const isEven = rowIndex % 2 === 0;
      const fillColor = isEven ? `FF${COLORS.background}` : `FFFFFFFF`;

      columns.forEach((col, colIndex) => {
        const cell = currentRow.getCell(colIndex + 1);
        const value = row[col.key];
        
        // Format value based on style
        cell.value = this.formatValue(value, col.style);
        
        cell.font = {
          name: FONTS.body,
          size: 10,
          color: { argb: `FF${COLORS.text}` },
        };
        
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: fillColor },
        };
        
        cell.alignment = {
          vertical: "middle",
          horizontal: col.alignment || "left",
          wrapText: false,
        };
        
        cell.border = {
          top: { style: "thin", color: { argb: `FF${COLORS.border}` } },
          bottom: { style: "thin", color: { argb: `FF${COLORS.border}` } },
          left: { style: "thin", color: { argb: `FF${COLORS.border}` } },
          right: { style: "thin", color: { argb: `FF${COLORS.border}` } },
        };

        // Apply number formatting
        if (col.style === "number") {
          cell.numFmt = "#,##0";
        } else if (col.style === "currency") {
          cell.numFmt = "₹#,##0.00";
        } else if (col.style === "percentage") {
          cell.numFmt = "0.00%";
        } else if (col.style === "date") {
          cell.numFmt = "dd-mmm-yyyy";
        }
      });
    });
  }

  private addFooter(options: ExcelExportOptions) {
    const lastDataRow = this.worksheet.lastRow?.number || 8;
    const totalColumns = options.columns.length;
    
    // Summary row (if data exists)
    if (options.data.length > 0) {
      const summaryRowIndex = lastDataRow + 1;
      const summaryRow = this.worksheet.getRow(summaryRowIndex);
      summaryRow.height = 25;
      
      const totalCell = summaryRow.getCell(1);
      totalCell.value = `Total Records: ${options.data.length}`;
      totalCell.font = {
        name: FONTS.subheader,
        size: 10,
        bold: true,
        color: { argb: `FF${COLORS.primary}` },
      };
      this.worksheet.mergeCells(summaryRowIndex, 1, summaryRowIndex, totalColumns);
    }

    // Footer notes
    if (options.footerNotes && options.footerNotes.length > 0) {
      const notesStartRow = lastDataRow + 2;
      
      options.footerNotes.forEach((note, index) => {
        const noteRow = this.worksheet.getRow(notesStartRow + index);
        noteRow.height = 18;
        
        const noteCell = noteRow.getCell(1);
        noteCell.value = `• ${note}`;
        noteCell.font = {
          name: FONTS.body,
          size: 9,
          italic: true,
          color: { argb: `FF${COLORS.textLight}` },
        };
        this.worksheet.mergeCells(notesStartRow + index, 1, notesStartRow + index, totalColumns);
      });
    }

    // Signature row
    const signatureRow = this.worksheet.getRow(lastDataRow + (options.footerNotes?.length || 0) + 3);
    signatureRow.height = 50;
    
    // Left signature
    const leftSigCell = signatureRow.getCell(1);
    leftSigCell.value = "\n\n_____________________\nAuthorized Signature";
    leftSigCell.font = {
      name: FONTS.body,
      size: 9,
      color: { argb: `FF${COLORS.text}` },
    };
    leftSigCell.alignment = { vertical: "top", horizontal: "left" };
    
    // Right signature
    const rightSigCell = signatureRow.getCell(totalColumns);
    rightSigCell.value = "\n\n_____________________\nOfficial Seal";
    rightSigCell.font = {
      name: FONTS.body,
      size: 9,
      color: { argb: `FF${COLORS.text}` },
    };
    rightSigCell.alignment = { vertical: "top", horizontal: "right" };
  }

  private applyStyles(columns: ExcelColumn[]) {
    // Set column widths
    columns.forEach((col, index) => {
      const column = this.worksheet.getColumn(index + 1);
      column.width = col.width || 20;
    });

    // Auto-filter on header
    this.worksheet.autoFilter = {
      from: { row: 8, column: 1 },
      to: { row: 8, column: columns.length },
    };
  }

  private formatValue(value: any, style?: ExcelColumn["style"]): any {
    if (value === null || value === undefined) return "";
    
    switch (style) {
      case "currency":
        return typeof value === "number" ? value : parseFloat(value) || 0;
      case "percentage":
        return typeof value === "number" ? value / 100 : parseFloat(value) / 100 || 0;
      case "number":
        return typeof value === "number" ? value : parseFloat(value) || 0;
      case "date":
        return value instanceof Date ? value : new Date(value);
      default:
        return String(value);
    }
  }
}

// Convenience function for quick exports
export async function exportToExcel(options: ExcelExportOptions): Promise<Uint8Array> {
  const exporter = new ExcelExporter();
  return exporter.generate(options);
}

// Pre-built report templates
export const ReportTemplates = {
  feeReport: (data: any[], options: Partial<ExcelExportOptions>): ExcelExportOptions => ({
    title: "Fee Collection Report",
    schoolName: options.schoolName || "Pathshala Pro School",
    columns: [
      { header: "Voucher No.", key: "voucherNumber", width: 15, style: "text" },
      { header: "Student Name", key: "studentName", width: 25, style: "text" },
      { header: "Class", key: "className", width: 12, style: "text" },
      { header: "Section", key: "section", width: 10, style: "text" },
      { header: "Total Amount", key: "amount", width: 15, style: "currency" },
      { header: "Paid Amount", key: "paidAmount", width: 15, style: "currency" },
      { header: "Due Amount", key: "dueAmount", width: 15, style: "currency" },
      { header: "Status", key: "status", width: 12, style: "text" },
      { header: "Payment Method", key: "paymentMethod", width: 15, style: "text" },
      { header: "Date", key: "date", width: 12, style: "date" },
    ],
    data,
    footerNotes: [
      "All amounts are in local currency (INR)",
      "Status: PAID - Fully paid, PENDING - Not paid, PARTIAL - Partially paid, OVERDUE - Past due date",
      "For queries, please contact the accounts department",
    ],
    ...options,
  }),

  attendanceReport: (data: any[], options: Partial<ExcelExportOptions>): ExcelExportOptions => ({
    title: "Attendance Analysis Report",
    schoolName: options.schoolName || "Pathshala Pro School",
    columns: [
      { header: "Roll No.", key: "rollNumber", width: 12, style: "text" },
      { header: "Student Name", key: "studentName", width: 25, style: "text" },
      { header: "Class", key: "className", width: 12, style: "text" },
      { header: "Section", key: "section", width: 10, style: "text" },
      { header: "Present Days", key: "presentDays", width: 14, style: "number" },
      { header: "Absent Days", key: "absentDays", width: 14, style: "number" },
      { header: "Total Days", key: "totalDays", width: 12, style: "number" },
      { header: "Attendance %", key: "attendancePercentage", width: 14, style: "percentage" },
      { header: "Status", key: "status", width: 12, style: "text" },
    ],
    data,
    footerNotes: [
      "Attendance % = (Present Days / Total Days) × 100",
      "Status: GOOD - 85%+, AVERAGE - 75-84%, DEFICIT - Below 75%",
      "Students with deficit attendance may face disciplinary action",
    ],
    ...options,
  }),

  studentReport: (data: any[], options: Partial<ExcelExportOptions>): ExcelExportOptions => ({
    title: "Student Enrollment Report",
    schoolName: options.schoolName || "Pathshala Pro School",
    columns: [
      { header: "Admission No.", key: "admissionNumber", width: 16, style: "text" },
      { header: "Student Name", key: "studentName", width: 25, style: "text" },
      { header: "Class", key: "className", width: 12, style: "text" },
      { header: "Section", key: "section", width: 10, style: "text" },
      { header: "Roll No.", key: "rollNumber", width: 10, style: "text" },
      { header: "Gender", key: "gender", width: 10, style: "text" },
      { header: "Status", key: "status", width: 12, style: "text" },
      { header: "Admission Date", key: "admissionDate", width: 14, style: "date" },
      { header: "Guardian Name", key: "guardianName", width: 20, style: "text" },
      { header: "Contact", key: "contactNumber", width: 15, style: "text" },
    ],
    data,
    footerNotes: [
      "Status: ACTIVE - Currently enrolled, INACTIVE - Temporarily inactive",
      "GRADUATED - Completed studies, TRANSFERRED - Moved to another institution",
      "This report contains confidential student information",
    ],
    ...options,
  }),

  examReport: (data: any[], options: Partial<ExcelExportOptions>): ExcelExportOptions => ({
    title: "Exam Performance Report",
    schoolName: options.schoolName || "Pathshala Pro School",
    columns: [
      { header: "Roll No.", key: "rollNumber", width: 12, style: "text" },
      { header: "Student Name", key: "studentName", width: 25, style: "text" },
      { header: "Class", key: "className", width: 12, style: "text" },
      { header: "Section", key: "section", width: 10, style: "text" },
      { header: "Exam", key: "examName", width: 20, style: "text" },
      { header: "Subject", key: "subject", width: 15, style: "text" },
      { header: "Marks", key: "marksObtained", width: 12, style: "text" },
      { header: "%", key: "percentage", width: 10, style: "percentage" },
      { header: "Grade", key: "grade", width: 8, style: "text" },
      { header: "Status", key: "status", width: 10, style: "text" },
    ],
    data,
    footerNotes: [
      "Grade Scale: A+ (90%+), A (80-89%), B (70-79%), C (60-69%), D (40-59%), F (Below 40%)",
      "Status: PASS - 40% or above, FAIL - Below 40%",
      "For grade improvement queries, contact the examination department",
    ],
    ...options,
  }),
};
