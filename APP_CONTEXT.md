# APP_CONTEXT.md — Pathshala-Pro School Management ERP (Automation Agent Guide)

> Base URL (local dev): `http://localhost:3000` (`npm run dev`)
> Auth: NextAuth v4 JWT. Public paths: `/login`, `/verify`, `/onboarding`. All `/…` dashboard routes require session + tenant; `/system-admin/*` requires SUPER_ADMIN/SYSTEM_ADMIN. Blocked subscription → `/subscription/inactive`.
> Global shell: sidebar navigation → dashboard pages → `ERPDataTable` lists + `TopSheet` (top slide-down) add/edit drawers + `AppDropdown` searchable dropdowns + `TenantDateInput` date fields + `sonner` toasts. No raw `<select>` or `<input type="date">`.
> Locales: `en`, `ur` (RTL), `hi`, `bn`. Currency/date format per tenant settings (default `DD/MM/YYYY`).

## 1. OVERVIEW & MODULES (route = local URL)

| Module | Routes |
|---|---|
| Dashboard / Home | `/` |
| Login / Onboarding / Verify | `/login`, `/onboarding`, `/verify/certificate/[id]` |
| Admissions + Enquiries | `/admissions`, `/enquiries` |
| Students + Performance | `/students`, `/students/performance` |
| Academic setup | `/academic-year`, `/academic/classes`, `/academic/sections`, `/academic/groups`, `/subjects`, `/timetable`, `/calendar` |
| Attendance + Leaves | `/attendance`, `/leaves` |
| Exams + Results | `/exams`, `/exams/[id]`, `/exams/question-bank`, `/exams/question-papers`, `/exams/question-papers/create`, `/exams/question-papers/[id]/edit`, `/exams/question-papers/[id]/preview`, `/exam-results`, `/exams/results` (legacy redirect → `/exam-results`) |
| Fees | `/fees` (vouchers), `/fees/structures` (class fee heads), `/fees/collection` (POS terminal), `/fees/bulk` (batch invoicing) |
| Accounting | `/accounting/accounts`, `/accounting/fee-heads`, `/accounting/expenses`, `/accounting/statements`, `/accounting/profit-loss`, `/transactions` |
| Staff + Payroll | `/staff`, `/salary` |
| Transport | `/transport` |
| Hostel | `/hostel` |
| Library | `/library` |
| Inventory | `/inventory` |
| Homework, Health, Certificates, Notices | `/homework`, `/health`, `/certificates`, `/notices` |
| Promotions | `/promotions/rules`, `/promotions/calculate` |
| Reports | `/reports`, `/reports/admissions`, `/reports/students`, `/reports/attendance`, `/reports/exams`, `/reports/fees`, `/reports/financial`, `/reports/salary` |
| Admin | `/users`, `/settings`, `/admin/historical-data` |
| Parent / Student portals | `/parent/dashboard`, `/parent/fees`, `/student/dashboard`, `/student/homework`, `/student/results`, `/student/timetable` |
| System admin | `/system-admin`, `/system-admin/tenants`, `/system-admin/tenants/[id]`, `/system-admin/users`, `/system-admin/billing`, `/system-admin/audit-logs`, `/system-admin/diagnostics`, `/system-admin/feature-flags`, `/system-admin/notices`, `/system-admin/settings`, `/system-admin/templates` |

## 2. WORKFLOW SEQUENCES & FORM FLOWS

All create/edit forms open in `TopSheet` (top slide-down). Fill → Save → toast → table refresh (TanStack invalidation). Cancel/X with dirty form triggers unsaved-changes confirm.

**Admit students (`/admissions`):**
1. Select `Academic Year *` → select `Class *` → optional `Group` (defaults "No Group (General)") → `Section` (filtered by class).
2. Click `Add Students` → modal: search + Class/Group/Section filters → tick 1..N students → Confirm (`Added {count} student(s)` toast). Duplicates auto-deduped by id.
3. Optional `Additional Notes` → review right-side Summary (count) → `Submit` → `admissionCompleted` toast + `["students"]` invalidated. Creates `StudentAcademicSession` (year+class+section+rollNumber) per student.

