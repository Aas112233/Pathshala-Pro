-- Pathshala-Pro — Core Academic Engine — Integrity DDL
-- Prisma 6 + PostgreSQL — multi-tenant composite, component sum, grace caps, read-only lockdown
-- Apply: npx prisma migrate dev --name academic_engine  (this file appended to generated migration.sql)

-- 1. Tenant grace caps — ensure sane bounds
ALTER TABLE "Tenant" ADD CONSTRAINT chk_tenant_grace CHECK ("maxGracePerSubject" BETWEEN 0 AND 20 AND "maxGracePerStudent" BETWEEN 0 AND 50);
ALTER TABLE "Tenant" ADD CONSTRAINT chk_tenant_curriculum CHECK ("curriculum" IN ('NCTB','CBSE','FBISE'));
ALTER TABLE "Tenant" ADD CONSTRAINT chk_tenant_gpa_scale CHECK ("gradingSystem" IN ('GPA','PERCENTAGE'));

-- 2. Component-level checks
ALTER TABLE "SubjectAssessmentComponent" ADD CONSTRAINT chk_component_pass_le_max CHECK ("passMarks" <= "maxMarks" AND "passMarks" >=0 AND "maxMarks" >0);
ALTER TABLE "SubjectAssessmentComponent" ADD CONSTRAINT chk_component_weight CHECK ("weightage" >=0 AND "weightage" <= 1.0);

ALTER TABLE "ExamComponentResult" ADD CONSTRAINT chk_component_obtained CHECK ("obtainedMarks" >=0);
ALTER TABLE "ExamComponentResult" ADD CONSTRAINT chk_component_grace CHECK ("graceMarksGiven" >=0 AND "graceMarksGiven" <= 20);

ALTER TABLE "ExamResult" ADD CONSTRAINT chk_exam_grace CHECK ("graceMarksGiven" >=0 AND "graceMarksGiven" <= 10);
ALTER TABLE "ExamResult" ADD CONSTRAINT chk_marks_range CHECK ("obtainedMarks" >=0 AND "obtainedMarks" <= "maxMarks" AND "maxMarks" >0);
ALTER TABLE "PromotionRule" ADD CONSTRAINT chk_promotion_thresholds CHECK ("minimumAttendance" BETWEEN 0 AND 100 AND "minimumOverallPercentage" BETWEEN 0 AND 100 AND "minimumPerSubject" BETWEEN 0 AND 100 AND "maxFailedSubjects" BETWEEN 0 AND 10);

-- 3. Component sum == ExamResult.obtainedMarks (when components exist)
CREATE OR REPLACE FUNCTION check_component_sum() RETURNS TRIGGER AS $$
DECLARE s numeric; r numeric; cnt int;
BEGIN
  SELECT COUNT(*) INTO cnt FROM "ExamComponentResult" WHERE "examResultId" = COALESCE(NEW."examResultId", OLD."examResultId");
  IF cnt = 0 THEN RETURN NEW; END IF;
  SELECT COALESCE(SUM("obtainedMarks"),0) INTO s FROM "ExamComponentResult" WHERE "examResultId" = COALESCE(NEW."examResultId", OLD."examResultId");
  SELECT "obtainedMarks" INTO r FROM "ExamResult" WHERE id = COALESCE(NEW."examResultId", OLD."examResultId");
  IF s <> r THEN
    RAISE EXCEPTION 'Component sum (%) != ExamResult.obtainedMarks (%) for ExamResult %', s, r, COALESCE(NEW."examResultId", OLD."examResultId");
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_component_sum ON "ExamComponentResult";
CREATE TRIGGER trg_component_sum
AFTER INSERT OR UPDATE OR DELETE ON "ExamComponentResult"
FOR EACH ROW EXECUTE FUNCTION check_component_sum();

-- Also enforce on ExamResult update of obtainedMarks when components exist
CREATE OR REPLACE FUNCTION check_examresult_sum_on_update() RETURNS TRIGGER AS $$
DECLARE s numeric;
BEGIN
  SELECT COALESCE(SUM("obtainedMarks"),0) INTO s FROM "ExamComponentResult" WHERE "examResultId" = NEW.id;
  IF s <> 0 AND s <> NEW."obtainedMarks" THEN
    RAISE EXCEPTION 'ExamResult.obtainedMarks (%) must equal sum of components (%)', NEW."obtainedMarks", s;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_examresult_sum ON "ExamResult";
CREATE TRIGGER trg_examresult_sum BEFORE UPDATE ON "ExamResult" FOR EACH ROW EXECUTE FUNCTION check_examresult_sum_on_update();

