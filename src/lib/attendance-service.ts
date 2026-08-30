import { Prisma } from "@prisma/client";

export type AttendanceStatusType =
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "HALF_DAY"
  | "EXCUSED"
  | "HOLIDAY";

export interface StudentAttendanceEntry {
  studentProfileId: string;
  status: AttendanceStatusType;
  note?: string;
}

export interface BulkStudentAttendanceParams {
  tenantId: string;
  academicYearId?: string;
  classId: string;
  sectionId?: string | null;
  date: Date;
  markedById: string;
  records: StudentAttendanceEntry[];
}

export interface BulkAttendanceResult {
  date: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  halfDayCount: number;
  excusedCount: number;
  attendanceRate: number; // percentage e.g. 95.5
  isHoliday: boolean;
  holidayTitle?: string;
}

export interface StaffBiometricPunchParams {
  tenantId: string;
  staffProfileId: string;
  punchTime: Date;
  punchType: "IN" | "OUT";
  markedById: string;
  expectedStartTime?: string; // e.g. "08:30" (default)
  expectedEndTime?: string;   // e.g. "16:00" (default)
  graceMinutes?: number;      // default 15
}

export interface StaffMonthlyPayrollAttendance {
  staffProfileId: string;
  monthYear: string; // e.g. "2026-09"
  totalCalendarDays: number;
  totalWorkingDays: number;
  presentDays: number;
  lateDays: number;
  halfDays: number;
  approvedLeaveDays: number;
  unexcusedAbsences: number;
  totalHolidays: number;
  lopDays: number; // Loss of Pay Days
  payableDays: number;
}

/**
 * 1. Bulk Student Attendance Submissions
 */
export async function submitBulkStudentAttendance(
  tx: Prisma.TransactionClient,
  params: BulkStudentAttendanceParams
): Promise<BulkAttendanceResult> {
  const { tenantId, academicYearId, date, markedById, records } = params;
  const dateOnly = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

  // 1. Check for Academic Holiday
  const holiday = await tx.academicHoliday.findFirst({
    where: {
      tenantId,
      affectsStudents: true,
      startDate: { lte: dateOnly },
      endDate: { gte: dateOnly },
    },
  });

  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let halfDayCount = 0;
  let excusedCount = 0;

  for (const entry of records) {
    const finalStatus = holiday ? "HOLIDAY" : entry.status;

    if (finalStatus === "PRESENT") presentCount++;
    else if (finalStatus === "ABSENT") absentCount++;
    else if (finalStatus === "LATE") {
      lateCount++;
      presentCount++; // Late counts toward presence
    } else if (finalStatus === "HALF_DAY") halfDayCount++;
    else if (finalStatus === "EXCUSED") excusedCount++;

    // Find existing attendance for student on date
    const existing = await tx.attendance.findFirst({
      where: {
        tenantId,
        studentProfileId: entry.studentProfileId,
        ...(academicYearId ? { academicYearId } : {}),
        date: dateOnly,
      },
    });

    if (existing) {
      await tx.attendance.update({
        where: { id: existing.id },
        data: {
          status: finalStatus,
          note: entry.note || existing.note,
          markedById,
        },
      });
    } else {
      await tx.attendance.create({
        data: {
          tenantId,
          studentProfileId: entry.studentProfileId,
          academicYearId,
          date: dateOnly,
          status: finalStatus,
          note: entry.note,
          markedById,
        },
      });
    }
  }

  const total = records.length;
  const attendanceRate =
    total > 0 ? Math.round((presentCount / total) * 10000) / 100 : 100;

  return {
    date: dateOnly.toISOString().slice(0, 10),
    totalStudents: total,
    presentCount,
    absentCount,
    lateCount,
    halfDayCount,
    excusedCount,
    attendanceRate,
    isHoliday: !!holiday,
    holidayTitle: holiday?.title,
  };
}

/**
 * 2. Record Staff Biometric / Timestamp Punch & Late Tracking
 */
