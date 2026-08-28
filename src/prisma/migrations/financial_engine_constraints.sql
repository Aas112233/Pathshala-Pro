-- =========================================================================
-- Pathshala-Pro ERP: Enterprise Double-Entry Accounting Engine Integrity
-- Target: PostgreSQL 16+
-- =========================================================================

-- 1. Create Concurrency-Safe Voucher Sequence Table (if not exists)
CREATE TABLE IF NOT EXISTS "TenantVoucherSequence" (
    "id" TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "voucherType" TEXT NOT NULL,
    "prefix" VARCHAR(10) NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "current_number" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uq_tenant_voucher_seq" UNIQUE ("tenantId", "voucherType", "fiscalYear")
);

CREATE INDEX IF NOT EXISTS "idx_tenant_voucher_seq_lookup" 
ON "TenantVoucherSequence" ("tenantId", "voucherType", "fiscalYear");

-- 2. Line Item CHECK Constraints (Non-Negative, No Ghost Rows, Strict Polarization)
DO $$ 
BEGIN
    -- Check debit >= 0
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_journal_line_debit_non_negative') THEN
        ALTER TABLE "JournalLineItem" ADD CONSTRAINT "chk_journal_line_debit_non_negative" 
        CHECK ("debitAmount" >= 0.00);
    END IF;

    -- Check credit >= 0
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_journal_line_credit_non_negative') THEN
        ALTER TABLE "JournalLineItem" ADD CONSTRAINT "chk_journal_line_credit_non_negative" 
        CHECK ("creditAmount" >= 0.00);
    END IF;

    -- Check not both zero (no ghost lines)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_journal_line_not_both_zero') THEN
        ALTER TABLE "JournalLineItem" ADD CONSTRAINT "chk_journal_line_not_both_zero" 
        CHECK ("debitAmount" > 0.00 OR "creditAmount" > 0.00);
    END IF;

    -- Check not both positive (single entry line must be either Debit OR Credit, not both)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_journal_line_mutually_exclusive') THEN
        ALTER TABLE "JournalLineItem" ADD CONSTRAINT "chk_journal_line_mutually_exclusive" 
        CHECK (NOT ("debitAmount" > 0.00 AND "creditAmount" > 0.00));
    END IF;
END $$;

-- 3. Deferrable Commit-Time Invariant Trigger: Sum(Debits) === Sum(Credits)
CREATE OR REPLACE FUNCTION fn_verify_journal_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_total_debit NUMERIC(15, 2);
    v_total_credit NUMERIC(15, 2);
    v_entry_number TEXT;
    v_target_entry_id TEXT;
BEGIN
    v_target_entry_id := COALESCE(NEW."journalEntryId", OLD."journalEntryId");

    SELECT 
        COALESCE(SUM("debitAmount"), 0.00),
        COALESCE(SUM("creditAmount"), 0.00)
    INTO v_total_debit, v_total_credit
    FROM "JournalLineItem"
    WHERE "journalEntryId" = v_target_entry_id;

    IF v_total_debit <> v_total_credit THEN
        SELECT "entryNumber" INTO v_entry_number 
        FROM "JournalEntry" 
        WHERE "id" = v_target_entry_id;

        RAISE EXCEPTION 'DOUBLE_ENTRY_VIOLATION: Journal Entry % (%) does not balance. Total Debit: %, Total Credit: %, Diff: %',
            v_entry_number, v_target_entry_id, v_total_debit, v_total_credit, ABS(v_total_debit - v_total_credit);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate deferrable trigger
DROP TRIGGER IF EXISTS trg_deferrable_journal_balance ON "JournalLineItem";

CREATE CONSTRAINT TRIGGER trg_deferrable_journal_balance
AFTER INSERT OR UPDATE OR DELETE ON "JournalLineItem"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION fn_verify_journal_entry_balance();

-- 4. Closed Financial Period Mutation Lock Trigger
CREATE OR REPLACE FUNCTION fn_prevent_closed_period_mutations()
RETURNS TRIGGER AS $$
DECLARE
    v_check_date TIMESTAMP(3);
    v_tenant_id TEXT;
    v_is_closed BOOLEAN;
    v_year_label TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_check_date := OLD."postingDate";
        v_tenant_id := OLD."tenantId";
    ELSE
        v_check_date := NEW."postingDate";
        v_tenant_id := NEW."tenantId";
    END IF;

    -- Check if date falls in a closed Academic/Financial Year
    SELECT "isClosed", "label" 
    INTO v_is_closed, v_year_label
    FROM "AcademicYear"
    WHERE "tenantId" = v_tenant_id
      AND v_check_date BETWEEN "startDate" AND "endDate"
    LIMIT 1;

    IF v_is_closed = TRUE THEN
        RAISE EXCEPTION 'CLOSED_PERIOD_LOCK: Cannot perform % operation. Financial Year "%" is closed for posting.',
            TG_OP, v_year_label;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_closed_period_journal ON "JournalEntry";

CREATE TRIGGER trg_prevent_closed_period_journal
BEFORE INSERT OR UPDATE OR DELETE ON "JournalEntry"
FOR EACH ROW
EXECUTE FUNCTION fn_prevent_closed_period_mutations();
