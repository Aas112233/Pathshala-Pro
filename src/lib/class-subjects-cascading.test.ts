import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getSubjects } from "@/app/api/subjects/route";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  subject: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/api-auth", () => ({
  requireApiAccess: vi.fn().mockResolvedValue({
    authContext: { userId: "user-1", tenantId: "mhs", role: "ADMIN" },
  }),
}));

describe("GET /api/subjects Cascading Class-Subject Filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries without classSubjects filter when classId is not provided", async () => {
    db.subject.findMany.mockResolvedValue([
      { id: "sub-1", name: "Mathematics" },
      { id: "sub-2", name: "Science" },
    ]);

    const req = new NextRequest("http://localhost:3000/api/subjects");
    const res = await getSubjects(req);
    expect(res).toBeDefined();
    const json = await res!.json();

    expect(res!.status).toBe(200);
    expect(json.success).toBe(true);
    expect(db.subject.findMany).toHaveBeenCalledWith({
      where: { tenantId: "mhs" },
      orderBy: { name: "asc" },
    });
  });

  it("queries with classSubjects.some when classId is provided", async () => {
    db.subject.findMany.mockResolvedValue([
      { id: "sub-1", name: "Mathematics" },
    ]);

    const req = new NextRequest("http://localhost:3000/api/subjects?classId=cls-10");
    const res = await getSubjects(req);
    expect(res).toBeDefined();
    const json = await res!.json();

    expect(res!.status).toBe(200);
    expect(json.success).toBe(true);
    expect(db.subject.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "mhs",
        classSubjects: {
          some: { classId: "cls-10", tenantId: "mhs" },
        },
      },
      orderBy: { name: "asc" },
    });
  });
});
