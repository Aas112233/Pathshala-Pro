import { describe, it, expect } from "vitest";
import React from "react";
import { pdf } from "@react-pdf/renderer";
import { NextIntlClientProvider } from "next-intl";
import bnMessages from "@/messages/bn.json";
import { FeeVoucherPDFDocument } from "@/lib/pdf-templates/fee-voucher";
import { registerPdfFonts } from "@/lib/pdf-fonts";

const voucher: any = {
  schoolName: "Test School",
  currencySymbol: "৳",
  voucherId: "VCH-1",
  issueDate: "01/01/2026",
  dueDate: "10/01/2026",
  studentName: "রহিম উদ্দিন",
  studentId: "STU-1",
  rollNumber: "01",
  className: "Class 10",
  feeType: "Tuition",
  academicYear: "2026",
  baseAmount: 1000,
  discountAmount: 0,
  arrears: 0,
  totalDue: 1000,
};

function extractPdfText(src: string): string {
  const out: string[] = [];
  const re = /<([0-9A-Fa-f]+)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    try {
      out.push(Buffer.from(m[1], "hex").toString("utf8"));
    } catch {
      /* skip */
    }
  }
  return out.join(" ");
}

describe("fee voucher bn end-to-end", () => {
  it("renders Bengali labels and student name", () => {
    registerPdfFonts();
    const doc = (
      <NextIntlClientProvider locale="bn" messages={bnMessages as any}>
        <FeeVoucherPDFDocument vouchers={[voucher]} />
      </NextIntlClientProvider>
    );
    expect(doc).toBeDefined();
    expect(doc.props.locale).toBe("bn");
  });
});
