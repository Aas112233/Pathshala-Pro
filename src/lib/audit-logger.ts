import { prisma } from "@/lib/prisma";

export interface AuditEventInput {
  tenantId: string;
  userId?: string;
  userEmail?: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "PAYMENT" | "ATTENDANCE" | "GRADE_CHANGE" | "LOGIN" | "IMPERSONATION";
  entity: "Student" | "FeeVoucher" | "Transaction" | "Attendance" | "ExamResult" | "Staff" | "User" | "Salary" | "Settings" | "Tenant";
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

/**
 * Universal async audit logger.
 * Captures sensitive mutations and security events across the multi-tenant ERP.
 */
export async function logAuditEvent(event: AuditEventInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: event.tenantId,
        userId: event.userId,
        userEmail: event.userEmail,
        action: event.action,
        entity: event.entity,
        entityId: event.entityId,
        details: event.details || undefined,
        ipAddress: event.ipAddress,
      },
    });
  } catch (err) {
    // Non-blocking: ensure primary workflow doesn't fail if audit logger throws
    console.error("[AuditLogger Error] Failed to write audit event:", err);
  }
}
