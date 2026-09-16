import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/class-subjects/route";

const db = vi.hoisted(() => ({
  class: { findUnique: vi.fn() },
  subject: { findMany: vi.fn() },
  classSubject: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/api-auth", () => ({
  requireApiAccess: vi.fn().mockResolvedValue({
    authContext: { userId: "user-1", tenantId: "mhs", role: "ADMIN" },
  }),
}));

async function postSubjects(body: Record<string, unknown>) {
  const response = await POST(new NextRequest("http://localhost:3000/api/class-subjects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
  if (!response) throw new Error("Expected an API response");
  return response;
}

function expectTransaction(includeCreate: boolean) {
  const operations = [db.classSubject.deleteMany.mock.results[0].value];
  if (includeCreate) operations.push(db.classSubject.createMany.mock.results[0].value);
  expect(db.$transaction).toHaveBeenCalledExactlyOnceWith(operations);
  expect(db.classSubject.deleteMany).toHaveBeenCalledExactlyOnceWith({
    where: { tenantId: "mhs", classId: "class-1" },
  });
}

describe("POST /api/class-subjects replacement transaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.class.findUnique.mockResolvedValue({ id: "class-1" });
    db.subject.findMany.mockResolvedValue([{ id: "sub-1", subjectId: "SUB-MATH" }]);
    db.classSubject.deleteMany.mockResolvedValue({ count: 1 });
    db.classSubject.createMany.mockResolvedValue({ count: 1 });
    db.classSubject.findMany.mockResolvedValue([]);
    db.$transaction.mockResolvedValue([{ count: 1 }, { count: 1 }]);
  });

  it.each([{}, { isCompulsory: false, sortOrder: 3 }])("replaces using public subject IDs and preserves defaults or overrides: %j", async (options) => {
    const result = [{ id: "mapping-1", subject: { subjectId: "SUB-MATH", name: "Math" } }];
    db.classSubject.findMany.mockResolvedValueOnce(result);
    const response = await postSubjects({
      classId: "class-1",
      subjects: [{ subjectId: "SUB-MATH", ...options }],
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      success: true, data: result, message: "Subjects assigned to class successfully",
    });
    expectTransaction(true);
    expect(db.class.findUnique).toHaveBeenCalledWith({ where: { id: "class-1", tenantId: "mhs" } });
    expect(db.subject.findMany).toHaveBeenCalledWith({
      where: { tenantId: "mhs", subjectId: { in: ["SUB-MATH"] } },
      select: { id: true, subjectId: true },
    });
    expect(db.classSubject.createMany).toHaveBeenCalledExactlyOnceWith({
      data: [{ tenantId: "mhs", classId: "class-1", subjectId: "sub-1", isCompulsory: true, sortOrder: 0, ...options }],
    });
    expect(db.classSubject.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: "mhs", classId: "class-1" }, orderBy: { sortOrder: "asc" },
    }));
  });

  it("clears assignments in a delete-only transaction for an empty array", async () => {
    db.subject.findMany.mockResolvedValueOnce([]);
    const response = await postSubjects({ classId: "class-1", subjects: [] });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ success: true, data: [] });
    expectTransaction(false);
    expect(db.classSubject.createMany).not.toHaveBeenCalled();
  });

  it("returns the existing error contract and skips the result query when the transaction fails", async () => {
    db.$transaction.mockRejectedValueOnce({ code: "P2003", meta: { field_name: "subjectId" } });
    const response = await postSubjects({ classId: "class-1", subjects: [{ subjectId: "SUB-MATH" }] });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: true, details: [{ field: "subjectId", code: "FOREIGN_KEY_CONSTRAINT" }],
    });
    expectTransaction(true);
    expect(db.classSubject.findMany).not.toHaveBeenCalled();
  });

  it.each([
    [{ subjects: [] }, "classId and subjects array are required"],
    [{ classId: "class-1", subjects: "SUB-MATH" }, "classId and subjects array are required"],
    [{ classId: "class-1", subjects: [{ subjectId: "missing" }] }, "One or more subjects not found"],
  ])("rejects invalid input before any writes: %j", async (body, message) => {
    db.subject.findMany.mockResolvedValueOnce([]);
    const response = await postSubjects(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: true, message });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.classSubject.deleteMany).not.toHaveBeenCalled();
    expect(db.classSubject.createMany).not.toHaveBeenCalled();
  });
});