export async function recordStaffBiometricPunch(
  tx: Prisma.TransactionClient,
  params: StaffBiometricPunchParams
) {
  const {
    tenantId,
    staffProfileId,
    punchTime,
    punchType,
    markedById,
    expectedStartTime = "08:30",
    expectedEndTime = "16:00",
    graceMinutes = 15,
  } = params;

  const dateOnly = new Date(Date.UTC(punchTime.getFullYear(), punchTime.getMonth(), punchTime.getDate()));

  // Parse expected start time
  const [startH, startM] = expectedStartTime.split(":").map(Number);
  const expectedStartMs = (startH * 60 + startM) * 60 * 1000;
  const punchMs = (punchTime.getHours() * 60 + punchTime.getMinutes()) * 60 * 1000;

  let lateMinutes = 0;
  let status: AttendanceStatusType = "PRESENT";

  if (punchType === "IN") {
    const diffMinutes = Math.max(0, Math.floor((punchMs - expectedStartMs) / 60000));
    if (diffMinutes > graceMinutes) {
      lateMinutes = diffMinutes;
      status = diffMinutes > 120 ? "HALF_DAY" : "LATE";
    }
  }

  // Parse expected end time for early departures
  let earlyDepartureMinutes = 0;
  if (punchType === "OUT") {
    const [endH, endM] = expectedEndTime.split(":").map(Number);
    const expectedEndMs = (endH * 60 + endM) * 60 * 1000;
    if (punchMs < expectedEndMs) {
      earlyDepartureMinutes = Math.floor((expectedEndMs - punchMs) / 60000);
    }
  }

  const existing = await tx.attendance.findFirst({
    where: {
      tenantId,
      staffProfileId,
      date: dateOnly,
    },
  });

  if (existing) {
    return tx.attendance.update({
      where: { id: existing.id },
      data: {
        ...(punchType === "IN" ? { checkInTime: punchTime, lateMinutes, status } : {}),
        ...(punchType === "OUT" ? { checkOutTime: punchTime, earlyDepartureMinutes } : {}),
        markedById,
      },
    });
  } else {
    return tx.attendance.create({
      data: {
        tenantId,
        staffProfileId,
        date: dateOnly,
        status,
        checkInTime: punchType === "IN" ? punchTime : undefined,
        checkOutTime: punchType === "OUT" ? punchTime : undefined,
        lateMinutes,
        earlyDepartureMinutes,
        markedById,
      },
    });
  }
}

/**
 * 3. Payroll-Integrated Staff Monthly Attendance Aggregator
 */
export async function getStaffMonthlyAttendanceSummary(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    staffProfileId: string;
    year: number;
    month: number; // 1-12
  }
): Promise<StaffMonthlyPayrollAttendance> {
  const { tenantId, staffProfileId, year, month } = params;

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const totalCalendarDays = new Date(year, month, 0).getDate();

  // 1. Fetch Attendance Records for the Month
  const records = await tx.attendance.findMany({
    where: {
      tenantId,
      staffProfileId,
      date: { gte: startDate, lte: endDate },
    },
  });

  // 2. Fetch Approved Leaves
  const leaves = await tx.leaveApplication.findMany({
    where: {
      tenantId,
      staffProfileId,
      status: "APPROVED",
      fromDate: { lte: endDate },
      toDate: { gte: startDate },
    },
  });

  let approvedLeaveDays = 0;
  for (const l of leaves) {
    const lStart = l.fromDate < startDate ? startDate : l.fromDate;
    const lEnd = l.toDate > endDate ? endDate : l.toDate;
    const days = Math.ceil((lEnd.getTime() - lStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    approvedLeaveDays += Math.max(0, days);
  }

  // 3. Fetch Holidays for Staff
  const holidays = await tx.academicHoliday.findMany({
    where: {
      tenantId,
      affectsStaff: true,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });

  let totalHolidays = 0;
  for (const h of holidays) {
    const hStart = h.startDate < startDate ? startDate : h.startDate;
    const hEnd = h.endDate > endDate ? endDate : h.endDate;
    const days = Math.ceil((hEnd.getTime() - hStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    totalHolidays += Math.max(0, days);
  }

  let presentDays = 0;
  let lateDays = 0;
  let halfDays = 0;
  let unexcusedAbsences = 0;

  for (const rec of records) {
    if (rec.status === "PRESENT") presentDays++;
    else if (rec.status === "LATE") {
      lateDays++;
      presentDays++;
    } else if (rec.status === "HALF_DAY") halfDays++;
    else if (rec.status === "ABSENT") unexcusedAbsences++;
  }

  // Working days (approx calendar days minus Sundays and holidays)
  let sundaysCount = 0;
  for (let d = 1; d <= totalCalendarDays; d++) {
    const current = new Date(year, month - 1, d);
    if (current.getDay() === 0) sundaysCount++;
  }
  const totalWorkingDays = Math.max(0, totalCalendarDays - sundaysCount - totalHolidays);

// Late penalty: Every 3 late days = 0.5 day LOP (rounded to 2dp for precision)
  const latePenaltyDays = Math.round((Math.floor(lateDays / 3) * 0.5 + Number.EPSILON) * 100) / 100;

// LOP = Unexcused Absences + Half-day deductions + Late penalty (rounded)
  const lopDays = Math.round((unexcusedAbsences + halfDays * 0.5 + latePenaltyDays) * 100) / 100;

// Payable Days = Calendar Days - LOP (integer safe)
  const payableDays = Math.max(0, totalCalendarDays - lopDays);

  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  return {
    staffProfileId,
    monthYear: monthStr,
    totalCalendarDays,
    totalWorkingDays,
    presentDays,
    lateDays,
    halfDays,
    approvedLeaveDays,
    unexcusedAbsences,
    totalHolidays,
    lopDays,
    payableDays: Math.round(payableDays * 100) / 100,
  };
}
