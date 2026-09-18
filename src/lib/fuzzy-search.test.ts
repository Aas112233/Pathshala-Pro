import { describe, it, expect } from "vitest";
import { fuzzyMatch, fuzzyFilter } from "@/lib/utils";

describe("fuzzyMatch utility", () => {
  it("matches exact text with highest score", () => {
    const res = fuzzyMatch("Abdul Karim", "Abdul Karim");
    expect(res.matches).toBe(true);
    expect(res.score).toBe(1000);
  });

  it("matches case-insensitively and prefixes", () => {
    const res = fuzzyMatch("abdul", "Abdul Karim (101)");
    expect(res.matches).toBe(true);
    expect(res.score).toBeGreaterThan(500);
  });

  it("matches out-of-order tokens (e.g. Karim Abdul)", () => {
    const res = fuzzyMatch("Karim Abdul", "Abdul Karim • STU-001");
    expect(res.matches).toBe(true);
    expect(res.score).toBeGreaterThan(300);
  });

  it("matches with 1 typo tolerance for misspelled names", () => {
    // "Abul" instead of "Abdul" (omitted 'd')
    const res = fuzzyMatch("Abul", "Abdul Karim");
    expect(res.matches).toBe(true);

    // "Tarique" instead of "Tariq"
    const res2 = fuzzyMatch("Tarique", "Dr. Tariq Mahmood");
    expect(res2.matches).toBe(true);
  });

  it("matches subsequence initials (e.g. 'akr' for 'Abdul Karim')", () => {
    const res = fuzzyMatch("akr", "Abdul Karim");
    expect(res.matches).toBe(true);
  });

  it("rejects non-matching text", () => {
    const res = fuzzyMatch("Zainab", "Abdul Karim");
    expect(res.matches).toBe(false);
  });
});

describe("fuzzyFilter utility", () => {
  const students = [
    { id: "1", name: "Zainab Bibi (103)" },
    { id: "2", name: "Abdul Karim (101)" },
    { id: "3", name: "Karim Ullah (102)" },
    { id: "4", name: "Muhammad Abdullah (104)" },
  ];

  it("ranks exact and prefix matches above distant matches", () => {
    const filtered = fuzzyFilter(students, "abdul", (s) => s.name);
    expect(filtered.length).toBeGreaterThanOrEqual(2);
    // "Abdul Karim" starts with "Abdul", so should rank before "Muhammad Abdullah"
    expect(filtered[0].id).toBe("2");
  });

  it("handles out of order tokens and roll numbers", () => {
    const filtered = fuzzyFilter(students, "101 Karim", (s) => s.name);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("2");
  });
});
