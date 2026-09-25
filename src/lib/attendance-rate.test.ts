// @vitest-environment node
import { describe, it, expect } from "vitest";

import {
  attendanceRateFromCounts,
  attendanceRateFromRecords,
  dayAttendanceRate,
  dayAttendanceRateFromCounts,
  ATTENDED_STATUSES,
  NON_TEACHING_STATUSES,
  ATTENDANCE_STATUSES,
  AUTHORISED_ABSENCE_STATUSES,
  isKnownAttendanceStatus,
  unknownAttendanceStatuses,
} from "@/lib/attendance-rate";

/**
 * The single attendance-rate definition.
 *
 * The first block of tests is the migrated engine suite — it moved here with the
 * function. The "holiday" block is the reason the module exists: it pins the
 * difference between this definition and the one the attendance report used to
 * use, so nobody reintroduces it.
 */

describe("attendanceRateFromRecords", () => {
  it("reports untracked when there are no records at all", () => {
    const result = attendanceRateFromRecords([]);
    expect(result.rate).toBeNull();
    expect(result.totalDays).toBe(0);
    expect(result.tracked).toBe(false);
  });

  it("reports untracked when every record is a holiday", () => {
    const result = attendanceRateFromRecords([{ status: "HOLIDAY" }, { status: "HOLIDAY" }]);
    expect(result.rate).toBeNull();
    expect(result.totalDays).toBe(0);
    expect(result.tracked).toBe(false);
  });

  it("counts LATE as present but HALF_DAY as not present", () => {
    const result = attendanceRateFromRecords([
      { status: "PRESENT" },
      { status: "LATE" },
      { status: "HALF_DAY" },
      { status: "ABSENT" },
    ]);
    expect(result.presentDays).toBe(2);
    expect(result.totalDays).toBe(4);
    expect(result.rate).toBe(50);
  });

  it("excludes holidays from the denominator", () => {
    const result = attendanceRateFromRecords([{ status: "PRESENT" }, { status: "HOLIDAY" }]);
    expect(result.totalDays).toBe(1);
    expect(result.rate).toBe(100);
  });

  it("rounds to two decimals", () => {
    // 2 of 3 days attended.
    const result = attendanceRateFromRecords([
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "ABSENT" },
    ]);
    expect(result.rate).toBe(66.67);
  });
});

describe("attendanceRateFromCounts", () => {
  it("agrees with the record-based computation", () => {
    const records = [
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "LATE" },
      { status: "ABSENT" },
      { status: "HOLIDAY" },
    ];
    const counts = { PRESENT: 2, LATE: 1, ABSENT: 1, HOLIDAY: 1 };
    expect(attendanceRateFromCounts(counts)).toEqual(attendanceRateFromRecords(records));
  });

  it("reports untracked for an empty count map", () => {
    expect(attendanceRateFromCounts({}).rate).toBeNull();
    expect(attendanceRateFromCounts({}).tracked).toBe(false);
  });

  it("ignores zero and negative counts rather than counting them as days", () => {
    expect(attendanceRateFromCounts({ PRESENT: 0, ABSENT: 0 }).rate).toBeNull();
    expect(attendanceRateFromCounts({ PRESENT: 5, ABSENT: -3 }).rate).toBe(100);
  });
});

/**
 * The defect this module was created to remove.
 *
 * `POST /api/attendance` rewrites every student's status to `HOLIDAY` when an
 * academic holiday covers the date, so holiday rows exist for the whole school.
 * The attendance report counted them in the denominator and not in the
 * numerator, so it reported every student's attendance as if they had been
 * absent on every holiday.
 */
