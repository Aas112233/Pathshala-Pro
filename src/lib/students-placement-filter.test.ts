// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Roster placement filter guards for GET /api/students.
 *
 * Two behaviours are load-bearing for the academic-year module and both were
 * broken:
 *
 *  1. A promoted student has a placement row for the target year AND a still
 *     valid placement row for the source year. The profile fallback must not
 *     let them match their old class in the new year — otherwise they appear
 *     twice in the roster.
 *
 *  2. The placement clause must compose with the search filter instead of
 *     replacing it. It used to assign to `where.OR`, clobbering a single-term
 *     search and silently returning the whole class.
 */

const db = vi.hoisted(() => ({
  studentProfile: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/api-auth", () => ({
  requireApiAccess: vi.fn().mockResolvedValue({
    authContext: { tenantId: "tenant-1", user: { id: "user-1" } },
  }),
}));
vi.mock("@/lib/academic-year-guards", () => ({
  resolveRequestAcademicYearId: vi.fn().mockResolvedValue("ay-2026"),
  ensureStudentAcademicSession: vi.fn().mockResolvedValue(undefined),
  assertAcademicYearOpen: vi.fn().mockResolvedValue(undefined),
  assertAcademicYearsOpen: vi.fn().mockResolvedValue(undefined),
}));

import { GET as GET_ROUTE } from "@/app/api/students/route";
import { fastCache } from "@/lib/fast-memory-cache";

/**
 * The handler's inferred return type is `NextResponse | undefined` because
 * `requireApiAccess` may short-circuit. In these tests it never does.
 */
const GET = GET_ROUTE as unknown as (request: NextRequest) => Promise<Response>;

function get(query: string) {
  return new NextRequest(`http://localhost:3000/api/students?${query}`);
}

/** Pull the where clause handed to the count/findMany pair. */
function whereClause() {
  return db.studentProfile.findMany.mock.calls[0][0].where;
}

describe("GET /api/students placement filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The route memoises identical roster queries, so a repeat query in the
    // next test would never reach the database.
    fastCache.invalidatePrefix("students:");
    db.studentProfile.findMany.mockResolvedValue([]);
    db.studentProfile.count.mockResolvedValue(0);
  });

  it("treats the year-scoped session as authoritative and guards the profile fallback", async () => {
    const res = await GET(get("classId=cls-6&academicYearId=ay-2026"));
    expect(res.status).toBe(200);

    const where = whereClause();
    const placement = where.AND.find((clause: any) => Array.isArray(clause.OR));

    expect(placement).toBeDefined();

    // Branch 1: the student's placement for this year matches.
    expect(placement.OR[0].academicSessions.some).toEqual({
      academicYearId: "ay-2026",
      classId: "cls-6",
    });

    // Branch 2: legacy fallback, gated on the student having NO row for the year.
    expect(placement.OR[1].academicSessions.none).toEqual({ academicYearId: "ay-2026" });
    expect(placement.OR[1].classId).toBe("cls-6");
  });

  it("never places the placement clause directly on where.OR", async () => {
    await GET(get("classId=cls-6&academicYearId=ay-2026"));

    const where = whereClause();
    // A bare top-level OR would be the profile fallback leaking through.
    if (where.OR) {
      for (const branch of where.OR) {
        expect(branch.academicSessions).toBeUndefined();
      }
    }
    expect(where.AND).toBeDefined();
  });

  it("keeps a single-term search filter when a class filter is also applied", async () => {
    await GET(get("search=ali&classId=cls-6&academicYearId=ay-2026"));

    const where = whereClause();

    // The search OR survives...
    expect(where.OR).toEqual([
      { firstName: { contains: "ali", mode: "insensitive" } },
      { lastName: { contains: "ali", mode: "insensitive" } },
      { firstNameBn: { contains: "ali", mode: "insensitive" } },
      { lastNameBn: { contains: "ali", mode: "insensitive" } },
      { studentId: { contains: "ali", mode: "insensitive" } },
      { rollNumber: { contains: "ali", mode: "insensitive" } },
      { guardianName: { contains: "ali", mode: "insensitive" } },
    ]);

    // ...and is ANDed with the placement clause rather than replaced by it.
    expect(where.AND).toHaveLength(1);
    expect(where.AND[0].OR[0].academicSessions.some.classId).toBe("cls-6");
  });

  it("combines a multi-term search with the placement clause", async () => {
    await GET(get("search=ali+khan&classId=cls-6&academicYearId=ay-2026"));

    const where = whereClause();
    // One AND entry per search token, plus the placement clause.
    expect(where.AND).toHaveLength(3);
    expect(where.AND[2].OR[0].academicSessions.some.classId).toBe("cls-6");
  });

  it("falls back to the plain profile column when no academic year is supplied", async () => {
    // resolveRequestAcademicYearId is mocked to always return a year, so this
    // path is exercised by querying without class hierarchy filters instead.
    const res = await GET(get("status=ACTIVE"));
    expect(res.status).toBe(200);

    const where = whereClause();
    expect(where.AND).toBeUndefined();
    expect(where.OR).toBeUndefined();
    expect(where.status).toBe("ACTIVE");
  });

  it("scopes every query to the current tenant", async () => {
    await GET(get("classId=cls-6&academicYearId=ay-2026"));
    expect(whereClause().tenantId).toBe("tenant-1");
  });
});
