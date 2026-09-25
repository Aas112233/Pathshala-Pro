import { Prisma } from "@prisma/client";
import {
  accumulateFinalisation,
  emptyFinalisationTotals,
  finalisationTotalsSummary,
  finaliseSessionResults,
  type FinalisationSessionRow,
  type FinalisationSummary,
} from "@/lib/academic-year-finalisation";

/**
 * Loading and persistence for the year-close snapshot.
 *
 * Split from `academic-year-finalisation.ts` for the same reason
 * `rollover-preflight-roster.ts` is split from `rollover-preflight.ts`: the
 * arithmetic stays provably database-free, so its tests need no database and a
 * query change cannot quietly weaken its guarantees.
 *
 * There is deliberately **no cap** on how many sessions are finalised. The year
 * close has no inverse — nothing in this codebase reopens a closed year — so a
 * student skipped by a limit would be skipped permanently, and would never get
 * a final percentage or GPA. The pre-flight scan caps at 5,000 and reports
 * `truncated` because it is a read-only diagnostic; truncation there costs a
 * finding, here it would cost a transcript. Instead the work is paged, which
 * bounds memory without dropping anyone.
 */

/** Sessions read and written per page. */
export const FINALISATION_PAGE_SIZE = 500;

/**
 * Session updates issued concurrently. The close runs inside one interactive
 * transaction, so these share a single connection; batching them cuts round-trip
 * latency without asking the pool for connections it does not have.
 */
const WRITE_CONCURRENCY = 25;

export type FinalisationClient = Pick<
  Prisma.TransactionClient,
  "studentAcademicSession" | "examResult"
>;

export interface FinalisationOutcome extends FinalisationSummary {
  /** Pages read and written. 1 for any ordinary school. */
  pages: number;
}

/**
 * Freeze the year's results onto every session in it.
 *
 * Must be called inside the close transaction. Doing it beforehand would open a
 * window in which a year is open but already carries finals computed from
 * results that are still editable; doing it afterwards would allow a year to be
 * closed with no snapshot at all, and there is no way back from that.
 */
export async function finaliseAcademicYearSessions(
  client: FinalisationClient,
  params: { tenantId: string; academicYearId: string; finalisedAt?: Date }
): Promise<FinalisationOutcome> {
  const { tenantId, academicYearId } = params;
  const finalisedAt = (params.finalisedAt ?? new Date()).toISOString();

  let totals = emptyFinalisationTotals();
  let pages = 0;
  let cursor: string | undefined;

  for (;;) {
    const sessions = await client.studentAcademicSession.findMany({
      where: { tenantId, academicYearId },
      // Cursor paging on `id` is stable here: finalisation writes the snapshot
      // columns and never the primary key, so the window cannot shift beneath
      // us the way `skip`/`take` would if rows were added mid-run.
      orderBy: { id: "asc" },
      take: FINALISATION_PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, studentProfileId: true, classId: true, rollNumber: true },
    });

    if (sessions.length === 0) break;

    pages += 1;
    cursor = sessions[sessions.length - 1].id;

    const sessionRows: FinalisationSessionRow[] = sessions.map((session) => ({
      sessionId: session.id,
      studentProfileId: session.studentProfileId,
      classId: session.classId,
      rollNumber: session.rollNumber,
    }));

    // Every result the student has in this year, with no exam filter, because
    // `decidePromotion` reads the same unfiltered set. A subject examined twice
    // resolves to its latest sitting inside the pure module.
    const results = await client.examResult.findMany({
      where: {
        tenantId,
        academicYearId,
        studentProfileId: { in: sessionRows.map((row) => row.studentProfileId) },
      },
      select: {
        studentProfileId: true,
        subjectId: true,
        examId: true,
        percentage: true,
        status: true,
        grade: true,
        gradePoint: true,
        maxMarks: true,
        obtainedMarks: true,
        createdAt: true,
        subject: { select: { name: true } },
      },
    });

    const report = finaliseSessionResults({
      academicYearId,
      finalisedAt,
      sessions: sessionRows,
      results: results.map((row) => ({
        studentProfileId: row.studentProfileId,
        subjectId: row.subjectId,
        subjectName: row.subject.name,
        examId: row.examId,
        percentage: row.percentage,
        status: row.status,
        grade: row.grade,
        gradePoint: row.gradePoint,
        maxMarks: row.maxMarks,
        obtainedMarks: row.obtainedMarks,
        createdAt: row.createdAt,
      })),
    });

    await writeFinalisedSessions(client, report.sessions);
    totals = accumulateFinalisation(totals, report);

    if (sessions.length < FINALISATION_PAGE_SIZE) break;
  }

  return { ...finalisationTotalsSummary(totals), pages };
}

/**
 * Persist the snapshot. A session with no results is written as nulls rather
 * than skipped, so the row records "this student finished the year with nothing
 * on file" — which is a fact worth keeping — instead of being indistinguishable
 * from a row the close never reached.
 */
async function writeFinalisedSessions(
  client: FinalisationClient,
  sessions: Array<{
    sessionId: string;
    finalGpa: number | null;
    finalPercentage: number | null;
    totalMarks: number;
    obtainedMarks: number;
    snapshot: unknown;
  }>
): Promise<void> {
  for (let index = 0; index < sessions.length; index += WRITE_CONCURRENCY) {
    const chunk = sessions.slice(index, index + WRITE_CONCURRENCY);

    await Promise.all(
      chunk.map((session) =>
        client.studentAcademicSession.update({
          where: { id: session.sessionId },
          data: {
            finalGpa: session.finalGpa,
            finalPercentage: session.finalPercentage,
            totalMarks: session.totalMarks,
            obtainedMarks: session.obtainedMarks,
            // `DbNull` writes a real SQL NULL. Plain `null` is rejected by the
            // client for a Json column, and `JsonNull` would store the JSON
            // literal `null` — a snapshot that claims to exist and be empty.
            snapshot:
              session.snapshot === null
                ? Prisma.DbNull
                : (session.snapshot as Prisma.InputJsonValue),
          },
        })
      )
    );
  }
}
