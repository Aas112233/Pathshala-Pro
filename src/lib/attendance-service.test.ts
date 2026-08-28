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
    it("computes monthly summary with late penalty deductions for payroll", async () => {
      const mockTx = {
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
          findMany: vi.fn().mockResolvedValue([]),
        },
      } as any;

      const summary = await getStaffMonthlyAttendanceSummary(mockTx, {
        tenantId: "tenant-1",
        staffProfileId: "staff-1",
        year: 2026,
        month: 9, // September (30 days)
      });

      expect(summary.totalCalendarDays).toBe(30);
      expect(summary.presentDays).toBe(6); // 3 Present + 3 Late
      expect(summary.lateDays).toBe(3);
      expect(summary.unexcusedAbsences).toBe(1);
      expect(summary.approvedLeaveDays).toBe(2);
      expect(summary.lopDays).toBe(1.5); // 1 absent + 0.5 (3 late penalty)
      expect(summary.payableDays).toBe(28.5); // 30 - 1.5
    });
  });
});
