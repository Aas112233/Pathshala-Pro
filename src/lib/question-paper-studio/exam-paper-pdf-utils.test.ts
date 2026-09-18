import { describe, it, expect } from "vitest";
import {
  stripHtml,
  resolvePdfLabels,
  toRoman,
  formatQuestionNumber,
  placeMarks,
  pdfPageSize,
  pdfPagePadding,
  pdfTypeScale,
  pdfLineHeight,
  pdfQuestionColumnWidth,
} from "./exam-paper-pdf-utils";

describe("exam-paper-pdf-utils", () => {
  it("strips rich-text HTML without leaking tags", () => {
    expect(stripHtml("<b>বল</b> কত?")).toBe("বল কত?");
    expect(stripHtml("plain text")).toBe("plain text");
    expect(stripHtml("")).toBe("");
    expect(stripHtml(null)).toBe("");
    expect(stripHtml("<p>ক</p><p>খ</p>")).toContain("ক");
    expect(stripHtml("<p>ক</p><p>খ</p>")).not.toContain("<p>");
    expect(stripHtml("a &amp; b")).toBe("a & b");
  });

  it("resolves label sets from the numeral system", () => {
    expect(resolvePdfLabels("bengali").subject).toBe("বিষয়");
    expect(resolvePdfLabels("english").subject).toBe("Subject");
    expect(resolvePdfLabels("arabic").subject).toBe("الموضوع");
  });

  it("converts to roman numerals", () => {
    expect(toRoman(1)).toBe("I");
    expect(toRoman(4)).toBe("IV");
    expect(toRoman(14)).toBe("XIV");
  });

  it("formats question numbers per numbering style", () => {
    expect(formatQuestionNumber("3", 0, "english", "english")).toBe("3");
    expect(formatQuestionNumber("3", 0, "bengali", "bengali")).toBe("৩");
    expect(formatQuestionNumber("3", 0, "roman", "english")).toBe("III");
    expect(formatQuestionNumber("3", 0, "parentheses-bengali", "english")).toBe("(৩)");
    expect(formatQuestionNumber("3", 0, "q-prefix", "english")).toBe("Q. 3");
    expect(formatQuestionNumber(undefined, 2, "english", "english")).toBe("3");
    // Already-localized numbers pass through untouched
    expect(formatQuestionNumber("২", 0, "bengali", "bengali")).toBe("২");
  });

  it("places marks per marksPosition", () => {
    expect(placeMarks(5, "right-bracket", "english")).toEqual({ prefix: "", suffix: " [5]" });
    expect(placeMarks(5, "inline-parentheses", "english")).toEqual({ prefix: "", suffix: " (5)" });
    expect(placeMarks(5, "left-margin", "english")).toEqual({ prefix: "[5] ", suffix: "" });
    expect(placeMarks(5, "hidden", "english")).toEqual({ prefix: "", suffix: "" });
    expect(placeMarks(undefined, "right-bracket", "english")).toEqual({ prefix: "", suffix: "" });
    expect(placeMarks("10", "right-bracket", "bengali").suffix).toContain("১০");
  });

  it("maps page geometry and typography", () => {
    expect(pdfPageSize("A4")).toBe("A4");
    expect(pdfPageSize("Legal")).toBe("LEGAL");
    expect(pdfPageSize("Letter")).toBe("LETTER");
    expect(pdfPagePadding("compact")).toBeLessThan(pdfPagePadding("standard"));
    expect(pdfPagePadding("standard")).toBeLessThan(pdfPagePadding("wide"));
    expect(pdfTypeScale("compact").question).toBeLessThan(pdfTypeScale("xl").question);
    expect(pdfLineHeight("tight")).toBeLessThan(pdfLineHeight("spacious"));
    expect(pdfQuestionColumnWidth(1)).toBe("100%");
    expect(pdfQuestionColumnWidth(2)).toBe("48%");
    expect(pdfQuestionColumnWidth(3)).toBe("31%");
  });
});
