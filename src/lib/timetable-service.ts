import { Prisma } from "@prisma/client";

export type SubstitutionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface CreateTimetableSlotParams {
  tenantId: string;
  academicYearId?: string;
  classId: string;
  sectionId?: string | null;
  dayOfWeek: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
  periodNumber: number;
  startTime: string; // "08:00"
  endTime: string;   // "08:45"
  subjectId?: string | null;
  staffProfileId?: string | null;
  roomNumber?: string | null;
  isBreak?: boolean;
  breakLabel?: string | null;
  excludeSlotId?: string; // For updates
}

export interface SlotConflictCheckResult {
  hasConflict: boolean;
  conflictType?: "TEACHER_DOUBLE_BOOKED" | "ROOM_COLLISION" | "CLASS_SLOT_OCCUPIED";
  conflictMessage?: string;
  conflictingSlotId?: string;
}

export interface AssignSubstitutionParams {
  tenantId: string;
  academicYearId: string;
  timetableSlotId: string;
  date: Date;
  substituteStaffId: string;
  reason?: string;
  assignedById: string;
  notes?: string;
}

export interface SubstitutionResult {
  substitutionId: string;
  timetableSlotId: string;
  date: string;
  originalStaffId: string;
  substituteStaffId: string;
  status: SubstitutionStatus;
  reason?: string;
}

/**
 * 1. Checks for Teacher and Room Collisions in Master Timetable
 */
export async function validateTimetableSlotConflict(
  tx: Prisma.TransactionClient,
  params: CreateTimetableSlotParams
): Promise<SlotConflictCheckResult> {
  const {
    tenantId,
    academicYearId,
    classId,
    sectionId,
    dayOfWeek,
    periodNumber,
    staffProfileId,
    roomNumber,
    isBreak = false,
    excludeSlotId,
  } = params;

  if (isBreak) {
    return { hasConflict: false };
  }

  // 1. Check if Class/Section slot is already occupied
  const existingClassSlot = await tx.timetable.findFirst({
    where: {
      tenantId,
      ...(academicYearId ? { academicYearId } : {}),
      classId,
      sectionId: sectionId ?? null,
      dayOfWeek,
      periodNumber,
      ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
    },
    include: { subject: true },
  });

  if (existingClassSlot) {
    return {
      hasConflict: true,
      conflictType: "CLASS_SLOT_OCCUPIED",
      conflictMessage: `Class/Section already has ${existingClassSlot.subject?.name || "a subject"} scheduled for Period ${periodNumber} on ${dayOfWeek}.`,
      conflictingSlotId: existingClassSlot.id,
    };
  }

  // 2. Check Teacher Double-Booking
  if (staffProfileId) {
    const teacherConflict = await tx.timetable.findFirst({
      where: {
        tenantId,
        staffProfileId,
        dayOfWeek,
        periodNumber,
        isBreak: false,
        ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
      },
      include: { class: true, section: true, subject: true },
    });

    if (teacherConflict) {
      return {
        hasConflict: true,
        conflictType: "TEACHER_DOUBLE_BOOKED",
        conflictMessage: `Teacher is already teaching ${teacherConflict.subject?.name || "another class"} in Class ${teacherConflict.class.name} (Section: ${teacherConflict.section?.name || "All"}) during Period ${periodNumber} on ${dayOfWeek}.`,
        conflictingSlotId: teacherConflict.id,
      };
    }
  }

  // 3. Check Room Collision
  if (roomNumber && roomNumber.trim()) {
    const roomConflict = await tx.timetable.findFirst({
      where: {
        tenantId,
        roomNumber: roomNumber.trim(),
        dayOfWeek,
        periodNumber,
        isBreak: false,
        ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
      },
      include: { class: true, section: true },
    });

    if (roomConflict) {
      return {
        hasConflict: true,
        conflictType: "ROOM_COLLISION",
        conflictMessage: `Room '${roomNumber}' is already occupied by Class ${roomConflict.class.name} during Period ${periodNumber} on ${dayOfWeek}.`,
        conflictingSlotId: roomConflict.id,
      };
    }
  }

  return { hasConflict: false };
}

/**
 * 2. Assigns a Teacher Substitution for a specific date
 */