**Student CRUD (`/students`):**
1. Click `Add Student` (TopSheet) → Personal (first/last name, DOB, gender) → Guardian (name, contact) → Academic (`AcademicStudentSelector`) → Save. Edit via row action → same sheet prefilled. Delete → confirm → toast.

**Fee batch invoicing (`/fees/bulk`):**
1. Pick `Academic Year *` → `Fee Type` (default TUITION) → `Month/Year` + `Due date` (`TenantDateInput`, ISO `yyyy-mm-dd` wire) → `Base amount` → toggle `useClassFeeStructure` (pulls per-class heads) / `carryForwardArrears`.
2. Target: `ALL_STUDENTS` | `CLASS` (+classId) | `SECTION` (+classId+sectionId) → Submit `POST /api/fees/batch` → voucherIds auto `SAL-YYYY-NNNN`.

**Fee collection POS (`/fees/collection`):**
1. Select Academic Year (provider) → `AcademicStudentSelector`: Class → Section → Student.
2. Unpaid `FeeVoucher` list appears (or annual ledger balance with auto-create on pay if empty). Tick 1..N vouchers.
3. Enter `amountPaid` (>0) + `paymentMethod` (CASH, BANK, CHEQUE, EASYPAISA, JAZZCASH, BKASH, NAGAD, UPI, CARD, POS_CARD, DIGITAL, ONLINE, OTHER) + optional note → `Collect` (`POST /api/fees/collect-direct` single or `/bulk-collect` multi).
4. Server: `allocatePayment` per voucher, posts double-entry RECEIPT journal, `receiptNumber` auto `REC-YYYY-NNNN` (`TXN-REC-…`), excess > balance → Student Advance Wallet (Account 2050). Print `FeeVoucher` PDF receipt.

**Class fee structure (`/fees/structures`):**
1. `Academic Year *` + `Class *` → heads: tuition/lab/computer/exam/sports/library/other (≥0) → `billingCycle` MONTHLY/QUARTERLY/BI_ANNUAL/ANNUAL → Save.

**Exam lifecycle (`/exams` → `/exam-results`):**
1. Create Exam (TopSheet): `Academic year *`, `Name *`, `Type` MID_TERM/FINAL/UNIT_TEST/ANNUAL, `Start/End dates`, `totalMarks` (default 100), `passPercentage` (default 33), ≥1 subject row (subjectId + maxMarks + passMarks, default 100/33) → Save.
2. Question paper (optional, `/exams/question-papers/create` studio): pick template → compose Sections A/B/C with marks budget → `Save as Draft` / `Save & Finalize Paper` (validates ≥1 section, marks sum).
3. Marks entry (`/exam-results`): filter Exam → Class → Subject → enter `obtainedMarks` (≤ maxMarks) per student or tick Absent (saves status ABSENT, 0 marks, not 0/F). `obtainedMarks cannot exceed maxMarks` enforced.
4. `Publish` exam (`isPublished=true`) → results immutable/read-only; edits/deletes blocked ("Published … use controlled correction workflow"). Promotion-locked rows show `Locked` pill.

**Promotion (`/promotions/rules` → `/promotions/calculate`):**
1. Rule per class/year: minAttendance (75), minOverall% (40), minPerSubject (33), maxFailedSubjects, conditional flag, nextClassId → Calculate → PROMOTED/RETAINED/CONDITIONAL_PROMOTED list → Confirm. Locks source exam marks.

**Attendance (`/attendance`):**
1. Pick Academic Year → Class → Section → `Date` (`TenantDateInput`) → grid of students → bulk mark PRESENT/ABSENT/LATE/LEAVE → `Submit bulk` (`POST /api/attendance/bulk`). Staff variant: biometric punch or date + staff selector (08:30–16:00, 15m grace).

