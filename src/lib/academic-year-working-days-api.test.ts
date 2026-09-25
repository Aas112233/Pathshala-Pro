// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Route-level suite for GET/PUT /api/academic-years/[id]/working-days.
 *
 * `@/lib/academic-year-guards` is deliberately **not** mocked. The closed-year
 * refusal is the whole reason this endpoint reads the year through
 * `assertAcademicYearOpen` instead of trusting the id, and stubbing the guard
 * would assert only that the route calls a function that was told to throw.
 * Letting the real guard run against the mocked Prisma makes "a closed year
 * refuses the write" an integration test rather than a restatement of the mock.
 *
 * The Prisma mock keeps real state (`stored`): a write mutates it and a later
 * read sees the change. That is what makes the PUT-echoes-GET assertion mean
 * something — otherwise it would only prove that two mocks agree.
 */

const db = vi.hoisted(() => ({
  academicYear: { findFirst: vi.fn(), update: vi.fn() },
  academicHoliday: { findMany: vi.fn() },
  tenant: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/api-auth", () => ({
  requireApiAccess: vi.fn().mockResolvedValue({
    authContext: { tenantId: "tenant-1", user: { id: "user-1" } },
  }),
}));

import { GET as GET_ROUTE, PUT as PUT_ROUTE } from "@/app/api/academic-years/[id]/working-days/route";

/**
 * The handlers' inferred return type is `NextResponse | undefined` because
 * `requireApiAccess` may short-circuit. In these tests it never does.
 */
