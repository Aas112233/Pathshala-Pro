import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createExamResultNewSchema } from "@/lib/schemas";
import { gradeExamResult } from "@/lib/exam-grading";

export type ExamResultRowInput = z.infer<typeof createExamResultNewSchema>;

export interface ExamResultRowError {
  field?: string;
  code: string;
  message: string;
}

export interface ValidatedExamResultRow {
  studentProfileId: string;
  academicYearId: string;
  examId: string;
  subjectId: string;
  maxMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade: string;
  gradePoint: number;
  status: string;
  reExamAllowed: boolean;
  /** Only set for mode "upsert": id of the existing row to update. */
  existingResultId?: string;
  /**
   * Raw submitted marks when the grader clamped them into [0, maxMarks]
   * (reachable only via a payload maxMarks above the mapping's). Null when
   * nothing was clamped — the audit column, not a display field.
   */
  originalObtained?: number | null;
}

/**
 * Structural client shared by `prisma` and any interactive transaction, so
 * batch validation can run inside the same transaction that writes.
 */
type ResultDbClient = Pick<
  typeof prisma,
  "exam" | "examSubject" | "examResult" | "studentProfile" | "classPromotion" | "academicYear"
>;

/**
 * Validate a batch of exam-result rows against tenant data and derive the
 * server-authoritative grade for every row.
 *
 * Enforced invariants (server-first — the client is never trusted):
 *  1. exam / student / academic year exist and belong to this tenant
 *  2. the exam's own academic year matches the row's academic year
 *  3. the academic year is not closed for writes
 *  4. the parent exam is not published (marks become read-only on publish)
 *  5. the student has not been promoted out of the academic year
 *  6. mode "create": no existing result for (student, exam, subject)
 *     mode "upsert": existing rows are updated, but locked rows are rejected
 *  7. the subject actually belongs to the exam (ExamSubject mapping)
 *  8. maxMarks come from the ExamSubject mapping — never from the payload
 *  9. grade math is derived via `gradeExamResult` (single source of truth)
 *
 * All reads go through the passed client, so callers can validate and write
 * inside ONE transaction and get all-or-nothing batch semantics.
 */
