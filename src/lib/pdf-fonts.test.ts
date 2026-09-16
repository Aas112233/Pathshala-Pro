// @vitest-environment node
import { describe, it, expect } from "vitest";
import { getPdfFontFamily, pdfTextSample } from "@/lib/pdf-fonts";

describe("PDF script detection (getPdfFontFamily)", () => {
  it("picks Bengali for Bangla content even with an English locale", () => {
    expect(getPdfFontFamily("en", "Rahim Uddin", "রহিম উদ্দিন")).toBe("NotoSansBengali");
  });

  it("picks Bengali for the Taka sign alone", () => {
    expect(getPdfFontFamily("৳500")).toBe("NotoSansBengali");
  });

  it("picks Devanagari for Hindi content", () => {
    expect(getPdfFontFamily("en", "राम कुमार")).toBe("NotoSansDevanagari");
  });

  it("picks Devanagari for a bare rupee sign", () => {
    expect(getPdfFontFamily("₹500")).toBe("NotoSansDevanagari");
  });

  it("picks Arabic for Urdu content", () => {
    expect(getPdfFontFamily("en", "علی رضا")).toBe("NotoSansArabic");
  });

  it("falls back to the locale tag for all-Latin documents", () => {
    expect(getPdfFontFamily("bn", "Pathshala Pro School")).toBe("NotoSansBengali");
    expect(getPdfFontFamily("hi", "Pathshala Pro School")).toBe("NotoSansDevanagari");
    expect(getPdfFontFamily("ur", "Pathshala Pro School")).toBe("NotoSansArabic");
  });

  it("defaults to NotoSans for Latin content with an English locale", () => {
    expect(getPdfFontFamily("en", "Pathshala Pro School")).toBe("NotoSans");
  });

  it("defaults to NotoSans when given nothing usable", () => {
    expect(getPdfFontFamily()).toBe("NotoSans");
    expect(getPdfFontFamily(null, undefined, "")).toBe("NotoSans");
  });

  it("never mistakes a font preference name for content", () => {
    // Regression: passing a font *name* (e.g. "Hind Siliguri") must not
    // resolve a script family — only real content or a locale tag may.
    expect(getPdfFontFamily("Hind Siliguri")).toBe("NotoSans");
  });
});

describe("pdfTextSample", () => {
  it("flattens row strings for detection and caps scanned rows", () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({ name: `Student ${i}` }));
    const sample = pdfTextSample(rows);
    expect(sample).toContain("Student 0");
    expect(sample).not.toContain("Student 499");
    expect(getPdfFontFamily(sample)).toBe("NotoSans");
  });

  it("surfaces non-Latin row content", () => {
    const sample = pdfTextSample([{ name: "রহিম" }]);
    expect(getPdfFontFamily(sample)).toBe("NotoSansBengali");
  });

  it("handles empty input", () => {
    expect(pdfTextSample(null)).toBe("");
    expect(pdfTextSample([])).toBe("");
  });
});
