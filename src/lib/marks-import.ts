/**
 * Bulk marks import helpers for the exam-results marks entry module.
 *
 * Excel-only format (first sheet, same layout for template + upload):
 *   rollNumber | studentId | studentName | obtainedMarks | absent
 *
 * - Rows are matched to the roster by roll number, falling back to student ID.
 * - `absent` accepts TRUE/FALSE, YES/NO, 1/0, A/P, ABSENT/PRESENT.
 * - An obtainedMarks of A/AB/ABS is treated as absent.
 * - Locked rows and out-of-range marks are skipped, never overwritten.
 */

export interface ImportMarkRow {
  rollNumber: string;
  studentId: string;
  obtainedMarks: string;
  absent: boolean;
}

export interface RosterMarkRow {
  studentProfileId: string;
  studentId: string;
  rollNumber: string;
  firstName?: string;
  lastName?: string;
  obtainedMarks: string;
  isLocked?: boolean;
  isAbsent?: boolean;
}

const ABSENT_VALUES = new Set(["true", "yes", "y", "1", "a", "ab", "abs", "absent"]);

function isAbsentValue(value: string): boolean {
  return ABSENT_VALUES.has(value.trim().toLowerCase());
}

function headerIndex(header: string[], ...keywords: string[]): number {
  const lowered = header.map((h) => h.trim().toLowerCase());
  for (const kw of keywords) {
    const idx = lowered.findIndex((h) => h === kw || h.includes(kw));
    if (idx !== -1) return idx;
  }
  return -1;
}

/** Map raw XLSX sheet rows to import rows. */
export function mapSheetRows(rawRows: Array<Array<string | number | null | undefined>>): ImportMarkRow[] {
  const rows = rawRows
    .map((r) => (r ?? []).map((c) => String(c ?? "").trim()))
    .filter((r) => r.some((c) => c !== ""));
  if (rows.length === 0) return [];

  // Header detection: first row names columns instead of carrying data.
  const first = rows[0].map((c) => c.toLowerCase());
  const looksLikeHeader =
    first.some((c) => c.includes("roll") || c.includes("mark") || c.includes("absent") || c.includes("student") || c.includes("name"));
  const body = looksLikeHeader ? rows.slice(1) : rows;

  let rollIdx = 0;
  let idIdx = 1;
  let marksIdx = 3;
  let absentIdx = 4;
  if (looksLikeHeader) {
    const header = rows[0];
    rollIdx = Math.max(0, headerIndex(header, "roll"));
    const foundId = headerIndex(header, "studentid", "admission", "student id");
    idIdx = foundId === -1 ? -1 : foundId;
    const foundMarks = headerIndex(header, "obtained", "marks", "score");
    marksIdx = foundMarks === -1 ? 3 : foundMarks;
    const foundAbsent = headerIndex(header, "absent", "status", "present");
    absentIdx = foundAbsent === -1 ? 4 : foundAbsent;
  }

  return body.map((cells) => {
    const at = (i: number) => (i >= 0 && i < cells.length ? cells[i] : "");
    const marksRaw = at(marksIdx);
    const absentRaw = at(absentIdx);
    // "A" in the marks column means absent; unrecognised status words are ignored.
    const absent = isAbsentValue(absentRaw) || isAbsentValue(marksRaw);
    return {
      rollNumber: at(rollIdx),
      studentId: idIdx === -1 ? "" : at(idIdx),
      obtainedMarks: isAbsentValue(marksRaw) ? "" : marksRaw,
      absent,
    };
  });
}

export interface ApplyImportResult<T extends RosterMarkRow> {
  updated: T[];
  matched: number;
  skipped: number;
}

/**
 * Apply imported rows onto the current roster. Returns a new roster array.
 * Locked rows, unknown rolls/IDs and out-of-range marks are skipped.
 */
export function applyImportedMarks<T extends RosterMarkRow>(
  roster: T[],
  imports: ImportMarkRow[],
  maxMarks: number
): ApplyImportResult<T> {
  const byRoll = new Map<string, ImportMarkRow>();
  const byId = new Map<string, ImportMarkRow>();
  for (const imp of imports) {
    if (imp.rollNumber) byRoll.set(imp.rollNumber.trim(), imp);
    if (imp.studentId) byId.set(imp.studentId.trim(), imp);
  }

  let matched = 0;
  let skipped = 0;
  const updated = roster.map((row) => {
    const imp =
      (row.rollNumber && byRoll.get(row.rollNumber.trim())) ||
      (row.studentId && byId.get(row.studentId.trim()));
    if (!imp) return row;
    if (row.isLocked) {
      skipped++;
      return row;
    }
    if (imp.absent) {
      matched++;
      return { ...row, isAbsent: true, obtainedMarks: "" };
    }
    if (imp.obtainedMarks === "") {
      skipped++;
      return row;
    }
    const num = parseFloat(imp.obtainedMarks);
    if (isNaN(num) || num < 0 || num > maxMarks) {
      skipped++;
      return row;
    }
    matched++;
    return { ...row, isAbsent: false, obtainedMarks: imp.obtainedMarks.trim() };
  });

  return { updated, matched, skipped };
}

/** Template grid (header + one row per student) for the XLSX template file. */
export function buildMarksTemplateRows<T extends RosterMarkRow>(roster: T[]): string[][] {
  const rows: string[][] = [["rollNumber", "studentId", "studentName", "obtainedMarks", "absent"]];
  for (const row of roster) {
    const name = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
    rows.push([
      row.rollNumber ?? "",
      row.studentId ?? "",
      name,
      row.isAbsent ? "" : row.obtainedMarks ?? "",
      row.isAbsent ? "TRUE" : "FALSE",
    ]);
  }
  return rows;
}
