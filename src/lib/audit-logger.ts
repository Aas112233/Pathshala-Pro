import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "PAYMENT"
  | "ATTENDANCE"
  | "GRADE_CHANGE"
  | "LOGIN"
  | "IMPERSONATION"
  /** Year lifecycle. A closed or rolled-over year changes what every other
   *  record means, so these are their own actions rather than an UPDATE. */
  | "CLOSE"
  | "REOPEN"
  | "ROLLOVER"
  | "PROMOTE"
  | "ISSUE"
  /** A balance the school decided it will not collect. It changes what the
   *  year's receivable means, so it is its own action rather than an UPDATE. */
  | "WRITE_OFF";

export type AuditEntity =
  | "Student"
  | "FeeVoucher"
  | "Transaction"
  | "Attendance"
  | "ExamResult"
  | "Staff"
  | "User"
  | "Salary"
  | "Settings"
  | "Tenant"
  | "AcademicYear"
  | "Promotion"
  | "Certificate";

export interface AuditEventInput {
  tenantId: string;
  userId?: string;
  userEmail?: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * The slice of the Prisma client the logger writes through. Both the full
 * client and a transaction client satisfy it.
 */
type AuditWriter = Pick<Prisma.TransactionClient, "auditLog">;

/**
 * Universal audit logger.
 * Captures sensitive mutations and security events across the multi-tenant ERP.
 *
 * By default this is best-effort: a failure to write an audit row must never
 * roll back the business operation that produced it, so errors are logged and
 * swallowed. Pass `client` to make the write part of a transaction instead —
 * use that where losing the audit row would leave the system unexplainable,
 * such as closing or rolling over an academic year.
 */
export async function logAuditEvent(
  event: AuditEventInput,
  client: AuditWriter = prisma
): Promise<void> {
  const data = {
    tenantId: event.tenantId,
    userId: event.userId,
    userEmail: event.userEmail,
    action: event.action,
    entity: event.entity,
    entityId: event.entityId,
    details: (event.details ?? undefined) as Prisma.InputJsonValue | undefined,
    ipAddress: event.ipAddress,
  };

  // A transaction client must not swallow its own errors: the caller asked for
  // the entry to be atomic with the change it describes.
  if (client !== prisma) {
    await client.auditLog.create({ data });
    return;
  }

  try {
    await client.auditLog.create({ data });
  } catch (err) {
    console.error("[AuditLogger Error] Failed to write audit event:", err);
  }
}