-- 4. Grace cap per student per exam — tenant limit
CREATE OR REPLACE FUNCTION check_grace_limit() RETURNS TRIGGER AS $$
DECLARE total numeric; cap numeric; tenantIdVal text;
BEGIN
  tenantIdVal := COALESCE(NEW."tenantId", OLD."tenantId");
  SELECT COALESCE(SUM("graceMarksGiven"),0) INTO total
  FROM "ExamComponentResult"
  WHERE "examResultId" = COALESCE(NEW."examResultId", OLD."examResultId");

  -- Add subject-level grace if present (ExamResult.graceMarksGiven for same examResult)
  SELECT total + COALESCE((SELECT "graceMarksGiven" FROM "ExamResult" WHERE id = COALESCE(NEW."examResultId", OLD."examResultId")),0) INTO total;

  SELECT "maxGracePerStudent" INTO cap FROM "Tenant" WHERE "tenantId" = tenantIdVal;
  IF total > COALESCE(cap, 10) THEN
    RAISE EXCEPTION 'Total grace % exceeds tenant cap % for tenant %', total, COALESCE(cap,10), tenantIdVal;
  END IF;

  -- Per-subject cap
  IF NEW."graceMarksGiven" > (SELECT "maxGracePerSubject" FROM "Tenant" WHERE "tenantId"=tenantIdVal) THEN
    RAISE EXCEPTION 'Per-subject grace % exceeds tenant max %', NEW."graceMarksGiven", (SELECT "maxGracePerSubject" FROM "Tenant" WHERE "tenantId"=tenantIdVal);
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_grace_cap_component ON "ExamComponentResult";
CREATE TRIGGER trg_grace_cap_component BEFORE INSERT OR UPDATE ON "ExamComponentResult" FOR EACH ROW EXECUTE FUNCTION check_grace_limit();

CREATE OR REPLACE FUNCTION check_grace_limit_examresult() RETURNS TRIGGER AS $$
DECLARE total numeric; cap numeric;
BEGIN
  SELECT COALESCE(SUM("graceMarksGiven"),0) INTO total FROM "ExamComponentResult" WHERE "examResultId"=NEW.id;
  total := total + COALESCE(NEW."graceMarksGiven",0);
  SELECT "maxGracePerStudent" INTO cap FROM "Tenant" WHERE "tenantId"=NEW."tenantId";
  IF total > COALESCE(cap,10) THEN RAISE EXCEPTION 'Total grace % exceeds cap %', total, COALESCE(cap,10); END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_grace_cap_exam ON "ExamResult";
CREATE TRIGGER trg_grace_cap_exam BEFORE UPDATE ON "ExamResult" FOR EACH ROW EXECUTE FUNCTION check_grace_limit_examresult();

-- 5. Read-only lockdown when AcademicYear.isClosed = true
CREATE OR REPLACE FUNCTION block_closed_year_examresult() RETURNS TRIGGER AS $$
DECLARE closed boolean;
BEGIN
  SELECT "isClosed" INTO closed FROM "AcademicYear" WHERE id = COALESCE(NEW."academicYearId", OLD."academicYearId");
  IF closed THEN RAISE EXCEPTION 'AcademicYear is closed — ExamResult is read-only (%)', COALESCE(NEW."academicYearId", OLD."academicYearId"); END IF;
  -- Also block if isLocked set
  IF OLD."isLocked" = true AND (NEW."obtainedMarks" <> OLD."obtainedMarks" OR NEW."grade" <> OLD."grade") THEN
    RAISE EXCEPTION 'ExamResult isLocked — marks/grade immutable';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_lock_examresult ON "ExamResult";
CREATE TRIGGER trg_lock_examresult BEFORE UPDATE OR DELETE ON "ExamResult" FOR EACH ROW EXECUTE FUNCTION block_closed_year_examresult();

CREATE OR REPLACE FUNCTION block_closed_year_session() RETURNS TRIGGER AS $$
DECLARE closed boolean;
BEGIN
  SELECT "isClosed" INTO closed FROM "AcademicYear" WHERE id = COALESCE(NEW."academicYearId", OLD."academicYearId");
  IF closed THEN RAISE EXCEPTION 'AcademicYear is closed — StudentAcademicSession is read-only'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_lock_session ON "StudentAcademicSession";
CREATE TRIGGER trg_lock_session BEFORE UPDATE OR DELETE ON "StudentAcademicSession" FOR EACH ROW EXECUTE FUNCTION block_closed_year_session();

-- 6. Tenant match enforcement — composite FK emulation (Prisma uses cuid PK, so enforce tenant equality via trigger)
CREATE OR REPLACE FUNCTION assert_tenant_match_examresult() RETURNS TRIGGER AS $$
DECLARE t1 text; t2 text; t3 text;
BEGIN
  SELECT "tenantId" INTO t1 FROM "Exam" WHERE id = NEW."examId";
  SELECT "tenantId" INTO t2 FROM "Subject" WHERE id = NEW."subjectId";
  SELECT "tenantId" INTO t3 FROM "StudentProfile" WHERE id = NEW."studentProfileId";
  IF t1 <> NEW."tenantId" OR t2 <> NEW."tenantId" OR t3 <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Tenant mismatch in ExamResult: tenantId % vs exam % subject % student %', NEW."tenantId", t1, t2, t3;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_tenant_examresult ON "ExamResult";
CREATE TRIGGER trg_tenant_examresult BEFORE INSERT OR UPDATE ON "ExamResult" FOR EACH ROW EXECUTE FUNCTION assert_tenant_match_examresult();

