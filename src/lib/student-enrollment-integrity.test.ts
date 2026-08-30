import { describe, expect, it } from "vitest";
import { getLockedStudentPlacementFields, hasStudentHistoricalUsage } from "@/lib/data-integrity";

const emptyUsage = {
  feeVouchers: 0,
  attendances: 0,
  examResults: 0,
  promotions: 0,
  bookIssues: 0,
  transportAllocations: 0,
};

describe("student enrollment immutability", () => {
  it("locks placement edits when any historical dependency exists", () => {
    expect(hasStudentHistoricalUsage({ ...emptyUsage, bookIssues: 1 })).toBe(true);
    expect(getLockedStudentPlacementFields(
      { ...emptyUsage, transportAllocations: 1 },
      { classId: "class-2", groupId: "group-2", sectionId: "section-2", rollNumber: "0002" },
      { classId: "class-1", groupId: "group-1", sectionId: "section-1", rollNumber: "0001" },
    )).toEqual(["classId", "groupId", "sectionId", "rollNumber"]);
  });

  it("allows placement changes only for students with no historical usage", () => {
    expect(getLockedStudentPlacementFields(
      emptyUsage,
      { classId: "class-2" },
      { classId: "class-1" },
    )).toEqual([]);
  });
});
