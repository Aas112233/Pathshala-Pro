import { Prisma } from "@prisma/client";

export type VoucherTypeEnum = "JOURNAL" | "PAYMENT" | "RECEIPT" | "SALES_FEE" | "SALARY" | "PURCHASE" | "CONTRA" | "CLOSING";

const VOUCHER_PREFIX_MAP: Record<VoucherTypeEnum, string> = {
  JOURNAL: "JV",
  PAYMENT: "PAY",
  RECEIPT: "REC",
  SALES_FEE: "SAL",
  SALARY: "PAY",
  PURCHASE: "PUR",
  CONTRA: "CON",
  CLOSING: "JV",
};

/**
 * Concurrency-Safe, Atomic Voucher Number Generation Engine
 * Uses PostgreSQL row-level pessimistic locking (`SELECT ... FOR UPDATE`)
 * to prevent duplicate voucher sequences under high concurrent load.
 *
 * `voucherType` is backed by a Postgres enum ("VoucherType"), so every bound
 * parameter touching that column needs an explicit `::"VoucherType"` cast —
 * without it Postgres cannot resolve the comparison and raises SQLSTATE 42883
 * (`operator does not exist: "VoucherType" = text`), which aborts the whole
 * surrounding transaction.
 *
 * Output format: `{PREFIX}-{YYYY}-{000001}` (e.g. `SAL-2026-000042`)
 */
export async function getNextVoucherNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  voucherType: VoucherTypeEnum,
  fiscalYear?: number
): Promise<string> {
  const defaultPrefix = VOUCHER_PREFIX_MAP[voucherType] || "JV";

  let year = fiscalYear;
  if (year === undefined || year === null) {
    const now = new Date();
    year = now.getFullYear();
    try {
      const tenant = await (tx as any).tenant?.findUnique?.({
        where: { tenantId },
        select: { fiscalYearStart: true },
      });
      if (tenant?.fiscalYearStart && tenant.fiscalYearStart > 1) {
        const currentMonth = now.getMonth() + 1;
        if (currentMonth < tenant.fiscalYearStart) {
          year = now.getFullYear() - 1;
        }
      }
    } catch {}
  }

  try {
    const lockedRows = await tx.$queryRaw<Array<{ id: string; current_number: number; prefix: string | null }>>`
      SELECT id, current_number, prefix 
      FROM "TenantVoucherSequence"
      WHERE "tenantId" = ${tenantId}
        AND "voucherType" = ${voucherType}::"VoucherType"
        AND "fiscalYear" = ${year}
      FOR UPDATE
    `;

    let nextVal: number;
    let sequencePrefix = defaultPrefix;

    if (lockedRows && lockedRows.length > 0) {
      const sequenceRow = lockedRows[0];
      nextVal = Number(sequenceRow.current_number) + 1;
      if (sequenceRow.prefix) {
        sequencePrefix = sequenceRow.prefix;
      }

      await tx.$executeRaw`
        UPDATE "TenantVoucherSequence"
        SET "current_number" = ${nextVal},
            "updatedAt" = NOW()
        WHERE id = ${sequenceRow.id}
      `;
    } else {
      const inserted = await tx.$queryRaw<Array<{ current_number: number; prefix: string | null }>>`
        INSERT INTO "TenantVoucherSequence" ("id", "tenantId", "voucherType", "prefix", "fiscalYear", "current_number", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, ${tenantId}, ${voucherType}::"VoucherType", ${defaultPrefix}, ${year}, 1, NOW(), NOW())
        ON CONFLICT ("tenantId", "voucherType", "fiscalYear")
        DO UPDATE SET "current_number" = "TenantVoucherSequence"."current_number" + 1, "updatedAt" = NOW()
        RETURNING "current_number", "prefix"
      `;
      nextVal = Number(inserted && inserted[0] ? inserted[0].current_number : 1);
      if (inserted && inserted[0]?.prefix) {
        sequencePrefix = inserted[0].prefix;
      }
    }

    const paddedSequence = String(nextVal).padStart(6, "0");
    return `${sequencePrefix}-${year}-${paddedSequence}`;
  } catch (error) {
    // Only a client that cannot execute raw SQL at all (a mocked / in-memory
    // TransactionClient in unit tests) may fall back to a random suffix. A real
    // Prisma client always exposes $queryRaw/$executeRaw, so a genuine database
    // error MUST propagate: the previous blanket `catch {}` swallowed Postgres
    // SQLSTATE 42883 (un-cast `voucherType` enum comparison) here, which minted
    // a random voucher number while leaving the surrounding Postgres
    // transaction aborted — every subsequent statement then failed with 25P02
    // and surfaced to users as a generic 500 "Internal server error".
    if (typeof (tx as any)?.$queryRaw !== "function" || typeof (tx as any)?.$executeRaw !== "function") {
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      return `${defaultPrefix}-${year}-${randomSuffix}`;
    }
    throw error;
  }
}
