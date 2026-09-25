// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The closed-year write boundary.
 *
 * A closed year is read-only. Four write paths were reaching past that boundary
 * and creating or moving year-scoped records inside a frozen year — a state that
 * cannot be repaired, because nothing reopens a closed year. Six more were found
 * later, across three year-scoped models: `AcademicHoliday`, `ClassFeeStructure`
 * and `PromotionRule`.
 *
 * The subtlety these tests exist to pin down is what is *not* blocked. A
 * `StudentProfile` is "where this student is now" and belongs to no single year,
 * so correcting a guardian's phone number must keep working while a closed year
 * is selected. Only the year-scoped placement row is protected. A guard that
 * refused the whole request would make every student in the school uneditable
 * for as long as history is open in the year switcher.
 */

const db = vi.hoisted(() => ({
  studentProfile: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  studentAcademicSession: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  class: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  section: { findFirst: vi.fn() },
  group: { findFirst: vi.fn() },
  subject: { findFirst: vi.fn() },
  staffProfile: { findFirst: vi.fn() },
  timetable: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  academicYear: { findFirst: vi.fn(), findMany: vi.fn() },
  academicHoliday: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  classFeeStructure: { findFirst: vi.fn(), upsert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  promotionRule: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  classPromotion: { count: vi.fn() },
  feeVoucher: { count: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));

vi.mock("@/lib/api-auth", () => ({
  requireApiAccess: vi.fn().mockResolvedValue({
    authContext: {
      tenantId: "mhs",
      user: { id: "user-1", email: "admin@mhs.test", role: "ADMIN" },
    },
  }),
  isTenantOwned: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/upload-security", () => ({
  verifyInternalFileUrl: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/data-integrity", () => ({
  getStudentUsageCounts: vi.fn().mockResolvedValue({}),
  getLockedStudentPlacementFields: vi.fn().mockReturnValue([]),
  buildLockedFieldsDetails: vi.fn(),
  integrityViolation: vi.fn(),
  lockedUpdateMessage: vi.fn(),
  lockedDeleteMessage: vi.fn(),
}));

vi.mock("@/lib/fast-memory-cache", () => ({
  fastCache: { invalidatePrefix: vi.fn(), get: vi.fn(), set: vi.fn() },
}));

import { POST as createStudentRoute } from "@/app/api/students/route";
import { PUT as updateStudentRoute } from "@/app/api/students/[id]/route";
import { POST as createTimetableRoute } from "@/app/api/timetables/route";
import {
  PUT as updateTimetableRoute,
  DELETE as deleteTimetableRoute,
} from "@/app/api/timetables/[id]/route";
import { POST as createHolidayRoute } from "@/app/api/holidays/route";
import {
  PUT as updateHolidayRoute,
  DELETE as deleteHolidayRoute,
} from "@/app/api/holidays/[id]/route";
import { POST as createPromotionRuleRoute } from "@/app/api/promotion-rules/route";
import {
  PUT as updatePromotionRuleRoute,
  DELETE as deletePromotionRuleRoute,
} from "@/app/api/promotion-rules/[id]/route";
import { POST as createFeeStructureRoute } from "@/app/api/fees/structures/route";
import {
  PUT as updateFeeStructureRoute,
  DELETE as deleteFeeStructureRoute,
} from "@/app/api/fees/structures/[id]/route";

const createStudent = createStudentRoute as unknown as (request: NextRequest) => Promise<Response>;
const updateStudent = updateStudentRoute as unknown as (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;
const createTimetable = createTimetableRoute as unknown as (request: NextRequest) => Promise<Response>;
const updateTimetable = updateTimetableRoute as unknown as (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;
const deleteTimetable = deleteTimetableRoute as unknown as (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;
const createHoliday = createHolidayRoute as unknown as (request: NextRequest) => Promise<Response>;
const updateHoliday = updateHolidayRoute as unknown as (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;
const deleteHoliday = deleteHolidayRoute as unknown as (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;
const createPromotionRule = createPromotionRuleRoute as unknown as (request: NextRequest) => Promise<Response>;
const updatePromotionRule = updatePromotionRuleRoute as unknown as (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;
const deletePromotionRule = deletePromotionRuleRoute as unknown as (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;
const createFeeStructure = createFeeStructureRoute as unknown as (request: NextRequest) => Promise<Response>;
const updateFeeStructure = updateFeeStructureRoute as unknown as (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;
const deleteFeeStructure = deleteFeeStructureRoute as unknown as (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;

const CLOSED_YEAR = {
  id: "ay-closed",
  tenantId: "mhs",
  yearId: "AY-2027",
  label: "2027-2028",
  isClosed: true,
};

const OPEN_YEAR = { ...CLOSED_YEAR, id: "ay-open", yearId: "AY-2028", label: "2028-2029", isClosed: false };

const idParams = (id: string) => ({ params: Promise.resolve({ id }) });

/**
 * Asserts the refusal came from the year guard, not from something else in the
 * route that happens to answer 409. A test that only checks the status would
 * still pass if the guard were deleted and an unrelated conflict fired.
 */
async function expectClosedYearRefusal(res: Response) {
  expect(res.status).toBe(409);
  const json = await res.json();
  expect(json.message).toContain("closed and read-only");
  expect(json.details).toContainEqual(
    expect.objectContaining({ code: "ACADEMIC_YEAR_CLOSED" })
  );
}

function jsonRequest(url: string, method: string, body: unknown) {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * `assertAcademicYearOpen` resolves the year through the shared guard, so the
 * mock answers by id rather than by call order. The fee-structure routes resolve
 * the year themselves first and accept either an internal id or a `yearId` code,
 * so the `OR` form has to answer too.
 */
function primeYears(...years: Array<typeof CLOSED_YEAR>) {
  db.academicYear.findFirst.mockImplementation(async ({ where }: any) => {
    if (where.id) return years.find((year) => year.id === where.id) ?? null;
    const clauses: any[] = where.OR ?? [];
    return (
      years.find((year) =>
        clauses.some((clause) => clause.id === year.id || clause.yearId === year.yearId)
      ) ?? null
    );
  });
  db.academicYear.findMany.mockImplementation(async ({ where }: any) => {
    const ids: string[] = where.id?.in ?? [];
    return years.filter((year) => ids.includes(year.id));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (arg: any) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(db)
  );

  db.studentProfile.create.mockImplementation(async ({ data }: any) => ({
    id: "stu-new",
    ...data,
    class: { id: "cls-1", name: "Class 1", classNumber: 1 },
    group: null,
    section: null,
  }));
  db.studentProfile.update.mockImplementation(async ({ data }: any) => ({
    id: "stu-1",
    classId: "cls-1",
    sectionId: null,
    groupId: null,
    rollNumber: "1",
    ...data,
  }));
  db.class.findFirst.mockResolvedValue({ id: "cls-1", classNumber: 1 });
  db.section.findFirst.mockResolvedValue({ id: "sec-1" });
  db.group.findFirst.mockResolvedValue({ id: "grp-1" });
  db.timetable.create.mockResolvedValue({ id: "tt-1" });
  db.timetable.update.mockResolvedValue({ id: "tt-1" });
  db.timetable.delete.mockResolvedValue({ id: "tt-1" });
});

describe("POST /api/students — closed-year guard", () => {
  const BODY = {
    firstName: "Ali",
    lastName: "Khan",
    dateOfBirth: "2014-06-01",
    guardianName: "Karim Khan",
    guardianContact: "03001234567",
    classId: "cls-1",
    rollNumber: "1",
  };

  it("refuses to place a new student into a closed year", async () => {
    primeYears(CLOSED_YEAR);

    const res = await createStudent(
      jsonRequest("http://localhost:3000/api/students?academicYearId=ay-closed", "POST", BODY)
    );

    await expectClosedYearRefusal(res);
    // The refusal happens before the transaction, so no profile is left behind
    // with no placement in it.
    expect(db.studentProfile.create).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("admits the same student into an open year", async () => {
    primeYears(OPEN_YEAR);

    const res = await createStudent(
      jsonRequest("http://localhost:3000/api/students?academicYearId=ay-open", "POST", BODY)
    );

    expect(res.status).toBe(201);
    expect(db.studentProfile.create).toHaveBeenCalledTimes(1);
  });
});

describe("PUT /api/students/[id] — closed-year guard", () => {
  function primeExistingStudent(overrides: Record<string, unknown> = {}) {
    db.studentProfile.findUnique.mockResolvedValue({
      id: "stu-1",
      tenantId: "mhs",
      studentId: "S001",
      classId: "cls-1",
      sectionId: null,
      groupId: null,
      rollNumber: "1",
      ...overrides,
    });
  }

  it("refuses to move a student inside a closed year", async () => {
    primeExistingStudent();
    primeYears(CLOSED_YEAR);

    const res = await updateStudent(
      jsonRequest("http://localhost:3000/api/students/stu-1?academicYearId=ay-closed", "PUT", {
        classId: "cls-2",
      }),
      idParams("stu-1")
    );

    await expectClosedYearRefusal(res);
    // Refused before the profile write, so the caller is not left with a
    // half-applied edit to reason about.
    expect(db.studentProfile.update).not.toHaveBeenCalled();
    expect(db.studentAcademicSession.update).not.toHaveBeenCalled();
    expect(db.studentAcademicSession.create).not.toHaveBeenCalled();
  });

  /**
   * The other half of the boundary. A profile is not year-scoped, so a closed
   * year in the switcher must not make the school's students uneditable.
   */
  it("still allows a profile-only edit while a closed year is selected", async () => {
    primeExistingStudent({ classId: null });
    primeYears(CLOSED_YEAR);

    const res = await updateStudent(
      jsonRequest("http://localhost:3000/api/students/stu-1?academicYearId=ay-closed", "PUT", {
        guardianContact: "03009999999",
      }),
      idParams("stu-1")
    );

    expect(res.status).toBe(200);
    expect(db.studentProfile.update).toHaveBeenCalledTimes(1);
    // No placement was touched, so no session write should have been attempted.
    expect(db.studentAcademicSession.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/timetables — closed-year guard", () => {
  const entry = (academicYearId: string) => ({
    academicYearId,
    classId: "cls-1",
    dayOfWeek: "MONDAY",
    periodNumber: 1,
    startTime: "09:00",
    endTime: "09:45",
    isBreak: true,
  });

  it("refuses a single entry targeting a closed year", async () => {
    primeYears(CLOSED_YEAR);

    const res = await createTimetable(
      jsonRequest("http://localhost:3000/api/timetables", "POST", entry("ay-closed"))
    );

    await expectClosedYearRefusal(res);
    expect(db.timetable.create).not.toHaveBeenCalled();
  });

  /**
   * A batch is refused whole. Half-writing a timetable across an open and a
   * closed year would leave the closed year's timetable partially edited, which
   * is worse than refusing everything and letting the operator fix the year.
   */
  it("refuses a whole batch when any one of its years is closed", async () => {
    primeYears(OPEN_YEAR, CLOSED_YEAR);

    const res = await createTimetable(
      jsonRequest("http://localhost:3000/api/timetables", "POST", {
        entries: [entry("ay-open"), entry("ay-closed")],
      })
    );

    await expectClosedYearRefusal(res);
    expect(db.timetable.create).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("allows a batch whose years are all open", async () => {
    primeYears(OPEN_YEAR);

    const res = await createTimetable(
      jsonRequest("http://localhost:3000/api/timetables", "POST", {
        entries: [entry("ay-open")],
      })
    );

    expect(res.status).toBe(201);
    expect(db.timetable.create).toHaveBeenCalledTimes(1);
  });
});

describe("PUT and DELETE /api/timetables/[id] — closed-year guard", () => {
  /**
   * The entry's year governs the write whether or not the request is the one
   * changing it: editing the room of a slot in a closed year is still an edit to
   * a closed year.
   */
  it("refuses to edit an entry that belongs to a closed year", async () => {
    db.timetable.findFirst.mockResolvedValue({ id: "tt-1", academicYearId: "ay-closed" });
    primeYears(CLOSED_YEAR);

    const res = await updateTimetable(
      jsonRequest("http://localhost:3000/api/timetables/tt-1", "PUT", { roomNumber: "12" }),
      idParams("tt-1")
    );

    await expectClosedYearRefusal(res);
    expect(db.timetable.update).not.toHaveBeenCalled();
  });

  it("refuses to delete an entry that belongs to a closed year", async () => {
    db.timetable.findFirst.mockResolvedValue({ id: "tt-1", academicYearId: "ay-closed" });
    primeYears(CLOSED_YEAR);

    const res = await deleteTimetable(
      new NextRequest("http://localhost:3000/api/timetables/tt-1", { method: "DELETE" }),
      idParams("tt-1")
    );

    await expectClosedYearRefusal(res);
    expect(db.timetable.delete).not.toHaveBeenCalled();
  });

  it("allows deleting an entry in an open year", async () => {
    db.timetable.findFirst.mockResolvedValue({ id: "tt-1", academicYearId: "ay-open" });
    primeYears(OPEN_YEAR);

    const res = await deleteTimetable(
      new NextRequest("http://localhost:3000/api/timetables/tt-1", { method: "DELETE" }),
      idParams("tt-1")
    );

    expect(res.status).toBe(200);
    expect(db.timetable.delete).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/holidays — closed-year guard", () => {
  const BODY = {
    academicYearId: "ay-closed",
    title: "Eid Holiday",
    startDate: "2027-06-01",
    endDate: "2027-06-05",
  };

  it("refuses a holiday added to a closed year", async () => {
    primeYears(CLOSED_YEAR);

    const res = await createHoliday(
      jsonRequest("http://localhost:3000/api/holidays", "POST", BODY)
    );

    await expectClosedYearRefusal(res);
    expect(db.academicHoliday.create).not.toHaveBeenCalled();
  });

  it("allows a holiday in an open year", async () => {
    primeYears(OPEN_YEAR);

    const res = await createHoliday(
      jsonRequest("http://localhost:3000/api/holidays", "POST", {
        ...BODY,
        academicYearId: "ay-open",
      })
    );

    expect(res.status).toBe(201);
    expect(db.academicHoliday.create).toHaveBeenCalledTimes(1);
  });
});

describe("PUT and DELETE /api/holidays/[id] — closed-year guard", () => {
  it("refuses to edit a holiday belonging to a closed year", async () => {
    db.academicHoliday.findFirst.mockResolvedValue({
      id: "hol-1",
      academicYearId: "ay-closed",
      startDate: new Date("2027-06-01"),
      endDate: new Date("2027-06-05"),
    });
    primeYears(CLOSED_YEAR);

    const res = await updateHoliday(
      jsonRequest("http://localhost:3000/api/holidays/hol-1", "PUT", { title: "Moved" }),
      idParams("hol-1")
    );

    await expectClosedYearRefusal(res);
    expect(db.academicHoliday.update).not.toHaveBeenCalled();
  });

  it("refuses to delete a holiday belonging to a closed year", async () => {
    db.academicHoliday.findFirst.mockResolvedValue({
      id: "hol-1",
      academicYearId: "ay-closed",
      startDate: new Date("2027-06-01"),
      endDate: new Date("2027-06-05"),
    });
    primeYears(CLOSED_YEAR);

    const res = await deleteHoliday(
      new NextRequest("http://localhost:3000/api/holidays/hol-1", { method: "DELETE" }),
      idParams("hol-1")
    );

    await expectClosedYearRefusal(res);
    expect(db.academicHoliday.delete).not.toHaveBeenCalled();
  });
});

describe("POST /api/promotion-rules — closed-year guard", () => {
  const BODY = { academicYearId: "ay-closed", classId: "cls-1" };

  it("refuses a rule created for a closed year", async () => {
    primeYears(CLOSED_YEAR);
    db.class.findUnique.mockResolvedValue({ id: "cls-1", classNumber: 1 });

    const res = await createPromotionRule(
      jsonRequest("http://localhost:3000/api/promotion-rules", "POST", BODY)
    );

    await expectClosedYearRefusal(res);
    expect(db.promotionRule.create).not.toHaveBeenCalled();
  });

  /**
   * The rule that governs a closed year is the recorded basis on which students
   * were retained or advanced. Editing it afterwards changes the reason without
   * changing the outcome, so the year being frozen is the governing fact — not
   * whether promotion records happen to exist yet.
   */
  it("refuses the rule even when no promotions have been recorded", async () => {
    primeYears(CLOSED_YEAR);
    db.class.findUnique.mockResolvedValue({ id: "cls-1", classNumber: 1 });
    db.promotionRule.findFirst.mockResolvedValue(null);

    const res = await createPromotionRule(
      jsonRequest("http://localhost:3000/api/promotion-rules", "POST", BODY)
    );

    await expectClosedYearRefusal(res);
    expect(db.promotionRule.findFirst).not.toHaveBeenCalled();
  });
});

describe("PUT and DELETE /api/promotion-rules/[id] — closed-year guard", () => {
  function primeExistingRule(academicYearId: string) {
    db.promotionRule.findUnique.mockResolvedValue({
      id: "rule-1",
      tenantId: "mhs",
      academicYearId,
      classId: "cls-1",
      nextClassId: null,
      class: { id: "cls-1", classNumber: 1 },
    });
    // No historical promotions, so the route's own lock is not what refuses.
    db.classPromotion.count.mockResolvedValue(0);
    db.class.findUnique.mockResolvedValue({ id: "cls-1", classNumber: 1 });
  }

  it("refuses to edit a rule that lives in a closed year", async () => {
    primeExistingRule("ay-closed");
    primeYears(CLOSED_YEAR);

    const res = await updatePromotionRule(
      jsonRequest("http://localhost:3000/api/promotion-rules/rule-1", "PUT", { minimumAttendance: 80 }),
      idParams("rule-1")
    );

    await expectClosedYearRefusal(res);
    expect(db.promotionRule.update).not.toHaveBeenCalled();
  });

  /**
   * The update schema is a partial of the create schema, so `academicYearId` is
   * writable — a rule can be *moved*. Guarding only the source year would leave
   * that as an open door into a frozen year.
   */
  it("refuses to move a rule from an open year into a closed one", async () => {
    primeExistingRule("ay-open");
    primeYears(OPEN_YEAR, CLOSED_YEAR);

    const res = await updatePromotionRule(
      jsonRequest("http://localhost:3000/api/promotion-rules/rule-1", "PUT", {
        academicYearId: "ay-closed",
      }),
      idParams("rule-1")
    );

    await expectClosedYearRefusal(res);
    expect(db.promotionRule.update).not.toHaveBeenCalled();
  });

  it("allows editing a rule in an open year", async () => {
    primeExistingRule("ay-open");
    primeYears(OPEN_YEAR);
    db.promotionRule.update.mockResolvedValue({
      id: "rule-1",
      academicYearId: "ay-open",
      classId: "cls-1",
      nextClassId: null,
    });

    const res = await updatePromotionRule(
      jsonRequest("http://localhost:3000/api/promotion-rules/rule-1", "PUT", { minimumAttendance: 80 }),
      idParams("rule-1")
    );

    expect(res.status).toBe(200);
    expect(db.promotionRule.update).toHaveBeenCalledTimes(1);
  });

  it("refuses to delete a rule that lives in a closed year", async () => {
    primeExistingRule("ay-closed");
    primeYears(CLOSED_YEAR);

    const res = await deletePromotionRule(
      new NextRequest("http://localhost:3000/api/promotion-rules/rule-1", { method: "DELETE" }),
      idParams("rule-1")
    );

    await expectClosedYearRefusal(res);
    expect(db.promotionRule.delete).not.toHaveBeenCalled();
  });
});

describe("POST /api/fees/structures — closed-year guard", () => {
  const BODY = { academicYearId: "ay-closed", classId: "cls-1", tuitionFee: 500 };

  it("refuses a fee structure created for a closed year", async () => {
    primeYears(CLOSED_YEAR);
    db.class.findFirst.mockResolvedValue({ id: "cls-1", classNumber: 1 });

    const res = await createFeeStructure(
      jsonRequest("http://localhost:3000/api/fees/structures", "POST", BODY)
    );

    await expectClosedYearRefusal(res);
    expect(db.classFeeStructure.upsert).not.toHaveBeenCalled();
  });

  /**
   * The route is an upsert, so "create" and "change" are the same call. Both are
   * writes to the year, so the same guard covers them.
   */
  it("allows a fee structure for an open year", async () => {
    primeYears(OPEN_YEAR);
    db.class.findFirst.mockResolvedValue({ id: "cls-1", name: "Class 1", classNumber: 1 });
    db.classFeeStructure.upsert.mockResolvedValue({ id: "fs-1" });

    const res = await createFeeStructure(
      jsonRequest("http://localhost:3000/api/fees/structures", "POST", {
        ...BODY,
        academicYearId: "ay-open",
      })
    );

    expect(res.status).toBe(201);
    expect(db.classFeeStructure.upsert).toHaveBeenCalledTimes(1);
  });
});

describe("PUT and DELETE /api/fees/structures/[id] — closed-year guard", () => {
  function primeExistingStructure(academicYearId: string) {
    db.classFeeStructure.findFirst.mockResolvedValue({
      id: "fs-1",
      tenantId: "mhs",
      academicYearId,
      classId: "cls-1",
      tuitionFee: 500,
      labFee: 0,
      computerFee: 0,
      examFee: 0,
      sportsFee: 0,
      libraryFee: 0,
      otherFee: 0,
    });
    // No vouchers issued, so the route's own integrity lock is not what refuses.
    db.feeVoucher.count.mockResolvedValue(0);
  }

  it("refuses to edit a fee structure in a closed year", async () => {
    primeExistingStructure("ay-closed");
    primeYears(CLOSED_YEAR);

    const res = await updateFeeStructure(
      jsonRequest("http://localhost:3000/api/fees/structures/fs-1", "PUT", { tuitionFee: 600 }),
      idParams("fs-1")
    );

    await expectClosedYearRefusal(res);
    expect(db.classFeeStructure.update).not.toHaveBeenCalled();
  });

  it("refuses to move a fee structure from an open year into a closed one", async () => {
    primeExistingStructure("ay-open");
    primeYears(OPEN_YEAR, CLOSED_YEAR);

    const res = await updateFeeStructure(
      jsonRequest("http://localhost:3000/api/fees/structures/fs-1", "PUT", {
        academicYearId: "ay-closed",
      }),
      idParams("fs-1")
    );

    await expectClosedYearRefusal(res);
    expect(db.classFeeStructure.update).not.toHaveBeenCalled();
  });

  it("refuses to delete a fee structure in a closed year", async () => {
    primeExistingStructure("ay-closed");
    primeYears(CLOSED_YEAR);

    const res = await deleteFeeStructure(
      new NextRequest("http://localhost:3000/api/fees/structures/fs-1", { method: "DELETE" }),
      idParams("fs-1")
    );

    await expectClosedYearRefusal(res);
    expect(db.classFeeStructure.delete).not.toHaveBeenCalled();
  });

  it("allows editing a fee structure in an open year", async () => {
    primeExistingStructure("ay-open");
    primeYears(OPEN_YEAR);
    db.classFeeStructure.update.mockResolvedValue({ id: "fs-1" });

    const res = await updateFeeStructure(
      jsonRequest("http://localhost:3000/api/fees/structures/fs-1", "PUT", { tuitionFee: 600 }),
      idParams("fs-1")
    );

    expect(res.status).toBe(200);
    expect(db.classFeeStructure.update).toHaveBeenCalledTimes(1);
  });
});
