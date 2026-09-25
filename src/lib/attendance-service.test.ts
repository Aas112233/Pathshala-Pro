import { describe, it, expect, vi } from "vitest";
import {
  submitBulkStudentAttendance,
  recordStaffBiometricPunch,
  getStaffMonthlyAttendanceSummary,
} from "@/lib/attendance-service";

describe("Academic Calendar Holidays & Attendance Service", () => {
  describe("submitBulkStudentAttendance", () => {
    it("submits bulk attendance roster and calculates attendance percentage", async () => {
      const mockTx = {
        academicHoliday: {
          findFirst: vi.fn().mockResolvedValue(null), // no holiday
        },
        attendance: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "att-1" }),
        },
      } as any;

      const result = await submitBulkStudentAttendance(mockTx, {
        tenantId: "tenant-1",
        classId: "class-10",
        date: new Date("2026-09-15"),
        markedById: "teacher-1",
        records: [
          { studentProfileId: "st-1", status: "PRESENT" },
          { studentProfileId: "st-2", status: "PRESENT" },
          { studentProfileId: "st-3", status: "LATE" },
          { studentProfileId: "st-4", status: "ABSENT" },
        ],
      });

      expect(result.totalStudents).toBe(4);
      expect(result.presentCount).toBe(3); // 2 Present + 1 Late
      expect(result.absentCount).toBe(1);
      expect(result.lateCount).toBe(1);
      expect(result.attendanceRate).toBe(75);
      expect(result.isHoliday).toBe(false);
    });

    it("automatically sets status to HOLIDAY when date falls on an Academic Holiday", async () => {
      const mockTx = {
        academicHoliday: {
          findFirst: vi.fn().mockResolvedValue({
            id: "hol-1",
            title: "Independence Day",
          }),
        },
        attendance: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "att-hol" }),
        },
      } as any;

      const result = await submitBulkStudentAttendance(mockTx, {
        tenantId: "tenant-1",
        classId: "class-10",
        date: new Date("2026-03-26"),
        markedById: "teacher-1",
        records: [
          { studentProfileId: "st-1", status: "PRESENT" },
          { studentProfileId: "st-2", status: "PRESENT" },
        ],
      });

      expect(result.isHoliday).toBe(true);
      expect(result.holidayTitle).toBe("Independence Day");
      expect(mockTx.attendance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "HOLIDAY",
          }),
        })
      );
    });
  });

  describe("recordStaffBiometricPunch", () => {
    it("records on-time check-in punch with 0 late minutes", async () => {
      const mockTx = {
        attendance: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "att-staff-1", ...data })),
        },
      } as any;

      const punchDate = new Date("2026-09-15T08:25:00");
      const record = await recordStaffBiometricPunch(mockTx, {
        tenantId: "tenant-1",
        staffProfileId: "staff-1",
        punchTime: punchDate,
        punchType: "IN",
        markedById: "biometric-device",
        expectedStartTime: "08:30",
        graceMinutes: 15,
      });

      expect(record.status).toBe("PRESENT");
      expect(record.lateMinutes).toBe(0);
    });

    it("records late arrival check-in punch past grace period", async () => {
      const mockTx = {
        attendance: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "att-staff-2", ...data })),
        },
      } as any;

      const punchDate = new Date("2026-09-15T08:55:00"); // 25 mins late
      const record = await recordStaffBiometricPunch(mockTx, {
        tenantId: "tenant-1",
        staffProfileId: "staff-1",
        punchTime: punchDate,
        punchType: "IN",
        markedById: "biometric-device",
        expectedStartTime: "08:30",
        graceMinutes: 15,
      });

      expect(record.status).toBe("LATE");
      expect(record.lateMinutes).toBe(25);
    });
  });

  describe("getStaffMonthlyAttendanceSummary", () => {
    /**
     * September 2026 starts on a Tuesday and has 30 days, so it contains four
     * Sundays (6th, 13th, 20th, 27th) and four Saturdays (5th, 12th, 19th, 26th).
     * Every expectation below is checkable by hand against that.
     */
    function payrollTx(holidays: Array<{ startDate: Date; endDate: Date }> = []) {
      return {
        attendance: {
          findMany: vi.fn().mockResolvedValue([
            { status: "PRESENT" },
            { status: "PRESENT" },
            { status: "PRESENT" },
            { status: "LATE" },
            { status: "LATE" },
            { status: "LATE" }, // 3 late = 0.5 LOP
            { status: "ABSENT" }, // 1 absent = 1 LOP
          ]),
        },
        leaveApplication: {
          findMany: vi.fn().mockResolvedValue([
            {
              fromDate: new Date("2026-09-10"),
              toDate: new Date("2026-09-11"), // 2 days approved leave
            },
          ]),
        },
        academicHoliday: {
          findMany: vi.fn().mockResolvedValue(holidays),
        },
      } as any;
    }

    const baseParams = {
      tenantId: "tenant-1",
      staffProfileId: "staff-1",
      year: 2026,
      month: 9, // September (30 days)
    };

    it("computes monthly summary with late penalty deductions for payroll", async () => {
      const summary = await getStaffMonthlyAttendanceSummary(payrollTx(), {
        ...baseParams,
        nonWorkingWeekdays: [0],
      });

      expect(summary.totalCalendarDays).toBe(30);
      expect(summary.presentDays).toBe(6); // 3 Present + 3 Late
      expect(summary.lateDays).toBe(3);
      expect(summary.unexcusedAbsences).toBe(1);
      expect(summary.approvedLeaveDays).toBe(2);
      expect(summary.lopDays).toBe(1.5); // 1 absent + 0.5 (3 late penalty)
      expect(summary.payableDays).toBe(28.5); // 30 - 1.5
    });

    it("counts working days from the supplied weekly days off, not a hardcoded Sunday", async () => {
      const sixDayWeek = await getStaffMonthlyAttendanceSummary(payrollTx(), {
        ...baseParams,
        nonWorkingWeekdays: [0],
      });
      const fiveDayWeek = await getStaffMonthlyAttendanceSummary(payrollTx(), {
        ...baseParams,
        nonWorkingWeekdays: [0, 6],
      });

      expect(sixDayWeek.weekendDays).toBe(4);
      expect(sixDayWeek.totalWorkingDays).toBe(26);

      // The arithmetic this replaced counted Sundays only, so a Monday-Friday
      // school was handed 26 and every Saturday was treated as a teaching day.
      expect(fiveDayWeek.weekendDays).toBe(8);
      expect(fiveDayWeek.totalWorkingDays).toBe(22);
    });

    it("excludes a holiday that spans a weekly day off exactly once", async () => {
      // Saturday 5th, Sunday 6th, Monday 7th. The Sunday is already a weekly day
      // off, so only the Saturday and the Monday reduce the working-day count.
      const summary = await getStaffMonthlyAttendanceSummary(
        payrollTx([{ startDate: new Date("2026-09-05"), endDate: new Date("2026-09-07") }]),
        { ...baseParams, nonWorkingWeekdays: [0] }
      );

      expect(summary.weekendDays).toBe(4);
      expect(summary.totalHolidays).toBe(3); // three holiday dates
      expect(summary.holidayWorkingDays).toBe(2); // only two of them were teaching days
      expect(summary.totalWorkingDays).toBe(24);

      // The replaced arithmetic computed 30 - 4 - 3 = 23, removing the 6th twice.
      expect(summary.totalWorkingDays).not.toBe(23);
    });

    it("keeps the working-day figure reconcilable from the returned counts", async () => {
      const summary = await getStaffMonthlyAttendanceSummary(
        payrollTx([{ startDate: new Date("2026-09-05"), endDate: new Date("2026-09-07") }]),
        { ...baseParams, nonWorkingWeekdays: [0] }
      );

      expect(summary.totalWorkingDays).toBe(
        summary.totalCalendarDays - summary.weekendDays - summary.holidayWorkingDays
      );
      expect(summary.totalHolidays).toBeGreaterThanOrEqual(summary.holidayWorkingDays);
    });

    it("does not double-count overlapping holiday ranges", async () => {
      const summary = await getStaffMonthlyAttendanceSummary(
        payrollTx([
          { startDate: new Date("2026-09-02"), endDate: new Date("2026-09-04") },
          { startDate: new Date("2026-09-04"), endDate: new Date("2026-09-06") },
        ]),
        { ...baseParams, nonWorkingWeekdays: [0] }
      );

      // The union is the 2nd to the 6th: five dates, not 3 + 3. One of them is
      // the Sunday, so four of them were teaching days.
      expect(summary.totalHolidays).toBe(5);
      expect(summary.holidayWorkingDays).toBe(4);
      expect(summary.totalWorkingDays).toBe(22);
    });

    it("refuses to guess a weekly schedule", async () => {
      await expect(
        getStaffMonthlyAttendanceSummary(payrollTx(), {
          ...baseParams,
          nonWorkingWeekdays: null as unknown as [],
        })
      ).rejects.toThrow(/requires an array/);
    });
  });
});