describe("holidays must not be counted as absences", () => {
  const YEAR = { teachingDays: 100, holidays: 20, attended: 80 };

  it("reports the holiday-free rate", () => {
    const counts = { PRESENT: YEAR.attended, ABSENT: 20, HOLIDAY: YEAR.holidays };
    const result = attendanceRateFromCounts(counts);

    expect(result.rate).toBe(80);
    // Only the 100 teaching days are counted; the 20 holidays are dropped.
    expect(result.totalDays).toBe(100);
  });

  it("differs materially from the holiday-counting definition it replaced", () => {
    const counts = { PRESENT: YEAR.attended, ABSENT: 20, HOLIDAY: YEAR.holidays };

    // What the report used to compute: present over every row on file.
    const legacy =
      Math.round((counts.PRESENT / (counts.PRESENT + counts.ABSENT + counts.HOLIDAY)) * 100);

    expect(legacy).toBe(67);
    expect(attendanceRateFromCounts(counts).rate).toBe(80);

    // 13 points is the difference between "average" and "deficit" against the
    // report's own 75% threshold, for a student who attended four days in five.
    expect(legacy).toBeLessThan(75);
    expect(attendanceRateFromCounts(counts).rate).toBeGreaterThan(75);
  });

  it("does not report a 0% day for a register taken on a holiday", () => {
    const register = Array.from({ length: 30 }, () => ({ status: "HOLIDAY" }));
    expect(attendanceRateFromRecords(register).rate).toBeNull();
  });
});

describe("the declared policy", () => {
  it("counts PRESENT and LATE as attended, and nothing else", () => {
    expect([...ATTENDED_STATUSES].sort()).toEqual(["LATE", "PRESENT"]);
  });

  it("treats HALF_DAY and EXCUSED as not attended", () => {
    // Both are preserved from the promotion engine: changing either would move
    // real students across the promotion line.
    const result = attendanceRateFromRecords([{ status: "HALF_DAY" }, { status: "EXCUSED" }]);
    expect(result.presentDays).toBe(0);
    expect(result.rate).toBe(0);
  });

  it("treats an unrecognised status as a day not attended", () => {
    // Conservative on purpose: a status the policy does not know must never be
    // able to inflate a student's attendance.
    const result = attendanceRateFromCounts({ PRESENT: 1, SOMETHING_NEW: 1 });
    expect(result.presentDays).toBe(1);
    expect(result.totalDays).toBe(2);
    expect(result.rate).toBe(50);
  });

  it("excludes only HOLIDAY from the denominator", () => {
    expect([...NON_TEACHING_STATUSES]).toEqual(["HOLIDAY"]);
  });
});

describe("dayAttendanceRate", () => {
  it("reports a rate for an ordinary register", () => {
    const result = dayAttendanceRate([
      { status: "PRESENT" },
      { status: "LATE" },
      { status: "ABSENT" },
      { status: "EXCUSED" },
    ]);
    expect(result.rate).toBe(50);
    expect(result.presentDays).toBe(2);
    expect(result.totalDays).toBe(4);
    expect(result.isHoliday).toBe(false);
  });

  it("reports a holiday rather than a 0% rate", () => {
    const result = dayAttendanceRate([{ status: "HOLIDAY" }, { status: "HOLIDAY" }]);
    expect(result.rate).toBeNull();
    expect(result.isHoliday).toBe(true);
    expect(result.tracked).toBe(false);
    // The register was taken; there were simply no teaching days to score.
    expect(result.totalDays).toBe(0);
  });

  it("reports untracked for an empty register", () => {
    const result = dayAttendanceRate([]);
    expect(result.rate).toBeNull();
    expect(result.isHoliday).toBe(false);
  });

  it("computes the same figure from pre-aggregated counts", () => {
    const fromRecords = dayAttendanceRate([
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "LATE" },
      { status: "ABSENT" },
      { status: "HOLIDAY" },
    ]);
    const fromCounts = dayAttendanceRateFromCounts({
      PRESENT: 2,
      LATE: 1,
      ABSENT: 1,
      HOLIDAY: 1,
    });

    expect(fromCounts).toEqual(fromRecords);
    expect(fromCounts.rate).toBe(75);
  });

  it("detects a holiday from counts alone, so a groupBy needs no second query", () => {
    const result = dayAttendanceRateFromCounts({ HOLIDAY: 40 });
    expect(result.isHoliday).toBe(true);
    expect(result.rate).toBeNull();
    expect(result.tracked).toBe(false);
  });
});

/**
 * The vocabulary, declared once.
 *
 * The arithmetic above was only half the defect. The status *names* had been
 * hand-written four times — here, in `attendance-service.ts`, in
 * `createAttendanceSchema`/the manual form, and in the fast grid — and no list
 * imported any other. `POST /api/attendance`'s fast-grid branch validated
 * nothing at all, so any string the client sent was persisted verbatim.
 */
