// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Route-level suite for `PUT /api/leaves/[id]` — approving a leave.
 *
 * `Attendance` is a year-scoped model, and this route used to create its rows
 * with no `academicYearId` at all. The consequence was not "the year is missing"
 * but *one question, two answers*: a leave approved here was invisible to every
 * year-scoped query — the promotion engine, the year-close gate,
 * `reports/attendance` — while the identical day entered as `LEAVE` on the
 * manual attendance form carried a year and counted as a day of absence.
 *
 * These tests pin the two halves of the fix: the row carries the year that
 * covers its own day, and a day in a closed year refuses the whole approval
 * rather than being silently dropped.
 */

const db = vi.hoisted(() => ({
  leaveApplication: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
  academicYear: { findFirst: vi.fn(), findMany: vi.fn() },
  attendance: { findFirst: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/api-auth", () => ({
  requireApiAccess: vi.fn().mockResolvedValue({
    authContext: { tenantId: "mhs", user: { id: "user-1" } },
  }),
}));

import { PUT as LEAVE_PUT } from "@/app/api/leaves/[id]/route";

const putLeave = LEAVE_PUT as unknown as (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;

const AY_2025 = {
  id: "ay-2025",
  label: "2025-2026",
  startDate: new Date("2025-04-01"),
  endDate: new Date("2026-03-31"),
  isClosed: false,
};
const AY_2026 = {
  id: "ay-2026",
  label: "2026-2027",
  startDate: new Date("2026-04-01"),
  endDate: new Date("2027-03-31"),
  isClosed: false,
};

const idParams = (id: string) => ({ params: Promise.resolve({ id }) });

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/leaves/leave-1", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Answers the route's two year queries the way Prisma would: `findMany` applies
 * the overlap filter and the `startDate desc` ordering the route asks for, and
 * `findFirst` answers `assertAcademicYearOpen` by id. Filtering for real matters
 * here — a mock that returned every year regardless of the range would let a
 * broken overlap query pass.
 */
function primeYears(...years: Array<typeof AY_2025>) {
  db.academicYear.findMany.mockImplementation(async ({ where }: any) => {
    // The route asks for `startDate <= leaveEnd AND endDate >= leaveStart`.
    // Filtering for real matters here: a mock that returned every year
    // regardless of range would let a broken overlap query pass.
    const leaveEnd: Date = where.startDate.lte;
    const leaveStart: Date = where.endDate.gte;
    return years
      .filter((year) => year.startDate <= leaveEnd && year.endDate >= leaveStart)
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
      .map(({ id, label, startDate, endDate, isClosed }) => ({
        id,
        label,
        startDate,
        endDate,
        isClosed,
      }));
  });
  db.academicYear.findFirst.mockImplementation(
    async ({ where }: any) => years.find((year) => year.id === where.id) ?? null
  );
}

/** The leave row as the route will see it, so `update` can echo it back. */
let leaveRow: Record<string, any>;

function primeLeave(overrides: Record<string, unknown> = {}) {
  leaveRow = {
    id: "leave-1",
    tenantId: "mhs",
    studentProfileId: "stu-1",
    staffProfileId: null,
    status: "PENDING",
    leaveType: "SICK",
    fromDate: new Date("2026-05-04"),
    toDate: new Date("2026-05-05"),
    reason: "Fever",
    approvedById: null,
    ...overrides,
  };
  db.leaveApplication.findFirst.mockResolvedValue(leaveRow);
  // The route reads the *updated* row to learn whose attendance to write, so the
  // mock has to return a real row rather than a bare `{ id }`.
  db.leaveApplication.update.mockImplementation(async ({ data }: any) => ({
    ...leaveRow,
    ...data,
  }));
}

/** The `data` of every attendance row the route created, in call order. */
function createdRows(): Array<Record<string, any>> {
  return db.attendance.create.mock.calls.map((call: any) => call[0].data);
}

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (arg: any) =>
    typeof arg === "function" ? arg(db) : Promise.all(arg)
  );
  db.leaveApplication.delete.mockResolvedValue({ id: "leave-1" });
  db.attendance.findFirst.mockResolvedValue(null);
  db.attendance.create.mockImplementation(async ({ data }: any) => ({ id: "att-1", ...data }));
  primeLeave();
  primeYears(AY_2025, AY_2026);
});

