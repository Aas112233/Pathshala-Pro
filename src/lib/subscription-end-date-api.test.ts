import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as postEndDate } from "@/app/api/system-admin/subscriptions/end-date/route";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/api-auth", () => ({
  requireApiAccess: vi.fn().mockResolvedValue({
    authContext: {
      user: { id: "admin-1", email: "sys@pathshala.pro", role: "SYSTEM_ADMIN", tenantId: "platform" },
      isImpersonated: false,
    },
  }),
}));

const previousSubscription = {
  tenantId: "mhs",
  status: "ACTIVE",
  planId: "plan-starter",
  gracePeriodDays: 7,
  subscriptionEndAt: new Date("2027-01-01T00:00:00.000Z"),
  currentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
  plan: { code: "PRO", name: "Pro" },
};

describe("POST /api/system-admin/subscriptions/end-date", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("overrides the end date-time through the subscription engine", async () => {
    const updated = { ...previousSubscription, subscriptionEndAt: new Date("2027-06-30T23:59:00.000Z") };
    vi.spyOn(prisma, "$transaction").mockImplementation(async (fn: any) =>
      fn({
        tenantSubscription: {
          findUnique: vi.fn().mockResolvedValue(previousSubscription),
          update: vi.fn().mockResolvedValue(updated),
        },
        tenant: { update: vi.fn().mockResolvedValue({}) },
        subscriptionChangeLog: { create: vi.fn().mockResolvedValue({}) },
        superAdminActionLog: { create: vi.fn().mockResolvedValue({}) },
        notice: { create: vi.fn().mockResolvedValue({}) },
      })
    );

    const req = new NextRequest("http://localhost/api/system-admin/subscriptions/end-date", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: "mhs", subscriptionEndAt: "2027-06-30T23:59" }),
    });

    const res = (await postEndDate(req))!;
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.subscriptionEndAt).toBeDefined();
  });

  it("rejects a malformed end date-time before touching the database", async () => {
    const req = new NextRequest("http://localhost/api/system-admin/subscriptions/end-date", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: "mhs", subscriptionEndAt: "2027-02-30T10:00" }),
    });

    const res = (await postEndDate(req))!;
    expect(res.status).toBe(400);
  });

  it("rejects a non-integer or out-of-range grace period", async () => {
    for (const gracePeriodDays of [-1, 1.5, 3651]) {
      const req = new NextRequest("http://localhost/api/system-admin/subscriptions/end-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: "mhs", subscriptionEndAt: "2027-06-30T23:59", gracePeriodDays }),
      });
      const res = (await postEndDate(req))!;
      expect(res.status).toBe(400);
    }
  });
});
