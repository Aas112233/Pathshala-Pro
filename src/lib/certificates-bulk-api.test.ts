// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Route-level suite for POST /api/certificates/bulk.
 *
 * The batch exists so a year-end exit run does not fire N single-issue requests
 * that each re-read the same "latest certificate number" row. These tests pin
 * the contract that makes that safe:
 *   - every student in the batch is written inside one transaction;
 *   - numbers are allocated once, in a contiguous run;
 *   - a student who already holds an active transfer certificate is *skipped*
 *     and reported, never silently duplicated and never failing the batch;
 *   - an unknown or repeated student id is a 400, not a silent drop.
 */

const db = vi.hoisted(() => ({
  studentProfile: { findMany: vi.fn() },
  certificate: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

const tx = vi.hoisted(() => ({
  certificate: { findMany: vi.fn(), create: vi.fn() },
  auditLog: { create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/api-auth", () => ({
  requireApiAccess: vi.fn().mockResolvedValue({
    authContext: { tenantId: "tenant-1", user: { id: "user-1" } },
  }),
}));

import { POST as POST_ROUTE } from "@/app/api/certificates/bulk/route";

/**
 * `requireApiAccess` can short-circuit, so the handler is inferred as
 * `NextResponse | undefined`. It never short-circuits in these tests.
 */
const POST = POST_ROUTE as unknown as (request: NextRequest) => Promise<Response>;

function student(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    studentId: `ADM-${id}`,
    firstName: `First${id}`,
    lastName: `Last${id}`,
    rollNumber: `R-${id}`,
    fatherName: `Father ${id}`,
    guardianName: `Guardian ${id}`,
    dateOfBirth: new Date("2012-05-04"),
    admissionDate: new Date("2020-04-01"),
    class: { name: "Class 5" },
    section: { name: "A" },
    ...overrides,
  };
}

function post(body: unknown) {
  return new NextRequest("http://localhost/api/certificates/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Defaults: three students, none holding an active transfer certificate. */
function primeHappyPath() {
  db.studentProfile.findMany.mockResolvedValue([student("s1"), student("s2"), student("s3")]);
  db.certificate.findMany.mockResolvedValue([]);
  tx.certificate.findMany.mockResolvedValue([]);
  tx.certificate.create.mockImplementation(async ({ data }: any) => ({
    id: `cert-${data.certificateNumber}`,
    certificateNumber: data.certificateNumber,
    certificateType: data.certificateType,
    issueDate: data.issueDate,
    validUntil: data.validUntil ?? null,
    purpose: data.purpose ?? null,
    status: data.status,
    studentProfileId: data.studentProfileId,
  }));
  db.$transaction.mockImplementation(async (fn: any) => fn(tx));
}

beforeEach(() => {
  vi.clearAllMocks();
  primeHappyPath();
});

describe("POST /api/certificates/bulk — happy path", () => {
  it("issues one certificate per student inside a single transaction", async () => {
    const response = await POST(post({ studentProfileIds: ["s1", "s2", "s3"], certificateType: "TRANSFER" }));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.data.issued).toHaveLength(3);
    expect(json.data.skipped).toHaveLength(0);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.certificate.create).toHaveBeenCalledTimes(3);
  });

  it("allocates a contiguous run of numbers from a single probe", async () => {
    await POST(post({ studentProfileIds: ["s1", "s2", "s3"], certificateType: "TRANSFER" }));

    // One read of the high-water mark for the whole batch, not one per student.
    expect(tx.certificate.findMany).toHaveBeenCalledTimes(1);

    const sequences = tx.certificate.create.mock.calls.map((call: any[]) =>
      String(call[0].data.certificateNumber).split("-")[3]
    );
    expect(sequences).toEqual(["00001", "00002", "00003"]);
  });

  it("continues from the highest existing number for the type", async () => {
    tx.certificate.findMany.mockResolvedValue([
      { certificateNumber: "CERT-TRANSFER-2026-00040-AAAAAAAA" },
    ]);

    await POST(post({ studentProfileIds: ["s1", "s2"], certificateType: "TRANSFER" }));

    const sequences = tx.certificate.create.mock.calls.map((call: any[]) =>
      String(call[0].data.certificateNumber).split("-")[3]
    );
    expect(sequences).toEqual(["00041", "00042"]);
  });

  it("returns print-ready student details with each certificate", async () => {
    const response = await POST(post({ studentProfileIds: ["s1"], certificateType: "TRANSFER" }));
    const json = await response.json();

    expect(json.data.issued[0].student).toMatchObject({
      id: "s1",
      studentId: "ADM-s1",
      firstName: "Firsts1",
      lastName: "Lasts1",
      className: "Class 5",
      sectionName: "A",
    });
  });

  it("records the issuing user and scopes every read to the tenant", async () => {
    await POST(post({ studentProfileIds: ["s1"], certificateType: "TRANSFER" }));

    expect(tx.certificate.create.mock.calls[0][0].data.issuedById).toBe("user-1");
    expect(db.studentProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-1" }) })
    );
    expect(db.certificate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-1" }) })
    );
  });

  it("audits the batch inside the transaction that issued it", async () => {
    await POST(post({ studentProfileIds: ["s1", "s2"], certificateType: "TRANSFER" }));

    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    const { data } = tx.auditLog.create.mock.calls[0][0];
    expect(data).toMatchObject({
      tenantId: "tenant-1",
      userId: "user-1",
      action: "ISSUE",
      entity: "Certificate",
    });
    expect(data.details.issuedCount).toBe(2);
    expect(data.details.certificateNumbers).toHaveLength(2);
  });
});

describe("POST /api/certificates/bulk — already-issued students", () => {
  it("skips a student who already holds an active transfer certificate", async () => {
    db.certificate.findMany.mockResolvedValue([
      { studentProfileId: "s2", certificateNumber: "CERT-TRANSFER-2026-00009-FFFFFFFF" },
    ]);

    const response = await POST(post({ studentProfileIds: ["s1", "s2", "s3"], certificateType: "TRANSFER" }));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.data.issued.map((c: any) => c.studentProfileId)).toEqual(["s1", "s3"]);
    expect(json.data.skipped).toEqual([
      expect.objectContaining({ studentProfileId: "s2", code: "CERTIFICATE_ALREADY_ACTIVE" }),
    ]);
    expect(tx.certificate.create).toHaveBeenCalledTimes(2);
  });

  it("reports an entirely skipped batch without writing anything", async () => {
    db.certificate.findMany.mockResolvedValue([
      { studentProfileId: "s1", certificateNumber: "CERT-TRANSFER-2026-00001-AAAAAAAA" },
    ]);

    const response = await POST(post({ studentProfileIds: ["s1"], certificateType: "TRANSFER" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.issued).toEqual([]);
    expect(json.data.skipped).toHaveLength(1);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("does not apply the guard to certificate types that legitimately repeat", async () => {
    await POST(post({ studentProfileIds: ["s1"], certificateType: "BONAFIDE" }));

    // No lookup for an existing active certificate of a repeatable type.
    expect(db.certificate.findMany).not.toHaveBeenCalled();
    expect(tx.certificate.create).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/certificates/bulk — rejected batches", () => {
  it("rejects a repeated student id instead of issuing twice", async () => {
    const response = await POST(post({ studentProfileIds: ["s1", "s1"], certificateType: "TRANSFER" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.details[0].code).toBe("DUPLICATE_STUDENT");
    expect(tx.certificate.create).not.toHaveBeenCalled();
  });

  it("rejects a student who does not belong to the tenant", async () => {
    db.studentProfile.findMany.mockResolvedValue([student("s1")]);

    const response = await POST(post({ studentProfileIds: ["s1", "s9"], certificateType: "TRANSFER" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.details[0].code).toBe("STUDENT_NOT_FOUND");
    expect(tx.certificate.create).not.toHaveBeenCalled();
  });

  it("rejects an empty selection", async () => {
    const response = await POST(post({ studentProfileIds: [], certificateType: "TRANSFER" }));
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json.error).toBe(true);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an unparseable issue date", async () => {
    const response = await POST(
      post({ studentProfileIds: ["s1"], certificateType: "TRANSFER", issueDate: "not-a-date" })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.details[0].code).toBe("INVALID_DATE");
  });

  it("rejects a body that is not JSON", async () => {
    const request = new NextRequest("http://localhost/api/certificates/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{{{",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("POST /api/certificates/bulk — exit-workflow defaults", () => {
  it("dates every certificate in the batch from the batch issue date", async () => {
    await POST(
      post({
        studentProfileIds: ["s1", "s2"],
        certificateType: "TRANSFER",
        issueDate: "2026-06-30T00:00:00.000Z",
      })
    );

    for (const call of tx.certificate.create.mock.calls) {
      expect(call[0].data.issueDate.toISOString()).toBe("2026-06-30T00:00:00.000Z");
    }
  });

  it("accepts a character certificate for a graduate", async () => {
    db.studentProfile.findMany.mockResolvedValue([student("s1")]);

    const response = await POST(post({ studentProfileIds: ["s1"], certificateType: "CHARACTER" }));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.data.issued[0].certificateType).toBe("CHARACTER");
  });
});