describe("PUT /api/leaves/[id] — an approval's attendance rows are year-scoped", () => {
  it("stamps the covering year onto every row it creates", async () => {
    const res = await putLeave(
      jsonRequest({ status: "APPROVED", fromDate: "2026-05-04", toDate: "2026-05-05" }),
      idParams("leave-1")
    );

    expect(res.status).toBe(200);
    const rows = createdRows();
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.academicYearId).toBe("ay-2026");
      expect(row.status).toBe("LEAVE");
      expect(row.studentProfileId).toBe("stu-1");
    }
  });

  it("resolves the year per day, so a leave across a year boundary is split", async () => {
    // 2026-03-30 and -31 belong to 2025-2026; 2026-04-01 and -02 to 2026-2027.
    // Resolving once for the whole leave would put all four days in one year,
    // which is the same "one question, two answers" defect in a smaller form.
    const res = await putLeave(
      jsonRequest({ status: "APPROVED", fromDate: "2026-03-30", toDate: "2026-04-02" }),
      idParams("leave-1")
    );

    expect(res.status).toBe(200);
    expect(createdRows().map((row) => row.academicYearId)).toEqual([
      "ay-2025",
      "ay-2025",
      "ay-2026",
      "ay-2026",
    ]);
  });

  it("asks the database only for years that overlap the leave", async () => {
    await putLeave(
      jsonRequest({ status: "APPROVED", fromDate: "2026-05-04", toDate: "2026-05-05" }),
      idParams("leave-1")
    );

    const where = db.academicYear.findMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe("mhs");
    expect(where.startDate.lte).toBeInstanceOf(Date);
    expect(where.endDate.gte).toBeInstanceOf(Date);
    // `startDate desc` matches POST /api/attendance, so overlapping years
    // resolve identically in both writers.
    expect(db.academicYear.findMany.mock.calls[0][0].orderBy).toEqual({ startDate: "desc" });
  });

  it("skips a day that no academic year covers rather than writing a yearless row", async () => {
    // A leave over the summer break, when no year is open.
    primeYears(AY_2025);

    const res = await putLeave(
      jsonRequest({ status: "APPROVED", fromDate: "2026-05-04", toDate: "2026-05-05" }),
      idParams("leave-1")
    );

    expect(res.status).toBe(200);
    // The leave itself is still approved; only the attendance rows are skipped.
    expect(db.leaveApplication.update).toHaveBeenCalledTimes(1);
    expect(createdRows()).toHaveLength(0);
  });

  it("does not create a second row for a day that already has one", async () => {
    db.attendance.findFirst.mockResolvedValue({ id: "att-existing" });

    await putLeave(
      jsonRequest({ status: "APPROVED", fromDate: "2026-05-04", toDate: "2026-05-05" }),
      idParams("leave-1")
    );

    expect(db.attendance.create).not.toHaveBeenCalled();
  });
});

describe("PUT /api/leaves/[id] — a closed year refuses the approval", () => {
  it("refuses before writing anything, so no half-applied approval is left", async () => {
    primeYears({ ...AY_2026, isClosed: true });

    const res = await putLeave(
      jsonRequest({ status: "APPROVED", fromDate: "2026-05-04", toDate: "2026-05-05" }),
      idParams("leave-1")
    );

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.message).toContain("closed and read-only");
    expect(json.details).toContainEqual(
      expect.objectContaining({ code: "ACADEMIC_YEAR_CLOSED" })
    );
    // The guard runs before the transaction, so the approval is not committed
    // with none of its attendance rows — a silently dropped row is precisely the
    // defect this route is being fixed for.
    expect(db.leaveApplication.update).not.toHaveBeenCalled();
    expect(db.attendance.create).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("allows an approval whose days are all in open years", async () => {
    const res = await putLeave(
      jsonRequest({ status: "APPROVED", fromDate: "2026-05-04", toDate: "2026-05-05" }),
      idParams("leave-1")
    );

    expect(res.status).toBe(200);
    expect(db.attendance.create).toHaveBeenCalledTimes(2);
  });
});

describe("PUT /api/leaves/[id] — non-approval edits stay untouched", () => {
  it("writes no attendance when the leave is rejected", async () => {
    const res = await putLeave(jsonRequest({ status: "REJECTED" }), idParams("leave-1"));

    expect(res.status).toBe(200);
    expect(db.attendance.create).not.toHaveBeenCalled();
    // The year lookup is approval-only, so a rejection does no extra work.
    expect(db.academicYear.findMany).not.toHaveBeenCalled();
  });

  it("does not re-run on an approval that is already approved", async () => {
    primeLeave({ status: "APPROVED" });

    const res = await putLeave(jsonRequest({ status: "APPROVED" }), idParams("leave-1"));

    expect(res.status).toBe(200);
    expect(db.attendance.create).not.toHaveBeenCalled();
  });

  it("answers 404 for a leave that is not in this tenant", async () => {
    db.leaveApplication.findFirst.mockResolvedValue(null);

    const res = await putLeave(jsonRequest({ status: "APPROVED" }), idParams("leave-1"));

    expect(res.status).toBe(404);
    expect(db.academicYear.findMany).not.toHaveBeenCalled();
  });
});
