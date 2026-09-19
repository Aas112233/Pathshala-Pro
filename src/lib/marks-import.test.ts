import { describe, it, expect } from "vitest";
import {
  mapSheetRows,
  applyImportedMarks,
  buildMarksTemplateRows,
  type RosterMarkRow,
} from "@/lib/marks-import";

const roster: RosterMarkRow[] = [
  { studentProfileId: "p1", studentId: "STU001", rollNumber: "1", firstName: "Karim", lastName: "Ahmed", obtainedMarks: "", isAbsent: false },
  { studentProfileId: "p2", studentId: "STU002", rollNumber: "2", firstName: "Zainab", lastName: "Bibi", obtainedMarks: "70", isAbsent: false },
  { studentProfileId: "p3", studentId: "STU003", rollNumber: "3", firstName: "Rahim", lastName: "Uddin", obtainedMarks: "", isAbsent: false, isLocked: true },
];

describe("mapSheetRows", () => {
  it("maps template columns by header", () => {
    const rows = mapSheetRows([
      ["rollNumber", "studentId", "studentName", "obtainedMarks", "absent"],
      ["1", "STU001", "Karim", "85", "FALSE"],
    ]);
    expect(rows).toEqual([
      { rollNumber: "1", studentId: "STU001", obtainedMarks: "85", absent: false },
    ]);
  });

  it("treats A in marks and TRUE absent as absent", () => {
    const rows = mapSheetRows([
      ["roll", "marks", "absent"],
      ["1", "A", ""],
      ["2", "70", "TRUE"],
      ["3", "72", "yes"],
    ]);
    expect(rows[0]).toMatchObject({ rollNumber: "1", absent: true, obtainedMarks: "" });
    expect(rows[1]).toMatchObject({ rollNumber: "2", absent: true });
    expect(rows[2]).toMatchObject({ rollNumber: "3", absent: true });
  });

  it("falls back to template positions without a header", () => {
    const rows = mapSheetRows([["1", "STU001", "Karim", "88", "FALSE"]]);
    expect(rows[0]).toMatchObject({ rollNumber: "1", studentId: "STU001", obtainedMarks: "88", absent: false });
  });

  it("accepts numeric XLSX cell values", () => {
    const rows = mapSheetRows([
      ["rollNumber", "studentId", "studentName", "obtainedMarks", "absent"],
      ["2", "STU002", "Karim", 90, "FALSE"],
    ]);
    expect(rows[0]).toMatchObject({ rollNumber: "2", obtainedMarks: "90", absent: false });
  });

  it("returns empty for blank grids", () => {
    expect(mapSheetRows([[], ["  ", ""]])).toEqual([]);
  });
});

describe("applyImportedMarks", () => {
  it("fills marks, flags absent, skips locked/unknown", () => {
    const { updated, matched, skipped } = applyImportedMarks(
      roster,
      [
        { rollNumber: "1", studentId: "", obtainedMarks: "85", absent: false },
        { rollNumber: "", studentId: "STU002", obtainedMarks: "", absent: true },
        { rollNumber: "3", studentId: "", obtainedMarks: "90", absent: false }, // locked
        { rollNumber: "9", studentId: "", obtainedMarks: "80", absent: false }, // unknown roll
      ],
      100
    );
    expect(updated[0].obtainedMarks).toBe("85");
    expect(updated[1]).toMatchObject({ isAbsent: true, obtainedMarks: "" });
    expect(updated[2].obtainedMarks).toBe("");
    expect(matched).toBe(2);
    expect(skipped).toBe(1);
  });

  it("rejects over-max marks", () => {
    const { updated, matched, skipped } = applyImportedMarks(
      [roster[0]],
      [{ rollNumber: "1", studentId: "", obtainedMarks: "999", absent: false }],
      100
    );
    expect(updated[0].obtainedMarks).toBe("");
    expect(matched).toBe(0);
    expect(skipped).toBe(1);
  });

  it("rejects negative and non-numeric marks", () => {
    for (const bad of ["-5", "abc"]) {
      const { updated, matched, skipped } = applyImportedMarks(
        [roster[0]],
        [{ rollNumber: "1", studentId: "", obtainedMarks: bad, absent: false }],
        100
      );
      expect(updated[0].obtainedMarks).toBe("");
      expect(matched).toBe(0);
      expect(skipped).toBe(1);
    }
  });
});

describe("buildMarksTemplateRows", () => {
  it("emits header plus one row per student", () => {
    const rows = buildMarksTemplateRows(roster);
    expect(rows[0]).toEqual(["rollNumber", "studentId", "studentName", "obtainedMarks", "absent"]);
    expect(rows).toHaveLength(4);
    expect(rows[1]).toEqual(["1", "STU001", "Karim Ahmed", "", "FALSE"]);
    expect(rows[2]).toEqual(["2", "STU002", "Zainab Bibi", "70", "FALSE"]);
  });
});
