// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  resolveActiveAcademicYear,
  resolveActiveAcademicYearId,
  type AcademicYearReader,
} from "@/lib/academic-year-guards";

/**
 * The resolver takes its reader as a parameter, so these tests exercise the
 * real hierarchy with no module mocking — the tiers and their order are the
 * whole contract.
 */
function readerReturning(...responses: Array<{ id: string } | null>) {
  const findFirst = vi.fn();
  for (const response of responses) {
    findFirst.mockResolvedValueOnce(response);
  }
  // Anything past the scripted responses finds nothing.
  findFirst.mockResolvedValue(null);
  return { findFirst, reader: { academicYear: { findFirst } } as unknown as AcademicYearReader };
}

describe("resolveActiveAcademicYear — hierarchy", () => {
  it("prefers the year the institute flagged as current", async () => {
    const { findFirst, reader } = readerReturning({ id: "ay-flagged" });

    const resolution = await resolveActiveAcademicYear("tenant-1", reader);

    expect(resolution).toEqual({ id: "ay-flagged", source: "isCurrent" });
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst.mock.calls[0][0].where).toMatchObject({
      tenantId: "tenant-1",
      isCurrent: true,
      isClosed: false,
    });
  });

  it("does not consult the date range once a flagged year is found", async () => {
    const { findFirst, reader } = readerReturning({ id: "ay-flagged" });
    await resolveActiveAcademicYear("tenant-1", reader);
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it("falls back to the open year whose range covers today", async () => {
    const { findFirst, reader } = readerReturning(null, { id: "ay-by-date" });

    const resolution = await resolveActiveAcademicYear("tenant-1", reader);

    expect(resolution).toEqual({ id: "ay-by-date", source: "dateRange" });
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it("falls back to the latest open year when no range covers today", async () => {
    const { reader } = readerReturning(null, null, { id: "ay-latest-open" });
    const resolution = await resolveActiveAcademicYear("tenant-1", reader);
    expect(resolution).toEqual({ id: "ay-latest-open", source: "latestOpen" });
  });

  it("falls back to the latest year of any kind, closed included", async () => {
    const { reader } = readerReturning(null, null, null, { id: "ay-latest-any" });
    const resolution = await resolveActiveAcademicYear("tenant-1", reader);
    expect(resolution).toEqual({ id: "ay-latest-any", source: "latestAny" });
  });

  it("reports an empty institute rather than guessing", async () => {
    const { reader } = readerReturning(null, null, null, null);
    const resolution = await resolveActiveAcademicYear("tenant-1", reader);
    expect(resolution).toEqual({ id: "", source: "none" });
  });
});

describe("resolveActiveAcademicYear — determinism", () => {
  /**
   * This is the defect the flag exists to remove. Two years covering today is
   * normal — a school opens next year's records before closing this one — and
   * the old query was `findFirst` with no `orderBy`, so which of the two came
   * back was up to the query planner and could differ between two identical
   * requests.
   */
  it("orders every tier newest-first so overlapping years resolve the same way twice", async () => {
    const { findFirst, reader } = readerReturning(null, { id: "ay-newest" });

    await resolveActiveAcademicYear("tenant-1", reader);
    await resolveActiveAcademicYear("tenant-1", reader);

    for (const call of findFirst.mock.calls) {
      expect(call[0].orderBy).toEqual({ startDate: "desc" });
    }
  });

  it("scopes every tier to the tenant", async () => {
    const { findFirst, reader } = readerReturning(null, null, null, null);

    await resolveActiveAcademicYear("tenant-42", reader);

    expect(findFirst).toHaveBeenCalledTimes(4);
    for (const call of findFirst.mock.calls) {
      expect(call[0].where).toMatchObject({ tenantId: "tenant-42" });
    }
  });

  it("ignores a closed year even when it is flagged current", async () => {
    // A closed year cannot be the operating year. The query says so, so a
    // stale flag cannot pin the institute to a closed year.
    const { findFirst, reader } = readerReturning(null, { id: "ay-open" });

    const resolution = await resolveActiveAcademicYear("tenant-1", reader);

    expect(findFirst.mock.calls[0][0].where).toMatchObject({ isClosed: false });
    expect(resolution.source).toBe("dateRange");
  });
});

describe("resolveActiveAcademicYearId", () => {
  it("returns just the id", async () => {
    const { reader } = readerReturning({ id: "ay-flagged" });
    await expect(resolveActiveAcademicYearId("tenant-1", reader)).resolves.toBe("ay-flagged");
  });

  it("returns an empty string when the tenant has no years", async () => {
    const { reader } = readerReturning(null, null, null, null);
    await expect(resolveActiveAcademicYearId("tenant-1", reader)).resolves.toBe("");
  });
});