export async function validateExamResultBatch(
  db: ResultDbClient,
  tenantId: string,
  rows: ExamResultRowInput[],
  mode: "create" | "upsert"
): Promise<{ validRows: ValidatedExamResultRow[]; errors: ExamResultRowError[] }> {
  const errors: ExamResultRowError[] = [];
  const validRows: ValidatedExamResultRow[] = [];
  if (rows.length === 0) return { validRows, errors };

  const examIds = [...new Set(rows.map((r) => r.examId))];
  const studentIds = [...new Set(rows.map((r) => r.studentProfileId))];
  const subjectIds = [...new Set(rows.map((r) => r.subjectId))];
  const academicYearIds = [...new Set(rows.map((r) => r.academicYearId))];

  // Batch-load everything in six queries total (no per-row N+1).
  const [exams, students, examSubjects, promoted, academicYears, existingResults] =
    await Promise.all([
      db.exam.findMany({
        where: { tenantId, id: { in: examIds } },
        select: { id: true, academicYearId: true, isPublished: true },
      }),
      db.studentProfile.findMany({
        where: { tenantId, id: { in: studentIds } },
        select: { id: true },
      }),
      db.examSubject.findMany({
        where: { tenantId, examId: { in: examIds }, subjectId: { in: subjectIds } },
        select: { examId: true, subjectId: true, maxMarks: true, passMarks: true },
      }),
      db.classPromotion.findMany({
        where: {
          tenantId,
          status: "PROMOTED",
          OR: rows.map((r) => ({
            studentProfileId: r.studentProfileId,
            fromAcademicYearId: r.academicYearId,
          })),
        },
        select: { studentProfileId: true, fromAcademicYearId: true },
      }),
      db.academicYear.findMany({
        where: { tenantId, id: { in: academicYearIds } },
        select: { id: true, isClosed: true },
      }),
      db.examResult.findMany({
        where: {
          tenantId,
          OR: rows.map((r) => ({
            studentProfileId: r.studentProfileId,
            examId: r.examId,
            subjectId: r.subjectId,
          })),
        },
        select: {
          id: true,
          studentProfileId: true,
          examId: true,
          subjectId: true,
          isLocked: true,
        },
      }),
    ]);

  const examMap = new Map(exams.map((e) => [e.id, e]));
  const studentIdSet = new Set(students.map((s) => s.id));
  const examSubjectMap = new Map(
    examSubjects.map((es) => [`${es.examId}:${es.subjectId}`, es])
  );
  const promotedKeys = new Set(
    promoted.map((p) => `${p.studentProfileId}:${p.fromAcademicYearId}`)
  );
  const knownYearIds = new Set(academicYears.map((y) => y.id));
  const closedYearIds = new Set(
    academicYears.filter((y) => y.isClosed).map((y) => y.id)
  );
  const existingMap = new Map(
    existingResults.map((r) => [
      `${r.studentProfileId}:${r.examId}:${r.subjectId}`,
      r,
    ])
  );

  // Reject the same (student, exam, subject) appearing twice in one payload —
  // the second row would collide with the first on the unique constraint.
  const seenRowKeys = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const reject = (field: string, code: string, message: string) => {
      errors.push({ field: `results[${index}].${field}`, code, message });
    };

    const exam = examMap.get(row.examId);
    if (!exam) {
      reject("examId", "not_found", "Exam not found");
      continue;
    }

    if (!studentIdSet.has(row.studentProfileId)) {
      reject("studentProfileId", "not_found", "Student not found");
      continue;
    }

    if (!knownYearIds.has(row.academicYearId)) {
      reject("academicYearId", "not_found", "Academic year not found");
      continue;
    }
    if (exam.academicYearId !== row.academicYearId) {
      reject(
        "academicYearId",
        "year_mismatch",
        "Exam and result must belong to the same academic year"
      );
      continue;
    }
    if (closedYearIds.has(row.academicYearId)) {
      reject(
        "academicYearId",
        "ACADEMIC_YEAR_CLOSED",
        "Mutations are not allowed for a closed academic year."
      );
      continue;
    }

    if (exam.isPublished) {
      reject(
        "examId",
        "locked",
        "This exam has been published and its marks are read-only. Use the controlled correction workflow instead of direct edits."
      );
      continue;
    }

    if (promotedKeys.has(`${row.studentProfileId}:${row.academicYearId}`)) {
      reject(
        "studentProfileId",
        "locked",
        mode === "create"
          ? "Cannot enter marks. Student has been promoted and exam results are locked."
          : "Cannot modify marks. Student has been promoted and exam results are locked."
      );
      continue;
    }

    const rowKey = `${row.studentProfileId}:${row.examId}:${row.subjectId}`;
    const existing = existingMap.get(rowKey);

    if (mode === "create" && existing) {
      reject(
        "examId",
        "duplicate",
        "Result already exists for this student, exam, and subject combination"
      );
      continue;
    }
    if (mode === "upsert" && existing?.isLocked) {
      reject(
        "studentProfileId",
        "locked",
        "Cannot modify marks. Student has been promoted and exam results are locked."
      );
      continue;
    }
    if (seenRowKeys.has(rowKey)) {
      reject(
        "examId",
        "duplicate",
        "Duplicate entry for the same student, exam, and subject in this request"
      );
      continue;
    }
    seenRowKeys.add(rowKey);

    const examSubject = examSubjectMap.get(`${row.examId}:${row.subjectId}`);
    if (!examSubject) {
      reject("subjectId", "not_found", "Subject is not part of this exam");
      continue;
    }

    // Server-authoritative marks ceiling — the payload's maxMarks is ignored.
    const obtainedMarks = row.absent ? 0 : row.obtainedMarks;
    const graded = gradeExamResult({
      obtainedMarks,
      maxMarks: examSubject.maxMarks,
      passMarks: examSubject.passMarks,
      status: row.absent ? "ABSENT" : null,
    });
    // Clamp audit: the API boundary already caps obtainedMarks at the
    // payload's maxMarks, so the grader only clamps when the payload's
    // maxMarks exceeds the mapping's. Persist the raw figure then.
    const clampedMarks = Math.min(Math.max(obtainedMarks, 0), examSubject.maxMarks);

    validRows.push({
      studentProfileId: row.studentProfileId,
      academicYearId: row.academicYearId,
      examId: row.examId,
      subjectId: row.subjectId,
      maxMarks: examSubject.maxMarks,
      // Persist the clamped figure (what counts) and keep the raw submit in
      // originalObtained — never the reverse.
      obtainedMarks: clampedMarks,
      originalObtained: clampedMarks !== obtainedMarks ? obtainedMarks : null,
      percentage: graded.percentage,
      grade: graded.grade,
      gradePoint: graded.gradePoint,
      status: graded.status,
      reExamAllowed: !row.absent && row.reExamAllowed && graded.status === "FAIL",
      existingResultId: existing?.id,
    });
  }

  return { validRows, errors };
}