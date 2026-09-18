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
  fiscalYear: number = new Date().getFullYear()
): Promise<string> {
  const prefix = VOUCHER_PREFIX_MAP[voucherType] || "JV";

  try {
    const lockedRows = await tx.$queryRaw<Array<{ id: string; current_number: number }>>`
      SELECT id, current_number 
      FROM "TenantVoucherSequence"
      WHERE "tenantId" = ${tenantId}
        AND "voucherType" = ${voucherType}::"VoucherType"
        AND "fiscalYear" = ${fiscalYear}
      FOR UPDATE
    `;

    let nextVal: number;

    if (lockedRows && lockedRows.length > 0) {
      const sequenceRow = lockedRows[0];
      nextVal = Number(sequenceRow.current_number) + 1;

      await tx.$executeRaw`
        UPDATE "TenantVoucherSequence"
        SET "current_number" = ${nextVal},
            "updatedAt" = NOW()
        WHERE id = ${sequenceRow.id}
      `;
    } else {
      nextVal = 1;
      await tx.$executeRaw`
        INSERT INTO "TenantVoucherSequence" ("id", "tenantId", "voucherType", "prefix", "fiscalYear", "current_number", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, ${tenantId}, ${voucherType}::"VoucherType", ${prefix}, ${fiscalYear}, ${nextVal}, NOW(), NOW())
        ON CONFLICT ("tenantId", "voucherType", "fiscalYear")
        DO UPDATE SET "current_number" = "TenantVoucherSequence"."current_number" + 1, "updatedAt" = NOW()
      `;
    }

    const paddedSequence = String(nextVal).padStart(6, "0");
    return `${prefix}-${fiscalYear}-${paddedSequence}`;
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
      return `${prefix}-${fiscalYear}-${randomSuffix}`;
    }
    throw error;
  }
}