const GET = GET_ROUTE as unknown as (
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;
const PUT = PUT_ROUTE as unknown as (
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;

/**
 * March 2026 is chosen because it is hand-checkable and it contains the trap:
 * the 1st is a Sunday, so a Sunday-only week has 5 non-working days and a
 * Sunday+Saturday week has 9. The 7th is a Saturday and the 8th a Sunday, which
 * is what the double-subtraction regression needs.
 */
const START = new Date("2026-03-01T00:00:00.000Z");
const END = new Date("2026-03-31T00:00:00.000Z");

const MARCH_2026 = {
  id: "ay-1",
  label: "2025-2026",
  yearId: "AY2025",
  tenantId: "tenant-1",
  startDate: START,
  endDate: END,
  isClosed: false,
  nonWorkingWeekdays: [0] as unknown,
};

function year(overrides: Record<string, unknown> = {}) {
  return { ...MARCH_2026, ...overrides };
}

/** The mocked database's current state. Writes mutate it; reads observe it. */
let stored: ReturnType<typeof year>;

function setYear(overrides: Record<string, unknown> = {}) {
  stored = year(overrides);
}

function holiday(startDate: string, endDate: string, scope: "both" | "students" | "staff" = "both") {
  return {
    startDate: new Date(`${startDate}T00:00:00.000Z`),
    endDate: new Date(`${endDate}T00:00:00.000Z`),
    affectsStudents: scope !== "staff",
    affectsStaff: scope !== "students",
  };
}

function get(id = "ay-1") {
  return new NextRequest(`http://localhost:3000/api/academic-years/${id}/working-days`);
}

function put(body: unknown, id = "ay-1") {
  return new NextRequest(`http://localhost:3000/api/academic-years/${id}/working-days`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const ctx = (id = "ay-1") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  setYear();
  db.academicYear.findFirst.mockImplementation(async () => stored);
  db.academicYear.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => {
      stored = { ...stored, ...data };
      return stored;
    }
  );
  db.academicHoliday.findMany.mockResolvedValue([]);
  db.tenant.findUnique.mockResolvedValue({ firstDayOfWeek: "sunday" });
});

describe("GET /api/academic-years/[id]/working-days", () => {
  // ---------------------------------------------------------------------------
  // Undeclared is not zero.
  // ---------------------------------------------------------------------------
  it.each([
    ["null", null],
    ["undefined", undefined],
  ])("reports an undeclared year (%s) as calendar: null, never 0", async (_label, value) => {
    setYear({ nonWorkingWeekdays: value });

    const res = await GET(get(), ctx());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.policy.declared).toBe(false);
    expect(json.data.calendar).toBeNull();
    // The key is present and null — not omitted, which a caller would have to
    // distinguish from "not loaded yet".
    expect("calendar" in json.data).toBe(true);
    expect(json.data.policy.nonWorkingWeekdays).toEqual([]);
    expect(json.data.policy.nonWorkingWeekdayNames).toEqual([]);

    // Nothing is countable, so no holiday read happens at all.
    expect(db.academicHoliday.findMany).not.toHaveBeenCalled();
  });

  it("echoes the year it is reporting on", async () => {
    const res = await GET(get(), ctx());
    const json = await res.json();

    expect(json.data.year).toEqual({
      id: "ay-1",
      label: "2025-2026",
      yearId: "AY2025",
      startDate: START.toISOString(),
      endDate: END.toISOString(),
      isClosed: false,
    });
  });

  // ---------------------------------------------------------------------------
  // The suggestion is a form pre-fill, never an input to arithmetic.
  // ---------------------------------------------------------------------------
  describe("the tenant-settings suggestion", () => {
    it("is offered only while the year is undeclared", async () => {
      setYear({ nonWorkingWeekdays: null });
      db.tenant.findUnique.mockResolvedValue({ firstDayOfWeek: "friday" });

      const res = await GET(get(), ctx());
      const json = await res.json();

      expect(json.data.policy.suggestion).toEqual({
        nonWorkingWeekdays: [5],
        source: "tenantFirstDayOfWeek",
        firstDayOfWeek: "friday",
      });
    });

    it("is not offered once a policy is declared, and the tenant is not read", async () => {
      setYear({ nonWorkingWeekdays: [0] });

      const res = await GET(get(), ctx());
      const json = await res.json();

      expect(json.data.policy.suggestion).toBeNull();
      // Not merely unused — never fetched. A display setting has no business
      // being read on a path that computes an arithmetic input.
      expect(db.tenant.findUnique).not.toHaveBeenCalled();
    });

    it("is null rather than a guess when the setting is not a weekday name", async () => {
      setYear({ nonWorkingWeekdays: null });
      db.tenant.findUnique.mockResolvedValue({ firstDayOfWeek: "fortnightly" });

      const res = await GET(get(), ctx());
      const json = await res.json();

      expect(json.data.policy.suggestion).toBeNull();
    });

    it("is null when the tenant row cannot be found", async () => {
      setYear({ nonWorkingWeekdays: null });
      db.tenant.findUnique.mockResolvedValue(null);

      const res = await GET(get(), ctx());
      const json = await res.json();

      expect(json.data.policy.suggestion).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // The count itself.
  // ---------------------------------------------------------------------------
  it("counts a Sunday-only week as 26 working days in March 2026", async () => {
    const res = await GET(get(), ctx());
    const json = await res.json();

    // 31 days, 5 Sundays (1st, 8th, 15th, 22nd, 29th).
    expect(json.data.calendar.students).toMatchObject({
      totalCalendarDays: 31,
      weekendDays: 5,
      holidayWorkingDays: 0,
      holidayCalendarDays: 0,
      workingDays: 26,
    });
  });

  it("counts a Sunday+Saturday week as 22, because the weekend is the policy and not a constant", async () => {
    setYear({ nonWorkingWeekdays: [0, 6] });

    const res = await GET(get(), ctx());
    const json = await res.json();

    // 5 Sundays + 4 Saturdays. A hardcoded-Sunday implementation would say 26.
    expect(json.data.calendar.students).toMatchObject({
      totalCalendarDays: 31,
      weekendDays: 9,
      workingDays: 22,
    });
  });

  it("reports a separate calendar for students and for staff", async () => {
    setYear({ nonWorkingWeekdays: [0] });
    // A closed day for students while staff still attend — exam leave.
    db.academicHoliday.findMany.mockResolvedValue([holiday("2026-03-10", "2026-03-10", "students")]);

    const res = await GET(get(), ctx());
    const json = await res.json();

    expect(json.data.calendar.students).toMatchObject({
      totalCalendarDays: 31,
      weekendDays: 5,
      holidayWorkingDays: 1,
      holidayCalendarDays: 1,
      workingDays: 25,
    });
    expect(json.data.calendar.staff).toMatchObject({
      totalCalendarDays: 31,
      weekendDays: 5,
      holidayWorkingDays: 0,
      holidayCalendarDays: 0,
      workingDays: 26,
    });
  });

  it("does not subtract a holiday twice when it falls on a weekly day off", async () => {
    setYear({ nonWorkingWeekdays: [0] });
    // Saturday the 7th through Sunday the 8th: one working weekday and one
    // weekly day off.
    db.academicHoliday.findMany.mockResolvedValue([holiday("2026-03-07", "2026-03-08")]);

    const res = await GET(get(), ctx());
    const json = await res.json();

    // The Sunday is counted once, under weekendDays. The old
    // `calendarDays - sundays - holidays` arithmetic removed it twice and said 24.
    expect(json.data.calendar.students).toMatchObject({
      totalCalendarDays: 31,
      weekendDays: 5,
      holidayWorkingDays: 1,
      holidayCalendarDays: 2,
      workingDays: 25,
    });
    expect(json.data.calendar.students.workingDays).not.toBe(24);
  });

  it("collapses overlapping holiday ranges instead of counting them twice", async () => {
    setYear({ nonWorkingWeekdays: [0] });
    db.academicHoliday.findMany.mockResolvedValue([
      holiday("2026-03-09", "2026-03-11"),
      holiday("2026-03-10", "2026-03-12"),
    ]);

    const res = await GET(get(), ctx());
    const json = await res.json();

    // The union is the 9th–12th: four distinct dates, all working weekdays.
    // 31 calendar days − 5 Sundays − 4 holiday weekdays = 22.
    expect(json.data.calendar.students).toMatchObject({
      holidayCalendarDays: 4,
      holidayWorkingDays: 4,
      workingDays: 22,
    });
  });

  it("keeps the three buckets disjoint, so they sum to the calendar", async () => {
    setYear({ nonWorkingWeekdays: [0, 6] });
    db.academicHoliday.findMany.mockResolvedValue([
      holiday("2026-03-10", "2026-03-10", "students"),
      holiday("2026-03-07", "2026-03-08", "students"),
    ]);

    const res = await GET(get(), ctx());
    const json = await res.json();
    const calendar = json.data.calendar.students;

    expect(calendar.workingDays + calendar.weekendDays + calendar.holidayWorkingDays).toBe(
      calendar.totalCalendarDays
    );
    expect(calendar.holidayCalendarDays).toBeGreaterThanOrEqual(calendar.holidayWorkingDays);
  });

  it("reads holidays for this year's window only", async () => {
    await GET(get(), ctx());

    // The overlap predicate is asserted rather than trusted: a holiday that
    // merely starts before the year ends is included, and one that ends before
    // the year begins is not.
    expect(db.academicHoliday.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          academicYearId: "ay-1",
          startDate: { lte: END },
          endDate: { gte: START },
        }),
      })
    );
  });

  // ---------------------------------------------------------------------------
  // Corrupt stored data is loud.
  // ---------------------------------------------------------------------------
  it.each([
    ["a weekday above the range", [7]],
    ["a negative weekday", [-1]],
    ["a non-integer weekday", [1.5]],
    ["a weekday name", ["sunday"]],
    ["every weekday at once", [0, 1, 2, 3, 4, 5, 6]],
    ["a string instead of a list", "sunday"],
    ["an object that names no list", { weekend: [0] }],
  ])("surfaces %s in the stored policy as an explicit error, never a count", async (_label, value) => {
    setYear({ nonWorkingWeekdays: value });

    const res = await GET(get(), ctx());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe(true);
    expect(json.details[0].code).toBe("INVALID_STORED_WORKING_DAY_POLICY");
    // No number reaches the operator that looks like a fact.
    expect(json.data).toBeUndefined();
    expect(db.academicHoliday.findMany).not.toHaveBeenCalled();
  });

  it("404s an unknown year", async () => {
    db.academicYear.findFirst.mockResolvedValue(null);

    const res = await GET(get("ay-missing"), ctx("ay-missing"));

    expect(res.status).toBe(404);
  });
});

