// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Academic year lifecycle: date coercion, the `isCurrent` switch, and the audit
 * trail.
 *
 * Both write routes now run inside a transaction, so the assertions target the
 * transaction delegates. `tx` is a distinct object from `db` on purpose — that
 * is what exercises the audit logger's transactional branch rather than its
 * best-effort one.
 */

const db = vi.hoisted(() => ({
  academicYear: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  class: { findMany: vi.fn() },
  promotionRule: { findMany: vi.fn() },
  studentAcademicSession: { findMany: vi.fn() },
  studentProfile: { findMany: vi.fn() },
  classPromotion: { findMany: vi.fn() },
  examResult: { groupBy: vi.fn() },
  certificate: { findMany: vi.fn() },
  attendance: { groupBy: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));

const tx = vi.hoisted(() => ({
  academicYear: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  // Closing finalises the year inside the same transaction, so these live on
  // `tx` rather than on `db`.
  studentAcademicSession: { findMany: vi.fn(), update: vi.fn() },
  examResult: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));

vi.mock("@/lib/api-auth", () => ({
  requireApiAccess: vi.fn().mockResolvedValue({
    authContext: {
      tenantId: "mhs",
      user: { id: "user-1", email: "admin@mhs.test", role: "ADMIN" },
    },
  }),
}));

vi.mock("@/lib/data-integrity", () => ({
  getAcademicYearUsageCounts: vi.fn().mockResolvedValue({}),
  integrityViolation: vi.fn(),
  lockedUpdateMessage: vi.fn(),
  lockedDeleteMessage: vi.fn(),
  buildLockedFieldsDetails: vi.fn(),
}));

import { POST as createAcademicYearRoute } from "@/app/api/academic-years/route";
import {
  PUT as updateAcademicYearRoute,
  DELETE as deleteAcademicYearRoute,
} from "@/app/api/academic-years/[id]/route";
import { requireApiAccess } from "@/lib/api-auth";

/**
 * `requireApiAccess` can short-circuit, so each handler is inferred as
 * `NextResponse | undefined`. It never short-circuits in these tests, so pin the
 * signatures to what is actually exercised.
 */
const createAcademicYear = createAcademicYearRoute as unknown as (
  request: NextRequest
) => Promise<Response>;

const updateAcademicYear = updateAcademicYearRoute as unknown as (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;

const deleteAcademicYear = deleteAcademicYearRoute as unknown as (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;

const OPEN_YEAR = {
  id: "ay-2027",
  tenantId: "mhs",
  yearId: "ACADEMIC YEAR 2027",
  label: "2027-2028",
  startDate: new Date("2027-01-01T00:00:00.000Z"),
  endDate: new Date("2027-12-31T00:00:00.000Z"),
  isClosed: false,
  isCurrent: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function postRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/academic-years", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function putRequest(id: string, body: unknown) {
  return new NextRequest(`http://localhost:3000/api/academic-years/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const putParams = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (fn: any) => fn(tx));
  tx.academicYear.create.mockImplementation(async ({ data }: any) => ({
    ...OPEN_YEAR,
    ...data,
    isCurrent: data.isCurrent ?? false,
  }));
  tx.academicYear.update.mockImplementation(async ({ data }: any) => ({
    ...OPEN_YEAR,
    ...data,
  }));
  tx.academicYear.findFirst.mockResolvedValue(null);
  db.academicYear.findFirst.mockResolvedValue(null);
  db.academicYear.findUnique.mockResolvedValue(OPEN_YEAR);
  tx.auditLog.create.mockResolvedValue({ id: "audit-1" });

  // A close runs the pre-flight gate, which reads the year's cohort. Primed to
  // an empty, healthy year so that only the tests that care see a blocker.
  db.academicYear.findMany.mockResolvedValue([]);
  db.class.findMany.mockResolvedValue([]);
  db.promotionRule.findMany.mockResolvedValue([]);
  db.studentAcademicSession.findMany.mockResolvedValue([]);
  db.studentProfile.findMany.mockResolvedValue([]);
  db.classPromotion.findMany.mockResolvedValue([]);
  db.examResult.groupBy.mockResolvedValue([]);
  db.certificate.findMany.mockResolvedValue([]);
  db.attendance.groupBy.mockResolvedValue([]);
  // No attendance on file: an untracked school must never be handed a
  // defaulter list, so the attendance check stays silent by default here.
  db.attendance.groupBy.mockResolvedValue([]);

  // A close also finalises every session in the year. Primed to an empty year so
  // that only the tests that care about finalisation see any sessions.
  tx.studentAcademicSession.findMany.mockResolvedValue([]);
  tx.studentAcademicSession.update.mockResolvedValue({});
  tx.examResult.findMany.mockResolvedValue([]);
});

describe("POST /api/academic-years", () => {
  it("coerces string date inputs into native Date objects", async () => {
    const res = await createAcademicYear(
      postRequest({
        yearId: "ACADEMIC YEAR 2027",
        label: "2027-2028",
        startDate: "2027-01-01",
        endDate: "2027-12-31",
      })
    );

    expect(res.status).toBe(201);
    expect(tx.academicYear.create).toHaveBeenCalledTimes(1);
    const { data } = tx.academicYear.create.mock.calls[0][0];
    expect(data.startDate).toBeInstanceOf(Date);
    expect(data.endDate).toBeInstanceOf(Date);
    expect((data.startDate as Date).toISOString()).toContain("2027-01-01");
    expect((data.endDate as Date).toISOString()).toContain("2027-12-31");
  });

  it("rejects creation when startDate is after endDate", async () => {
    const res = await createAcademicYear(
      postRequest({
        yearId: "ACADEMIC YEAR 2027",
        label: "2027-2028",
        startDate: "2027-12-31",
        endDate: "2027-01-01",
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toBe("Invalid dates");
    expect(json.details[0].message).toContain("Start date must be before end date");
  });

  it("rejects creation when dates are invalid strings", async () => {
    const res = await createAcademicYear(
      postRequest({
        yearId: "ACADEMIC YEAR 2027",
        label: "2027-2028",
        startDate: "not-a-valid-date",
        endDate: "2027-12-31",
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toBe("Invalid start date");
  });

  it("makes the first year the current year", async () => {
    // No year is flagged current yet, so the new one becomes it — otherwise a
    // fresh tenant has years but no answer to "which year are we in".
    tx.academicYear.findFirst.mockResolvedValue(null);

    const res = await createAcademicYear(
      postRequest({
        yearId: "ACADEMIC YEAR 2027",
        label: "2027-2028",
        startDate: "2027-01-01",
        endDate: "2027-12-31",
      })
    );

    expect(res.status).toBe(201);
    expect(tx.academicYear.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isCurrent: true } })
    );
    const json = await res.json();
    expect(json.data.isCurrent).toBe(true);
  });

  it("does not displace the existing current year", async () => {
    tx.academicYear.findFirst.mockResolvedValue({ id: "ay-existing-current" });

    const res = await createAcademicYear(
      postRequest({
        yearId: "ACADEMIC YEAR 2028",
        label: "2028-2029",
        startDate: "2028-01-01",
        endDate: "2028-12-31",
      })
    );

    expect(res.status).toBe(201);
    expect(tx.academicYear.update).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.data.isCurrent).toBe(false);
  });

  it("records the creation in the same transaction as the year", async () => {
    await createAcademicYear(
      postRequest({
        yearId: "ACADEMIC YEAR 2027",
        label: "2027-2028",
        startDate: "2027-01-01",
        endDate: "2027-12-31",
      })
    );

    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    const { data } = tx.auditLog.create.mock.calls[0][0];
    expect(data).toMatchObject({
      tenantId: "mhs",
      userId: "user-1",
      userEmail: "admin@mhs.test",
      action: "CREATE",
      entity: "AcademicYear",
    });
  });
});

describe("PUT /api/academic-years/[id]", () => {
  it("coerces string date inputs into Date objects", async () => {
    const res = await updateAcademicYear(
      putRequest("ay-2027", {
        label: "2027-2028 Updated",
        startDate: "2027-02-01",
        endDate: "2027-11-30",
      }),
      putParams("ay-2027")
    );

    expect(res.status).toBe(200);
    expect(tx.academicYear.update).toHaveBeenCalledTimes(1);
    const { data } = tx.academicYear.update.mock.calls[0][0];
    expect(data.startDate).toBeInstanceOf(Date);
    expect(data.endDate).toBeInstanceOf(Date);
  });

  it("switches the current year and clears the flag from the one it displaces", async () => {
    tx.academicYear.findFirst.mockResolvedValue({ id: "ay-2026", label: "2026-2027" });

    const res = await updateAcademicYear(
      putRequest("ay-2027", { isCurrent: true }),
      putParams("ay-2027")
    );

    expect(res.status).toBe(200);

    // Cleared first, then set — the other order would briefly leave two
    // current years, which is the state the flag exists to prevent.
    expect(tx.academicYear.updateMany).toHaveBeenCalledWith({
      where: { tenantId: "mhs", isCurrent: true, id: { not: "ay-2027" } },
      data: { isCurrent: false },
    });
    expect(tx.academicYear.update).toHaveBeenCalledWith({
      where: { id: "ay-2027" },
      data: { isCurrent: true },
    });
  });

  it("audits a current-year switch as a rollover, naming the year it displaced", async () => {
    tx.academicYear.findFirst.mockResolvedValue({ id: "ay-2026", label: "2026-2027" });

    await updateAcademicYear(putRequest("ay-2027", { isCurrent: true }), putParams("ay-2027"));

    const { data } = tx.auditLog.create.mock.calls[0][0];
    expect(data.action).toBe("ROLLOVER");
    expect(data.details.displacedCurrentYear).toEqual({ id: "ay-2026", label: "2026-2027" });
  });

  it("retires the current flag when the year is closed", async () => {
    const res = await updateAcademicYear(
      putRequest("ay-2027", { isClosed: true }),
      putParams("ay-2027")
    );

    expect(res.status).toBe(200);
    expect(tx.academicYear.updateMany).toHaveBeenCalledWith({
      where: { tenantId: "mhs", id: "ay-2027", isCurrent: true },
      data: { isCurrent: false },
    });
    const { data } = tx.auditLog.create.mock.calls[0][0];
    expect(data.action).toBe("CLOSE");
  });

  it("audits a plain edit as an update", async () => {
    await updateAcademicYear(
      putRequest("ay-2027", { label: "2027-2028 Renamed" }),
      putParams("ay-2027")
    );

    const { data } = tx.auditLog.create.mock.calls[0][0];
    expect(data.action).toBe("UPDATE");
    expect(data.details.changedFields).toEqual(["label"]);
  });

  it("refuses a request that closes and makes current at once", async () => {
    const res = await updateAcademicYear(
      putRequest("ay-2027", { isClosed: true, isCurrent: true }),
      putParams("ay-2027")
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.details[0].code).toBe("CONFLICTING_FLAGS");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses any edit to an already-closed year", async () => {
    db.academicYear.findUnique.mockResolvedValue({ ...OPEN_YEAR, isClosed: true });

    await updateAcademicYear(
      putRequest("ay-2027", { isCurrent: true }),
      putParams("ay-2027")
    );

    // The closed-year guard returns before the transaction, so a closed year
    // can never be made current.
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

/**
 * Closing a year is the last moment at which "this cohort never crossed the
 * boundary" is still fixable. These tests assert that the close refuses when it
 * is not, using the same pure checks the read-only pre-flight route reports.
 */
describe("PUT /api/academic-years/[id] — close pre-flight gate", () => {
  const CLASS_1 = { id: "cls-1", name: "Class 1", classNumber: 1 };

  function sessionRow(overrides: Record<string, unknown> = {}) {
    return {
      studentProfileId: "stu-1",
      rollNumber: "1",
      classId: CLASS_1.id,
      class: { name: CLASS_1.name },
      studentProfile: {
        studentId: "S001",
        firstName: "Ali",
        lastName: "Khan",
        status: "ACTIVE",
        guardianName: "Karim Khan",
        guardianContact: "03001234567",
        dateOfBirth: new Date("2014-06-01"),
        gender: "MALE",
      },
      ...overrides,
    };
  }

  /** A year holding one student, with marks and a rule, but no rollover. */
  function primeYearWithOneStudent() {
    db.class.findMany.mockResolvedValue([CLASS_1]);
    db.promotionRule.findMany.mockResolvedValue([
      { classId: CLASS_1.id, nextClassId: null, isActive: true, minimumAttendance: 75 },
    ]);
    db.studentAcademicSession.findMany.mockResolvedValue([sessionRow()]);
    db.examResult.groupBy.mockResolvedValue([{ studentProfileId: "stu-1" }]);
  }

  it("blocks the close when a student in the year was never promoted", async () => {
    primeYearWithOneStudent();
    // No ClassPromotion row for the year: the cohort is still inside it.
    db.classPromotion.findMany.mockResolvedValue([]);

    const res = await updateAcademicYear(
      putRequest("ay-2027", { isClosed: true }),
      putParams("ay-2027")
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.details.map((d: any) => d.code)).toContain("UNPROMOTED_STUDENT");
    // Nothing may be written when the gate refuses.
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("blocks the close when a class holding students has no promotion rule", async () => {
    primeYearWithOneStudent();
    db.promotionRule.findMany.mockResolvedValue([]);
    // Give the student a rollover record so the only finding is the missing rule.
    db.classPromotion.findMany.mockResolvedValue([
      { studentProfileId: "stu-1", status: "PROMOTED" },
    ]);

    const res = await updateAcademicYear(
      putRequest("ay-2027", { isClosed: true }),
      putParams("ay-2027")
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.details.map((d: any) => d.code)).toContain("NO_PROMOTION_RULE");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  /**
   * Documents are routinely printed after the year is frozen, so an unissued
   * certificate must not hold the whole school's year open.
   */
  it("closes on a warning, leaving an unissued exit document to be printed later", async () => {
    primeYearWithOneStudent();
    db.classPromotion.findMany.mockResolvedValue([
      { studentProfileId: "stu-1", status: "GRADUATED" },
    ]);
    db.certificate.findMany.mockResolvedValue([]);

    const res = await updateAcademicYear(
      putRequest("ay-2027", { isClosed: true }),
      putParams("ay-2027")
    );

    expect(res.status).toBe(200);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    const { data } = tx.auditLog.create.mock.calls[0][0];
    expect(data.action).toBe("CLOSE");
  });

  it("blocks the close when two students share a roll number", async () => {
    primeYearWithOneStudent();
    db.studentAcademicSession.findMany.mockResolvedValue([
      sessionRow(),
      sessionRow({
        studentProfileId: "stu-2",
        studentProfile: {
          studentId: "S002",
          firstName: "Sara",
          lastName: "Khan",
          status: "ACTIVE",
          guardianName: "Karim Khan",
          guardianContact: "03001234567",
          dateOfBirth: new Date("2014-06-01"),
          gender: "FEMALE",
        },
      }),
    ]);
    db.examResult.groupBy.mockResolvedValue([
      { studentProfileId: "stu-1" },
      { studentProfileId: "stu-2" },
    ]);
    db.classPromotion.findMany.mockResolvedValue([
      { studentProfileId: "stu-1", status: "PROMOTED" },
      { studentProfileId: "stu-2", status: "PROMOTED" },
    ]);

    const res = await updateAcademicYear(
      putRequest("ay-2027", { isClosed: true }),
      putParams("ay-2027")
    );
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.details.map((d: any) => d.code)).toContain("DUPLICATE_ROLL_NUMBER");
  });

  it("does not run the gate for an ordinary edit", async () => {
    await updateAcademicYear(
      putRequest("ay-2027", { label: "Renamed" }),
      putParams("ay-2027")
    );

    expect(db.studentAcademicSession.findMany).not.toHaveBeenCalled();
  });
});

/**
 * Closing freezes the year.
 *
 * The snapshot is written inside the close transaction, so a close that cannot
 * finalise must not happen at all: there is no reopen path, which means a
 * half-closed year is not a state anyone can recover from.
 */
describe("PUT /api/academic-years/[id] — closing finalises the year", () => {
  const CLASS_1 = { id: "cls-1", name: "Class 1", classNumber: 1 };

  /** A year that passes the gate: one class, one student, rolled over, no debts. */
  function primeClosableYear() {
    db.class.findMany.mockResolvedValue([CLASS_1]);
    db.promotionRule.findMany.mockResolvedValue([
      { classId: CLASS_1.id, nextClassId: null, isActive: true, minimumAttendance: 75 },
    ]);
    db.studentAcademicSession.findMany.mockResolvedValue([
      {
        studentProfileId: "stu-1",
        rollNumber: "1",
        classId: CLASS_1.id,
        class: { name: CLASS_1.name },
        studentProfile: {
          studentId: "S001",
          firstName: "Ali",
          lastName: "Khan",
          status: "ACTIVE",
          guardianName: "Karim Khan",
          guardianContact: "03001234567",
          dateOfBirth: new Date("2014-06-01"),
          gender: "MALE",
        },
      },
    ]);
    db.examResult.groupBy.mockResolvedValue([{ studentProfileId: "stu-1" }]);
    db.classPromotion.findMany.mockResolvedValue([
      { studentProfileId: "stu-1", status: "GRADUATED" },
    ]);
    db.certificate.findMany.mockResolvedValue([]);
  }

  const SESSION = {
    id: "sess-1",
    studentProfileId: "stu-1",
    classId: CLASS_1.id,
    rollNumber: "1",
  };

  function examResultRow(overrides: Record<string, unknown> = {}) {
    return {
      studentProfileId: "stu-1",
      subjectId: "sub-1",
      examId: "exam-annual",
      percentage: 80,
      status: "PASS",
      grade: "A+",
      gradePoint: 5,
      maxMarks: 100,
      obtainedMarks: 80,
      createdAt: new Date("2027-11-01T00:00:00.000Z"),
      subject: { name: "Bangla" },
      ...overrides,
    };
  }

  function close() {
    return updateAcademicYear(
      putRequest("ay-2027", { isClosed: true }),
      putParams("ay-2027")
    );
  }

  it("writes the frozen figures onto every session in the year", async () => {
    primeClosableYear();
    tx.studentAcademicSession.findMany.mockResolvedValue([SESSION]);
    tx.examResult.findMany.mockResolvedValue([
      examResultRow({ subjectId: "sub-1", percentage: 80, gradePoint: 5 }),
      examResultRow({
        subjectId: "sub-2",
        subject: { name: "English" },
        percentage: 60,
        gradePoint: 4,
        maxMarks: 50,
        obtainedMarks: 30,
      }),
    ]);

    const res = await close();

    expect(res.status).toBe(200);
    expect(tx.studentAcademicSession.update).toHaveBeenCalledTimes(1);
    const { where, data } = tx.studentAcademicSession.update.mock.calls[0][0];
    expect(where).toEqual({ id: "sess-1" });
    expect(data.finalPercentage).toBe(70);
    expect(data.finalGpa).toBe(4.5);
    expect(data.totalMarks).toBe(150);
    expect(data.obtainedMarks).toBe(110);
    expect(data.snapshot).toMatchObject({
      academicYearId: "ay-2027",
      finalPercentage: 70,
      finalGpa: 4.5,
    });
  });

  it("returns the finalisation summary so the operator can see what was frozen", async () => {
    primeClosableYear();
    tx.studentAcademicSession.findMany.mockResolvedValue([SESSION]);
    tx.examResult.findMany.mockResolvedValue([examResultRow()]);

    const json = await (await close()).json();

    expect(json.data.finalisation).toMatchObject({
      sessions: 1,
      withResults: 1,
      withoutResults: 0,
      averagePercentage: 80,
    });
    expect(json.message).toContain("1 transcript(s) finalised");
  });

  /**
   * Zero is a real mark. Writing 0 for a student who was never examined would
   * invent a failing grade on a row that can never be corrected.
   */
  it("leaves a student with no results null, and says so in the response", async () => {
    primeClosableYear();
    tx.studentAcademicSession.findMany.mockResolvedValue([SESSION]);
    tx.examResult.findMany.mockResolvedValue([]);

    const json = await (await close()).json();

    const { data } = tx.studentAcademicSession.update.mock.calls[0][0];
    expect(data.finalPercentage).toBeNull();
    expect(data.finalGpa).toBeNull();

    expect(json.data.finalisation.withoutResults).toBe(1);
    expect(json.data.finalisation.withoutResultsSample).toEqual([
      { sessionId: "sess-1", studentProfileId: "stu-1", rollNumber: "1" },
    ]);
    expect(json.message).toContain("no results recorded");
  });

  it("records what was frozen on the audit entry", async () => {
    primeClosableYear();
    tx.studentAcademicSession.findMany.mockResolvedValue([SESSION]);
    tx.examResult.findMany.mockResolvedValue([examResultRow()]);

    await close();

    const { data } = tx.auditLog.create.mock.calls[0][0];
    expect(data.action).toBe("CLOSE");
    expect(data.details.finalisation).toMatchObject({
      sessions: 1,
      withResults: 1,
      withoutResults: 0,
      pages: 1,
    });
  });

  it("does not touch the year's sessions when the update is not a close", async () => {
    const res = await updateAcademicYear(
      putRequest("ay-2027", { label: "2027-2028 Renamed" }),
      putParams("ay-2027")
    );

    expect(res.status).toBe(200);
    expect(tx.studentAcademicSession.findMany).not.toHaveBeenCalled();
    expect(tx.studentAcademicSession.update).not.toHaveBeenCalled();
  });

  /**
   * A cap would be the pre-flight's house style, but a pre-flight cap costs a
   * finding while a finalisation cap costs a transcript — and nothing reopens a
   * closed year. So the work is paged, and only the *report* of who had no
   * results is bounded.
   */
  it("pages through a year larger than one page instead of capping it", async () => {
    primeClosableYear();

    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      id: `sess-${String(index).padStart(4, "0")}`,
      studentProfileId: `stu-${index}`,
      classId: CLASS_1.id,
      rollNumber: String(index),
    }));
    const secondPage = [
      { id: "sess-last", studentProfileId: "stu-last", classId: CLASS_1.id, rollNumber: "9999" },
    ];

    tx.studentAcademicSession.findMany
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);
    tx.examResult.findMany.mockResolvedValue([]);

    const json = await (await close()).json();

    expect(json.data.finalisation.sessions).toBe(501);
    expect(tx.studentAcademicSession.update).toHaveBeenCalledTimes(501);
    // Only the listing is bounded; the count is honest.
    expect(json.data.finalisation.withoutResults).toBe(501);
    expect(json.data.finalisation.withoutResultsSample).toHaveLength(50);
    expect(json.data.finalisation.withoutResultsTruncated).toBe(true);
  });
});

describe("DELETE /api/academic-years/[id]", () => {
  it("audits the deletion inside the transaction that performs it", async () => {
    const res = await deleteAcademicYear(
      new NextRequest("http://localhost:3000/api/academic-years/ay-2027", { method: "DELETE" }),
      putParams("ay-2027")
    );

    expect(res.status).toBe(200);
    expect(tx.academicYear.delete).toHaveBeenCalledWith({ where: { id: "ay-2027" } });
    const { data } = tx.auditLog.create.mock.calls[0][0];
    expect(data).toMatchObject({ action: "DELETE", entity: "AcademicYear", entityId: "ay-2027" });
  });
});

describe("year lifecycle RBAC", () => {
  /** Swap the role the route sees for the next call only. */
  function asRole(role: string) {
    vi.mocked(requireApiAccess).mockResolvedValueOnce({
      authContext: {
        tenantId: "mhs",
        user: { id: "user-1", email: "staff@mhs.test", role },
      },
    } as any);
  }

  it("refuses a year close for a role without the rollover capability", async () => {
    // An academic coordinator runs the timetable and exams. Freezing a whole
    // year of records is not that job.
    asRole("ACADEMIC_COORDINATOR");

    const res = await updateAcademicYear(
      putRequest("ay-2027", { isClosed: true }),
      putParams("ay-2027")
    );

    expect(res.status).toBe(403);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses an operating-year switch for a role without the rollover capability", async () => {
    asRole("ACADEMIC_COORDINATOR");

    const res = await updateAcademicYear(
      putRequest("ay-2027", { isCurrent: true }),
      putParams("ay-2027")
    );

    expect(res.status).toBe(403);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("still allows an ordinary edit for the same role", async () => {
    // The capability gates the lifecycle flags, not the whole resource.
    asRole("ACADEMIC_COORDINATOR");

    const res = await updateAcademicYear(
      putRequest("ay-2027", { label: "2027-2028 Renamed" }),
      putParams("ay-2027")
    );

    expect(res.status).toBe(200);
  });

  it("allows an administrator to close a year", async () => {
    asRole("ADMIN");

    const res = await updateAcademicYear(
      putRequest("ay-2027", { isClosed: true }),
      putParams("ay-2027")
    );

    expect(res.status).toBe(200);
  });

  it("refuses to delete a year without the rollover capability", async () => {
    asRole("ACADEMIC_COORDINATOR");

    const res = await deleteAcademicYear(
      new NextRequest("http://localhost:3000/api/academic-years/ay-2027", { method: "DELETE" }),
      putParams("ay-2027")
    );

    expect(res.status).toBe(403);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