export async function assignTeacherSubstitution(
  tx: Prisma.TransactionClient,
  params: AssignSubstitutionParams
): Promise<SubstitutionResult> {
  const {
    tenantId,
    academicYearId,
    timetableSlotId,
    date,
    substituteStaffId,
    reason = "Relief Duty",
    assignedById,
    notes,
  } = params;

  // 1. Fetch Target Timetable Slot
  const slot = await tx.timetable.findUnique({
    where: { id: timetableSlotId },
    include: { staffProfile: true, class: true },
  });

  if (!slot || slot.tenantId !== tenantId) {
    throw new Error("Timetable slot not found or tenant mismatch.");
  }

  if (!slot.staffProfileId) {
    throw new Error("Cannot assign substitution to a slot with no assigned teacher.");
  }

  if (slot.staffProfileId === substituteStaffId) {
    throw new Error("Substitute teacher cannot be the same as the original teacher.");
  }

  const dateOnly = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

  // 2. Check if substitute teacher is on approved leave on that date
  const activeLeave = await tx.leaveApplication.findFirst({
    where: {
      tenantId,
      staffProfileId: substituteStaffId,
      status: "APPROVED",
      fromDate: { lte: dateOnly },
      toDate: { gte: dateOnly },
    },
  });

  if (activeLeave) {
    throw new Error(
      `Substitute teacher is on approved ${activeLeave.leaveType} leave on ${dateOnly.toISOString().slice(0, 10)}.`
    );
  }

  // 3. Check if substitute teacher is already teaching their own class in that period
  const ownClassConflict = await tx.timetable.findFirst({
    where: {
      tenantId,
      staffProfileId: substituteStaffId,
      dayOfWeek: slot.dayOfWeek,
      periodNumber: slot.periodNumber,
      isBreak: false,
    },
    include: { class: true },
  });

  if (ownClassConflict) {
    throw new Error(
      `Substitute teacher is already scheduled to teach Class ${ownClassConflict.class.name} during Period ${slot.periodNumber}.`
    );
  }

  // 4. Check if substitute teacher has another substitution assignment in the same period on this date
  const existingSubAssignment = await tx.teacherSubstitution.findFirst({
    where: {
      tenantId,
      substituteStaffId,
      date: dateOnly,
      status: "SCHEDULED",
      timetableSlot: {
        dayOfWeek: slot.dayOfWeek,
        periodNumber: slot.periodNumber,
      },
    },
  });

  if (existingSubAssignment) {
    throw new Error(
      `Substitute teacher is already assigned to another substitution duty during Period ${slot.periodNumber} on this date.`
    );
  }

  // 5. Create or Update Substitution Record
  const substitution = await tx.teacherSubstitution.upsert({
    where: {
      tenantId_timetableSlotId_date: {
        tenantId,
        timetableSlotId: slot.id,
        date: dateOnly,
      },
    },
    create: {
      tenantId,
      academicYearId,
      timetableSlotId: slot.id,
      date: dateOnly,
      originalStaffId: slot.staffProfileId,
      substituteStaffId,
      status: "SCHEDULED",
      reason,
      assignedById,
      notes,
    },
    update: {
      substituteStaffId,
      status: "SCHEDULED",
      reason,
      assignedById,
      notes,
    },
  });

  return {
    substitutionId: substitution.id,
    timetableSlotId: substitution.timetableSlotId,
    date: dateOnly.toISOString().slice(0, 10),
    originalStaffId: substitution.originalStaffId,
    substituteStaffId: substitution.substituteStaffId,
    status: substitution.status,
    reason: substitution.reason ?? undefined,
  };
}

/**
 * 3. Fetches Date-Resolved Daily Schedule (Applying Live Substitutions)
 */
export async function getEffectiveDailySchedule(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    date: Date;
    classId?: string;
    sectionId?: string | null;
    staffProfileId?: string;
  }
) {
  const { tenantId, date, classId, sectionId, staffProfileId } = params;

  const daysOfWeek = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
  const dayOfWeek = daysOfWeek[date.getDay()];
  const dateOnly = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

  // Fetch Master Slots
  const slots = await tx.timetable.findMany({
    where: {
      tenantId,
      dayOfWeek,
      ...(classId ? { classId } : {}),
      ...(sectionId !== undefined ? { sectionId } : {}),
      ...(staffProfileId ? { staffProfileId } : {}),
    },
    include: {
      class: true,
      section: true,
      subject: true,
      staffProfile: true,
      substitutions: {
        where: {
          tenantId,
          date: dateOnly,
          status: "SCHEDULED",
        },
        include: {
          substituteStaff: true,
        },
      },
    },
    orderBy: { periodNumber: "asc" },
  });

  return slots.map((slot) => {
    const activeSub = slot.substitutions[0];
    const isSubstituted = !!activeSub;

    return {
      slotId: slot.id,
      dayOfWeek: slot.dayOfWeek,
      periodNumber: slot.periodNumber,
      startTime: slot.startTime,
      endTime: slot.endTime,
      className: slot.class.name,
      sectionName: slot.section?.name ?? null,
      subjectName: slot.subject?.name ?? "Break / Free",
      roomNumber: slot.roomNumber,
      isBreak: slot.isBreak,
      breakLabel: slot.breakLabel,
      teacherName: isSubstituted
        ? `${activeSub.substituteStaff.firstName} ${activeSub.substituteStaff.lastName} (Substitute)`
        : slot.staffProfile
        ? `${slot.staffProfile.firstName} ${slot.staffProfile.lastName}`
        : "Unassigned",
      isSubstituted,
      substituteDetails: isSubstituted
        ? {
            originalTeacher: `${slot.staffProfile?.firstName} ${slot.staffProfile?.lastName}`,
            substituteTeacher: `${activeSub.substituteStaff.firstName} ${activeSub.substituteStaff.lastName}`,
            reason: activeSub.reason,
          }
        : null,
    };
  });
}