describe("the attendance vocabulary", () => {
  it("declares exactly seven statuses, including LEAVE", () => {
    expect([...ATTENDANCE_STATUSES].sort()).toEqual([
      "ABSENT",
      "EXCUSED",
      "HALF_DAY",
      "HOLIDAY",
      "LATE",
      "LEAVE",
      "PRESENT",
    ]);
  });

  it("accepts every declared status", () => {
    for (const status of ATTENDANCE_STATUSES) {
      expect(isKnownAttendanceStatus(status)).toBe(true);
    }
  });

  it("rejects a near miss, a wrong case, and a padded value", () => {
    // `PRESENTT` is the shape a typo actually takes; `present` is what a
    // hand-written client sends when it does not read the shared list.
    for (const bad of ["PRESENTT", "present", "PRESENT ", " LEAVED", "P", "half_day"]) {
      expect(isKnownAttendanceStatus(bad)).toBe(false);
    }
  });

  it("rejects non-string input rather than coercing it", () => {
    // The fast-grid branch reads an arbitrary JSON body, so `undefined` and
    // numbers are reachable. A coercion here would turn `1` into a status.
    expect(isKnownAttendanceStatus(undefined)).toBe(false);
    expect(isKnownAttendanceStatus(null)).toBe(false);
    expect(isKnownAttendanceStatus(1)).toBe(false);
    expect(isKnownAttendanceStatus({ status: "PRESENT" })).toBe(false);
    expect(isKnownAttendanceStatus(["PRESENT"])).toBe(false);
  });

  it("lists the statuses in a count map that nothing recognises", () => {
    expect(
      unknownAttendanceStatuses({ PRESENT: 3, PRESENTT: 1, LEAVE: 2, "": 1 })
    ).toEqual(["PRESENTT", ""]);
  });

  it("finds nothing to report in a map built from the vocabulary", () => {
    expect(unknownAttendanceStatuses({ PRESENT: 4, EXCUSED: 1, HOLIDAY: 2 })).toEqual([]);
  });
});

/**
 * The defect the vocabulary convergence removed.
 *
 * `LEAVE` is written by leave approval and by the manual attendance form, and it
 * appeared in no domain list — so it was never *handled*. It fell through
 * `ATTENDED_STATUSES` and `NON_TEACHING_STATUSES` alike, landing in the
 * denominator without landing in the numerator. An absence the school had
 * authorised was counted as an absence, by accident, because nobody had decided
 * otherwise.
 */
describe("LEAVE is counted, not ignored", () => {
  it("counts LEAVE in the denominator but not the numerator", () => {
    const result = attendanceRateFromCounts({ PRESENT: 3, LEAVE: 1 });
    expect(result.presentDays).toBe(3);
    expect(result.totalDays).toBe(4);
    expect(result.rate).toBe(75);
  });

  it("is not a non-teaching status, so a leave day is still a school day", () => {
    // Contrast the two: a holiday leaves the denominator, a leave does not.
    // Scoring a leave as a holiday would be the opposite error — it would
    // silently excuse the absence instead of counting it.
    expect(NON_TEACHING_STATUSES).not.toContain("LEAVE");
    expect(attendanceRateFromCounts({ LEAVE: 5 }).totalDays).toBe(5);
    expect(attendanceRateFromCounts({ HOLIDAY: 5 }).totalDays).toBe(0);
  });

  it("scores a student who was on leave all term as 0%, not as untracked", () => {
    const result = attendanceRateFromCounts({ LEAVE: 20 });
    expect(result.tracked).toBe(true);
    expect(result.rate).toBe(0);
  });

  it("treats LEAVE and EXCUSED identically, because they are the same fact", () => {
    expect([...AUTHORISED_ABSENCE_STATUSES].sort()).toEqual(["EXCUSED", "LEAVE"]);
    expect(attendanceRateFromCounts({ PRESENT: 1, LEAVE: 1 })).toEqual(
      attendanceRateFromCounts({ PRESENT: 1, EXCUSED: 1 })
    );
  });
});
