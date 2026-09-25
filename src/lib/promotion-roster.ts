import { prisma } from "@/lib/prisma";
import { attendanceRateFromCounts } from "@/lib/attendance-rate";
import { type PromotionCandidate, type SubjectResultInput } from "@/lib/promotion-engine";

/**
 * Roster and evidence loading for the promotion pipeline.
 *
 * Shared by the preview (GET /api/promotions/calculate) and the write
 * (POST /api/promotions/execute) so the two can never disagree about who is in
 * a cohort or what their results are. That agreement is the whole point: the
 * original defect was a preview that described one thing and a write that did
 * another.
 */

export interface CohortSeed {
  studentProfileId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  sectionId: string | null;
  groupId: string | null;
  /**
   * "session"  - placement came from the year-scoped enrollment row (authoritative)
   * "profile"  - no enrollment exists for that year, so the student's profile
   *              placement was used. Surfaced as a warning to the operator.
   */
  placementSource: "session" | "profile";
  /**
   * The fields a leaving certificate is composed from. Loaded here rather than
   * in a second pass so the cohort remains the single description of who is
   * being moved — the pre-flight gate reads the same rows the promotion writes.
   */
  demographics: {
    guardianName: string;
    guardianContact: string;
    dateOfBirth: Date | null;
    gender: string | null;
  };
}

export interface PromotionCohortEntry {
  seed: CohortSeed;
  candidate: PromotionCandidate;
}

export interface PromotionCohort {
  entries: PromotionCohortEntry[];
  /** studentProfileId -> display name, for error messages. */
  nameByStudent: Map<string, string>;
  legacyPlacementIds: string[];
}

export interface LoadCohortParams {
  tenantId: string;
  fromAcademicYearId: string;
  classId: string;
  className: string;
  classNumber: number;
}

/**
 * Resolve the cohort for a class within an academic year, plus the exam and
 * attendance evidence needed to judge each student.
 *
 * The year-scoped StudentAcademicSession is authoritative. Students with no
 * session for that year are included via their profile placement (so legacy
 * records are not silently dropped) but are flagged, because a profile
 * placement is "where they are now", not "where they were then".
 */
export async function loadPromotionCohort(
  params: LoadCohortParams
): Promise<PromotionCohort> {
  const { tenantId, fromAcademicYearId, classId, className, classNumber } = params;

  const [sessions, legacyProfiles] = await Promise.all([
    prisma.studentAcademicSession.findMany({
      where: {
        tenantId,
        academicYearId: fromAcademicYearId,
        classId,
        studentProfile: { status: "ACTIVE" },
      },
      select: {
        studentProfileId: true,
        rollNumber: true,
        sectionId: true,
        groupId: true,
        studentProfile: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            guardianName: true,
            guardianContact: true,
            dateOfBirth: true,
            gender: true,
          },
        },
      },
    }),
    prisma.studentProfile.findMany({
      where: {
        tenantId,
        classId,
        status: "ACTIVE",
        academicSessions: { none: { academicYearId: fromAcademicYearId } },
      },
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        rollNumber: true,
        sectionId: true,
        groupId: true,
        guardianName: true,
        guardianContact: true,
        dateOfBirth: true,
        gender: true,
      },
    }),
  ]);

  const seeds: CohortSeed[] = [
    ...sessions.map((session) => ({
      studentProfileId: session.studentProfileId,
      studentId: session.studentProfile.studentId,
      studentName: `${session.studentProfile.firstName} ${session.studentProfile.lastName}`.trim(),
      rollNumber: session.rollNumber,
      sectionId: session.sectionId,
      groupId: session.groupId,
      placementSource: "session" as const,
      demographics: {
        guardianName: session.studentProfile.guardianName,
        guardianContact: session.studentProfile.guardianContact,
        dateOfBirth: session.studentProfile.dateOfBirth,
        gender: session.studentProfile.gender,
      },
    })),
    ...legacyProfiles.map((profile) => ({
      studentProfileId: profile.id,
      studentId: profile.studentId,
      studentName: `${profile.firstName} ${profile.lastName}`.trim(),
      rollNumber: profile.rollNumber,
      sectionId: profile.sectionId,
      groupId: profile.groupId,
      placementSource: "profile" as const,
      demographics: {
        guardianName: profile.guardianName,
        guardianContact: profile.guardianContact,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
      },
    })),
  ];

  const nameByStudent = new Map(seeds.map((s) => [s.studentProfileId, s.studentName]));

  if (seeds.length === 0) {
    return { entries: [], nameByStudent, legacyPlacementIds: [] };
  }

  const studentIds = seeds.map((s) => s.studentProfileId);

  const [resultRows, attendanceRows] = await Promise.all([
    prisma.examResult.findMany({
      where: { tenantId, academicYearId: fromAcademicYearId, studentProfileId: { in: studentIds } },
      select: {
        studentProfileId: true,
        subjectId: true,
        percentage: true,
        status: true,
        grade: true,
        createdAt: true,
        subject: { select: { name: true } },
      },
    }),
    prisma.attendance.groupBy({
      by: ["studentProfileId", "status"],
      where: { tenantId, academicYearId: fromAcademicYearId, studentProfileId: { in: studentIds } },
      _count: { _all: true },
    }),
  ]);

  const resultsByStudent = new Map<string, SubjectResultInput[]>();
  for (const row of resultRows) {
    const list = resultsByStudent.get(row.studentProfileId) ?? [];
    list.push({
      subjectId: row.subjectId,
      subjectName: row.subject.name,
      percentage: row.percentage,
      status: row.status,
      grade: row.grade,
      createdAt: row.createdAt,
    });
    resultsByStudent.set(row.studentProfileId, list);
  }

  const attendanceCountsByStudent = new Map<string, Record<string, number>>();
  for (const row of attendanceRows) {
    if (!row.studentProfileId) continue;
    const counts = attendanceCountsByStudent.get(row.studentProfileId) ?? {};
    counts[row.status] = (counts[row.status] ?? 0) + row._count._all;
    attendanceCountsByStudent.set(row.studentProfileId, counts);
  }

  const entries: PromotionCohortEntry[] = seeds.map((seed) => {
    const attendance = attendanceRateFromCounts(
      attendanceCountsByStudent.get(seed.studentProfileId) ?? {}
    );

    return {
      seed,
      candidate: {
        studentProfileId: seed.studentProfileId,
        studentId: seed.studentId,
        studentName: seed.studentName,
        rollNumber: seed.rollNumber,
        fromClassId: classId,
        fromClassName: className,
        fromClassNumber: classNumber,
        examResults: resultsByStudent.get(seed.studentProfileId) ?? [],
        attendanceRate: attendance.rate,
        attendancePresentDays: attendance.presentDays,
        attendanceTotalDays: attendance.totalDays,
      },
    };
  });

  return {
    entries,
    nameByStudent,
    legacyPlacementIds: seeds
      .filter((s) => s.placementSource === "profile")
      .map((s) => s.studentProfileId),
  };
}