**Staff + payroll (`/staff` → `/salary`):**
1. Add Staff: firstName*, lastName*, department*, designation*, hireDate*, dateOfBirth*, baseSalary (≥0), email/phone optional → Save (staffId optional/auto).
2. Monthly attendance accumulates → Salary ledger: staff* + academicYear* + month (1–12) + year → compute (LOP→PF→Tax→Loan capped, net never negative) → Save → payslip PDF. Paid/partial ledgers are read-only (adjustment workflow only).

**Transport (`/transport`):** Vehicle (number, capacity) → Route (vehicle-assigned) → Stop → Student allocation (capacity-checked). Order matters; allocation without vehicle capacity fails.

**Hostel (`/hostel`):** Hostel → Room (capacity) → Bed (`@@unique room+bedNumber`) → Student allocation. Must pick parent before child; overbooking rejected.

**Library (`/library`):** Book (title/ISBN/copies) → Issue (student + dueDate) → Return (`Book returned and inventory updated` toast, stock incremented). No issue if copies=0.

**Inventory (`/inventory`):** Item → Stock IN/OUT transaction (atomic; OUT > on-hand rejected, never negative) → reorder alert at threshold.

**Timetable (`/timetable`), Homework (`/homework`), Leaves (`/leaves`), Certificates (`/certificates`), Notices (`/notices`), Health (`/health`):** all = pick Year/Class/Section (or staff/student) → date range → Save → list + toast. Certificate issue needs student + type + issueDate.

## 3. RELATIONAL DEPENDENCIES (parent → child)

- `AcademicYear` is root scope for EVERYTHING: classes, sections, groups, subjects, exams, results, vouchers, salary, timetable, promotions. Switching year resets Class/Section/Group/Student selection. Closed year blocks writes (`assertAcademicYearOpen`).
- `Class → Section`: section list filtered by `classId`; placeholder `Select class first…`, disabled until class set; changing class clears `sectionId/studentId/subjectId`.
- `Class → Section → Group → Student`: never standalone student pick; use `AcademicStudentSelector` (`requireSectionForStudent=true`). Changing upstream clears downstream.
- `Class → Subject`: subject dropdown filtered to class curriculum (`maxMarks/passMarks` per subject).
- `Class → Fee Structure`: picking class loads tuition/lab/computer/exam/sports/library/other defaults for invoicing.
- `Exam → Subject → Result`: result needs valid exam+subject pair; `maxMarks` bound from exam-subject row; published exam freezes all child results.
- `FeeVoucher → Transaction/Receipt`: payment needs unpaid voucher; receipt `REC-…` + journal `JV/PAY/REC/SAL-…` auto-linked; overpay → wallet ledger, not extra receipt.
- `Staff → Attendance → Salary`: salary month needs staff + approved attendance/leave union; paid ledgers lock.
- `Hostel → Room → Bed`, `Vehicle → Route → Stop → Allocation`, `Book → Issue → Return`, `Item → Stock Txn`: strict top-down creation; child disabled until parent chosen.
- Tenant isolation: every query/mutation scoped `where: { tenantId }`; cross-tenant ids rejected at API.

## 4. FORM CONSTRAINTS & REQUIRED FIELDS

Conventions: `*` = required (zod `min(1)`). Dates via `TenantDateInput` (display per tenant `dateFormat`, wire ISO). Dropdowns via `AppDropdown` (live search). Money = non-negative numbers, 2dp; payments `>0`; debits=credits enforced server-side.

