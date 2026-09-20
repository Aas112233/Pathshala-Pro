import { describe, it, expect, vi } from "vitest";
import {
  forceDeleteTenant,
  isProtectedTenantId,
} from "@/lib/superadmin-service";
import { forceDeleteTenantSchema } from "@/lib/schemas";

const DELETE_MANY_MODELS = [
  "graceMarkLedger",
  "examComponentResult",
  "studentWalletLedger",
  "healthRecord",
  "parentStudentLink",
  "studentAcademicSession",
  "classPromotion",
  "feeInvoiceItem",
  "journalLineItem",
  "transaction",
  "feeVoucher",
  "studentFeeConcession",
  "salaryLedger",
  "attendance",
  "homeworkSubmission",
  "leaveApplication",
  "bookIssue",
  "transportAllocation",
  "hostelAllocation",
  "certificate",
  "examResult",
  "inventoryTransaction",
  "teacherSubstitution",
  "homework",
  "calendarEvent",
  "enquiry",
  "question",
  "questionPaperSet",
  "questionPaperVersion",
  "questionPaper",
  "syllabusWeight",
  "classSubject",
  "subjectAssessmentComponent",
  "examSubject",
  "promotionRule",
  "classFeeStructure",
  "academicHoliday",
  "applicantDocument",
  "admissionApplication",
  "expense",
  "vehicleExpenseLog",
  "transportRoute",
  "journalEntry",
  "financialPeriod",
  "feeHead",
  "chartOfAccount",
  "tenantVoucherSequence",
  "timetable",
  "expenseCategory",
  "inventoryItem",
  "book",
  "hostelRoom",
  "hostel",
  "transportVehicle",
  "exam",
  "subject",
  "section",
  "group",
  "class",
  "staffProfile",
  "user",
  "studentProfile",
  "academicYear",
  "fiscalYear",
  "auditLog",
  "notice",
  "bankAccount",
  "subscriptionChangeLog",
  "tenantSubscription",
  "tenantFeatureOverride",
];

function buildMockTx(tenant: any) {
  const tx: any = {};
  for (const m of DELETE_MANY_MODELS) {
    tx[m] = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) };
  }
  tx.user.count = vi.fn().mockResolvedValue(3);
  tx.studentProfile.count = vi.fn().mockResolvedValue(120);
  tx.staffProfile.count = vi.fn().mockResolvedValue(15);
  tx.feeVoucher.count = vi.fn().mockResolvedValue(400);
  tx.transaction.count = vi.fn().mockResolvedValue(350);
  tx.chartOfAccount.updateMany = vi.fn().mockResolvedValue({ count: 5 });
  tx.tenant = {
    findUnique: vi.fn().mockResolvedValue(tenant),
    delete: vi.fn().mockResolvedValue(tenant),
  };
  tx.superAdminActionLog = { create: vi.fn().mockResolvedValue({ id: "log-del-1" }) };
  return tx;
}

const adminContext = {
  adminUserId: "sys-admin-1",
  adminEmail: "superadmin@pathshala.pro",
};

describe("Tenant force-delete guards", () => {
  it("protects the platform SYSTEM tenant in every casing", () => {
    expect(isProtectedTenantId("SYSTEM")).toBe(true);
    expect(isProtectedTenantId("system")).toBe(true);
    expect(isProtectedTenantId(" System-Platform ")).toBe(true);
    expect(isProtectedTenantId("platform")).toBe(true);
    expect(isProtectedTenantId("")).toBe(true);
    expect(isProtectedTenantId(null)).toBe(true);
    expect(isProtectedTenantId(undefined)).toBe(true);
  });

  it("allows ordinary school slugs", () => {
    expect(isProtectedTenantId("greenwood-high")).toBe(false);
    expect(isProtectedTenantId("school-1")).toBe(false);
  });

  it("refuses to wipe the SYSTEM tenant", async () => {
    const tx = buildMockTx({ tenantId: "SYSTEM", name: "Platform" });
    await expect(
      forceDeleteTenant(tx, { tenantId: "SYSTEM", reason: "closure request", context: adminContext })
    ).rejects.toThrow("SYSTEM tenant can never be deleted");
    expect(tx.tenant.delete).not.toHaveBeenCalled();
  });

  it("throws when the tenant does not exist", async () => {
    const tx = buildMockTx(null);
    await expect(
      forceDeleteTenant(tx, { tenantId: "ghost-school", reason: "closure request", context: adminContext })
    ).rejects.toThrow("not found");
    expect(tx.tenant.delete).not.toHaveBeenCalled();
  });
});

describe("forceDeleteTenantSchema", () => {
  const valid = {
    confirmTenantId: "greenwood",
    confirmName: "Greenwood High",
    acknowledged: true,
    reason: "School closure requested by owner",
  };

  it("accepts a fully confirmed payload", () => {
    expect(forceDeleteTenantSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects missing acknowledgement and short reasons", () => {
    expect(
      forceDeleteTenantSchema.safeParse({ ...valid, acknowledged: false }).success
    ).toBe(false);
    expect(
      forceDeleteTenantSchema.safeParse({ ...valid, reason: "oops" }).success
    ).toBe(false);
    expect(
      forceDeleteTenantSchema.safeParse({ ...valid, confirmTenantId: "" }).success
    ).toBe(false);
  });
});

describe("forceDeleteTenant happy path", () => {
  it("wipes dependents, deletes the tenant, and keeps a platform audit trail", async () => {
    const tenant = { tenantId: "greenwood", name: "Greenwood High" };
    const tx = buildMockTx(tenant);

    const result = await forceDeleteTenant(tx, {
      tenantId: "greenwood",
      reason: "School closure requested by owner",
      context: adminContext,
    });

    expect(result.deletedTenantId).toBe("greenwood");
    expect(result.deletedName).toBe("Greenwood High");
    expect(result.counts).toEqual({
      users: 3,
      studentProfiles: 120,
      staffProfiles: 15,
      feeVouchers: 400,
      transactions: 350,
    });

    // Every dependent table is wiped scoped to the tenant.
    for (const m of DELETE_MANY_MODELS) {
      expect(tx[m].deleteMany).toHaveBeenCalledWith({ where: { tenantId: "greenwood" } });
    }
    // Self-referencing chart hierarchy is detached before deletion.
    expect(tx.chartOfAccount.updateMany).toHaveBeenCalledWith({
      where: { tenantId: "greenwood" },
      data: { parentAccountId: null },
    });
    expect(tx.tenant.delete).toHaveBeenCalledWith({ where: { tenantId: "greenwood" } });

    // Surviving forensic trail with the operator reason.
    expect(tx.superAdminActionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: "TENANT_FORCE_DELETE",
          targetTenantId: "greenwood",
          adminEmail: adminContext.adminEmail,
        }),
      })
    );
    const details = tx.superAdminActionLog.create.mock.calls[0][0].data.details;
    expect(details.reason).toBe("School closure requested by owner");
    expect(details.deletedTenantName).toBe("Greenwood High");
  });
});
