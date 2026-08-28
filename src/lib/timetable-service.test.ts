import { describe, it, expect, vi } from "vitest";
import {
  validateTimetableSlotConflict,
  assignTeacherSubstitution,
  getEffectiveDailySchedule,
} from "@/lib/timetable-service";

describe("Timetable Conflict Detection & Teacher Substitution Engine", () => {
  describe("validateTimetableSlotConflict", () => {
    it("detects class slot occupied conflict", async () => {
      const mockTx = {
        timetable: {
          findFirst: vi.fn().mockResolvedValueOnce({
            id: "slot-existing",
            subject: { name: "Mathematics" },
          }),
        },
      } as any;

      const result = await validateTimetableSlotConflict(mockTx, {
        tenantId: "tenant-1",
        classId: "class-10",
        dayOfWeek: "MONDAY",
        periodNumber: 1,
        startTime: "08:00",
        endTime: "08:45",
      });

      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe("CLASS_SLOT_OCCUPIED");
      expect(result.conflictMessage).toContain("Mathematics");
    });

    it("detects teacher double-booking conflict", async () => {
      const mockTx = {
        timetable: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce(null) // class check ok
            .mockResolvedValueOnce({
              id: "slot-teacher-busy",
              class: { name: "Class 9" },
              section: { name: "A" },
              subject: { name: "Physics" },
            }), // teacher busy in class 9
        },
      } as any;

      const result = await validateTimetableSlotConflict(mockTx, {
        tenantId: "tenant-1",
        classId: "class-10",
        dayOfWeek: "MONDAY",
        periodNumber: 2,
        startTime: "08:45",
        endTime: "09:30",
        staffProfileId: "teacher-physics",
      });

      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe("TEACHER_DOUBLE_BOOKED");
      expect(result.conflictMessage).toContain("Class 9");
    });

    it("detects room collision conflict", async () => {
      const mockTx = {
        timetable: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce(null) // class check ok
            .mockResolvedValueOnce(null) // teacher check ok
            .mockResolvedValueOnce({
              id: "slot-room-busy",
              class: { name: "Class 12" },
              section: { name: "Science" },
            }), // room busy
        },
      } as any;

      const result = await validateTimetableSlotConflict(mockTx, {
        tenantId: "tenant-1",
        classId: "class-10",
        dayOfWeek: "TUESDAY",
        periodNumber: 3,
        startTime: "09:30",
        endTime: "10:15",
        staffProfileId: "teacher-1",
        roomNumber: "LAB-2",
      });

      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe("ROOM_COLLISION");
      expect(result.conflictMessage).toContain("LAB-2");
    });

    it("returns no conflict for completely free slot and room", async () => {
      const mockTx = {
        timetable: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as any;

      const result = await validateTimetableSlotConflict(mockTx, {
        tenantId: "tenant-1",
        classId: "class-10",
        dayOfWeek: "WEDNESDAY",
        periodNumber: 1,
        startTime: "08:00",
        endTime: "08:45",
        staffProfileId: "teacher-free",
        roomNumber: "ROOM-101",
      });

      expect(result.hasConflict).toBe(false);
    });
  });

  describe("assignTeacherSubstitution", () => {
    it("rejects if substitute teacher is on approved leave", async () => {
      const mockTx = {
        timetable: {
          findUnique: vi.fn().mockResolvedValue({
            id: "slot-1",
            tenantId: "tenant-1",
            staffProfileId: "teacher-orig",
            dayOfWeek: "MONDAY",
            periodNumber: 1,
          }),
        },
        leaveApplication: {
          findFirst: vi.fn().mockResolvedValue({
            leaveType: "SICK",
          }),
        },
      } as any;

      await expect(
        assignTeacherSubstitution(mockTx, {
          tenantId: "tenant-1",
          academicYearId: "ay-2026",
          timetableSlotId: "slot-1",
          date: new Date("2026-09-14"),
          substituteStaffId: "teacher-sub",
          assignedById: "admin-1",
        })
      ).rejects.toThrow("on approved SICK leave");
    });

    it("creates substitution when substitute is available", async () => {
      const mockTx = {
        timetable: {
          findUnique: vi.fn().mockResolvedValue({
            id: "slot-1",
            tenantId: "tenant-1",
            staffProfileId: "teacher-orig",
            dayOfWeek: "MONDAY",
            periodNumber: 1,
          }),
          findFirst: vi.fn().mockResolvedValue(null), // no own class conflict
        },
        leaveApplication: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        teacherSubstitution: {
          findFirst: vi.fn().mockResolvedValue(null), // no other sub assignment
          upsert: vi.fn().mockResolvedValue({
            id: "sub-1",
            timetableSlotId: "slot-1",
            originalStaffId: "teacher-orig",
            substituteStaffId: "teacher-sub",
            status: "SCHEDULED",
            reason: "Medical Emergency",
          }),
        },
      } as any;

      const sub = await assignTeacherSubstitution(mockTx, {
        tenantId: "tenant-1",
        academicYearId: "ay-2026",
        timetableSlotId: "slot-1",
        date: new Date("2026-09-14"),
        substituteStaffId: "teacher-sub",
        reason: "Medical Emergency",
        assignedById: "admin-1",
      });

      expect(sub.substitutionId).toBe("sub-1");
      expect(sub.originalStaffId).toBe("teacher-orig");
      expect(sub.substituteStaffId).toBe("teacher-sub");
      expect(sub.status).toBe("SCHEDULED");
    });
  });

  describe("getEffectiveDailySchedule", () => {
    it("dynamically replaces original teacher with substitute teacher info", async () => {
      const mockTx = {
        timetable: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "slot-1",
              dayOfWeek: "MONDAY",
              periodNumber: 1,
              startTime: "08:00",
              endTime: "08:45",
              class: { name: "Class 10" },
              section: { name: "A" },
              subject: { name: "Mathematics" },
              staffProfile: { firstName: "Ahmed", lastName: "Khan" },
              isBreak: false,
              roomNumber: "101",
              substitutions: [
                {
                  id: "sub-1",
                  status: "SCHEDULED",
                  reason: "Official Duty",
                  substituteStaff: { firstName: "Fatima", lastName: "Zahra" },
                },
              ],
            },
          ]),
        },
      } as any;

      const schedule = await getEffectiveDailySchedule(mockTx, {
        tenantId: "tenant-1",
        date: new Date("2026-09-14"), // Monday
        classId: "class-10",
      });

      expect(schedule.length).toBe(1);
      expect(schedule[0].isSubstituted).toBe(true);
      expect(schedule[0].teacherName).toContain("Fatima Zahra (Substitute)");
      expect(schedule[0].substituteDetails?.originalTeacher).toContain("Ahmed Khan");
    });
  });
});