| Form | Required * | Optional | Auto-generated (do NOT type) |
|---|---|---|---|
| Student | firstName, lastName, dateOfBirth, guardianName, guardianContact | guardianEmail, father/motherName, address, bloodGroup, class/group/section, rollNumber, photo | `studentId` (STU-…), `rollNumber` if blank (session-scoped) |
| Staff | firstName, lastName, department, designation, hireDate, dateOfBirth | email, phone, qualification, address, photo, userId | `staffId` if blank |
| User | email, password (≥6), name, role | tenantId, staff/student link, permissions, parentStudentIds | — |
| Academic Year | yearId, label, startDate, endDate | isClosed | — |
| Subject | subjectId, name, code | category (default COMPULSORY), maxMarks 100, passMarks 33 | — |
| Exam | academicYearId, name, ≥1 subject {subjectId,maxMarks,passMarks} | examId, type MID_TERM, totalMarks 100, pass% 33 | `examId` if blank |
| Exam Result | studentProfileId, academicYearId, examId, subjectId, maxMarks, obtainedMarks (≥0) | absent (default false), reExamAllowed | status (PASS/FAIL/ABSENT) computed; `obtainedMarks ≤ maxMarks` unless absent |
| Fee Voucher | studentProfileId, academicYearId, feeType, voucherId, totalDue ≥0, dueDate | baseAmount, discount, arrears | `voucherId` SAL-YYYY-NNNN (batch), totals/balance server-computed |
| Fee Collect | voucher(s), amountPaid >0, paymentMethod | receiptNumber, note | `receiptNumber` REC-YYYY-NNNN, `transactionId` TXN-REC-…, wallet credit |
| Salary ledger | staffProfileId, academicYearId, month, year | allowances/deductions | netPayable, journal id |
| Attendance | date, status PRESENT/ABSENT/LATE/LEAVE + (studentProfileId XOR staffProfileId) | note | — |
| Leave | applicantType STUDENT/STAFF + student/staff id, leaveType, from/to dates | reason | — |
| Class Fee Structure | academicYearId, classId | all heads ≥0, billingCycle MONTHLY, isActive | — |
| Promotion Rule | academicYearId, classId | thresholds, nextClassId | — |
| Transaction/Expense/Account | transactionId/amount/method/receipt or account code+name | note | `voucherNumber` JV/PAY/REC/PUR/CON-YYYY-NNNN via `getNextVoucherNumber` (FOR UPDATE sequence) |

Validation errors surface per-field; submit blocked until fixed. Published/paid/locked records reject edits with explanatory message (use correction/adjustment flow, not delete).

## 5. SUCCESS / ERROR INDICATORS (for automation asserts)

- **Success toast (sonner):** `toast.success(...)` — e.g. `Added {count} student(s)`, `Question paper saved successfully!`, `Book returned and inventory updated`, delete confirmations. Assert toast visible containing keywords (`success`, `saved`, `Added`, `completed`, `deleted`); do NOT rely on CSS class (no `.toast-success` in codebase).
- **Error toast:** `toast.error(e?.message)` — raw server message, never generic. API field errors formatted `[Field '<field>', Code: <code>] <message>`. Examples: `obtainedMarks cannot exceed maxMarks`, `Published marks are read-only…`, `Marks … locked due to promotion`, `Please fill in all required fields.`
- **Drawers/modals:** `TopSheet` slides from top; close on Save (toast + table refresh) or X/backdrop (dirty → unsaved-changes confirm). No center-alert forms for entity CRUD.
- **Tables:** `ERPDataTable` with `startRow-endRow of totalCount`, page-size picker `[10, 20, 50, 100]`, prev/next buttons; loading = `TableSkeleton`; empty = message + action button (e.g. `No students added yet` / `Click 'Add Students'…`).
- **Cache refresh:** mutation `onSuccess` → `invalidateQueries({ queryKey: ["<base>"] })` where base ∈ `classes, sections, groups, students, subjects, staff, exams, exam-results, fees, salary, attendance…` — assert list updates without manual reload.
- **Redirects:** no redirect on most saves (stay + refresh). Exceptions: `question-papers/create` → paper list on save; `/exams/results` → redirects to `/exam-results`; unauthenticated → `/login`; blocked tenant → `/subscription/inactive`.
- **Guards/locks:** missing permission renders `Access restricted / You do not have permission…`; published exam / promoted student / paid salary rows render `Locked` pill and block edit (toast explains). Use these as negative-path asserts.
- **PDF/Excel exports:** fee voucher, report card/transcript, payslip, daybook buttons trigger file download (react-pdf/exceljs, 4-locale headers, tenant currency + localized dates).
