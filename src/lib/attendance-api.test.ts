// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Route-level suite for `POST /api/attendance` — the write boundary the
 * vocabulary convergence added.
 *
 * The fast-grid branch used to read `item.status || "PRESENT"` with no
 * validation at all, so any string the client sent was persisted verbatim. An
 * unrecognised status is not inert: `attendanceRateFromCounts` scores anything
 * that is neither attended nor non-teaching as a day of absence, so a typo
 * becomes an absence in every denominator downstream — including the figure that
 * decides whether a student is promoted. These tests pin the refusal, because a
 * refusal at the boundary is the only place the mistake is cheap.
 *
 * The single-record path is covered too: its schema used to allow only
 * PRESENT/ABSENT/LATE/LEAVE, so it could not express `HOLIDAY` (which the fast
 * grid writes school-wide), `EXCUSED` (which the register and the reports use)
 * or `HALF_DAY` — three statuses the rest of the system understood and this
 * endpoint rejected.
 */

const db = vi.hoisted(() => ({
  attendance: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  academicYear: { findFirst: vi.fn() },
  studentProfile: { findUnique: vi.fn() },
  staffProfile: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

const alerts = vi.hoisted(() => ({ triggerAbsenceAlert: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/api-auth", () => ({
  requireApiAccess: vi.fn().mockResolvedValue({
    authContext: { tenantId: "mhs", user: { id: "user-1" } },
  }),
  getSelfScopedStudentProfileIds: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/notifications/triggers/absence-alert", () => alerts);

import { POST as ATTENDANCE_POST } from "@/app/api/attendance/route";

const postAttendance = ATTENDANCE_POST as unknown as (request: NextRequest) => Promise<Response>;

const OPEN_YEAR = { id: "ay-open", tenantId: "mhs", label: "2026-2027", isClosed: false };
const CLOSED_YEAR = { ...OPEN_YEAR, id: "ay-closed", label: "2025-2026", isClosed: true };

const ATTENDANCE_DATE = "2026-05-04";

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function grid(...records: Array<Record<string, unknown>>) {
  return { date: ATTENDANCE_DATE, records };
}

/**
 * The route resolves the year by date range and then calls the *real*
 * `assertAcademicYearOpen`, which re-reads it by id. The mock answers both
 * shapes, so the guard under test is the production one and not a stub.
 */
function primeYears(...years: Array<typeof OPEN_YEAR>) {
  db.academicYear.findFirst.mockImplementation(async ({ where }: any) => {
    if (where.id) return years.find((year) => year.id === where.id) ?? null;
    return years[0] ?? null;
  });
}

/** The statuses the route persisted, in call order. */
function writtenStatuses(): string[] {
  return db.attendance.create.mock.calls.map((call: any) => call[0].data.status);
}

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (arg: any) =>
    typeof arg === "function" ? arg(db) : Promise.all(arg)
  );
  db.attendance.findFirst.mockResolvedValue(null);
  db.attendance.create.mockImplementation(async ({ data }: any) => ({ id: "att-1", ...data }));
  db.attendance.update.mockImplementation(async ({ data }: any) => ({ id: "att-1", ...data }));
  db.studentProfile.findUnique.mockResolvedValue({ id: "stu-1", tenantId: "mhs" });
  primeYears(OPEN_YEAR);
});

describe("POST /api/attendance (fast grid) — unknown statuses are refused", () => {
  it("rejects a near-miss status and names the values that are allowed", async () => {
    const res = await postAttendance(
      jsonRequest(grid({ studentProfileId: "stu-1", status: "PRESENTT" }))
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("PRESENTT");
    // The operator has to be able to fix it from the message alone, so the
    // allowed set is spelled out rather than described.
    expect(json.message).toContain("Allowed:");
    expect(json.message).toContain("HALF_DAY");
    expect(json.message).toContain("LEAVE");
  });

  it("refuses before writing anything, including the records that were valid", async () => {
    const res = await postAttendance(
      jsonRequest(
        grid(
          { studentProfileId: "stu-1", status: "PRESENT" },
          { studentProfileId: "stu-2", status: "NOT_A_STATUS" },
          { studentProfileId: "stu-3", status: "PRESENT" }
        )
      )
    );

    expect(res.status).toBe(400);
    // All-or-nothing: a half-written register is worse than a refused one,
    // because the operator cannot tell which half landed.
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.attendance.create).not.toHaveBeenCalled();
    expect(db.attendance.update).not.toHaveBeenCalled();
  });

  it("identifies the offending record so it can be found in the grid", async () => {
    const res = await postAttendance(
      jsonRequest(
        grid(
          { studentProfileId: "stu-1", status: "PRESENT" },
          { studentProfileId: "stu-2", status: "PRESENT" },
          { studentProfileId: "stu-3", status: "PRESENTT" }
        )
      )
    );

    const json = await res.json();
    expect(json.message).toContain("#2");
  });

  it("rejects a status that is not a string", async () => {
    const res = await postAttendance(
      jsonRequest(grid({ studentProfileId: "stu-1", status: 1 }))
    );

    expect(res.status).toBe(400);
    expect(db.attendance.create).not.toHaveBeenCalled();
  });

  it("refuses a record with no studentProfileId", async () => {
    const res = await postAttendance(jsonRequest(grid({ status: "PRESENT" })));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("studentProfileId");
    expect(db.attendance.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/attendance (fast grid) — the shared vocabulary is accepted", () => {
  it("accepts every status the module declares", async () => {
    const statuses = [
      "PRESENT",
      "ABSENT",
      "LATE",
      "HALF_DAY",
      "EXCUSED",
      "HOLIDAY",
      "LEAVE",
    ] as const;

    const res = await postAttendance(
      jsonRequest(
        grid(...statuses.map((status, index) => ({ studentProfileId: `stu-${index}`, status })))
      )
    );

    expect(res.status).toBe(201);
    expect(writtenStatuses()).toEqual([...statuses]);
  });

  it("defaults only an *omitted* status, and to PRESENT", async () => {
    const res = await postAttendance(jsonRequest(grid({ studentProfileId: "stu-1" })));

    expect(res.status).toBe(201);
    expect(writtenStatuses()).toEqual(["PRESENT"]);
  });

  it("writes a supplied status verbatim rather than normalising it", async () => {
    // `LEAVE` is the status leave approval writes. It must survive the write
    // unchanged — the defect being fixed was that nothing downstream *handled*
    // it, not that it was stored wrong.
    await postAttendance(jsonRequest(grid({ studentProfileId: "stu-1", status: "LEAVE" })));
    expect(writtenStatuses()).toEqual(["LEAVE"]);
  });

  it("keeps the year on the row it writes", async () => {
    await postAttendance(jsonRequest(grid({ studentProfileId: "stu-1", status: "PRESENT" })));

    expect(db.attendance.create.mock.calls[0][0].data.academicYearId).toBe("ay-open");
  });
});

describe("POST /api/attendance (fast grid) — the closed-year boundary still holds", () => {
  it("refuses to mark attendance in a closed year", async () => {
    primeYears(CLOSED_YEAR);

    const res = await postAttendance(
      jsonRequest(grid({ studentProfileId: "stu-1", status: "PRESENT" }))
    );

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.message).toContain("closed and read-only");
    expect(json.details).toContainEqual(
      expect.objectContaining({ code: "ACADEMIC_YEAR_CLOSED" })
    );
    // Validation passed, so the refusal came from the guard and not the schema.
    expect(db.attendance.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/attendance (single record) — same vocabulary, same guard", () => {
  function single(status: unknown) {
    return jsonRequest({ date: ATTENDANCE_DATE, studentProfileId: "stu-1", status });
  }

  it("rejects a status outside the vocabulary", async () => {
    const res = await postAttendance(single("PRESENTT"));

    // The zod path answers 422, not 400 — the fast grid answers 400 because it
    // validates by hand. Both refuse; the difference is the response helper.
    expect(res.status).toBe(422);
    expect(db.attendance.create).not.toHaveBeenCalled();
  });

  it("accepts the three statuses the old four-value enum rejected", async () => {
    for (const status of ["HOLIDAY", "EXCUSED", "HALF_DAY"]) {
      vi.clearAllMocks();
      db.$transaction.mockImplementation(async (arg: any) => arg(db));
      db.attendance.findFirst.mockResolvedValue(null);
      db.attendance.create.mockImplementation(async ({ data }: any) => ({ id: "att-1", ...data }));
      primeYears(OPEN_YEAR);

      const res = await postAttendance(single(status));

      expect(res.status, `status ${status} should be accepted`).toBe(201);
      expect(db.attendance.create.mock.calls[0][0].data.status).toBe(status);
    }
  });

  it("still accepts the four it always did", async () => {
    for (const status of ["PRESENT", "ABSENT", "LATE", "LEAVE"]) {
      vi.clearAllMocks();
      db.$transaction.mockImplementation(async (arg: any) => arg(db));
      db.attendance.findFirst.mockResolvedValue(null);
      db.attendance.create.mockImplementation(async ({ data }: any) => ({ id: "att-1", ...data }));
      primeYears(OPEN_YEAR);

      const res = await postAttendance(single(status));

      expect(res.status, `status ${status} should be accepted`).toBe(201);
    }
  });
});