describe("PUT /api/academic-years/[id]/working-days", () => {
  it("stores the policy deduplicated and sorted, so equal policies compare equal", async () => {
    const res = await PUT(put({ nonWorkingWeekdays: [6, 0, 0] }), ctx());

    expect(res.status).toBe(200);
    expect(db.academicYear.update).toHaveBeenCalledWith({
      where: { id: "ay-1" },
      data: { nonWorkingWeekdays: [0, 6] },
    });
  });

  it("returns exactly what the following GET returns", async () => {
    const putRes = await PUT(put({ nonWorkingWeekdays: [0, 6] }), ctx());
    const getRes = await GET(get(), ctx());

    const putJson = await putRes.json();
    const getJson = await getRes.json();

    expect(putJson.data).toEqual(getJson.data);
    // The save is confirmed against the state that was actually persisted, not
    // against the request body.
    expect(putJson.data.calendar.students.workingDays).toBe(22);
  });

  it("names the days it saved, so the message is readable without the numbers", async () => {
    const res = await PUT(put({ nonWorkingWeekdays: [0, 6] }), ctx());
    const json = await res.json();

    expect(json.message).toContain("sunday");
    expect(json.message).toContain("saturday");
  });

  it("accepts an empty list as a legitimate seven-day week", async () => {
    const res = await PUT(put({ nonWorkingWeekdays: [] }), ctx());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(db.academicYear.update).toHaveBeenCalledWith({
      where: { id: "ay-1" },
      data: { nonWorkingWeekdays: [] },
    });
    // No weekly days off, no holidays: every calendar day is a working day.
    expect(json.data.calendar.students.workingDays).toBe(31);
    expect(json.data.calendar.students.weekendDays).toBe(0);
  });

  it("declares the policy on an undeclared year, clearing the suggestion", async () => {
    setYear({ nonWorkingWeekdays: null });

    const res = await PUT(put({ nonWorkingWeekdays: [0] }), ctx());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.policy.declared).toBe(true);
    expect(json.data.policy.suggestion).toBeNull();
    expect(json.data.calendar.students.workingDays).toBe(26);
  });

  // ---------------------------------------------------------------------------
  // Rejections. None of them may reach the database.
  // ---------------------------------------------------------------------------
  it.each([
    ["a weekday above the range (7)", [7]],
    ["a negative weekday", [-1]],
    ["a non-integer weekday", [1.5]],
    ["a weekday name", ["sunday"]],
    ["null inside the list", [null]],
    ["every weekday at once", [0, 1, 2, 3, 4, 5, 6]],
    ["a string instead of a list", "sunday"],
    ["an object that names no list", { weekend: [0] }],
    ["no policy at all", {}],
  ])("refuses %s with a 400 and a field-level code", async (_label, value) => {
    const res = await PUT(put({ nonWorkingWeekdays: value }), ctx());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe(true);
    expect(json.details[0].field).toBe("nonWorkingWeekdays");
    expect(json.details[0].code).toBe("INVALID_WORKING_DAY_POLICY");
    expect(db.academicYear.update).not.toHaveBeenCalled();
  });

  it("refuses an all-seven policy as an unusable year, not as a valid one", async () => {
    const res = await PUT(put({ nonWorkingWeekdays: [0, 1, 2, 3, 4, 5, 6] }), ctx());
    const json = await res.json();

    // Distinct from the per-entry validation: every entry here is a valid
    // weekday, and the list as a whole is still refused.
    expect(res.status).toBe(400);
    expect(json.details[0].code).toBe("INVALID_WORKING_DAY_POLICY");
    expect(db.academicYear.update).not.toHaveBeenCalled();
  });

  it.each([
    ["a JSON null", null],
    ["a JSON string", "sunday"],
  ])("refuses %s body outright", async (_label, body) => {
    const res = await PUT(put(body), ctx());
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.details[0].code).toBe("MISSING_BODY");
    expect(db.academicYear.update).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // The closed-year boundary. This is the real guard, not a stub.
  // ---------------------------------------------------------------------------
  it("refuses to change a closed year's working days", async () => {
    setYear({ isClosed: true });

    const res = await PUT(put({ nonWorkingWeekdays: [0, 6] }), ctx());
    const json = await res.json();

    // The body was valid, so the refusal can only be the guard.
    expect(res.status).toBe(409);
    expect(json.details[0].code).toBe("ACADEMIC_YEAR_CLOSED");
    expect(db.academicYear.update).not.toHaveBeenCalled();
  });

  it("checks the closed year before it tries to read the stored policy", async () => {
    // A year that is both closed and corrupt. The close is the fact that
    // matters, so it must win — which also proves the guard is not sitting
    // downstream of the report loader.
    setYear({ isClosed: true, nonWorkingWeekdays: [7] });

    const res = await PUT(put({ nonWorkingWeekdays: [0] }), ctx());
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.details[0].code).toBe("ACADEMIC_YEAR_CLOSED");
    expect(db.academicYear.update).not.toHaveBeenCalled();
  });

  it("lets a valid save repair a year whose stored policy is corrupt", async () => {
    setYear({ nonWorkingWeekdays: [7] });

    const res = await PUT(put({ nonWorkingWeekdays: [0] }), ctx());
    const json = await res.json();

    // The error message on the read path promises exactly this, so it is
    // asserted rather than assumed.
    expect(res.status).toBe(200);
    expect(json.data.policy.declared).toBe(true);
    expect(json.data.policy.nonWorkingWeekdays).toEqual([0]);
    expect(stored.nonWorkingWeekdays).toEqual([0]);
  });

  it("404s an unknown year", async () => {
    db.academicYear.findFirst.mockResolvedValue(null);

    const res = await PUT(put({ nonWorkingWeekdays: [0] }, "ay-missing"), ctx("ay-missing"));

    expect(res.status).toBe(404);
    expect(db.academicYear.update).not.toHaveBeenCalled();
  });
});