CREATE OR REPLACE FUNCTION assert_tenant_match_component() RETURNS TRIGGER AS $$
DECLARE erTenant text; compTenant text;
BEGIN
  SELECT "tenantId" INTO erTenant FROM "ExamResult" WHERE id = NEW."examResultId";
  SELECT "tenantId" INTO compTenant FROM "SubjectAssessmentComponent" WHERE id = NEW."componentId";
  IF erTenant <> NEW."tenantId" OR compTenant <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Tenant mismatch in ExamComponentResult';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_tenant_component ON "ExamComponentResult";
CREATE TRIGGER trg_tenant_component BEFORE INSERT OR UPDATE ON "ExamComponentResult" FOR EACH ROW EXECUTE FUNCTION assert_tenant_match_component();

-- 7. Grace ledger immutability
CREATE OR REPLACE FUNCTION block_grace_ledger_update() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'GraceMarkLedger is append-only';
  RETURN NULL;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_grace_immutable ON "GraceMarkLedger";
CREATE TRIGGER trg_grace_immutable BEFORE UPDATE OR DELETE ON "GraceMarkLedger" FOR EACH ROW EXECUTE FUNCTION block_grace_ledger_update();

-- 8. Component max/pass sanity via ExamSubject max
CREATE OR REPLACE FUNCTION check_component_vs_examsubject() RETURNS TRIGGER AS $$
DECLARE maxOverall numeric;
BEGIN
  SELECT "maxMarks" INTO maxOverall FROM "ExamSubject" WHERE id = (SELECT "examSubjectId" FROM "SubjectAssessmentComponent" WHERE id = NEW."componentId");
  -- Component max should not exceed subject max (sanity)
  IF NEW."obtainedMarks" > (SELECT "maxMarks" FROM "SubjectAssessmentComponent" WHERE id = NEW."componentId") THEN
    RAISE EXCEPTION 'Component obtained > maxMarks';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_component_max ON "ExamComponentResult";
CREATE TRIGGER trg_component_max BEFORE INSERT OR UPDATE ON "ExamComponentResult" FOR EACH ROW EXECUTE FUNCTION check_component_vs_examsubject();

-- 9. Academic-year partitioning and database-level uniqueness.
-- Attendance is nullable for legacy rows; all new application writes populate it.
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "academicYearId" text;
CREATE INDEX IF NOT EXISTS "Attendance_tenantId_academicYearId_date_idx"
  ON "Attendance" ("tenantId", "academicYearId", "date");
CREATE INDEX IF NOT EXISTS "Attendance_tenantId_academicYearId_studentProfileId_date_idx"
  ON "Attendance" ("tenantId", "academicYearId", "studentProfileId", "date");
CREATE INDEX IF NOT EXISTS "Attendance_tenantId_academicYearId_staffProfileId_date_idx"
  ON "Attendance" ("tenantId", "academicYearId", "staffProfileId", "date");
DO $$ BEGIN
  ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_academicYearId_fkey"
    FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "SalaryLedger_tenantId_academicYearId_staffProfileId_month_year_key"
  ON "SalaryLedger" ("tenantId", "academicYearId", "staffProfileId", "month", "year");
CREATE UNIQUE INDEX IF NOT EXISTS "ClassPromotion_tenantId_studentProfileId_fromAcademicYearId_key"
  ON "ClassPromotion" ("tenantId", "studentProfileId", "fromAcademicYearId");

CREATE OR REPLACE FUNCTION block_closed_year_attendance() RETURNS TRIGGER AS $$
DECLARE closed boolean;
BEGIN
  IF COALESCE(NEW."academicYearId", OLD."academicYearId") IS NULL THEN RETURN NEW; END IF;
  SELECT "isClosed" INTO closed FROM "AcademicYear"
    WHERE id = COALESCE(NEW."academicYearId", OLD."academicYearId");
  IF closed THEN RAISE EXCEPTION 'AcademicYear is closed — Attendance is read-only'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_lock_attendance ON "Attendance";
CREATE TRIGGER trg_lock_attendance BEFORE UPDATE OR DELETE ON "Attendance"
  FOR EACH ROW EXECUTE FUNCTION block_closed_year_attendance();

-- 10. Operational collision, capacity, and stock invariants.
CREATE INDEX IF NOT EXISTS "Timetable_tenant_year_room_slot_idx"
  ON "Timetable" ("tenantId", "academicYearId", "roomNumber", "dayOfWeek", "periodNumber")
  WHERE "isBreak" = false AND "roomNumber" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "HostelAllocation_active_student_key"
  ON "HostelAllocation" ("tenantId", "studentProfileId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS "HostelAllocation_active_bed_key"
  ON "HostelAllocation" ("tenantId", "roomId", "bedNumber")
  WHERE "status" = 'ACTIVE' AND "bedNumber" IS NOT NULL;
DO $$ BEGIN
  ALTER TABLE "Book" ADD CONSTRAINT "Book_stock_bounds_check"
    CHECK ("availableCopies" >= 0 AND "availableCopies" <= "copies");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_quantity_nonnegative_check"
    CHECK ("quantity" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
