# i18n Audit — Hardcoded User-Facing Strings

**Generated:** 2026-08-29T21:03:56.442Z  
**Scope:** `src/app/**` (excluding `/api`), `src/components/**`, `src/viewmodels/**`, `src/hooks/**`, plus PDF/Excel document templates.  
**Method:** TypeScript AST scan (compiler API v5.9.3), not regex.  
**Locales:** en / ur (RTL) / hi / bn — every string below is English-only today.

> ⚠️ **Note:** source files in this workspace were being modified by another process during the audit 
> (files changed every ~20s). This report is a single atomic snapshot taken at the timestamp above; 
> re-run the scan before starting each batch to refresh line numbers.

## Executive summary

| Metric | Count |
|---|---:|
| Source files scanned | 427 |
| Files containing hardcoded strings | 139 |
| **Screen/page findings** | **1405** |
| Document-template findings (PDF/Excel) | 476 |
| **Total findings** | **1881** |
| Screens affected | 60 |
| Line numbers verified against source | 1881/1881 (100.0%) |

## Overall summary — concentration by screen

Ranked by **user visibility × volume**. Tier reflects how often a real user sees the screen.

| # | Screen / route | Tier | Findings | Files |
|---:|---|---|---:|---:|
| 1 | `/staff` | P1 | 135 | 8 |
| 2 | `/students` | P1 | 9 | 3 |
| 3 | `/login` | P1 | 7 | 1 |
| 4 | `/fees` | P1 | 7 | 2 |
| 5 | `/` | P1 | 4 | 1 |
| 6 | `/attendance` | P1 | 3 | 2 |
| 7 | `/onboarding` | P1 | 2 | 1 |
| 8 | `/exams` | P1 | 2 | 1 |
| 9 | `/users` | P2 | 60 | 3 |
| 10 | `/exams/question-papers/create` | P2 | 53 | 1 |
| 11 | `/homework` | P2 | 52 | 2 |
| 12 | `/reports/salary` | P2 | 45 | 1 |
| 13 | `/reports/admissions` | P2 | 44 | 1 |
| 14 | `/reports/financial` | P2 | 38 | 1 |
| 15 | `/reports` | P2 | 36 | 5 |
| 16 | `/reports/students` | P2 | 31 | 1 |
| 17 | `/exams/question-papers` | P2 | 29 | 1 |
| 18 | `/reports/fees` | P2 | 29 | 1 |
| 19 | `/salary` | P2 | 29 | 5 |
| 20 | `/exams/question-bank` | P2 | 25 | 1 |
| 21 | `/reports/attendance` | P2 | 23 | 1 |
| 22 | `/transport` | P2 | 22 | 2 |
| 23 | `/library` | P2 | 21 | 2 |
| 24 | `/admissions` | P2 | 17 | 2 |
| 25 | `/exams/question-papers/[id]/preview` | P2 | 17 | 1 |
| 26 | `/accounting/expenses` | P2 | 16 | 2 |
| 27 | `/fees/structures` | P2 | 15 | 1 |
| 28 | `/exam-results` | P2 | 12 | 1 |
| 29 | `/fees/bulk` | P2 | 11 | 1 |
| 30 | `/exams/results` | P2 | 8 | 1 |
| 31 | `/accounting/statements` | P2 | 6 | 1 |
| 32 | `/fees/collection` | P2 | 5 | 1 |
| 33 | `/timetable` | P2 | 4 | 2 |
| 34 | `/accounting/accounts` | P2 | 2 | 1 |
| 35 | `/accounting/profit-loss` | P2 | 2 | 1 |
| 36 | `/subjects` | P2 | 2 | 1 |
| 37 | `/reports/exams` | P2 | 1 | 1 |
| 38 | `(shared) Cross-screen components` | P3 | 121 | 16 |
| 39 | `/notices` | P3 | 53 | 4 |
| 40 | `/hostel` | P3 | 23 | 2 |
| 41 | `(shared) Design-system primitives` | P3 | 19 | 5 |
| 42 | `/enquiries` | P3 | 8 | 2 |
| 43 | `/health` | P3 | 8 | 2 |
| 44 | `/certificates` | P3 | 7 | 2 |
| 45 | `/inventory` | P3 | 6 | 2 |
| 46 | `/leaves` | P3 | 4 | 2 |
| 47 | `/academic-year` | P3 | 3 | 1 |
| 48 | `/settings` | P3 | 3 | 1 |
| 49 | `/academic/classes` | P3 | 2 | 1 |
| 50 | `/academic/groups` | P3 | 2 | 1 |
| 51 | `/academic/sections` | P3 | 2 | 1 |
| 52 | `/promotions/calculate` | P3 | 2 | 1 |
| 53 | `/transactions` | P3 | 2 | 1 |
| 54 | `/system-admin` | P4 | 179 | 3 |
| 55 | `/system-admin/notices` | P4 | 38 | 1 |
| 56 | `/system-admin/tenants/[id]` | P4 | 33 | 1 |
| 57 | `/system-admin/tenants` | P4 | 21 | 2 |
| 58 | `/system-admin/billing` | P4 | 18 | 1 |
| 59 | `/system-admin/audit-logs` | P4 | 10 | 1 |
| 60 | `/system-admin/users` | P4 | 10 | 1 |
| 61 | `/system-admin/settings` | P4 | 6 | 1 |
| 62 | `/system-admin/feature-flags` | P4 | 1 | 1 |
| — | *Document templates (PDF/Excel)* | P5 | 476 | 19 |

### Highest-concentration pages

| Screen | Findings | Why it matters |
|---|---:|---|
| `/system-admin` | 179 | Platform-operator surface (lower volume, high blast radius) |
| `/staff` | 135 | HR data; high daily traffic for admin roles |
| `(shared) Cross-screen components` | 121 | Reused across many screens — fix once, benefits everywhere |
| `/users` | 60 | Accounts and permissions; every admin touches it |
| `/exams/question-papers/create` | 53 | Exam operations; time-pressured, high-stakes usage |
| `/notices` | 53 | Announcements broadcast to parents and students — maximum reach |
| `/homework` | 52 | Daily teacher/parent touchpoint — parent-facing traffic |
| `/reports/salary` | 45 | Reporting screen — used by management for decisions |
| `/reports/admissions` | 44 | Reporting screen — used by management for decisions |
| `/reports/financial` | 38 | Reporting screen — used by management for decisions |
| `/system-admin/notices` | 38 | Platform-operator surface (lower volume, high blast radius) |
| `/reports` | 36 | Reporting screen — used by management for decisions |

### Suggested batching

| Batch | Contents | Findings | Rationale |
|---:|---|---:|---|
| **1** | P1 - Core daily | 169 | Core daily screens (dashboard, login, students, attendance, fees, exams, staff). Highest visibility — ship first. |
| **2** | P2 - Frequent | 655 | Frequent operational modules (admissions, results, timetable, homework, library, transport, accounting, reports, salary). |
| **3** | P3 - Occasional / shared | 265 | Occasional modules + shared/cross-screen components and design-system primitives. Fixing shared components pays dividends across all batches. |
| **4** | P4 - Platform ops | 316 | Platform operator screens (`/system-admin/*`). |
| **5** | P5 - Documents | 476 | Document templates (PDF/Excel) — printed artefacts; often need per-tenant locale at generation time. |

---

## Findings by screen

Each row: source line, the hardcoded string as it appears in code, and the suggested translation key.
`Kind` indicates where the literal sits (`jsx-text` = rendered text node, `prop:*` = JSX attribute,
`obj:*` = object literal such as a table column or dropdown option, `toast:*` = notification message).

### `/staff`

**Tier:** P1 - Core daily · **Findings:** 135 · **Files:** 8 · **Namespace:** `staff`

**`app/(dashboard)/staff/page.tsx`** — 4

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 208 | `jsx-child` | Grid view | `staff.page.gridViewText` |
| 208 | `jsx-child` | Table view | `staff.page.tableViewText` |
| 220 | `jsx-text` | Access restricted | `staff.page.accessRestrictedText` |
| 220 | `jsx-text` | You do not have permission to view staff. | `staff.page.youDoNotHavePermissionText` |

**`components/staff/staff-actions-dropdown.tsx`** — 7

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 49 | `prop:aria-label` | Staff actions | `staff.staffActionsDropdown.staffActionsAriaLabel` |
| 70 | `jsx-text` | View Details | `staff.staffActionsDropdown.viewDetailsText` |
| 79 | `jsx-text` | Edit | `staff.staffActionsDropdown.editText` |
| 97 | `jsx-child` | Updating... | `staff.staffActionsDropdown.updatingText` |
| 97 | `jsx-child` | Deactivate | `staff.staffActionsDropdown.deactivateText` |
| 97 | `jsx-child` | Activate | `staff.staffActionsDropdown.activateText` |
| 110 | `jsx-child` | Deleting... | `staff.staffActionsDropdown.deletingText` |

**`components/staff/staff-card.tsx`** — 4

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 59 | `jsx-child` | Active | `staff.staffCard.activeText` |
| 59 | `jsx-child` | Inactive | `staff.staffCard.inactiveText` |
| 97 | `jsx-text` | View | `staff.staffCard.viewText` |
| 105 | `jsx-text` | Edit | `staff.staffCard.editText` |

**`components/staff/staff-details-modal.tsx`** — 26

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 52 | `prop:title` | Staff Member Details | `staff.staffDetailsModal.staffMemberDetailsTitle` |
| 86 | `jsx-child` | Active | `staff.staffDetailsModal.activeText` |
| 86 | `jsx-child` | Inactive | `staff.staffDetailsModal.inactiveText` |
| 93 | `jsx-text` | Edit | `staff.staffDetailsModal.editText` |
| 106 | `jsx-text` | Personal Information | `staff.staffDetailsModal.personalInformationText` |
| 111 | `prop:label` | Gender | `staff.staffDetailsModal.genderLabel` |
| 116 | `prop:label` | Date of Birth | `staff.staffDetailsModal.dateBirthLabel` |
| 121 | `prop:label` | Address | `staff.staffDetailsModal.addressLabel` |
| 130 | `jsx-text` | Employment Information | `staff.staffDetailsModal.employmentInformationText` |
| 135 | `prop:label` | Department | `staff.staffDetailsModal.departmentLabel` |
| 140 | `prop:label` | Designation | `staff.staffDetailsModal.designationLabel` |
| 145 | `prop:label` | Hire Date | `staff.staffDetailsModal.hireDateLabel` |
| 150 | `prop:label` | Joining Date | `staff.staffDetailsModal.joiningDateLabel` |
| 155 | `prop:label` | Base Salary | `staff.staffDetailsModal.baseSalaryLabel` |
| 164 | `jsx-text` | Contact Information | `staff.staffDetailsModal.contactInformationText` |
| 169 | `prop:label` | Email | `staff.staffDetailsModal.emailLabel` |
| 174 | `prop:label` | Phone | `staff.staffDetailsModal.phoneLabel` |
| 183 | `jsx-text` | Additional Information | `staff.staffDetailsModal.additionalInformationText` |
| 188 | `prop:label` | Qualification | `staff.staffDetailsModal.qualificationLabel` |
| 193 | `prop:label` | Created At | `staff.staffDetailsModal.createdLabel` |
| 198 | `prop:label` | Last Updated | `staff.staffDetailsModal.lastUpdatedLabel` |
| 209 | `jsx-text` | Recent Salary Records | `staff.staffDetailsModal.recentSalaryRecordsText` |
| 224 | `jsx-text` | Base: | `staff.staffDetailsModal.baseText` |
| 224 | `jsx-text` | \| Deductions: | `staff.staffDetailsModal.deductionsText` |
| 225 | `jsx-text` | \| Advances: | `staff.staffDetailsModal.advancesText` |
| 246 | `jsx-text` | Recent Attendance Records | `staff.staffDetailsModal.recentAttendanceRecordsText` |

**`components/staff/staff-empty-state.tsx`** — 6

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 24 | `jsx-text` | No staff members found | `staff.staffEmptyState.noStaffMembersFoundText` |
| 27 | `jsx-text` | We couldn&apos;t find any staff members matching your current filters. T… | `staff.staffEmptyState.weCouldntFindAnyStaffText` |
| 30 | `jsx-text` | Clear Filters | `staff.staffEmptyState.clearFiltersText` |
| 42 | `jsx-text` | No staff members yet | `staff.staffEmptyState.noStaffMembersYetText` |
| 45 | `jsx-text` | Get started by adding your first staff member to the system. You can add… | `staff.staffEmptyState.getStartedAddingText` |
| 49 | `jsx-text` | Add First Staff Member | `staff.staffEmptyState.addFirstStaffMemberText` |

**`components/staff/staff-filters-bar.tsx`** — 17

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 29 | `obj:label` | All Departments | `staff.staffFiltersBar.allDepartmentsLabel` |
| 30 | `obj:label` | Teaching | `staff.staffFiltersBar.teachingLabel` |
| 31 | `obj:label` | Administration | `staff.staffFiltersBar.administrationLabel` |
| 32 | `obj:label` | Support | `staff.staffFiltersBar.supportLabel` |
| 33 | `obj:label` | Transport | `staff.staffFiltersBar.transportLabel` |
| 34 | `obj:label` | Maintenance | `staff.staffFiltersBar.maintenanceLabel` |
| 38 | `obj:label` | All Status | `staff.staffFiltersBar.allStatusLabel` |
| 39 | `obj:label` | Active | `staff.staffFiltersBar.activeLabel` |
| 40 | `obj:label` | Inactive | `staff.staffFiltersBar.inactiveLabel` |
| 44 | `obj:label` | All Genders | `staff.staffFiltersBar.allGendersLabel` |
| 45 | `obj:label` | Male | `staff.staffFiltersBar.maleLabel` |
| 46 | `obj:label` | Female | `staff.staffFiltersBar.femaleLabel` |
| 47 | `obj:label` | Other | `staff.staffFiltersBar.otherLabel` |
| 59 | `prop:placeholder` | Filter by Department | `staff.staffFiltersBar.filterDepartmentPlaceholder` |
| 70 | `prop:placeholder` | Status | `staff.staffFiltersBar.statusPlaceholder` |
| 80 | `prop:placeholder` | Gender | `staff.staffFiltersBar.genderPlaceholder` |
| 93 | `jsx-text` | Clear Filters | `staff.staffFiltersBar.clearFiltersText` |

**`components/staff/staff-form-modal.tsx`** — 66

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 204 | `toast:error` | File is too large. Max size is 5MB. | `staff.staffFormModal.fileTooLargeMaxError` |
| 237 | `toast:success` | Image uploaded successfully! | `staff.staffFormModal.imageUploadedSuccessfullySuccess` |
| 251 | `toast:error` | Network error during upload. | `staff.staffFormModal.networkErrorDuringUploadError` |
| 284 | `toast:error` | Please wait for the image upload to complete. | `staff.staffFormModal.pleaseWaitImageError` |
| 353 | `prop:title` | Edit Staff Member | `staff.staffFormModal.editStaffMemberTitle` |
| 353 | `prop:title` | Add New Staff Member | `staff.staffFormModal.addNewStaffMemberTitle` |
| 354 | `prop:description` | Update staff member information. | `staff.staffFormModal.updateStaffMemberInformationDescription` |
| 354 | `prop:description` | Create a new staff member profile in the system. | `staff.staffFormModal.createNewStaffMemberDescription` |
| 359 | `jsx-text` | Cancel | `staff.staffFormModal.cancelText` |
| 362 | `jsx-child` | Saving... | `staff.staffFormModal.savingText` |
| 362 | `jsx-child` | Uploading file... | `staff.staffFormModal.uploadingFileText` |
| 362 | `jsx-child` | Update Staff | `staff.staffFormModal.updateStaffText` |
| 362 | `jsx-child` | Save Staff | `staff.staffFormModal.saveStaffText` |
| 373 | `jsx-text` | Staff Photo | `staff.staffFormModal.staffPhotoText` |
| 392 | `prop:aria-label` | Click to preview image | `staff.staffFormModal.clickPreviewImageAriaLabel` |
| 396 | `prop:alt` | Staff preview | `staff.staffFormModal.staffPreviewAlt` |
| 416 | `jsx-child` | Change Photo | `staff.staffFormModal.changePhotoText` |
| 416 | `jsx-child` | Upload Photo | `staff.staffFormModal.uploadPhotoText` |
| 417 | `jsx-text` | PNG, JPG, WEBP up to 5MB | `staff.staffFormModal.pngJpgWebpUpText` |
| 422 | `jsx-text` | Uploading... | `staff.staffFormModal.uploadingText` |
| 449 | `prop:title` | Basic Information | `staff.staffFormModal.basicInformationTitle` |
| 451 | `prop:label` | Staff ID | `staff.staffFormModal.staffIdLabel` |
| 451 | `prop:helperText` | Format: STAFF-YYYY-#### | `staff.staffFormModal.formatStaffYyyyHelper` |
| 453 | `jsx-text` | Auto-generated on save | `staff.staffFormModal.autoGeneratedSaveText` |
| 457 | `prop:label` | Gender | `staff.staffFormModal.genderLabel` |
| 463 | `obj:label` | Male | `staff.staffFormModal.maleLabel` |
| 464 | `obj:label` | Female | `staff.staffFormModal.femaleLabel` |
| 465 | `obj:label` | Other | `staff.staffFormModal.otherLabel` |
| 470 | `prop:label` | First Name | `staff.staffFormModal.firstNameLabel` |
| 476 | `prop:placeholder` | First name | `staff.staffFormModal.firstNamePlaceholder` |
| 481 | `prop:label` | Last Name | `staff.staffFormModal.lastNameLabel` |
| 487 | `prop:placeholder` | Last name | `staff.staffFormModal.lastNamePlaceholder` |
| 494 | `prop:label` | First Name (Second Language) | `staff.staffFormModal.firstNameSecondLanguageLabel` |
| 500 | `prop:placeholder` | প্রথম নাম | `staff.staffFormModal.textPlaceholder` |
| 504 | `prop:label` | Last Name (Second Language) | `staff.staffFormModal.lastNameSecondLanguageLabel` |
| 510 | `prop:placeholder` | শেষ নাম | `staff.staffFormModal.textPlaceholder2` |
| 515 | `prop:label` | Date of Birth | `staff.staffFormModal.dateBirthLabel` |
| 525 | `prop:label` | Address | `staff.staffFormModal.addressLabel` |
| 531 | `prop:placeholder` | Full address | `staff.staffFormModal.fullAddressPlaceholder` |
| 539 | `prop:title` | Employment Information | `staff.staffFormModal.employmentInformationTitle` |
| 541 | `prop:label` | Department | `staff.staffFormModal.departmentLabel` |
| 547 | `prop:placeholder` | e.g. Teaching, Administration | `staff.staffFormModal.eGTeachingAdministrationPlaceholder` |
| 552 | `prop:label` | Designation | `staff.staffFormModal.designationLabel` |
| 558 | `prop:placeholder` | e.g. Senior Teacher, Principal | `staff.staffFormModal.eGSeniorTeacherPrincipalPlaceholder` |
| 564 | `prop:label` | Hire Date | `staff.staffFormModal.hireDateLabel` |
| 575 | `prop:label` | Joining Date | `staff.staffFormModal.joiningDateLabel` |
| 586 | `prop:label` | Qualification | `staff.staffFormModal.qualificationLabel` |
| 592 | `prop:placeholder` | e.g. M.Ed, B.Ed | `staff.staffFormModal.eGMEdBPlaceholder` |
| 596 | `prop:label` | Base Salary | `staff.staffFormModal.baseSalaryLabel` |
| 612 | `prop:label` | Status | `staff.staffFormModal.statusLabel` |
| 620 | `jsx-child` | Active | `staff.staffFormModal.activeText` |
| 620 | `jsx-child` | Inactive | `staff.staffFormModal.inactiveText` |
| 626 | `prop:title` | Contact Information | `staff.staffFormModal.contactInformationTitle` |
| 628 | `prop:label` | Email | `staff.staffFormModal.emailLabel` |
| 635 | `prop:placeholder` | staff@school.edu | `staff.staffFormModal.staffSchoolEduPlaceholder` |
| 640 | `prop:label` | Phone | `staff.staffFormModal.phoneLabel` |
| 646 | `prop:placeholder` | +880-XXX-XXXXXX | `staff.staffFormModal.880XxxXxxxxxPlaceholder` |
| 656 | `prop:title` | User Account | `staff.staffFormModal.userAccountTitle` |
| 666 | `jsx-text` | Create login account for this staff member | `staff.staffFormModal.createLoginAccountText` |
| 669 | `jsx-text` | This will allow the staff member to access the system | `staff.staffFormModal.thisWillAllowStaffText` |
| 676 | `prop:label` | Login Email | `staff.staffFormModal.loginEmailLabel` |
| 687 | `prop:placeholder` | staff@school.edu | `staff.staffFormModal.staffSchoolEduPlaceholder2` |
| 692 | `prop:label` | Temporary Password | `staff.staffFormModal.temporaryPasswordLabel` |
| 703 | `prop:placeholder` | Min 6 characters | `staff.staffFormModal.min6CharactersPlaceholder` |
| 720 | `prop:alt` | Staff photo preview | `staff.staffFormModal.staffPhotoPreviewAlt` |
| 721 | `prop:title` | Staff Photo | `staff.staffFormModal.staffPhotoTitle` |

**`viewmodels/staff/use-staff-view-model.ts`** — 5

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 117 | `toast:success` | Staff member created successfully! | `staff.useStaffViewModel.staffMemberCreatedSuccessfullySuccess` |
| 131 | `toast:success` | Staff member updated successfully! | `staff.useStaffViewModel.staffMemberUpdatedSuccessfullySuccess` |
| 144 | `toast:success` | Staff member deleted successfully! | `staff.useStaffViewModel.staffMemberDeletedSuccessfullySuccess` |
| 159 | `toast:success` | Staff member activated! | `staff.useStaffViewModel.staffMemberActivatedSuccess` |
| 159 | `toast:success` | Staff member deactivated! | `staff.useStaffViewModel.staffMemberDeactivatedSuccess` |

### `/students`

**Tier:** P1 - Core daily · **Findings:** 9 · **Files:** 3 · **Namespace:** `students`

**`app/(dashboard)/students/page.tsx`** — 2

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 207 | `jsx-text` | Access restricted | `students.page.accessRestrictedText` |
| 208 | `jsx-text` | You do not have permission to view students. | `students.page.youDoNotHavePermissionText` |

**`components/students/student-status-badge.tsx`** — 4 · *shared by 2 screens: `/admissions`, `/students`*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 11 | `obj:label` | Active | `students.studentStatusBadge.activeLabel` |
| 12 | `obj:label` | Inactive | `students.studentStatusBadge.inactiveLabel` |
| 13 | `obj:label` | Graduated | `students.studentStatusBadge.graduatedLabel` |
| 14 | `obj:label` | Transferred | `students.studentStatusBadge.transferredLabel` |

**`viewmodels/students/use-student-view-model.ts`** — 3 · *shared by 2 screens: `/admissions`, `/students`*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 157 | `toast:success` | Student created successfully! | `students.useStudentViewModel.studentCreatedSuccessfullySuccess` |
| 171 | `toast:success` | Student updated successfully! | `students.useStudentViewModel.studentUpdatedSuccessfullySuccess` |
| 184 | `toast:success` | Student deleted successfully! | `students.useStudentViewModel.studentDeletedSuccessfullySuccess` |

### `/login`

**Tier:** P1 - Core daily · **Findings:** 7 · **Files:** 1 · **Namespace:** `login`

**`app/(auth)/login/page.tsx`** — 7

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 223 | `prop:alt` | App Icon | `login.page.appIconAlt` |
| 228 | `jsx-text` | Pathshala Pro | `login.page.pathshalaProText` |
| 324 | `jsx-text` | EN | `login.page.enText` |
| 332 | `jsx-text` | BN | `login.page.bnText` |
| 340 | `jsx-text` | AR | `login.page.arText` |
| 369 | `prop:alt` | App Icon | `login.page.appIconAlt2` |
| 374 | `jsx-text` | Pathshala Pro | `login.page.pathshalaProText2` |

### `/fees`

**Tier:** P1 - Core daily · **Findings:** 7 · **Files:** 2 · **Namespace:** `fees`

**`app/(dashboard)/fees/page.tsx`** — 3

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 320 | `jsx-text` | Access restricted | `fees.page.accessRestrictedText3` |
| 321 | `jsx-text` | You do not have permission to view fees. | `fees.page.youDoNotHavePermissionText3` |
| 524 | `jsx-text` | Set Class Rates Now | `fees.page.setClassRatesNowText` |

**`components/fees/batch-invoice-modal.tsx`** — 4

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 81 | `obj:note` | Monthly Tuition Fee | `fees.batchInvoiceModal.monthlyTuitionFeeNote` |
| 161 | `jsx-text` | Monthly tuition invoices for | `fees.batchInvoiceModal.monthlyTuitionInvoicesText` |
| 161 | `jsx-text` | are now active. | `fees.batchInvoiceModal.areNowActiveText` |
| 201 | `jsx-text` | Done & Return to Ledger | `fees.batchInvoiceModal.doneReturnLedgerText` |

### `/`

**Tier:** P1 - Core daily · **Findings:** 4 · **Files:** 1 · **Namespace:** `dashboard`

**`app/(dashboard)/page.tsx`** — 4

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 228 | `jsx-text` | View | `dashboard.page.viewText` |
| 394 | `jsx-child` | Receipt #${…} | `dashboard.page.receiptText` |
| 557 | `jsx-text` | Pinned | `dashboard.page.pinnedText` |
| 562 | `jsx-text` | Urgent | `dashboard.page.urgentText` |

### `/attendance`

**Tier:** P1 - Core daily · **Findings:** 3 · **Files:** 2 · **Namespace:** `attendance`

**`app/(dashboard)/attendance/page.tsx`** — 1

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 234 | `jsx-text` | You don&apos;t have permission to view attendance records. | `attendance.page.youDontHavePermissionText` |

**`components/attendance/mark-attendance-modal.tsx`** — 2

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 145 | `jsx-text` | Total: | `attendance.markAttendanceModal.totalText` |
| 312 | `prop:placeholder` | Note (optional) | `attendance.markAttendanceModal.noteOptionalPlaceholder` |

### `/onboarding`

**Tier:** P1 - Core daily · **Findings:** 2 · **Files:** 1 · **Namespace:** `onboarding`

**`app/(auth)/onboarding/page.tsx`** — 2

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 728 | `jsx-text` | Your school ERP instance is live with full database isolation, academic … | `onboarding.page.yourSchoolErpInstanceText` |
| 729 | `jsx-text` | , and initial grade structures. | `onboarding.page.andInitialGradeStructuresText` |

### `/exams`

**Tier:** P1 - Core daily · **Findings:** 2 · **Files:** 1 · **Namespace:** `exams`

**`app/(dashboard)/exams/page.tsx`** — 2

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 271 | `jsx-text` | Access restricted | `exams.page.accessRestrictedText` |
| 272 | `jsx-text` | You do not have permission to view exams. | `exams.page.youDoNotHavePermissionText` |

### `/users`

**Tier:** P2 - Frequent · **Findings:** 60 · **Files:** 3 · **Namespace:** `users`

**`app/(dashboard)/users/page.tsx`** — 5

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 82 | `obj:header` | Access Level | `users.page.accessLevelColumnHeader` |
| 148 | `prop:title` | You cannot delete your own account | `users.page.youCannotDeleteOwnTitle` |
| 149 | `prop:aria-label` | You cannot delete your own account | `users.page.youCannotDeleteOwnAriaLabel` |
| 194 | `jsx-text` | Access restricted | `users.page.accessRestrictedText` |
| 196 | `jsx-text` | You do not have permission to view user accounts. | `users.page.youDoNotHavePermissionText` |

**`components/users/permission-modal.tsx`** — 33

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 51 | `obj:label` | View (Read) | `users.permissionModal.viewReadLabel` |
| 52 | `obj:label` | Create / Edit (Write) | `users.permissionModal.createEditWriteLabel` |
| 53 | `obj:label` | Delete / Approve (Manage) | `users.permissionModal.deleteApproveManageLabel` |
| 128 | `obj:label` | Level ${…} - ${…} | `users.permissionModal.levelLabel` |
| 213 | `toast:info` | Permissions reset to role defaults | `users.permissionModal.permissionsResetRoleDefaultsSuccess` |
| 221 | `toast:info` | Applied ${…} access level | `users.permissionModal.appliedAccessLevelSuccess` |
| 248 | `toast:success` | Permissions updated successfully | `users.permissionModal.permissionsUpdatedSuccessfullySuccess` |
| 268 | `obj:label` | Full Access | `users.permissionModal.fullAccessLabel` |
| 274 | `obj:label` | Principal | `users.permissionModal.principalLabel` |
| 280 | `obj:label` | Accountant | `users.permissionModal.accountantLabel` |
| 286 | `obj:label` | Teacher | `users.permissionModal.teacherLabel` |
| 292 | `obj:label` | Read-Only | `users.permissionModal.readOnlyLabel` |
| 298 | `obj:label` | No Access | `users.permissionModal.noAccessLabel` |
| 318 | `prop:title` | Manage Access & Permissions | `users.permissionModal.manageAccessPermissionsTitle` |
| 319 | `prop:description` | Configure module access levels for ${…} (${…}) | `users.permissionModal.configureModuleAccessLevelsDescription` |
| 334 | `jsx-text` | Reset to Defaults | `users.permissionModal.resetDefaultsText` |
| 340 | `jsx-text` | Matches | `users.permissionModal.matchesText` |
| 340 | `jsx-text` | role defaults | `users.permissionModal.roleDefaultsText` |
| 351 | `jsx-text` | Discard | `users.permissionModal.discardText` |
| 355 | `jsx-child` | Enforcing Rules... | `users.permissionModal.enforcingRulesText` |
| 355 | `jsx-child` | Save Policies | `users.permissionModal.savePoliciesText` |
| 382 | `obj:label` | No Access Level | `users.permissionModal.noAccessLevelLabel` |
| 383 | `prop:placeholder` | Select access level | `users.permissionModal.selectAccessLevelPlaceholder` |
| 388 | `jsx-text` | Last login: | `users.permissionModal.lastLoginText` |
| 399 | `jsx-text` | Warning: Admin Account | `users.permissionModal.warningAdminAccountText` |
| 401 | `jsx-text` | This user has the | `users.permissionModal.thisUserHasText` |
| 401 | `jsx-text` | role, which ordinarily grants full bypassing system access. Setting expl… | `users.permissionModal.roleWhichOrdinarilyGrantsFullText` |
| 412 | `jsx-text` | Quick Presets | `users.permissionModal.quickPresetsText` |
| 437 | `jsx-text` | Module Directory | `users.permissionModal.moduleDirectoryText` |
| 452 | `jsx-text` | All | `users.permissionModal.allText` |
| 528 | `prop:title` | Modified from role defaults | `users.permissionModal.modifiedRoleDefaultsTitle` |
| 555 | `jsx-text` | modules across | `users.permissionModal.modulesAcrossText` |
| 560 | `jsx-text` | differ from | `users.permissionModal.differText` |

**`components/users/user-form-modal.tsx`** — 22

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 87 | `toast:error` | Please fill in all required fields. | `users.userFormModal.pleaseFillAllRequiredError` |
| 104 | `toast:success` | User updated successfully | `users.userFormModal.userUpdatedSuccessfullySuccess` |
| 123 | `toast:success` | User created successfully | `users.userFormModal.userCreatedSuccessfullySuccess` |
| 140 | `prop:title` | Edit User | `users.userFormModal.editUserTitle` |
| 140 | `prop:title` | Create User | `users.userFormModal.createUserTitle` |
| 143 | `prop:description` | Update the user's details and permissions. | `users.userFormModal.updateUserSDetailsDescription` |
| 144 | `prop:description` | Add a new user to the system. | `users.userFormModal.addNewUserDescription` |
| 155 | `jsx-text` | Cancel | `users.userFormModal.cancelText` |
| 158 | `jsx-child` | Saving... | `users.userFormModal.savingText` |
| 158 | `jsx-child` | Update | `users.userFormModal.updateText` |
| 158 | `jsx-child` | Create | `users.userFormModal.createText` |
| 166 | `prop:label` | Full Name | `users.userFormModal.fullNameLabel` |
| 172 | `prop:placeholder` | John Doe | `users.userFormModal.johnDoePlaceholder` |
| 182 | `prop:label` | Email Address | `users.userFormModal.emailAddressLabel` |
| 188 | `prop:placeholder` | admin@example.com | `users.userFormModal.adminExampleComPlaceholder` |
| 198 | `prop:label` | New Password | `users.userFormModal.newPasswordLabel` |
| 198 | `prop:label` | Password | `users.userFormModal.passwordLabel` |
| 204 | `prop:placeholder` | Leave blank to keep same | `users.userFormModal.leaveBlankKeepSamePlaceholder` |
| 215 | `prop:label` | Role | `users.userFormModal.roleLabel` |
| 227 | `prop:placeholder` | Select role | `users.userFormModal.selectRolePlaceholder` |
| 249 | `jsx-text` | Active Account | `users.userFormModal.activeAccountText` |
| 252 | `jsx-text` | If disabled, this user will not be able to log in to the system. | `users.userFormModal.ifDisabledUserWillText` |

### `/exams/question-papers/create`

**Tier:** P2 - Frequent · **Findings:** 53 · **Files:** 1 · **Namespace:** `exams`

**`app/(dashboard)/exams/question-papers/create/page.tsx`** — 53

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 80 | `obj:title` | Section A: Multiple Choice Questions | `exams.page.sectionMultipleChoiceQuestionsTitle` |
| 87 | `obj:title` | Section B: Short Answer Questions | `exams.page.sectionBShortAnswerQuestionsTitle` |
| 94 | `obj:title` | Section C: Descriptive & Creative Questions | `exams.page.sectionCDescriptiveCreativeQuestionsTitle` |
| 205 | `toast:error` | Paper must have at least one section | `exams.page.paperMustHaveLeastError` |
| 320 | `toast:success` | Question paper saved successfully! | `exams.page.questionPaperSavedSuccessfullySuccess` |
| 361 | `jsx-text` | Interactive Section Composer & Marks Budget Engine | `exams.page.interactiveSectionComposerMarksBudgetText` |
| 372 | `jsx-text` | Save as Draft | `exams.page.saveAsDraftText` |
| 380 | `jsx-text` | Save & Finalize Paper | `exams.page.saveFinalizePaperText` |
| 392 | `jsx-text` | Marks Budget | `exams.page.marksBudgetText` |
| 395 | `jsx-text` | Marks | `exams.page.marksText3` |
| 401 | `jsx-text` | Time Allowed | `exams.page.timeAllowedText` |
| 404 | `jsx-text` | m ( | `exams.page.mText2` |
| 404 | `jsx-text` | mins) | `exams.page.minsText` |
| 410 | `jsx-text` | Total Questions | `exams.page.totalQuestionsText` |
| 413 | `jsx-text` | Questions Selected | `exams.page.questionsSelectedText` |
| 422 | `jsx-text` | Difficulty Ratio | `exams.page.difficultyRatioText` |
| 425 | `jsx-text` | Easy | `exams.page.easyText` |
| 427 | `jsx-text` | Med | `exams.page.medText` |
| 429 | `jsx-text` | Hard | `exams.page.hardText` |
| 442 | `jsx-text` | Configure target class, subject, and general instructions on the examina… | `exams.page.configureTargetClassSubjectText` |
| 454 | `prop:placeholder` | e.g. Annual Examination 2026 | `exams.page.eGAnnualExamination2026Placeholder` |
| 465 | `prop:placeholder` | e.g. SET-A / QP-101 | `exams.page.eGSetQpPlaceholder` |
| 474 | `prop:placeholder` | Select Academic Year | `exams.page.selectAcademicYearPlaceholder` |
| 494 | `prop:placeholder` | Select Class | `exams.page.selectClassPlaceholder2` |
| 512 | `prop:placeholder` | Select Subject | `exams.page.selectSubjectPlaceholder2` |
| 606 | `jsx-text` | Marks: | `exams.page.marksText4` |
| 626 | `toast:error` | Please select Target Class and Subject above first. | `exams.page.pleaseSelectTargetClassError` |
| 634 | `jsx-text` | Pick from Bank ( | `exams.page.pickBankText` |
| 650 | `prop:placeholder` | Section instructions (e.g. Answer all questions from this section)... | `exams.page.sectionInstructionsEGAnswerPlaceholder` |
| 666 | `jsx-text` | No questions added to this section yet. Click | `exams.page.noQuestionsAddedText` |
| 671 | `toast:error` | Please select Target Class and Subject first. | `exams.page.pleaseSelectTargetClassError2` |
| 678 | `jsx-text` | Pick from Bank | `exams.page.pickBankText2` |
| 680 | `jsx-text` | to choose questions. | `exams.page.toChooseQuestionsText` |
| 706 | `jsx-text` | Marks] | `exams.page.marksText5` |
| 738 | `jsx-text` | Select Questions for | `exams.page.selectQuestionsText` |
| 740 | `jsx-text` | Selected | `exams.page.selectedText` |
| 744 | `jsx-text` | Browse and check questions from the Question Bank to include in this sec… | `exams.page.browseCheckQuestionsText` |
| 753 | `prop:placeholder` | Search questions... | `exams.page.searchQuestionsPlaceholder` |
| 762 | `prop:placeholder` | All Types | `exams.page.allTypesPlaceholder` |
| 765 | `jsx-text` | All Question Types | `exams.page.allQuestionTypesText` |
| 766 | `jsx-text` | Multiple Choice (MCQ) | `exams.page.multipleChoiceMcqText` |
| 767 | `jsx-text` | Short Answer | `exams.page.shortAnswerText` |
| 768 | `jsx-text` | Descriptive / Essay | `exams.page.descriptiveEssayText` |
| 769 | `jsx-text` | Creative (CQ) | `exams.page.creativeCqText` |
| 775 | `prop:placeholder` | All Difficulties | `exams.page.allDifficultiesPlaceholder` |
| 778 | `jsx-text` | All Difficulties | `exams.page.allDifficultiesText` |
| 779 | `jsx-text` | Easy | `exams.page.easyText2` |
| 780 | `jsx-text` | Medium | `exams.page.mediumText` |
| 781 | `jsx-text` | Hard | `exams.page.hardText2` |
| 790 | `jsx-text` | No questions match your criteria in this subject's question bank. | `exams.page.noQuestionsMatchCriteriaText` |
| 828 | `jsx-text` | Marks | `exams.page.marksText6` |
| 841 | `jsx-text` | Done ( | `exams.page.doneText` |
| 841 | `jsx-text` | Selected) | `exams.page.selectedText2` |

### `/homework`

**Tier:** P2 - Frequent · **Findings:** 52 · **Files:** 2 · **Namespace:** `homework`

**`app/(dashboard)/homework/page.tsx`** — 48

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 168 | `toast:loading` | Uploading worksheet to Cloudflare R2... | `homework.page.uploadingWorksheetCloudflareR2Success` |
| 188 | `toast:success` | Worksheet uploaded successfully! | `homework.page.worksheetUploadedSuccessfullySuccess` |
| 273 | `toast:error` | Please enter or select a grade | `homework.page.pleaseEnterSelectError` |
| 293 | `toast:success` | Submission graded! | `homework.page.submissionGradedSuccess` |
| 313 | `jsx-text` | Overdue ( | `homework.page.overdueText` |
| 313 | `jsx-text` | d ago) | `homework.page.dAgoText` |
| 321 | `jsx-text` | Due Today | `homework.page.dueTodayText` |
| 329 | `jsx-text` | Due in | `homework.page.dueText` |
| 336 | `jsx-text` | Due in | `homework.page.dueText2` |
| 355 | `prop:title` | View attached worksheet | `homework.page.viewAttachedWorksheetTitle` |
| 403 | `jsx-text` | Submissions | `homework.page.submissionsText` |
| 418 | `prop:title` | Review & Grade Submissions | `homework.page.reviewGradeSubmissionsTitle` |
| 428 | `prop:title` | Edit Homework | `homework.page.editHomeworkTitle` |
| 439 | `prop:title` | Delete Homework | `homework.page.deleteHomeworkTitle` |
| 479 | `jsx-text` | You don&apos;t have permission to view homework. | `homework.page.youDontHavePermissionText` |
| 507 | `jsx-text` | Active Assignments | `homework.page.activeAssignmentsText` |
| 557 | `obj:label` | All Classes | `homework.page.allClassesLabel` |
| 573 | `jsx-text` | Search | `homework.page.searchText` |
| 615 | `jsx-child` | Publishing... | `homework.page.publishingText` |
| 651 | `prop:placeholder` | e.g. Chapter 4: Photosynthesis & Cell Structure Questions | `homework.page.eGChapter4PhotosynthesisPlaceholder` |
| 667 | `prop:placeholder` | Detailed instructions, reading page ranges, or specific assignment crite… | `homework.page.detailedInstructionsReadingPageRangesPlaceholder` |
| 685 | `jsx-text` | Worksheet Attachment (PDF, Image, or DOCX) | `homework.page.worksheetAttachmentPdfImageText` |
| 703 | `jsx-text` | Preview | `homework.page.previewText` |
| 738 | `jsx-text` | Uploading to Cloudflare R2... | `homework.page.uploadingCloudflareR2Text` |
| 747 | `jsx-text` | Click to upload worksheet attachment | `homework.page.clickUploadWorksheetAttachmentText` |
| 750 | `jsx-text` | Supports PDF, JPG, PNG, DOCX up to 5MB | `homework.page.supportsPdfJpgPngDocxText` |
| 773 | `jsx-text` | Broadcast announcement to student noticeboard | `homework.page.broadcastAnnouncementStudentNoticeboardText` |
| 776 | `jsx-text` | Automatically publishes a circular to this class on the institutional no… | `homework.page.automaticallyPublishesCircularText` |
| 791 | `prop:title` | ${…} — Submissions | `homework.page.submissionsTitle` |
| 792 | `prop:description` | Review student work, grade assignments, and leave remarks. | `homework.page.reviewStudentWorkGradeAssignmentsDescription` |
| 800 | `jsx-text` | Total Received | `homework.page.totalReceivedText` |
| 805 | `jsx-text` | Graded | `homework.page.gradedText` |
| 819 | `jsx-text` | All ( | `homework.page.allText` |
| 827 | `jsx-text` | Pending ( | `homework.page.pendingText` |
| 835 | `jsx-text` | Graded ( | `homework.page.gradedText2` |
| 849 | `jsx-text` | No submissions found | `homework.page.noSubmissionsFoundText` |
| 851 | `jsx-text` | Students will appear here once they turn in their homework. | `homework.page.studentsWillAppearHereOnceText` |
| 866 | `jsx-text` | Roll # | `homework.page.rollText` |
| 870 | `jsx-text` | Submitted: | `homework.page.submittedText` |
| 873 | `jsx-child` | Manual / Class Turn-in | `homework.page.manualClassTurnText` |
| 882 | `jsx-text` | View Submitted File | `homework.page.viewSubmittedFileText` |
| 902 | `jsx-text` | Grade: | `homework.page.gradeText` |
| 920 | `jsx-text` | Quick Grade: | `homework.page.quickGradeText` |
| 939 | `prop:placeholder` | Score / Grade | `homework.page.scoreGradePlaceholder` |
| 948 | `prop:placeholder` | Custom feedback / remarks... | `homework.page.customFeedbackRemarksPlaceholder` |
| 963 | `jsx-child` | Grading... | `homework.page.gradingText` |
| 963 | `jsx-child` | Save Grade | `homework.page.saveGradeText` |
| 975 | `jsx-text` | div> ); } | `homework.page.divText` |

**`viewmodels/homework/use-homework-view-model.ts`** — 4

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 28 | `toast:success` | Homework created | `homework.useHomeworkViewModel.homeworkCreatedSuccess` |
| 34 | `toast:success` | Homework updated | `homework.useHomeworkViewModel.homeworkUpdatedSuccess` |
| 40 | `toast:success` | Homework deleted | `homework.useHomeworkViewModel.homeworkDeletedSuccess` |
| 68 | `toast:success` | Graded | `homework.useHomeworkViewModel.gradedSuccess` |

### `/reports/salary`

**Tier:** P2 - Frequent · **Findings:** 45 · **Files:** 1 · **Namespace:** `reports`

**`app/(dashboard)/reports/salary/page.tsx`** — 45

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 107 | `toast:error` | Failed to generate salary payroll report | `reports.page.failedGenerateSalaryPayrollError` |
| 131 | `toast:success` | Payroll report exported to Excel | `reports.page.payrollReportExportedExcelSuccess` |
| 134 | `toast:error` | Failed to export payroll report | `reports.page.failedExportPayrollReportError` |
| 140 | `obj:header` | Staff ID | `reports.page.staffIdColumnHeader` |
| 147 | `obj:header` | Employee Name | `reports.page.employeeNameColumnHeader` |
| 157 | `obj:header` | Department | `reports.page.departmentColumnHeader` |
| 166 | `obj:header` | Period | `reports.page.periodColumnHeader` |
| 171 | `obj:header` | Gross Base | `reports.page.grossBaseColumnHeader` |
| 178 | `obj:header` | Deductions | `reports.page.deductionsColumnHeader` |
| 190 | `obj:header` | Net Payable | `reports.page.netPayableColumnHeader` |
| 199 | `obj:header` | Paid Amount | `reports.page.paidAmountColumnHeader` |
| 208 | `obj:header` | Status | `reports.page.statusColumnHeader3` |
| 224 | `obj:label` | Disbursed / Paid | `reports.page.disbursedPaidLabel` |
| 225 | `obj:label` | Pending Payout | `reports.page.pendingPayoutLabel` |
| 226 | `obj:label` | Deductions/Withheld | `reports.page.deductionsWithheldLabel` |
| 250 | `jsx-text` | Year | `reports.page.yearText` |
| 265 | `jsx-text` | Month | `reports.page.monthText` |
| 271 | `jsx-text` | All Months | `reports.page.allMonthsText` |
| 294 | `jsx-text` | Department | `reports.page.departmentText` |
| 300 | `jsx-text` | All Departments | `reports.page.allDepartmentsText` |
| 301 | `jsx-text` | Academic / Teaching | `reports.page.academicTeachingText` |
| 302 | `jsx-text` | Administration | `reports.page.administrationText` |
| 303 | `jsx-text` | Accounts & Finance | `reports.page.accountsFinanceText` |
| 304 | `jsx-text` | Support & Transport | `reports.page.supportTransportText` |
| 309 | `jsx-text` | Payout Status | `reports.page.payoutStatusText` |
| 315 | `jsx-text` | All Statuses | `reports.page.allStatusesText2` |
| 316 | `jsx-text` | Paid / Disbursed | `reports.page.paidDisbursedText` |
| 317 | `jsx-text` | Pending Payout | `reports.page.pendingPayoutText` |
| 318 | `jsx-text` | Partial | `reports.page.partialText` |
| 325 | `jsx-text` | Reset | `reports.page.resetText3` |
| 333 | `jsx-child` | Generating... | `reports.page.generatingText3` |
| 333 | `jsx-child` | Generate Report | `reports.page.generateReportText3` |
| 346 | `obj:label` | Year | `reports.page.yearLabel` |
| 347 | `obj:label` | Month | `reports.page.monthLabel` |
| 354 | `prop:title` | Total Gross Payroll | `reports.page.totalGrossPayrollTitle` |
| 359 | `prop:title` | Net Disbursed | `reports.page.netDisbursedTitle` |
| 364 | `prop:title` | Pending Payouts | `reports.page.pendingPayoutsTitle` |
| 369 | `prop:title` | Total Deductions | `reports.page.totalDeductionsTitle` |
| 378 | `prop:title` | Payroll by Department | `reports.page.payrollDepartmentTitle` |
| 379 | `prop:description` | Gross salary allocation across departments | `reports.page.grossSalaryAllocationAcrossDepartmentsDescription` |
| 383 | `prop:title` | Disbursement Composition | `reports.page.disbursementCompositionTitle` |
| 384 | `prop:description` | Ratio of disbursed vs pending vs deductions | `reports.page.ratioDisbursedVsPendingDescription` |
| 391 | `jsx-text` | Staff Payout Ledger | `reports.page.staffPayoutLedgerText` |
| 399 | `prop:title` | No Payroll Report Generated | `reports.page.noPayrollReportGeneratedTitle` |
| 400 | `prop:description` | Select fiscal year, month, and department filters above then click Gener… | `reports.page.selectFiscalYearMonthDescription` |

### `/reports/admissions`

**Tier:** P2 - Frequent · **Findings:** 44 · **Files:** 1 · **Namespace:** `reports`

**`app/(dashboard)/reports/admissions/page.tsx`** — 44

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 139 | `toast:error` | Failed to generate admissions conversion report | `reports.page.failedGenerateAdmissionsConversionError` |
| 165 | `toast:success` | Admissions conversion report exported to Excel | `reports.page.admissionsConversionReportExportedSuccess` |
| 168 | `toast:error` | Failed to export admissions report | `reports.page.failedExportAdmissionsReportError` |
| 174 | `obj:header` | Applicant / Student | `reports.page.applicantStudentColumnHeader` |
| 178 | `jsx-text` | Guardian: | `reports.page.guardianText` |
| 184 | `obj:header` | Contact Phone | `reports.page.contactPhoneColumnHeader` |
| 189 | `obj:header` | Target Grade | `reports.page.targetGradeColumnHeader` |
| 198 | `obj:header` | Lead Source | `reports.page.leadSourceColumnHeader` |
| 207 | `obj:header` | Pipeline Status | `reports.page.pipelineStatusColumnHeader` |
| 217 | `obj:header` | Admission Officer | `reports.page.admissionOfficerColumnHeader` |
| 224 | `obj:header` | Enquiry Date | `reports.page.enquiryDateColumnHeader` |
| 273 | `jsx-text` | From Date | `reports.page.fromDateText` |
| 283 | `jsx-text` | To Date | `reports.page.toDateText` |
| 293 | `jsx-text` | Pipeline Status | `reports.page.pipelineStatusText` |
| 299 | `jsx-text` | All Statuses | `reports.page.allStatusesText` |
| 300 | `jsx-text` | New Lead | `reports.page.newLeadText` |
| 301 | `jsx-text` | Contacted | `reports.page.contactedText` |
| 302 | `jsx-text` | Campus Visited | `reports.page.campusVisitedText` |
| 303 | `jsx-text` | Admitted / Enrolled | `reports.page.admittedEnrolledText` |
| 304 | `jsx-text` | Rejected | `reports.page.rejectedText` |
| 309 | `jsx-text` | Lead Source | `reports.page.leadSourceText` |
| 315 | `jsx-text` | All Sources | `reports.page.allSourcesText` |
| 316 | `jsx-text` | Walk In | `reports.page.walkText` |
| 317 | `jsx-text` | Phone Inquiry | `reports.page.phoneInquiryText` |
| 318 | `jsx-text` | Website Form | `reports.page.websiteFormText` |
| 319 | `jsx-text` | Parent Referral | `reports.page.parentReferralText` |
| 320 | `jsx-text` | Social Media | `reports.page.socialMediaText` |
| 325 | `jsx-text` | Target Class | `reports.page.targetClassText` |
| 331 | `jsx-text` | All Classes | `reports.page.allClassesText` |
| 343 | `jsx-text` | Reset | `reports.page.resetText` |
| 351 | `jsx-child` | Generating... | `reports.page.generatingText` |
| 351 | `jsx-child` | Generate Report | `reports.page.generateReportText` |
| 364 | `obj:label` | Range | `reports.page.rangeLabel` |
| 371 | `prop:title` | Total Enquiries | `reports.page.totalEnquiriesTitle` |
| 376 | `prop:title` | Admitted Students | `reports.page.admittedStudentsTitle` |
| 381 | `prop:title` | Conversion Rate | `reports.page.conversionRateTitle` |
| 386 | `prop:title` | Pending Follow-ups | `reports.page.pendingFollowUpsTitle` |
| 395 | `prop:title` | Leads by Source | `reports.page.leadsSourceTitle` |
| 396 | `prop:description` | Marketing channel distribution for applicant inquiries | `reports.page.marketingChannelDistributionApplicantDescription` |
| 400 | `prop:title` | Pipeline Status Breakdown | `reports.page.pipelineStatusBreakdownTitle` |
| 401 | `prop:description` | Distribution of applicant statuses across the intake funnel | `reports.page.distributionApplicantStatusesAcrossDescription` |
| 408 | `jsx-text` | Applicant Enquiries Ledger | `reports.page.applicantEnquiriesLedgerText` |
| 419 | `prop:title` | No Admissions Report Generated | `reports.page.noAdmissionsReportGeneratedTitle` |
| 420 | `prop:description` | Select date range, pipeline status, lead source, and target class filter… | `reports.page.selectDateRangePipelineStatusDescription` |

### `/reports/financial`

**Tier:** P2 - Frequent · **Findings:** 38 · **Files:** 1 · **Namespace:** `reports`

**`app/(dashboard)/reports/financial/page.tsx`** — 38

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 131 | `toast:error` | Failed to generate financial expenses report | `reports.page.failedGenerateFinancialExpensesError` |
| 155 | `toast:success` | Financial expenses report exported to Excel | `reports.page.financialExpensesReportExportedSuccess` |
| 158 | `toast:error` | Failed to export financial report | `reports.page.failedExportFinancialReportError` |
| 164 | `obj:header` | Voucher # | `reports.page.voucherColumnHeader` |
| 173 | `obj:header` | Description / Purpose | `reports.page.descriptionPurposeColumnHeader` |
| 177 | `jsx-text` | Payee: | `reports.page.payeeText` |
| 183 | `obj:header` | Category | `reports.page.categoryColumnHeader` |
| 192 | `obj:header` | Amount | `reports.page.amountColumnHeader` |
| 201 | `obj:header` | Method | `reports.page.methodColumnHeader` |
| 208 | `obj:header` | Date | `reports.page.dateColumnHeader2` |
| 217 | `obj:header` | Recorded By | `reports.page.recordedColumnHeader` |
| 231 | `obj:label` | Cash Expenses | `reports.page.cashExpensesLabel` |
| 232 | `obj:label` | Bank & Digital | `reports.page.bankDigitalLabel` |
| 256 | `jsx-text` | From Date | `reports.page.fromDateText2` |
| 266 | `jsx-text` | To Date | `reports.page.toDateText2` |
| 276 | `jsx-text` | Category | `reports.page.categoryText` |
| 282 | `jsx-text` | All Categories | `reports.page.allCategoriesText` |
| 292 | `jsx-text` | Method | `reports.page.methodText` |
| 298 | `jsx-text` | All Payment Methods | `reports.page.allPaymentMethodsText` |
| 299 | `jsx-text` | Cash | `reports.page.cashText` |
| 300 | `jsx-text` | Bank Account | `reports.page.bankAccountText` |
| 301 | `jsx-text` | Cheque | `reports.page.chequeText` |
| 302 | `jsx-text` | Digital Gateway | `reports.page.digitalGatewayText` |
| 309 | `jsx-text` | Reset | `reports.page.resetText2` |
| 317 | `jsx-child` | Generating... | `reports.page.generatingText2` |
| 317 | `jsx-child` | Generate Report | `reports.page.generateReportText2` |
| 330 | `obj:label` | Range | `reports.page.rangeLabel2` |
| 337 | `prop:title` | Total Fee Collections | `reports.page.totalFeeCollectionsTitle` |
| 342 | `prop:title` | Total Operational Expenses | `reports.page.totalOperationalExpensesTitle` |
| 347 | `prop:title` | Net Cash Balance | `reports.page.netCashBalanceTitle` |
| 352 | `prop:title` | Top Expense Category | `reports.page.topExpenseCategoryTitle` |
| 361 | `prop:title` | Expenses by Category | `reports.page.expensesCategoryTitle` |
| 362 | `prop:description` | Spending breakdown across operational heads | `reports.page.spendingBreakdownAcrossOperationalHeadsDescription` |
| 366 | `prop:title` | Payment Methods Distribution | `reports.page.paymentMethodsDistributionTitle` |
| 367 | `prop:description` | Cash vs Bank disbursement proportion | `reports.page.cashVsBankDisbursementProportionDescription` |
| 374 | `jsx-text` | Itemized Expense Ledger | `reports.page.itemizedExpenseLedgerText` |
| 385 | `prop:title` | No Financial Report Generated | `reports.page.noFinancialReportGeneratedTitle` |
| 386 | `prop:description` | Select date range, expense categories, and payment method filters above … | `reports.page.selectDateRangeExpenseCategoriesDescription` |

### `/reports`

**Tier:** P2 - Frequent · **Findings:** 36 · **Files:** 5 · **Namespace:** `reports`

**`components/reports/export-dropdown.tsx`** — 3 · *shared by 7 screens: `/reports/admissions`, `/reports/attendance`, `/reports/exams`, `/reports/fees`, `/reports/financial`, `/reports/salary` … (+1 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 21 | `obj:label` | Export as Excel | `reports.exportDropdown.exportAsExcelLabel` |
| 26 | `obj:label` | Export as PDF | `reports.exportDropdown.exportAsPdfLabel` |
| 64 | `jsx-text` | Export | `reports.exportDropdown.exportText` |

**`components/reports/report-charts.tsx`** — 3 · *shared by 7 screens: `/reports/admissions`, `/reports/attendance`, `/reports/exams`, `/reports/fees`, `/reports/financial`, `/reports/salary` … (+1 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 34 | `jsx-text` | No data available | `reports.reportCharts.noDataAvailableText` |
| 155 | `jsx-text` | No data available | `reports.reportCharts.noDataAvailableText2` |
| 266 | `jsx-text` | No data available | `reports.reportCharts.noDataAvailableText3` |

**`components/reports/report-filters.tsx`** — 24 · *shared by 7 screens: `/reports/admissions`, `/reports/attendance`, `/reports/exams`, `/reports/fees`, `/reports/financial`, `/reports/salary` … (+1 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 61 | `obj:label` | Pending | `reports.reportFilters.pendingLabel` |
| 62 | `obj:label` | Paid | `reports.reportFilters.paidLabel` |
| 63 | `obj:label` | Partial | `reports.reportFilters.partialLabel` |
| 64 | `obj:label` | Overdue | `reports.reportFilters.overdueLabel` |
| 137 | `prop:placeholder` | Select class | `reports.reportFilters.selectClassPlaceholder` |
| 140 | `jsx-text` | All Classes | `reports.reportFilters.allClassesText` |
| 157 | `prop:placeholder` | Select section | `reports.reportFilters.selectSectionPlaceholder` |
| 160 | `jsx-text` | All Sections | `reports.reportFilters.allSectionsText` |
| 177 | `prop:placeholder` | Select group | `reports.reportFilters.selectGroupPlaceholder` |
| 180 | `jsx-text` | All Groups | `reports.reportFilters.allGroupsText` |
| 197 | `prop:placeholder` | Select status | `reports.reportFilters.selectStatusPlaceholder` |
| 200 | `jsx-text` | All Status | `reports.reportFilters.allStatusText` |
| 220 | `prop:placeholder` | Select payment method | `reports.reportFilters.selectPaymentMethodPlaceholder` |
| 223 | `jsx-text` | All Methods | `reports.reportFilters.allMethodsText` |
| 224 | `jsx-text` | Cash | `reports.reportFilters.cashText` |
| 225 | `jsx-text` | Digital | `reports.reportFilters.digitalText` |
| 237 | `prop:placeholder` | Select exam type | `reports.reportFilters.selectExamTypePlaceholder` |
| 240 | `jsx-text` | All Exam Types | `reports.reportFilters.allExamTypesText` |
| 241 | `jsx-text` | Mid Term | `reports.reportFilters.midTermText` |
| 242 | `jsx-text` | Final | `reports.reportFilters.finalText` |
| 243 | `jsx-text` | Unit Test | `reports.reportFilters.unitTestText` |
| 244 | `jsx-text` | Quarterly | `reports.reportFilters.quarterlyText` |
| 245 | `jsx-text` | Half Yearly | `reports.reportFilters.halfYearlyText` |
| 246 | `jsx-text` | Annual | `reports.reportFilters.annualText` |

**`components/reports/report-metric-card.tsx`** — 1 · *shared by 7 screens: `/reports/admissions`, `/reports/attendance`, `/reports/exams`, `/reports/fees`, `/reports/financial`, `/reports/salary` … (+1 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 50 | `jsx-text` | % from last period | `reports.reportMetricCard.fromLastPeriodText` |

**`components/reports/report-summary-bar.tsx`** — 5 · *shared by 7 screens: `/reports/admissions`, `/reports/attendance`, `/reports/exams`, `/reports/fees`, `/reports/financial`, `/reports/salary` … (+1 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 34 | `prop:label` | Report period | `reports.reportSummaryBar.reportPeriodLabel` |
| 39 | `prop:label` | Generated at | `reports.reportSummaryBar.generatedLabel` |
| 44 | `prop:label` | Records | `reports.reportSummaryBar.recordsLabel` |
| 52 | `jsx-text` | Applied filters | `reports.reportSummaryBar.appliedFiltersText` |
| 70 | `jsx-text` | No extra filters | `reports.reportSummaryBar.noExtraFiltersText` |

### `/reports/students`

**Tier:** P2 - Frequent · **Findings:** 31 · **Files:** 1 · **Namespace:** `reports`

**`app/(dashboard)/reports/students/page.tsx`** — 31

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 105 | `obj:label` | Class | `reports.page.classLabel2` |
| 107 | `obj:label` | Section | `reports.page.sectionLabel2` |
| 109 | `obj:label` | Status | `reports.page.statusLabel2` |
| 134 | `toast:error` | Failed to generate student report | `reports.page.failedGenerateStudentReportError` |
| 160 | `toast:success` | Student report exported | `reports.page.studentReportExportedSuccess` |
| 163 | `toast:error` | Failed to export student report | `reports.page.failedExportStudentReportError` |
| 179 | `toast:success` | Student report exported | `reports.page.studentReportExportedSuccess2` |
| 182 | `toast:error` | Failed to export student report | `reports.page.failedExportStudentReportError2` |
| 196 | `obj:header` | Admission No. | `reports.page.admissionNoColumnHeader` |
| 199 | `obj:header` | Student Name | `reports.page.studentNameColumnHeader3` |
| 200 | `obj:header` | Class | `reports.page.classColumnHeader3` |
| 201 | `obj:header` | Section | `reports.page.sectionColumnHeader3` |
| 202 | `obj:header` | Roll No. | `reports.page.rollNoColumnHeader2` |
| 203 | `obj:header` | Gender | `reports.page.genderColumnHeader` |
| 206 | `obj:header` | Status | `reports.page.statusColumnHeader4` |
| 214 | `obj:header` | Admission Date | `reports.page.admissionDateColumnHeader` |
| 215 | `obj:header` | Guardian Name | `reports.page.guardianNameColumnHeader` |
| 216 | `obj:header` | Contact | `reports.page.contactColumnHeader` |
| 239 | `obj:label` | Active | `reports.page.activeLabel` |
| 240 | `obj:label` | Inactive | `reports.page.inactiveLabel` |
| 241 | `obj:label` | Graduated | `reports.page.graduatedLabel` |
| 242 | `obj:label` | Transferred | `reports.page.transferredLabel` |
| 290 | `obj:label` | Male | `reports.page.maleLabel` |
| 291 | `obj:label` | Female | `reports.page.femaleLabel` |
| 292 | `obj:label` | Other | `reports.page.otherLabel` |
| 323 | `prop:title` | Student Details | `reports.page.studentDetailsTitle` |
| 324 | `prop:description` | Generated results based on the selected filters. | `reports.page.generatedResultsBasedDescription` |
| 333 | `prop:title` | No students found | `reports.page.noStudentsFoundTitle` |
| 334 | `prop:description` | Try widening the date range or removing one of the filters. | `reports.page.tryWideningDateRangeDescription` |
| 339 | `prop:title` | Generate a student report | `reports.page.generateStudentReportTitle` |
| 340 | `prop:description` | Select a period and optional filters, then generate the report to view m… | `reports.page.selectPeriodOptionalDescription` |

### `/exams/question-papers`

**Tier:** P2 - Frequent · **Findings:** 29 · **Files:** 1 · **Namespace:** `exams`

**`app/(dashboard)/exams/question-papers/page.tsx`** — 29

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 178 | `toast:success` | Blueprint composed successfully! | `exams.page.blueprintComposedSuccessfullySuccess` |
| 208 | `toast:success` | Question paper saved and ready! | `exams.page.questionPaperSavedReadySuccess` |
| 219 | `toast:error` | Please fill in Title, Class, Subject, and Academic Year. | `exams.page.pleaseFillTitleClassError` |
| 297 | `prop:subtitle` | All repository question papers | `exams.page.allRepositoryQuestionPapersSubtitle` |
| 303 | `prop:subtitle` | Ready for Exam Day | `exams.page.readyExamDaySubtitle` |
| 309 | `prop:subtitle` | In Progress & Custom Sets | `exams.page.inProgressCustomSetsSubtitle` |
| 322 | `prop:placeholder` | Search by title, code... | `exams.page.searchTitleCodePlaceholder` |
| 362 | `prop:placeholder` | All Statuses | `exams.page.allStatusesPlaceholder` |
| 365 | `jsx-text` | All Statuses | `exams.page.allStatusesText` |
| 449 | `jsx-text` | Full Marks | `exams.page.fullMarksText` |
| 453 | `jsx-text` | Duration | `exams.page.durationText` |
| 457 | `jsx-text` | Sections | `exams.page.sectionsText` |
| 459 | `jsx-text` | Qs) | `exams.page.qsText` |
| 495 | `prop:title` | Delete Paper | `exams.page.deletePaperTitle` |
| 530 | `prop:placeholder` | e.g. Annual Exam 2026 - Mathematics | `exams.page.eGAnnualExam2026Placeholder` |
| 541 | `prop:placeholder` | Select Academic Year | `exams.page.selectAcademicYearPlaceholder2` |
| 559 | `prop:placeholder` | Select Class | `exams.page.selectClassPlaceholder3` |
| 577 | `prop:placeholder` | Select Subject | `exams.page.selectSubjectPlaceholder3` |
| 593 | `jsx-text` | Blueprint Question Distribution | `exams.page.blueprintQuestionDistributionText` |
| 595 | `jsx-text` | Target: | `exams.page.targetText` |
| 595 | `jsx-text` | Marks | `exams.page.marksText7` |
| 610 | `jsx-text` | Count | `exams.page.countText` |
| 620 | `jsx-text` | Pts/Q | `exams.page.ptsQText` |
| 643 | `jsx-text` | Count | `exams.page.countText2` |
| 653 | `jsx-text` | Pts/Q | `exams.page.ptsQText2` |
| 675 | `jsx-text` | Count | `exams.page.countText3` |
| 685 | `jsx-text` | Pts/Q | `exams.page.ptsQText3` |
| 707 | `jsx-text` | Count | `exams.page.countText4` |
| 717 | `jsx-text` | Pts/Q | `exams.page.ptsQText4` |

### `/reports/fees`

**Tier:** P2 - Frequent · **Findings:** 29 · **Files:** 1 · **Namespace:** `reports`

**`app/(dashboard)/reports/fees/page.tsx`** — 29

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 93 | `obj:label` | Status | `reports.page.statusLabel` |
| 95 | `obj:label` | Method | `reports.page.methodLabel` |
| 119 | `toast:error` | Failed to generate fee report | `reports.page.failedGenerateFeeReportError` |
| 141 | `toast:success` | Fee report exported | `reports.page.feeReportExportedSuccess` |
| 144 | `toast:error` | Failed to export fee report | `reports.page.failedExportFeeReportError` |
| 176 | `toast:success` | Fee report exported | `reports.page.feeReportExportedSuccess2` |
| 179 | `toast:error` | Failed to export fee report | `reports.page.failedExportFeeReportError2` |
| 191 | `obj:label` | Cash | `reports.page.cashLabel` |
| 192 | `obj:label` | Digital | `reports.page.digitalLabel` |
| 204 | `obj:header` | Voucher No. | `reports.page.voucherNoColumnHeader` |
| 207 | `obj:header` | Student Name | `reports.page.studentNameColumnHeader2` |
| 208 | `obj:header` | Class | `reports.page.classColumnHeader2` |
| 209 | `obj:header` | Section | `reports.page.sectionColumnHeader2` |
| 212 | `obj:header` | Total Amount | `reports.page.totalAmountColumnHeader` |
| 217 | `obj:header` | Paid | `reports.page.paidColumnHeader` |
| 222 | `obj:header` | Due | `reports.page.dueColumnHeader` |
| 234 | `obj:header` | Status | `reports.page.statusColumnHeader2` |
| 244 | `obj:header` | Payment Method | `reports.page.paymentMethodColumnHeader` |
| 247 | `obj:header` | Date | `reports.page.dateColumnHeader` |
| 308 | `prop:title` | Voucher Status Distribution | `reports.page.voucherStatusDistributionTitle` |
| 310 | `obj:label` | Paid | `reports.page.paidLabel` |
| 311 | `obj:label` | Pending | `reports.page.pendingLabel` |
| 312 | `obj:label` | Partial | `reports.page.partialLabel` |
| 313 | `obj:label` | Overdue | `reports.page.overdueLabel` |
| 325 | `prop:description` | Voucher-level detail for the selected period. | `reports.page.voucherLevelDetailDescription` |
| 334 | `prop:title` | No vouchers found | `reports.page.noVouchersFoundTitle` |
| 335 | `prop:description` | Try another payment status, method, or date range. | `reports.page.tryAnotherPaymentStatusMethodDescription` |
| 340 | `prop:title` | Generate a fee report | `reports.page.generateFeeReportTitle` |
| 341 | `prop:description` | Select the reporting period, then generate the report to review collecti… | `reports.page.selectReportingPeriodThenDescription` |

### `/salary`

**Tier:** P2 - Frequent · **Findings:** 29 · **Files:** 5 · **Namespace:** `salary`

**`app/(dashboard)/salary/page.tsx`** — 4

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 177 | `obj:title` | Deductions | `salary.page.deductionsTitle` |
| 224 | `obj:title` | Deductions | `salary.page.deductionsTitle2` |
| 465 | `jsx-text` | Access restricted | `salary.page.accessRestrictedText` |
| 466 | `jsx-text` | You do not have permission to view salary. | `salary.page.youDoNotHavePermissionText` |

**`components/salary/bulk-payroll-modal.tsx`** — 1

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 388 | `prop:aria-label` | Select ${…} | `salary.bulkPayrollModal.selectAriaLabel` |

**`components/salary/salary-filters-bar.tsx`** — 18

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 21 | `obj:label` | All Months | `salary.salaryFiltersBar.allMonthsLabel` |
| 22 | `obj:label` | January | `salary.salaryFiltersBar.januaryLabel` |
| 23 | `obj:label` | February | `salary.salaryFiltersBar.februaryLabel` |
| 24 | `obj:label` | March | `salary.salaryFiltersBar.marchLabel` |
| 25 | `obj:label` | April | `salary.salaryFiltersBar.aprilLabel` |
| 26 | `obj:label` | May | `salary.salaryFiltersBar.mayLabel` |
| 27 | `obj:label` | June | `salary.salaryFiltersBar.juneLabel` |
| 28 | `obj:label` | July | `salary.salaryFiltersBar.julyLabel` |
| 29 | `obj:label` | August | `salary.salaryFiltersBar.augustLabel` |
| 30 | `obj:label` | September | `salary.salaryFiltersBar.septemberLabel` |
| 31 | `obj:label` | October | `salary.salaryFiltersBar.octoberLabel` |
| 32 | `obj:label` | November | `salary.salaryFiltersBar.novemberLabel` |
| 33 | `obj:label` | December | `salary.salaryFiltersBar.decemberLabel` |
| 38 | `obj:label` | All Years | `salary.salaryFiltersBar.allYearsLabel` |
| 46 | `obj:label` | All Status | `salary.salaryFiltersBar.allStatusLabel` |
| 47 | `obj:label` | Pending | `salary.salaryFiltersBar.pendingLabel` |
| 48 | `obj:label` | Partial | `salary.salaryFiltersBar.partialLabel` |
| 49 | `obj:label` | Paid | `salary.salaryFiltersBar.paidLabel` |

**`components/salary/salary-form-modal.tsx`** — 1

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 214 | `jsx-text` | Cancel | `salary.salaryFormModal.cancelText` |

**`viewmodels/salary/use-salary-view-model.ts`** — 5

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 129 | `toast:success` | Salary ledger created successfully! | `salary.useSalaryViewModel.salaryLedgerCreatedSuccessfullySuccess` |
| 143 | `toast:success` | Salary ledger updated successfully! | `salary.useSalaryViewModel.salaryLedgerUpdatedSuccessfullySuccess` |
| 156 | `toast:success` | Salary ledger deleted successfully! | `salary.useSalaryViewModel.salaryLedgerDeletedSuccessfullySuccess` |
| 178 | `toast:success` | Payment recorded successfully! | `salary.useSalaryViewModel.paymentRecordedSuccessfullySuccess` |
| 193 | `toast:success` | Bulk payroll processed successfully! | `salary.useSalaryViewModel.bulkPayrollProcessedSuccessfullySuccess` |

### `/exams/question-bank`

**Tier:** P2 - Frequent · **Findings:** 25 · **Files:** 1 · **Namespace:** `exams`

**`app/(dashboard)/exams/question-bank/page.tsx`** — 25

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 310 | `toast:error` | Please fill in Class, Subject, and Question text. | `exams.page.pleaseFillClassSubjectError` |
| 372 | `prop:subtitle` | All repository questions | `exams.page.allRepositoryQuestionsSubtitle` |
| 378 | `prop:subtitle` | Multiple Choice | `exams.page.multipleChoiceSubtitle` |
| 384 | `prop:subtitle` | NCTB CQ & Broad | `exams.page.nctbCqBroadSubtitle` |
| 390 | `prop:subtitle` | 1-2 Mark Prompts | `exams.page.12MarkPromptsSubtitle` |
| 559 | `jsx-text` | m] | `exams.page.mText` |
| 573 | `prop:title` | View Details | `exams.page.viewDetailsTitle` |
| 582 | `prop:title` | Edit Question | `exams.page.editQuestionTitle` |
| 591 | `prop:title` | Delete Question | `exams.page.deleteQuestionTitle` |
| 624 | `prop:placeholder` | Select Class | `exams.page.selectClassPlaceholder` |
| 642 | `prop:placeholder` | Select Subject | `exams.page.selectSubjectPlaceholder` |
| 697 | `prop:placeholder` | e.g. Chapter 3: Force & Motion | `exams.page.eGChapter3ForcePlaceholder` |
| 707 | `prop:placeholder` | e.g. Newton's Second Law | `exams.page.eGNewtonSSecondPlaceholder` |
| 731 | `jsx-text` | Optional | `exams.page.optionalText` |
| 748 | `prop:placeholder` | Enter complete question statement / problem... | `exams.page.enterCompleteQuestionStatementProblemPlaceholder` |
| 761 | `jsx-text` | (Select the correct answer) | `exams.page.selectCorrectAnswerText` |
| 776 | `prop:placeholder` | Option ${…} text... | `exams.page.optionTextPlaceholder` |
| 798 | `jsx-child` | Correct | `exams.page.correctText` |
| 819 | `prop:placeholder` | Prompt for part (${…})... | `exams.page.promptPartPlaceholder` |
| 856 | `prop:placeholder` | Key points, formula, or correct answer summary... | `exams.page.keyPointsFormulaCorrectPlaceholder` |
| 868 | `prop:placeholder` | Teacher grading guidelines or theoretical explanation... | `exams.page.teacherGradingGuidelinesTheoreticalPlaceholder` |
| 905 | `jsx-text` | Marks • | `exams.page.marksText` |
| 914 | `jsx-text` | Stimulus / উদ্দীপক | `exams.page.stimulusText` |
| 950 | `jsx-text` | Marks | `exams.page.marksText2` |
| 960 | `jsx-text` | Solution Key: | `exams.page.solutionKeyText` |

### `/reports/attendance`

**Tier:** P2 - Frequent · **Findings:** 23 · **Files:** 1 · **Namespace:** `reports`

**`app/(dashboard)/reports/attendance/page.tsx`** — 23

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 95 | `obj:label` | Class | `reports.page.classLabel` |
| 97 | `obj:label` | Section | `reports.page.sectionLabel` |
| 122 | `toast:error` | Failed to generate attendance report | `reports.page.failedGenerateAttendanceReportError` |
| 145 | `toast:success` | Attendance report exported | `reports.page.attendanceReportExportedSuccess` |
| 148 | `toast:error` | Failed to export attendance report | `reports.page.failedExportAttendanceReportError` |
| 179 | `toast:success` | Attendance report exported | `reports.page.attendanceReportExportedSuccess2` |
| 182 | `toast:error` | Failed to export attendance report | `reports.page.failedExportAttendanceReportError2` |
| 198 | `obj:header` | Roll No. | `reports.page.rollNoColumnHeader` |
| 201 | `obj:header` | Student Name | `reports.page.studentNameColumnHeader` |
| 202 | `obj:header` | Class | `reports.page.classColumnHeader` |
| 203 | `obj:header` | Section | `reports.page.sectionColumnHeader` |
| 206 | `obj:header` | Present | `reports.page.presentColumnHeader` |
| 211 | `obj:header` | Absent | `reports.page.absentColumnHeader` |
| 214 | `obj:header` | Total Days | `reports.page.totalDaysColumnHeader` |
| 217 | `obj:header` | Attendance % | `reports.page.attendanceColumnHeader` |
| 229 | `obj:header` | Status | `reports.page.statusColumnHeader` |
| 310 | `prop:title` | Attendance Trend | `reports.page.attendanceTrendTitle` |
| 355 | `prop:title` | Attendance Details | `reports.page.attendanceDetailsTitle` |
| 356 | `prop:description` | Attendance status for the generated period. | `reports.page.attendanceStatusGeneratedDescription` |
| 365 | `prop:title` | No attendance data found | `reports.page.noAttendanceDataFoundTitle` |
| 366 | `prop:description` | Try a different period or broader class filters. | `reports.page.tryDifferentPeriodDescription` |
| 371 | `prop:title` | Generate an attendance report | `reports.page.generateAttendanceReportTitle` |
| 372 | `prop:description` | Select the date range and optional class filters to review attendance tr… | `reports.page.selectDateRangeDescription` |

### `/transport`

**Tier:** P2 - Frequent · **Findings:** 22 · **Files:** 2 · **Namespace:** `transport`

**`app/(dashboard)/transport/page.tsx`** — 14

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 275 | `toast:success` | Generated Passenger Manifest for ${…} | `transport.page.generatedPassengerManifestSuccess` |
| 334 | `jsx-text` | Seats | `transport.page.seatsText` |
| 392 | `jsx-text` | Scheduled Stops | `transport.page.scheduledStopsText` |
| 449 | `prop:title` | Download Driver Passenger Manifest (PDF) | `transport.page.downloadDriverPassengerManifestPdfTitle` |
| 490 | `jsx-text` | Roll # | `transport.page.rollText` |
| 581 | `jsx-text` | You don&apos;t have permission to view transport records. | `transport.page.youDontHavePermissionText` |
| 809 | `jsx-child` | Saving... | `transport.page.savingText` |
| 827 | `prop:placeholder` | e.g. BUS-402 | `transport.page.eGBus402Placeholder` |
| 865 | `prop:placeholder` | Driver Full Name | `transport.page.driverFullNamePlaceholder` |
| 904 | `jsx-child` | Saving... | `transport.page.savingText2` |
| 916 | `prop:placeholder` | e.g. Route A (Dhanmondi to Campus) | `transport.page.eGRouteDhanmondiPlaceholder` |
| 946 | `prop:placeholder` | Mirpur-10, Kazipara, Shewrapara, Agargaon, Campus | `transport.page.mirpur10KaziparaShewraparaAgargaonPlaceholder` |
| 950 | `jsx-text` | Enter comma-separated stop names in pickup sequence order. | `transport.page.enterCommaSeparatedStopNamesText` |
| 993 | `jsx-child` | Saving... | `transport.page.savingText3` |

**`viewmodels/transport/use-transport-view-model.ts`** — 8

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 24 | `toast:success` | Vehicle added | `transport.useTransportViewModel.vehicleAddedSuccess` |
| 29 | `toast:success` | Vehicle updated | `transport.useTransportViewModel.vehicleUpdatedSuccess` |
| 34 | `toast:success` | Vehicle deleted | `transport.useTransportViewModel.vehicleDeletedSuccess` |
| 57 | `toast:success` | Route added | `transport.useTransportViewModel.routeAddedSuccess` |
| 62 | `toast:success` | Route updated | `transport.useTransportViewModel.routeUpdatedSuccess` |
| 67 | `toast:success` | Route deleted | `transport.useTransportViewModel.routeDeletedSuccess` |
| 90 | `toast:success` | Student allocated | `transport.useTransportViewModel.studentAllocatedSuccess` |
| 95 | `toast:success` | Allocation removed | `transport.useTransportViewModel.allocationRemovedSuccess` |

### `/library`

**Tier:** P2 - Frequent · **Findings:** 21 · **Files:** 2 · **Namespace:** `library`

**`app/(dashboard)/library/page.tsx`** — 16

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 138 | `toast:success` | Book returned and inventory updated | `library.page.bookReturnedInventoryUpdatedSuccess` |
| 163 | `toast:success` | Generated Circulation Slip for ${…} | `library.page.generatedCirculationSlipSuccess` |
| 182 | `jsx-text` | · Accession: | `library.page.accessionText` |
| 245 | `jsx-text` | OVERDUE | `library.page.overdueText` |
| 280 | `prop:title` | Download Issue Slip (PDF) | `library.page.downloadIssueSlipPdfTitle` |
| 283 | `jsx-text` | Slip | `library.page.slipText` |
| 306 | `jsx-text` | You don&apos;t have permission to view library records. | `library.page.youDontHavePermissionText` |
| 376 | `obj:label` | All Categories | `library.page.allCategoriesLabel` |
| 392 | `obj:label` | All Statuses | `library.page.allStatusesLabel` |
| 419 | `jsx-child` | Saving... | `library.page.savingText` |
| 434 | `prop:label` | Publisher | `library.page.publisherLabel` |
| 434 | `prop:placeholder` | Publisher | `library.page.publisherPlaceholder` |
| 456 | `jsx-child` | Issuing... | `library.page.issuingText` |
| 465 | `obj:label` | ${…} (${…} avail) | `library.page.availLabel` |
| 471 | `prop:label` | Borrower ID | `library.page.borrowerIdLabel` |
| 471 | `prop:placeholder` | Roll No / Staff ID | `library.page.rollNoStaffIdPlaceholder` |

**`viewmodels/library/use-library-view-model.ts`** — 5

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 32 | `toast:success` | Book added | `library.useLibraryViewModel.bookAddedSuccess` |
| 38 | `toast:success` | Book updated | `library.useLibraryViewModel.bookUpdatedSuccess` |
| 44 | `toast:success` | Book deleted | `library.useLibraryViewModel.bookDeletedSuccess` |
| 81 | `toast:success` | Book issued | `library.useLibraryViewModel.bookIssuedSuccess` |
| 87 | `toast:success` | Book returned | `library.useLibraryViewModel.bookReturnedSuccess` |

### `/admissions`

**Tier:** P2 - Frequent · **Findings:** 17 · **Files:** 2 · **Namespace:** `admissions`

**`app/(dashboard)/admissions/page.tsx`** — 2

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 672 | `jsx-text` | Roll: | `admissions.page.rollText` |
| 749 | `jsx-text` | You don&apos;t have permission to view admissions. | `admissions.page.youDontHavePermissionText` |

**`components/admissions/student-selector-modal.tsx`** — 15

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 134 | `obj:label` | All Classes | `admissions.studentSelectorModal.allClassesLabel` |
| 139 | `obj:label` | All Groups | `admissions.studentSelectorModal.allGroupsLabel` |
| 144 | `obj:label` | All Sections | `admissions.studentSelectorModal.allSectionsLabel` |
| 178 | `prop:title` | Select Students | `admissions.studentSelectorModal.selectStudentsTitle` |
| 179 | `prop:description` | Search and select existing students for admission. Their current class i… | `admissions.studentSelectorModal.searchSelectExistingStudentsDescription` |
| 184 | `jsx-text` | Cancel | `admissions.studentSelectorModal.cancelText` |
| 207 | `prop:placeholder` | Search by name, roll number, or student ID... | `admissions.studentSelectorModal.searchNameRollNumberPlaceholder` |
| 219 | `prop:placeholder` | Filter by Class | `admissions.studentSelectorModal.filterClassPlaceholder` |
| 228 | `prop:placeholder` | Filter by Group | `admissions.studentSelectorModal.filterGroupPlaceholder` |
| 238 | `prop:placeholder` | Filter by Section | `admissions.studentSelectorModal.filterSectionPlaceholder` |
| 250 | `jsx-text` | student(s) selected | `admissions.studentSelectorModal.studentSSelectedText` |
| 259 | `jsx-text` | Loading students... | `admissions.studentSelectorModal.loadingStudentsText` |
| 263 | `jsx-text` | No students found | `admissions.studentSelectorModal.noStudentsFoundText` |
| 297 | `jsx-text` | Roll: | `admissions.studentSelectorModal.rollText` |
| 301 | `jsx-text` | Class: | `admissions.studentSelectorModal.classText` |

### `/exams/question-papers/[id]/preview`

**Tier:** P2 - Frequent · **Findings:** 17 · **Files:** 1 · **Namespace:** `exams`

**`app/(dashboard)/exams/question-papers/[id]/preview/page.tsx`** — 17

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 55 | `jsx-text` | Loading Question Paper... | `exams.page.loadingQuestionPaperText` |
| 63 | `jsx-text` | Question paper not found. | `exams.page.questionPaperNotFoundText` |
| 89 | `jsx-text` | • Full Marks: | `exams.page.fullMarksText2` |
| 102 | `jsx-child` | Hide Solution Key | `exams.page.hideSolutionKeyText` |
| 102 | `jsx-child` | Teacher Solution Key | `exams.page.teacherSolutionKeyText` |
| 131 | `jsx-text` | Class: | `exams.page.classText` |
| 135 | `jsx-text` | Subject: | `exams.page.subjectText` |
| 139 | `jsx-text` | Time Allowed: | `exams.page.timeAllowedText2` |
| 145 | `jsx-text` | Full Marks: | `exams.page.fullMarksText3` |
| 153 | `jsx-text` | Student Name: _________________________________________ | `exams.page.studentNameText` |
| 156 | `jsx-text` | Roll No: _______________ Section: ________ | `exams.page.rollNoSectionText` |
| 165 | `jsx-text` | General Instructions: | `exams.page.generalInstructionsText` |
| 191 | `jsx-text` | Marks] | `exams.page.marksText8` |
| 203 | `jsx-text` | উদ্দীপক / Context: | `exams.page.ContextText` |
| 264 | `jsx-text` | Solution Key / Answer: | `exams.page.solutionKeyAnswerText` |
| 268 | `jsx-text` | Note: | `exams.page.noteText` |
| 283 | `jsx-text` | *** END OF QUESTION PAPER *** | `exams.page.endQuestionPaperText` |

### `/accounting/expenses`

**Tier:** P2 - Frequent · **Findings:** 16 · **Files:** 2 · **Namespace:** `accounting`

**`app/(dashboard)/accounting/expenses/page.tsx`** — 2

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 174 | `jsx-text` | Access restricted | `accounting.page.accessRestrictedText2` |
| 175 | `jsx-text` | You do not have permission to view accounting. | `accounting.page.youDoNotHavePermissionText2` |

**`components/accounting/add-expense-modal.tsx`** — 14

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 148 | `jsx-text` | Payment Method | `accounting.addExpenseModal.paymentMethodText` |
| 154 | `jsx-text` | Petty Cash Register | `accounting.addExpenseModal.pettyCashRegisterText` |
| 155 | `jsx-text` | Bank Account Transfer | `accounting.addExpenseModal.bankAccountTransferText` |
| 156 | `jsx-text` | Bank Cheque / Pay Order | `accounting.addExpenseModal.bankChequePayOrderText` |
| 157 | `jsx-text` | Digital / Online Wallet | `accounting.addExpenseModal.digitalOnlineWalletText` |
| 163 | `jsx-text` | Expense Date * | `accounting.addExpenseModal.expenseDateText` |
| 175 | `jsx-text` | Payee / Vendor Name | `accounting.addExpenseModal.payeeVendorNameText` |
| 177 | `prop:placeholder` | e.g. National Power Grid / ABC Stationers | `accounting.addExpenseModal.eGNationalPowerGridPlaceholder` |
| 186 | `jsx-text` | Bill / Receipt Number | `accounting.addExpenseModal.billReceiptNumberText` |
| 188 | `prop:placeholder` | e.g. INV-98421 | `accounting.addExpenseModal.eGInv98421Placeholder` |
| 197 | `jsx-text` | Internal Audit Notes | `accounting.addExpenseModal.internalAuditNotesText` |
| 199 | `prop:placeholder` | Additional details, approval remarks, or purchase authorization referenc… | `accounting.addExpenseModal.additionalDetailsApprovalRemarksPlaceholder` |
| 211 | `jsx-text` | Cancel | `accounting.addExpenseModal.cancelText` |
| 223 | `jsx-text` | Save Expense Voucher | `accounting.addExpenseModal.saveExpenseVoucherText` |

### `/fees/structures`

**Tier:** P2 - Frequent · **Findings:** 15 · **Files:** 1 · **Namespace:** `fees`

**`app/(dashboard)/fees/structures/page.tsx`** — 15

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 181 | `toast:error` | Please select a target class. | `fees.page.pleaseSelectTargetClassError` |
| 187 | `toast:error` | Please select an academic year. | `fees.page.pleaseSelectAcademicYearError` |
| 255 | `jsx-child` | (Closed) | `fees.page.closedText` |
| 286 | `jsx-text` | Access restricted | `fees.page.accessRestrictedText4` |
| 287 | `jsx-text` | You do not have permission to view fees. | `fees.page.youDoNotHavePermissionText4` |
| 552 | `prop:description` | Itemize tuition and associated institutional facilities | `fees.page.itemizeTuitionAssociatedInstitutionalDescription` |
| 631 | `jsx-text` | (ID / Roll) | `fees.page.idRollText` |
| 633 | `prop:placeholder` | e.g. Student CUID or roll | `fees.page.eGStudentCuidPlaceholder` |
| 681 | `toast:error` | Please enter a valid student profile ID. | `fees.page.pleaseEnterValidStudentError` |
| 707 | `jsx-text` | Student | `fees.page.studentText` |
| 708 | `jsx-text` | Class | `fees.page.classText` |
| 709 | `jsx-text` | Category | `fees.page.categoryText` |
| 710 | `jsx-text` | Discount | `fees.page.discountText` |
| 717 | `jsx-text` | No active concessions configured. | `fees.page.noActiveConcessionsConfiguredText` |
| 733 | `jsx-child` | ${…}% OFF | `fees.page.offText` |

### `/exam-results`

**Tier:** P2 - Frequent · **Findings:** 12 · **Files:** 1 · **Namespace:** `resultsExtras`

**`app/(dashboard)/exam-results/page.tsx`** — 12

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 370 | `toast:error` | Marks for this student are locked due to promotion. | `resultsExtras.page.marksStudentError` |
| 475 | `toast:error` | This exam result is locked because the student has already been promoted… | `resultsExtras.page.thisExamResultLockedError` |
| 533 | `obj:label` | ${…} (Class ${…}) | `resultsExtras.page.classLabel` |
| 668 | `prop:title` | Marks permanently locked due to student promotion | `resultsExtras.page.marksPermanentlyLockedDueTitle` |
| 679 | `prop:title` | Edit Marks | `resultsExtras.page.editMarksTitle` |
| 720 | `jsx-text` | Access restricted | `resultsExtras.page.accessRestrictedText` |
| 721 | `jsx-text` | You do not have permission to view exam results. | `resultsExtras.page.youDoNotHavePermissionText` |
| 832 | `jsx-text` | Access restricted | `resultsExtras.page.accessRestrictedText2` |
| 833 | `jsx-text` | You do not have permission to view exam results. | `resultsExtras.page.youDoNotHavePermissionText2` |
| 902 | `prop:title` | Marks locked due to promotion | `resultsExtras.page.marksLockedDuePromotionTitle` |
| 903 | `jsx-text` | Locked | `resultsExtras.page.lockedText` |
| 1110 | `jsx-text` | Access restricted — no permission to view exams. | `resultsExtras.page.accessRestrictedNoPermissionText` |

### `/fees/bulk`

**Tier:** P2 - Frequent · **Findings:** 11 · **Files:** 1 · **Namespace:** `fees`

**`app/(dashboard)/fees/bulk/page.tsx`** — 11

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 427 | `obj:note` | Bulk Class Payment for ${…} (${…}) - 12 Months Ledger | `fees.page.bulkClassPayment12Note` |
| 435 | `obj:label` | Cash | `fees.page.cashLabel` |
| 436 | `obj:label` | Bank Transfer | `fees.page.bankTransferLabel` |
| 437 | `obj:label` | Card / POS | `fees.page.cardPosLabel` |
| 438 | `obj:label` | EasyPaisa | `fees.page.easypaisaLabel` |
| 439 | `obj:label` | JazzCash | `fees.page.jazzcashLabel` |
| 465 | `jsx-text` | Access restricted | `fees.page.accessRestrictedText` |
| 466 | `jsx-text` | You do not have permission to view fees. | `fees.page.youDoNotHavePermissionText` |
| 521 | `jsx-text` | Section | `fees.page.sectionText` |
| 583 | `jsx-text` | Total Enrolled Students | `fees.page.totalEnrolledStudentsText` |
| 586 | `jsx-text` | Students | `fees.page.studentsText` |

### `/exams/results`

**Tier:** P2 - Frequent · **Findings:** 8 · **Files:** 1 · **Namespace:** `exams`

**`app/(dashboard)/exams/results/page.tsx`** — 8

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 159 | `toast:error` | Marks for this student are locked due to promotion. | `exams.page.marksStudentError` |
| 212 | `toast:info` | All student marks for this subject are locked due to student promotion. | `exams.page.allStudentMarksSuccess` |
| 259 | `jsx-text` | Access restricted — no permission to view exams. | `exams.page.accessRestrictedNoPermissionText` |
| 301 | `jsx-text` | (Max: | `exams.page.maxText` |
| 417 | `jsx-text` | Access restricted | `exams.page.accessRestrictedText2` |
| 418 | `jsx-text` | You do not have permission to view exam results. | `exams.page.youDoNotHavePermissionText2` |
| 442 | `prop:title` | Marks locked because this student has already been promoted | `exams.page.marksLockedBecauseStudentTitle` |
| 445 | `jsx-text` | Locked | `exams.page.lockedText` |

### `/accounting/statements`

**Tier:** P2 - Frequent · **Findings:** 6 · **Files:** 1 · **Namespace:** `accounting`

**`app/(dashboard)/accounting/statements/page.tsx`** — 6

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 277 | `jsx-text` | Access restricted | `accounting.page.accessRestrictedText4` |
| 278 | `jsx-text` | You do not have permission to view accounting. | `accounting.page.youDoNotHavePermissionText4` |
| 349 | `jsx-text` | (Roll # | `accounting.page.rollText` |
| 349 | `jsx-text` | • ID: | `accounting.page.idText` |
| 377 | `jsx-text` | • Acc # | `accounting.page.accText` |
| 462 | `jsx-child` | Roll #${…} | `accounting.page.rollText2` |

### `/fees/collection`

**Tier:** P2 - Frequent · **Findings:** 5 · **Files:** 1 · **Namespace:** `fees`

**`app/(dashboard)/fees/collection/page.tsx`** — 5

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 323 | `jsx-text` | Access restricted | `fees.page.accessRestrictedText2` |
| 324 | `jsx-text` | You do not have permission to view fees. | `fees.page.youDoNotHavePermissionText2` |
| 448 | `jsx-text` | • Roll: | `fees.page.rollText` |
| 449 | `jsx-text` | • ID: | `fees.page.idText` |
| 938 | `jsx-child` | Receipt #${…} | `fees.page.receiptText` |

### `/timetable`

**Tier:** P2 - Frequent · **Findings:** 4 · **Files:** 2 · **Namespace:** `timetable`

**`app/(dashboard)/timetable/page.tsx`** — 1

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 235 | `jsx-text` | You don&apos;t have permission to view timetable. | `timetable.page.youDontHavePermissionText` |

**`viewmodels/timetable/use-timetable-view-model.ts`** — 3

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 67 | `toast:success` | Period added | `timetable.useTimetableViewModel.periodAddedSuccess` |
| 86 | `toast:success` | Period updated | `timetable.useTimetableViewModel.periodUpdatedSuccess` |
| 100 | `toast:success` | Period removed | `timetable.useTimetableViewModel.periodRemovedSuccess` |

### `/accounting/accounts`

**Tier:** P2 - Frequent · **Findings:** 2 · **Files:** 1 · **Namespace:** `accounting`

**`app/(dashboard)/accounting/accounts/page.tsx`** — 2

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 64 | `jsx-text` | Access restricted | `accounting.page.accessRestrictedText` |
| 65 | `jsx-text` | You do not have permission to view accounting. | `accounting.page.youDoNotHavePermissionText` |

### `/accounting/profit-loss`

**Tier:** P2 - Frequent · **Findings:** 2 · **Files:** 1 · **Namespace:** `accounting`

**`app/(dashboard)/accounting/profit-loss/page.tsx`** — 2

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 88 | `jsx-text` | Access restricted | `accounting.page.accessRestrictedText3` |
| 89 | `jsx-text` | You do not have permission to view accounting. | `accounting.page.youDoNotHavePermissionText3` |

### `/subjects`

**Tier:** P2 - Frequent · **Findings:** 2 · **Files:** 1 · **Namespace:** `subjects`

**`app/(dashboard)/subjects/page.tsx`** — 2

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 174 | `jsx-text` | Access restricted | `subjects.page.accessRestrictedText` |
| 175 | `jsx-text` | You do not have permission to view this section. | `subjects.page.youDoNotHavePermissionText` |

### `/reports/exams`

**Tier:** P2 - Frequent · **Findings:** 1 · **Files:** 1 · **Namespace:** `reports`

**`app/(dashboard)/reports/exams/page.tsx`** — 1

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 386 | `obj:label` | A+ | `reports.page.aLabel` |

### `(shared) Cross-screen components`

**Tier:** P3 - Occasional / shared · **Findings:** 121 · **Files:** 16 · **Namespace:** `common`

**`components/auth/permission-gate.tsx`** — 4 · *shared by 61 screens: `/academic/classes`, `/academic/groups`, `/academic/sections`, `/academic-year`, `/accounting/accounts`, `/accounting/expenses` … (+55 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 25 | `jsx-text` | Access Denied | `common.permissionGate.accessDeniedText` |
| 28 | `jsx-text` | You don&apos;t have the necessary permissions to view this page or perfo… | `common.permissionGate.youDontHaveNecessaryText` |
| 33 | `jsx-text` | Return to Dashboard | `common.permissionGate.returnDashboardText` |
| 49 | `jsx-text` | Loading permissions... | `common.permissionGate.loadingPermissionsText` |

**`components/layout/global-broadcast-banner.tsx`** — 3 · *shared by 52 screens: `/academic/classes`, `/academic/groups`, `/academic/sections`, `/academic-year`, `/accounting/accounts`, `/accounting/expenses` … (+46 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 56 | `jsx-child` | Platform Alert | `common.globalBroadcastBanner.platformAlertText` |
| 56 | `jsx-child` | Campus Notice | `common.globalBroadcastBanner.campusNoticeText` |
| 66 | `prop:title` | Dismiss announcement | `common.globalBroadcastBanner.dismissAnnouncementTitle` |

**`components/layout/header-notification-center.tsx`** — 5 · *shared by 61 screens: `/academic/classes`, `/academic/groups`, `/academic/sections`, `/academic-year`, `/accounting/accounts`, `/accounting/expenses` … (+55 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 224 | `jsx-text` | Loading notifications... | `common.headerNotificationCenter.loadingNotificationsText` |
| 233 | `jsx-text` | You are all caught up in this category. | `common.headerNotificationCenter.youAllCaughtUpText` |
| 278 | `jsx-text` | Pinned | `common.headerNotificationCenter.pinnedText` |
| 283 | `jsx-text` | Urgent | `common.headerNotificationCenter.urgentText` |
| 288 | `jsx-text` | SuperAdmin | `common.headerNotificationCenter.superadminText` |

**`components/layout/impersonation-banner.tsx`** — 5 · *shared by 52 screens: `/academic/classes`, `/academic/groups`, `/academic/sections`, `/academic-year`, `/accounting/accounts`, `/accounting/expenses` … (+46 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 28 | `toast:success` | Returned to System Admin console | `common.impersonationBanner.returnedSystemAdminConsoleSuccess` |
| 31 | `toast:error` | Failed to exit impersonation | `common.impersonationBanner.failedExitImpersonationError` |
| 35 | `toast:error` | Error exiting impersonation | `common.impersonationBanner.errorExitingImpersonationError` |
| 45 | `jsx-text` | System Admin Support Mode: Viewing as | `common.impersonationBanner.systemAdminSupportModeViewingText` |
| 58 | `jsx-text` | Exit Impersonation | `common.impersonationBanner.exitImpersonationText` |

**`components/layout/sidebar.tsx`** — 3 · *shared by 52 screens: `/academic/classes`, `/academic/groups`, `/academic/sections`, `/academic-year`, `/accounting/accounts`, `/accounting/expenses` … (+46 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 118 | `prop:alt` | App Icon | `common.sidebar.appIconAlt` |
| 161 | `jsx-text` | ⌘K | `common.sidebar.kText` |
| 191 | `jsx-text` | SYSTEM | `common.sidebar.systemText` |

**`components/layout/system-admin-sidebar.tsx`** — 5 · *shared by 9 screens: `/system-admin/audit-logs`, `/system-admin/billing`, `/system-admin/feature-flags`, `/system-admin/notices`, `/system-admin`, `/system-admin/settings` … (+3 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 33 | `prop:alt` | App Icon | `common.systemAdminSidebar.appIconAlt` |
| 37 | `jsx-text` | SYSTEM | `common.systemAdminSidebar.systemText` |
| 107 | `prop:title` | Switch to School ERP | `common.systemAdminSidebar.switchSchoolErpTitle` |
| 110 | `jsx-text` | Switch to School ERP | `common.systemAdminSidebar.switchSchoolErpText` |
| 116 | `jsx-text` | Platform Healthy | `common.systemAdminSidebar.platformHealthyText` |

**`components/pdf/mark-sheet-generator.tsx`** — 12

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 78 | `toast:error` | Please select an exam | `common.markSheetGenerator.pleaseSelectExamError` |
| 87 | `toast:error` | No marks found for this exam | `common.markSheetGenerator.noMarksFoundError` |
| 116 | `toast:success` | Mark sheet generated successfully | `common.markSheetGenerator.markSheetGeneratedSuccessfullySuccess` |
| 119 | `toast:error` | Failed to generate mark sheet | `common.markSheetGenerator.failedGenerateMarkSheetError` |
| 122 | `toast:error` | Failed to generate mark sheet | `common.markSheetGenerator.failedGenerateMarkSheetError2` |
| 133 | `jsx-text` | Generate Mark Sheet | `common.markSheetGenerator.generateMarkSheetText` |
| 138 | `jsx-text` | Generate Mark Sheet | `common.markSheetGenerator.generateMarkSheetText2` |
| 140 | `jsx-text` | Select an exam to generate the mark sheet for | `common.markSheetGenerator.selectExamGenerateText` |
| 145 | `jsx-text` | Select Exam | `common.markSheetGenerator.selectExamText` |
| 148 | `prop:placeholder` | Choose an exam | `common.markSheetGenerator.chooseExamPlaceholder` |
| 165 | `jsx-child` | Generating... | `common.markSheetGenerator.generatingText` |
| 165 | `jsx-child` | Generate Mark Sheet | `common.markSheetGenerator.generateMarkSheetText3` |

**`components/pdf/report-card-generator.tsx`** — 21

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 106 | `toast:error` | Please select an academic year | `common.reportCardGenerator.pleaseSelectAcademicYearError` |
| 137 | `toast:success` | Report card generated successfully | `common.reportCardGenerator.reportCardGeneratedSuccessfullySuccess` |
| 140 | `toast:error` | Failed to generate report card | `common.reportCardGenerator.failedGenerateReportCardError` |
| 143 | `toast:error` | Failed to generate report card | `common.reportCardGenerator.failedGenerateReportCardError2` |
| 154 | `jsx-text` | Generate Report Card | `common.reportCardGenerator.generateReportCardText` |
| 159 | `jsx-text` | Generate Report Card | `common.reportCardGenerator.generateReportCardText2` |
| 161 | `jsx-text` | Generate a comprehensive report card for | `common.reportCardGenerator.generateComprehensiveReportCardText` |
| 166 | `jsx-text` | Academic Year | `common.reportCardGenerator.academicYearText` |
| 169 | `prop:placeholder` | Choose academic year | `common.reportCardGenerator.chooseAcademicYearPlaceholder` |
| 182 | `jsx-text` | Teacher's Remarks (Optional) | `common.reportCardGenerator.teacherSRemarksOptionalText` |
| 186 | `prop:placeholder` | Enter teacher's remarks about the student's performance... | `common.reportCardGenerator.enterTeacherSRemarksAboutPlaceholder` |
| 192 | `jsx-text` | Principal's Remarks (Optional) | `common.reportCardGenerator.principalSRemarksOptionalText` |
| 196 | `prop:placeholder` | Enter principal's remarks... | `common.reportCardGenerator.enterPrincipalSRemarksPlaceholder` |
| 208 | `jsx-child` | Generating... | `common.reportCardGenerator.generatingText` |
| 208 | `jsx-child` | Generate Report Card | `common.reportCardGenerator.generateReportCardText3` |
| 213 | `jsx-text` | The report card will include: | `common.reportCardGenerator.theReportCardWillIncludeText` |
| 215 | `jsx-text` | Student profile with photo | `common.reportCardGenerator.studentProfilePhotoText` |
| 216 | `jsx-text` | Term-wise academic performance | `common.reportCardGenerator.termWiseAcademicPerformanceText` |
| 217 | `jsx-text` | Attendance record | `common.reportCardGenerator.attendanceRecordText` |
| 218 | `jsx-text` | Co-curricular activities | `common.reportCardGenerator.coCurricularActivitiesText` |
| 219 | `jsx-text` | Teacher and principal remarks | `common.reportCardGenerator.teacherPrincipalRemarksText` |

**`components/pdf/salary-slip-generator.tsx`** — 26

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 146 | `jsx-text` | Salary Slip | `common.salarySlipGenerator.salarySlipText` |
| 151 | `jsx-text` | Staff Information | `common.salarySlipGenerator.staffInformationText` |
| 153 | `jsx-text` | Staff ID: | `common.salarySlipGenerator.staffIdText` |
| 157 | `jsx-text` | Name: | `common.salarySlipGenerator.nameText` |
| 163 | `jsx-text` | Designation: | `common.salarySlipGenerator.designationText` |
| 167 | `jsx-text` | Department: | `common.salarySlipGenerator.departmentText` |
| 174 | `jsx-text` | Pay Period | `common.salarySlipGenerator.payPeriodText` |
| 176 | `jsx-text` | Month: | `common.salarySlipGenerator.monthText` |
| 180 | `jsx-text` | Year: | `common.salarySlipGenerator.yearText` |
| 185 | `jsx-text` | Academic Year: | `common.salarySlipGenerator.academicYearText` |
| 193 | `jsx-text` | Earnings | `common.salarySlipGenerator.earningsText` |
| 195 | `jsx-text` | Base Salary: | `common.salarySlipGenerator.baseSalaryText` |
| 199 | `jsx-text` | Gross Earnings: | `common.salarySlipGenerator.grossEarningsText` |
| 206 | `jsx-text` | Deductions | `common.salarySlipGenerator.deductionsText` |
| 209 | `jsx-text` | Total Deductions: | `common.salarySlipGenerator.totalDeductionsText` |
| 214 | `jsx-text` | No deductions | `common.salarySlipGenerator.noDeductionsText` |
| 220 | `jsx-text` | Advances: | `common.salarySlipGenerator.advancesText` |
| 229 | `jsx-text` | NET PAYABLE: | `common.salarySlipGenerator.netPayableText` |
| 235 | `jsx-text` | Amount Paid: | `common.salarySlipGenerator.amountPaidText` |
| 240 | `jsx-text` | Balance Due: | `common.salarySlipGenerator.balanceDueText` |
| 250 | `jsx-text` | Payment Date: | `common.salarySlipGenerator.paymentDateText` |
| 261 | `jsx-text` | Status: | `common.salarySlipGenerator.statusText` |
| 270 | `jsx-text` | Employee Signature | `common.salarySlipGenerator.employeeSignatureText` |
| 274 | `jsx-text` | Authorized Signature | `common.salarySlipGenerator.authorizedSignatureText` |
| 280 | `jsx-text` | This is a computer-generated document. No signature is required. | `common.salarySlipGenerator.thisComputerGeneratedText` |
| 281 | `jsx-text` | Generated on | `common.salarySlipGenerator.generatedText` |

**`components/pdf/student-id-card-generator.tsx`** — 12

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 79 | `toast:success` | ID card generated successfully | `common.studentIdCardGenerator.idCardGeneratedSuccessfullySuccess` |
| 81 | `toast:error` | Failed to generate ID card | `common.studentIdCardGenerator.failedGenerateIdCardError` |
| 84 | `toast:error` | Failed to generate ID card | `common.studentIdCardGenerator.failedGenerateIdCardError2` |
| 114 | `toast:success` | Generated ${…} of ${…} ID cards | `common.studentIdCardGenerator.generatedIdCardsSuccess` |
| 116 | `toast:error` | Failed to generate ID cards | `common.studentIdCardGenerator.failedGenerateIdCardsError` |
| 127 | `jsx-text` | Generate ID Card | `common.studentIdCardGenerator.generateIdCardText` |
| 132 | `jsx-text` | Generate Student ID Card | `common.studentIdCardGenerator.generateStudentIdCardText` |
| 134 | `jsx-text` | Generate ID cards for students. Cards will be generated in A4 format wit… | `common.studentIdCardGenerator.generateIdCardsStudentsText` |
| 145 | `jsx-child` | Generating... | `common.studentIdCardGenerator.generatingText` |
| 145 | `jsx-child` | Generate ID Card for ${…} | `common.studentIdCardGenerator.generateIdCardText2` |
| 156 | `jsx-child` | Generating... | `common.studentIdCardGenerator.generatingText2` |
| 156 | `jsx-child` | Generate All (${…} cards) | `common.studentIdCardGenerator.generateAllCardsText` |

**`components/shared/data-table.tsx`** — 3 · *shared by 22 screens: `/academic/classes`, `/academic/groups`, `/academic/sections`, `/academic-year`, `/admissions`, `/attendance` … (+16 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 121 | `jsx-text` | No results found. | `common.dataTable.noResultsFoundText` |
| 133 | `jsx-text` | Showing page | `common.dataTable.showingPageText` |
| 134 | `jsx-text` | total) | `common.dataTable.totalText` |

**`components/shared/error-boundary.tsx`** — 2 · *shared by 63 screens: `/login`, `/onboarding`, `/academic/classes`, `/academic/groups`, `/academic/sections`, `/academic-year` … (+57 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 48 | `jsx-text` | Something went wrong | `common.errorBoundary.somethingWentWrongText` |
| 59 | `jsx-text` | Try Again | `common.errorBoundary.tryAgainText` |

**`components/shared/image-preview-modal.tsx`** — 2 · *shared by 3 screens: `/admissions`, `/staff`, `/students`*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 154 | `prop:aria-label` | Close preview | `common.imagePreviewModal.closePreviewAriaLabel` |
| 259 | `prop:aria-label` | Click outside to close | `common.imagePreviewModal.clickOutsideCloseAriaLabel` |

**`components/shared/searchable-select.tsx`** — 2

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 141 | `prop:placeholder` | Search... | `common.searchableSelect.searchPlaceholder` |
| 157 | `jsx-text` | No options found. | `common.searchableSelect.noOptionsFoundText` |

**`hooks/use-exams.ts`** — 9 · *shared by 6 screens: `/exams`, `/exams/results`, `/exams/[id]`, `/promotions/calculate`, `/promotions/rules`, `/subjects`*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 196 | `toast:success` | Subject created successfully | `common.useExams.subjectCreatedSuccessfullySuccess` |
| 213 | `toast:success` | Subject updated successfully | `common.useExams.subjectUpdatedSuccessfullySuccess` |
| 233 | `toast:success` | Subject deleted successfully | `common.useExams.subjectDeletedSuccessfullySuccess` |
| 279 | `toast:success` | Exam created successfully | `common.useExams.examCreatedSuccessfullySuccess` |
| 299 | `toast:success` | Exam updated successfully | `common.useExams.examUpdatedSuccessfullySuccess` |
| 319 | `toast:success` | Exam deleted successfully | `common.useExams.examDeletedSuccessfullySuccess` |
| 354 | `toast:success` | Exam results saved successfully | `common.useExams.examResultsSavedSuccessfullySuccess` |
| 388 | `toast:success` | Promotion rule created successfully | `common.useExams.promotionRuleCreatedSuccessfullySuccess` |
| 433 | `toast:success` | Promotions executed successfully | `common.useExams.promotionsExecutedSuccessfullySuccess` |

**`hooks/use-excel-export.ts`** — 7 · *shared by 7 screens: `/reports/admissions`, `/reports/attendance`, `/reports/exams`, `/reports/fees`, `/reports/financial`, `/reports/salary` … (+1 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 79 | `obj:subtitle` | Comprehensive fee collection and outstanding analysis | `common.useExcelExport.comprehensiveFeeCollectionOutstandingSubtitle` |
| 102 | `obj:subtitle` | Student attendance patterns and defaulter analysis | `common.useExcelExport.studentAttendancePatternsDefaulterSubtitle` |
| 125 | `obj:subtitle` | Student enrollment and demographic overview | `common.useExcelExport.studentEnrollmentDemographicOverviewSubtitle` |
| 148 | `obj:subtitle` | Exam results and student performance analysis | `common.useExcelExport.examResultsStudentPerformanceSubtitle` |
| 171 | `obj:subtitle` | Staff payroll, allowances, deductions, and disbursement records | `common.useExcelExport.staffPayrollAllowancesDeductionsSubtitle` |
| 194 | `obj:subtitle` | Comprehensive institutional expenses, receipts, and cash flow audit | `common.useExcelExport.comprehensiveInstitutionalExpensesReceipSubtitle` |
| 217 | `obj:subtitle` | Lead generation, inquiry status conversion, and admission pipeline | `common.useExcelExport.leadGenerationInquiryStatusConversionSubtitle` |

### `/notices`

**Tier:** P3 - Occasional / shared · **Findings:** 53 · **Files:** 4 · **Namespace:** `notices`

**`app/(dashboard)/notices/page.tsx`** — 2

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 415 | `jsx-text` | PINNED | `notices.page.pinnedText` |
| 423 | `jsx-text` | PLATFORM | `notices.page.platformText` |

**`components/notices/create-notice-modal.tsx`** — 37

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 30 | `obj:label` | General Announcement | `notices.createNoticeModal.generalAnnouncementLabel` |
| 31 | `obj:label` | Academic Circular | `notices.createNoticeModal.academicCircularLabel` |
| 32 | `obj:label` | Exam Schedule & Info | `notices.createNoticeModal.examScheduleInfoLabel` |
| 33 | `obj:label` | Fee Due Reminder | `notices.createNoticeModal.feeDueReminderLabel` |
| 34 | `obj:label` | Holiday / Vacation Notice | `notices.createNoticeModal.holidayVacationNoticeLabel` |
| 35 | `obj:label` | School Function / Event | `notices.createNoticeModal.schoolFunctionEventLabel` |
| 36 | `obj:label` | Urgent Campus Alert | `notices.createNoticeModal.urgentCampusAlertLabel` |
| 40 | `obj:label` | Entire School Community (All) | `notices.createNoticeModal.entireSchoolCommunityAllLabel` |
| 41 | `obj:label` | Faculty & Teaching Staff | `notices.createNoticeModal.facultyTeachingStaffLabel` |
| 42 | `obj:label` | Students & Guardians | `notices.createNoticeModal.studentsGuardiansLabel` |
| 43 | `obj:label` | Parents & Guardians | `notices.createNoticeModal.parentsGuardiansLabel` |
| 47 | `obj:label` | Low | `notices.createNoticeModal.lowLabel` |
| 48 | `obj:label` | Normal | `notices.createNoticeModal.normalLabel` |
| 49 | `obj:label` | High | `notices.createNoticeModal.highLabel` |
| 50 | `obj:label` | Urgent | `notices.createNoticeModal.urgentLabel` |
| 104 | `toast:error` | Please provide both title and content for the notice | `notices.createNoticeModal.pleaseProvideBothTitleError` |
| 122 | `toast:success` | Notice updated successfully | `notices.createNoticeModal.noticeUpdatedSuccessfullySuccess` |
| 122 | `toast:success` | Notice published to school noticeboard | `notices.createNoticeModal.noticePublishedSchoolNoticeboardSuccess` |
| 130 | `toast:error` | Network error saving notice | `notices.createNoticeModal.networkErrorSavingNoticeError` |
| 140 | `prop:title` | Update Institutional Notice | `notices.createNoticeModal.updateInstitutionalNoticeTitle` |
| 140 | `prop:title` | Publish Institutional Notice | `notices.createNoticeModal.publishInstitutionalNoticeTitle` |
| 141 | `prop:subtitle` | School Noticeboard & Circulars | `notices.createNoticeModal.schoolNoticeboardCircularsSubtitle` |
| 142 | `prop:description` | Post official announcements, exam updates, fee reminders, or urgent camp… | `notices.createNoticeModal.postOfficialAnnouncementsExamUpdatesDescription` |
| 150 | `jsx-text` | Notice Title | `notices.createNoticeModal.noticeTitleText` |
| 154 | `prop:placeholder` | e.g. Annual Sports Week 2026 Schedule & Guidelines | `notices.createNoticeModal.eGAnnualSportsWeekPlaceholder` |
| 164 | `jsx-text` | Category | `notices.createNoticeModal.categoryText` |
| 184 | `jsx-text` | Priority Level | `notices.createNoticeModal.priorityLevelText` |
| 204 | `jsx-text` | Target Audience | `notices.createNoticeModal.targetAudienceText` |
| 228 | `jsx-text` | Notice Body / Description | `notices.createNoticeModal.noticeBodyDescriptionText` |
| 233 | `prop:placeholder` | Type complete circular details, dates, instructions, or required student… | `notices.createNoticeModal.typeCompleteCircularDetailsDatesPlaceholder` |
| 246 | `jsx-text` | Optional Expiration Date | `notices.createNoticeModal.optionalExpirationDateText` |
| 255 | `jsx-text` | Notice will auto-archive after this date. | `notices.createNoticeModal.noticeWillAutoArchiveAfterText` |
| 268 | `jsx-text` | Pin notice to top of Noticeboard | `notices.createNoticeModal.pinNoticeTopText` |
| 279 | `jsx-text` | Publish immediately upon saving | `notices.createNoticeModal.publishImmediatelyUponSavingText` |
| 293 | `jsx-text` | Cancel | `notices.createNoticeModal.cancelText` |
| 305 | `jsx-child` | Save Changes | `notices.createNoticeModal.saveChangesText` |
| 305 | `jsx-child` | Publish Notice | `notices.createNoticeModal.publishNoticeText` |

**`components/notices/login-announcements-dialog.tsx`** — 1 · *shared by 52 screens: `/academic/classes`, `/academic/groups`, `/academic/sections`, `/academic-year`, `/accounting/accounts`, `/accounting/expenses` … (+46 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 150 | `jsx-child` | Announcement ${…} of ${…} | `notices.loginAnnouncementsDialog.announcementText` |

**`components/notices/notice-detail-modal.tsx`** — 13 · *shared by 61 screens: `/academic/classes`, `/academic/groups`, `/academic/sections`, `/academic-year`, `/accounting/accounts`, `/accounting/expenses` … (+55 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 40 | `jsx-text` | URGENT | `notices.noticeDetailModal.urgentText` |
| 47 | `jsx-text` | HIGH PRIORITY | `notices.noticeDetailModal.highPriorityText` |
| 66 | `toast:success` | Notice copied to clipboard | `notices.noticeDetailModal.noticeCopiedClipboardSuccess` |
| 74 | `prop:subtitle` | Global Platform Announcement | `notices.noticeDetailModal.globalPlatformAnnouncementSubtitle` |
| 74 | `prop:subtitle` | Institutional Circular • ${…} | `notices.noticeDetailModal.institutionalCircularSubtitle` |
| 75 | `prop:description` | Published on ${…} | `notices.noticeDetailModal.publishedDescription` |
| 89 | `jsx-text` | Pinned | `notices.noticeDetailModal.pinnedText` |
| 94 | `jsx-text` | Audience: | `notices.noticeDetailModal.audienceText` |
| 98 | `jsx-text` | SuperAdmin Broadcast | `notices.noticeDetailModal.superadminBroadcastText` |
| 134 | `jsx-text` | Valid until: | `notices.noticeDetailModal.validUntilText` |
| 150 | `jsx-text` | Copy Circular | `notices.noticeDetailModal.copyCircularText` |
| 160 | `jsx-text` | Print / PDF | `notices.noticeDetailModal.printPdfText` |
| 168 | `jsx-text` | Done | `notices.noticeDetailModal.doneText` |

### `/hostel`

**Tier:** P3 - Occasional / shared · **Findings:** 23 · **Files:** 2 · **Namespace:** `hostel`

**`app/(dashboard)/hostel/page.tsx`** — 15

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 207 | `toast:success` | Generated Resident Manifest for ${…} | `hostel.page.generatedResidentManifestSuccess` |
| 236 | `jsx-text` | rooms listed | `hostel.page.roomsListedText` |
| 249 | `prop:title` | Download Evacuation & Resident Manifest (PDF) | `hostel.page.downloadEvacuationResidentManifestPdfTitle` |
| 252 | `jsx-text` | Manifest | `hostel.page.manifestText` |
| 262 | `jsx-text` | Room | `hostel.page.roomText` |
| 264 | `jsx-text` | Floor | `hostel.page.floorText` |
| 265 | `jsx-text` | Beds | `hostel.page.bedsText` |
| 308 | `jsx-text` | Roll No: | `hostel.page.rollNoText` |
| 314 | `jsx-text` | Room | `hostel.page.roomText2` |
| 353 | `jsx-text` | You don&apos;t have permission to view hostel records. | `hostel.page.youDontHavePermissionText` |
| 391 | `jsx-text` | Total Beds Available | `hostel.page.totalBedsAvailableText` |
| 480 | `jsx-child` | Saving... | `hostel.page.savingText` |
| 515 | `jsx-child` | Saving... | `hostel.page.savingText2` |
| 551 | `jsx-child` | Allocating... | `hostel.page.allocatingText` |
| 566 | `obj:label` | ${…} (${…} beds) | `hostel.page.bedsLabel` |

**`viewmodels/hostel/use-hostel-view-model.ts`** — 8

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 25 | `toast:success` | Hostel added | `hostel.useHostelViewModel.hostelAddedSuccess` |
| 30 | `toast:success` | Hostel updated | `hostel.useHostelViewModel.hostelUpdatedSuccess` |
| 35 | `toast:success` | Hostel deleted | `hostel.useHostelViewModel.hostelDeletedSuccess` |
| 58 | `toast:success` | Room added | `hostel.useHostelViewModel.roomAddedSuccess` |
| 63 | `toast:success` | Room updated | `hostel.useHostelViewModel.roomUpdatedSuccess` |
| 68 | `toast:success` | Room deleted | `hostel.useHostelViewModel.roomDeletedSuccess` |
| 91 | `toast:success` | Student allocated | `hostel.useHostelViewModel.studentAllocatedSuccess` |
| 96 | `toast:success` | Allocation vacated | `hostel.useHostelViewModel.allocationVacatedSuccess` |

### `(shared) Design-system primitives`

**Tier:** P3 - Occasional / shared · **Findings:** 19 · **Files:** 5 · **Namespace:** `common`

**`components/ui/app-dropdown.tsx`** — 1 · *shared by 21 screens: `/academic/classes`, `/academic/groups`, `/academic/sections`, `/admissions`, `/certificates`, `/enquiries` … (+15 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 138 | `prop:placeholder` | Search... | `common.appDropdown.searchPlaceholder` |

**`components/ui/erp-data-table.tsx`** — 7 · *shared by 9 screens: `/accounting/expenses`, `/accounting/statements`, `/notices`, `/`, `/students`, `/system-admin/audit-logs` … (+3 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 205 | `prop:aria-label` | Select all rows | `common.erpDataTable.selectAllRowsAriaLabel` |
| 242 | `jsx-text` | No records found | `common.erpDataTable.noRecordsFoundText` |
| 244 | `jsx-text` | Try adjusting your search or filters | `common.erpDataTable.tryAdjustingSearchText` |
| 273 | `prop:aria-label` | Select row ${…} | `common.erpDataTable.selectRowAriaLabel` |
| 298 | `jsx-text` | Rows per page: | `common.erpDataTable.rowsPerPageText` |
| 316 | `jsx-child` | ${…}-${…} of ${…} | `common.erpDataTable.ofText` |
| 316 | `jsx-child` | 0 of 0 | `common.erpDataTable.00Text` |

**`components/ui/erp-metric-card.tsx`** — 8 · *shared by 8 screens: `/academic-year`, `/accounting/expenses`, `/exams/question-bank`, `/exams/question-papers`, `/fees`, `/fees/structures` … (+2 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 38 | `obj:text` | text-emerald-600 dark:text-emerald-400 | `common.erpMetricCard.textEmerald600DarkTextText` |
| 39 | `obj:text` | text-amber-600 dark:text-amber-400 | `common.erpMetricCard.textAmber600DarkTextText` |
| 40 | `obj:text` | text-rose-600 dark:text-rose-400 | `common.erpMetricCard.textRose600DarkTextText` |
| 41 | `obj:text` | text-cyan-600 dark:text-cyan-400 | `common.erpMetricCard.textCyan600DarkTextText` |
| 42 | `obj:text` | text-teal-600 dark:text-teal-400 | `common.erpMetricCard.textTeal600DarkTextText` |
| 43 | `obj:text` | text-purple-600 dark:text-purple-400 | `common.erpMetricCard.textPurple600DarkTextText` |
| 122 | `jsx-text` | DETAILS | `common.erpMetricCard.detailsText` |
| 130 | `prop:title` | Options | `common.erpMetricCard.optionsTitle` |

**`components/ui/status-badge.tsx`** — 1 · *shared by 16 screens: `/academic/classes`, `/academic/groups`, `/academic/sections`, `/academic-year`, `/exam-results`, `/fees` … (+10 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 12 | `obj:info` | bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-… | `common.statusBadge.bgBlue100TextBlueInfo` |

**`components/ui/top-sheet.tsx`** — 2 · *shared by 61 screens: `/academic/classes`, `/academic/groups`, `/academic/sections`, `/academic-year`, `/accounting/accounts`, `/accounting/expenses` … (+55 more)*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 151 | `prop:title` | Close (Esc) | `common.topSheet.closeEscTitle` |
| 154 | `jsx-text` | Close | `common.topSheet.closeText` |

### `/enquiries`

**Tier:** P3 - Occasional / shared · **Findings:** 8 · **Files:** 2 · **Namespace:** `enquiries`

**`app/(dashboard)/enquiries/page.tsx`** — 4

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 254 | `jsx-text` | You don&apos;t have permission to view enquiries. | `enquiries.page.youDontHavePermissionText` |
| 274 | `jsx-text` | Search | `enquiries.page.searchText` |
| 404 | `prop:placeholder` | 01XXXXXXXXX | `enquiries.page.01xxxxxxxxxPlaceholder` |
| 407 | `prop:placeholder` | student@email.com | `enquiries.page.studentEmailComPlaceholder` |

**`viewmodels/enquiries/use-enquiries-view-model.ts`** — 4

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 70 | `toast:success` | Enquiry added | `enquiries.useEnquiriesViewModel.enquiryAddedSuccess` |
| 89 | `toast:success` | Enquiry updated | `enquiries.useEnquiriesViewModel.enquiryUpdatedSuccess` |
| 103 | `toast:success` | Enquiry deleted | `enquiries.useEnquiriesViewModel.enquiryDeletedSuccess` |
| 122 | `toast:success` | Converted to admission | `enquiries.useEnquiriesViewModel.convertedAdmissionSuccess` |

### `/health`

**Tier:** P3 - Occasional / shared · **Findings:** 8 · **Files:** 2 · **Namespace:** `health`

**`app/(dashboard)/health/page.tsx`** — 5

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 149 | `obj:header` | H/W | `health.page.hWColumnHeader` |
| 153 | `jsx-child` | ${…}cm | `health.page.cmText` |
| 153 | `jsx-child` | ${…}kg | `health.page.kgText` |
| 158 | `obj:header` | Vision | `health.page.visionColumnHeader` |
| 194 | `jsx-text` | You don&apos;t have permission to view health records. | `health.page.youDontHavePermissionText` |

**`viewmodels/health/use-health-view-model.ts`** — 3

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 28 | `toast:success` | Health record added | `health.useHealthViewModel.healthRecordAddedSuccess` |
| 38 | `toast:success` | Health record updated | `health.useHealthViewModel.healthRecordUpdatedSuccess` |
| 48 | `toast:success` | Health record deleted | `health.useHealthViewModel.healthRecordDeletedSuccess` |

### `/certificates`

**Tier:** P3 - Occasional / shared · **Findings:** 7 · **Files:** 2 · **Namespace:** `certificates`

**`app/(dashboard)/certificates/page.tsx`** — 4

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 181 | `jsx-text` | You don&apos;t have permission to view certificates. | `certificates.page.youDontHavePermissionText` |
| 199 | `obj:label` | All Types | `certificates.page.allTypesLabel` |
| 200 | `obj:label` | All Statuses | `certificates.page.allStatusesLabel` |
| 220 | `prop:placeholder` | Auto-generated if blank | `certificates.page.autoGeneratedIfBlankPlaceholder` |

**`viewmodels/certificates/use-certificates-view-model.ts`** — 3

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 28 | `toast:success` | Certificate issued | `certificates.useCertificatesViewModel.certificateIssuedSuccess` |
| 38 | `toast:success` | Certificate updated | `certificates.useCertificatesViewModel.certificateUpdatedSuccess` |
| 48 | `toast:success` | Certificate deleted | `certificates.useCertificatesViewModel.certificateDeletedSuccess` |

### `/inventory`

**Tier:** P3 - Occasional / shared · **Findings:** 6 · **Files:** 2 · **Namespace:** `inventory`

**`app/(dashboard)/inventory/page.tsx`** — 1

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 190 | `jsx-text` | You don&apos;t have permission to view inventory. | `inventory.page.youDontHavePermissionText` |

**`viewmodels/inventory/use-inventory-view-model.ts`** — 5

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 25 | `toast:success` | Item added | `inventory.useInventoryViewModel.itemAddedSuccess` |
| 30 | `toast:success` | Item updated | `inventory.useInventoryViewModel.itemUpdatedSuccess` |
| 35 | `toast:success` | Item deleted | `inventory.useInventoryViewModel.itemDeletedSuccess` |
| 58 | `toast:success` | Transaction recorded | `inventory.useInventoryViewModel.transactionRecordedSuccess` |
| 63 | `toast:success` | Transaction deleted | `inventory.useInventoryViewModel.transactionDeletedSuccess` |

### `/leaves`

**Tier:** P3 - Occasional / shared · **Findings:** 4 · **Files:** 2 · **Namespace:** `leaves`

**`app/(dashboard)/leaves/page.tsx`** — 1

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 209 | `jsx-text` | You don&apos;t have permission to view leave records. | `leaves.page.youDontHavePermissionText` |

**`viewmodels/leaves/use-leaves-view-model.ts`** — 3

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 34 | `toast:success` | Leave request submitted | `leaves.useLeavesViewModel.leaveRequestSubmittedSuccess` |
| 40 | `toast:success` | Leave updated | `leaves.useLeavesViewModel.leaveUpdatedSuccess` |
| 46 | `toast:success` | Leave deleted | `leaves.useLeavesViewModel.leaveDeletedSuccess` |

### `/academic-year`

**Tier:** P3 - Occasional / shared · **Findings:** 3 · **Files:** 1 · **Namespace:** `academicYear`

**`app/(dashboard)/academic-year/page.tsx`** — 3

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 195 | `jsx-text` | AY | `academicYear.page.ayText` |
| 291 | `jsx-text` | Access restricted | `academicYear.page.accessRestrictedText` |
| 292 | `jsx-text` | You do not have permission to view this section. | `academicYear.page.youDoNotHavePermissionText` |

### `/settings`

**Tier:** P3 - Occasional / shared · **Findings:** 3 · **Files:** 1 · **Namespace:** `settings`

**`app/(dashboard)/settings/page.tsx`** — 3

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 548 | `jsx-text` | Asia/Dhaka ( | `settings.page.asiaDhakaText` |
| 549 | `jsx-text` | Asia/Kolkata ( | `settings.page.asiaKolkataText` |
| 550 | `jsx-text` | Asia/Karachi ( | `settings.page.asiaKarachiText` |

### `/academic/classes`

**Tier:** P3 - Occasional / shared · **Findings:** 2 · **Files:** 1 · **Namespace:** `academicPeriods`

**`app/(dashboard)/academic/classes/page.tsx`** — 2

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 405 | `jsx-text` | Access restricted | `academicPeriods.page.accessRestrictedText` |
| 406 | `jsx-text` | You do not have permission to view this section. | `academicPeriods.page.youDoNotHavePermissionText` |

### `/academic/groups`

**Tier:** P3 - Occasional / shared · **Findings:** 2 · **Files:** 1 · **Namespace:** `academicPeriods`

**`app/(dashboard)/academic/groups/page.tsx`** — 2

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 377 | `jsx-text` | Access restricted | `academicPeriods.page.accessRestrictedText2` |
| 378 | `jsx-text` | You do not have permission to view this section. | `academicPeriods.page.youDoNotHavePermissionText2` |

### `/academic/sections`

**Tier:** P3 - Occasional / shared · **Findings:** 2 · **Files:** 1 · **Namespace:** `academicPeriods`

**`app/(dashboard)/academic/sections/page.tsx`** — 2

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 339 | `jsx-text` | Access restricted | `academicPeriods.page.accessRestrictedText3` |
| 340 | `jsx-text` | You do not have permission to view this section. | `academicPeriods.page.youDoNotHavePermissionText3` |

### `/promotions/calculate`

**Tier:** P3 - Occasional / shared · **Findings:** 2 · **Files:** 1 · **Namespace:** `promotions`

**`app/(dashboard)/promotions/calculate/page.tsx`** — 2

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 165 | `toast:error` | Unable to prepare promotions data. Missing student IDs or next class con… | `promotions.page.unablePreparePromotionsDataError` |
| 566 | `jsx-text` | None | `promotions.page.noneText` |

### `/transactions`

**Tier:** P3 - Occasional / shared · **Findings:** 2 · **Files:** 1 · **Namespace:** `transactions`

**`app/(dashboard)/transactions/page.tsx`** — 2

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 136 | `jsx-text` | Access restricted | `transactions.page.accessRestrictedText` |
| 137 | `jsx-text` | You do not have permission to view transactions. | `transactions.page.youDoNotHavePermissionText` |

### `/system-admin`

**Tier:** P4 - Platform ops · **Findings:** 179 · **Files:** 3 · **Namespace:** `systemAdmin`

**`app/system-admin/page.tsx`** — 18

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 75 | `obj:title` | Total School Instances | `systemAdmin.page.totalSchoolInstancesTitle` |
| 83 | `obj:title` | Active Paid Subscriptions | `systemAdmin.page.activePaidSubscriptionsTitle` |
| 91 | `obj:title` | Cross-Platform Students | `systemAdmin.page.crossPlatformStudentsTitle` |
| 99 | `obj:title` | Platform Infrastructure | `systemAdmin.page.platformInfrastructureTitle` |
| 126 | `jsx-text` | Onboard New School | `systemAdmin.page.onboardNewSchoolText` |
| 159 | `jsx-text` | Recently Provisioned Schools | `systemAdmin.page.recentlyProvisionedSchoolsText` |
| 167 | `jsx-text` | View All Directory | `systemAdmin.page.viewAllDirectoryText` |
| 174 | `jsx-text` | No school tenants provisioned yet. | `systemAdmin.page.noSchoolTenantsProvisionedYetText` |
| 195 | `jsx-text` | Tenant: | `systemAdmin.page.tenantText` |
| 195 | `jsx-text` | • Students: | `systemAdmin.page.studentsText` |
| 217 | `jsx-text` | Inspector | `systemAdmin.page.inspectorText` |
| 234 | `jsx-text` | SuperAdmin Modules | `systemAdmin.page.superadminModulesText` |
| 247 | `jsx-text` | SaaS Revenue & MRR | `systemAdmin.page.saasRevenueMrrText` |
| 248 | `jsx-text` | Manage subscriptions & plans | `systemAdmin.page.manageSubscriptionsPlansText` |
| 263 | `jsx-text` | Global Security Audit | `systemAdmin.page.globalSecurityAuditText` |
| 264 | `jsx-text` | Real-time mutation stream | `systemAdmin.page.realTimeMutationStreamText` |
| 279 | `jsx-text` | Tenant 360° Directory | `systemAdmin.page.tenant360DirectoryText` |
| 280 | `jsx-text` | Full multi-tenant inspector | `systemAdmin.page.fullMultiTenantInspectorText` |

**`components/system-admin/edit-tenant-modal.tsx`** — 35 · *shared by 2 screens: `/system-admin/tenants`, `/system-admin/tenants/[id]`*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 71 | `toast:error` | School name is required | `systemAdmin.editTenantModal.schoolNameRequiredError` |
| 89 | `toast:success` | School configuration updated successfully! | `systemAdmin.editTenantModal.schoolConfigurationUpdatedSuccessfullySuccess` |
| 93 | `toast:error` | Network error updating tenant | `systemAdmin.editTenantModal.networkErrorUpdatingTenantError` |
| 107 | `prop:description` | Update core institutional metadata, active subscription status, regional… | `systemAdmin.editTenantModal.updateCoreInstitutionalMetadataActiveDescription` |
| 114 | `jsx-text` | School Name * | `systemAdmin.editTenantModal.schoolNameText` |
| 125 | `jsx-text` | Subscription Status * | `systemAdmin.editTenantModal.subscriptionStatusText` |
| 131 | `jsx-text` | ACTIVE (Full Subscription Paid) | `systemAdmin.editTenantModal.activeFullSubscriptionPaidText` |
| 132 | `jsx-text` | TRIAL (30-Day Free Evaluation) | `systemAdmin.editTenantModal.trial30DayFreeEvaluationText` |
| 133 | `jsx-text` | SUSPENDED (Access Blocked) | `systemAdmin.editTenantModal.suspendedAccessBlockedText` |
| 134 | `jsx-text` | EXPIRED (Renewal Required) | `systemAdmin.editTenantModal.expiredRenewalRequiredText` |
| 140 | `jsx-text` | Operating Currency | `systemAdmin.editTenantModal.operatingCurrencyText` |
| 156 | `jsx-text` | Tax Rate (%) | `systemAdmin.editTenantModal.taxRateText` |
| 169 | `jsx-text` | Date Format | `systemAdmin.editTenantModal.dateFormatText` |
| 175 | `jsx-text` | DD/MM/YYYY (e.g. 26/08/2026) | `systemAdmin.editTenantModal.ddMmYyyyEGText` |
| 176 | `jsx-text` | MM/DD/YYYY (e.g. 08/26/2026) | `systemAdmin.editTenantModal.mmDdYyyyEGText` |
| 177 | `jsx-text` | YYYY-MM-DD (e.g. 2026-08-26) | `systemAdmin.editTenantModal.yyyyMmDdEGText` |
| 183 | `jsx-text` | Timezone | `systemAdmin.editTenantModal.timezoneText` |
| 189 | `jsx-text` | Asia/Karachi (PKT +05:00) | `systemAdmin.editTenantModal.asiaKarachiPkt0500Text` |
| 190 | `jsx-text` | Asia/Dhaka (BST +06:00) | `systemAdmin.editTenantModal.asiaDhakaBst0600Text` |
| 191 | `jsx-text` | Asia/Kolkata (IST +05:30) | `systemAdmin.editTenantModal.asiaKolkataIst0530Text` |
| 192 | `jsx-text` | Asia/Dubai (GST +04:00) | `systemAdmin.editTenantModal.asiaDubaiGst0400Text` |
| 193 | `jsx-text` | Asia/Riyadh (AST +03:00) | `systemAdmin.editTenantModal.asiaRiyadhAst0300Text` |
| 194 | `jsx-text` | UTC (+00:00) | `systemAdmin.editTenantModal.utc0000Text` |
| 200 | `jsx-text` | Grading System | `systemAdmin.editTenantModal.gradingSystemText` |
| 206 | `jsx-text` | GPA Scale (4.0 / 5.0) | `systemAdmin.editTenantModal.gpaScale405Text` |
| 207 | `jsx-text` | Percentage Only (0 - 100%) | `systemAdmin.editTenantModal.percentageOnly0100Text` |
| 208 | `jsx-text` | Letter Grades (A+, A, B, C, D, F) | `systemAdmin.editTenantModal.letterGradesBText` |
| 214 | `jsx-text` | Board Curriculum | `systemAdmin.editTenantModal.boardCurriculumText` |
| 220 | `jsx-text` | Bangladesh NCTB | `systemAdmin.editTenantModal.bangladeshNctbText` |
| 221 | `jsx-text` | India CBSE | `systemAdmin.editTenantModal.indiaCbseText` |
| 222 | `jsx-text` | Pakistan FBISE | `systemAdmin.editTenantModal.pakistanFbiseText` |
| 228 | `jsx-text` | Max Grace / Subject | `systemAdmin.editTenantModal.maxGraceSubjectText` |
| 241 | `jsx-text` | Max Grace / Student | `systemAdmin.editTenantModal.maxGraceStudentText` |
| 256 | `jsx-text` | Cancel | `systemAdmin.editTenantModal.cancelText` |
| 268 | `jsx-text` | Save Configuration | `systemAdmin.editTenantModal.saveConfigurationText` |

**`components/system-admin/onboard-institute-modal.tsx`** — 126 · *shared by 2 screens: `/system-admin`, `/system-admin/tenants`*

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 50 | `obj:label` | Pakistan (FBISE Federal Board) | `systemAdmin.onboardInstituteModal.pakistanFbiseFederalBoardLabel` |
| 51 | `obj:description` | SSC 9-10 (Science/Computer) & HSSC 11-12 (Pre-Med, Pre-Eng, ICS, I.Com) | `systemAdmin.onboardInstituteModal.ssc910ScienceComputerDescription` |
| 56 | `obj:label` | India (CBSE Board) | `systemAdmin.onboardInstituteModal.indiaCbseBoardLabel` |
| 57 | `obj:description` | Class 9-10 (Std/Basic Math, Science, Social) & Class 11-12 (Science, Com… | `systemAdmin.onboardInstituteModal.class910StdBasicDescription` |
| 62 | `obj:label` | Bangladesh (NCTB Curriculum) | `systemAdmin.onboardInstituteModal.bangladeshNctbCurriculumLabel` |
| 63 | `obj:description` | Primary (1-5), Junior Secondary (6-8), SSC (9-10) & HSC (11-12) with GPA… | `systemAdmin.onboardInstituteModal.primary15JuniorSecondaryDescription` |
| 68 | `obj:label` | K-12 Comprehensive | `systemAdmin.onboardInstituteModal.k12ComprehensiveLabel` |
| 69 | `obj:description` | Playgroup, Nursery, KG, Grades 1-10 with Sections & Core Subjects | `systemAdmin.onboardInstituteModal.playgroupNurseryKgGrades1Description` |
| 74 | `obj:label` | Primary School (1–5) | `systemAdmin.onboardInstituteModal.primarySchool15Label` |
| 75 | `obj:description` | Class 1 through Class 5 with Sections A & B | `systemAdmin.onboardInstituteModal.class1ThroughClass5Description` |
| 80 | `obj:label` | Middle School (6–8) | `systemAdmin.onboardInstituteModal.middleSchool68Label` |
| 81 | `obj:description` | Class 6 through Class 8 with Sections & General Science | `systemAdmin.onboardInstituteModal.class6ThroughClass8Description` |
| 86 | `obj:label` | Secondary / Matric (9–10) | `systemAdmin.onboardInstituteModal.secondaryMatric910Label` |
| 87 | `obj:description` | Class 9 & 10 Matriculation with Science/Arts groups | `systemAdmin.onboardInstituteModal.class910MatriculationDescription` |
| 92 | `obj:label` | Higher Secondary (11–12) | `systemAdmin.onboardInstituteModal.higherSecondary1112Label` |
| 93 | `obj:description` | FSc Pre-Med, Pre-Eng, ICS Computer Science & I.Com | `systemAdmin.onboardInstituteModal.fscPreMedPreEngDescription` |
| 98 | `obj:label` | Cambridge (O / A Levels) | `systemAdmin.onboardInstituteModal.cambridgeOLevelsLabel` |
| 99 | `obj:description` | O-Level (Y1–Y3) and A-Level (AS/A2) with Science & Business streams | `systemAdmin.onboardInstituteModal.oLevelY1Y3Description` |
| 104 | `obj:label` | Madrasa / Religious Institute | `systemAdmin.onboardInstituteModal.madrasaReligiousInstituteLabel` |
| 105 | `obj:description` | Nazra Quran, Hifz-ul-Quran & Dars-e-Nizami levels | `systemAdmin.onboardInstituteModal.nazraQuranHifzUlQuranDescription` |
| 110 | `obj:label` | Custom (Blank Start) | `systemAdmin.onboardInstituteModal.customBlankStartLabel` |
| 111 | `obj:description` | No default classes seeded. Setup classes and subjects manually later. | `systemAdmin.onboardInstituteModal.noDefaultClassesSeededSetupDescription` |
| 186 | `toast:success` | Generated secure temporary password | `systemAdmin.onboardInstituteModal.generatedSecureTemporaryPasswordSuccess` |
| 192 | `toast:error` | Please enter the institute name | `systemAdmin.onboardInstituteModal.pleaseEnterInstituteNameError` |
| 196 | `toast:error` | Please enter the school address | `systemAdmin.onboardInstituteModal.pleaseEnterSchoolAddressError` |
| 201 | `toast:error` | Please provide an academic year label | `systemAdmin.onboardInstituteModal.pleaseProvideAcademicYearError` |
| 205 | `toast:error` | Please select session start and end dates | `systemAdmin.onboardInstituteModal.pleaseSelectSessionStartError` |
| 210 | `toast:error` | Please enter the administrator's name | `systemAdmin.onboardInstituteModal.pleaseEnterAdministratorSError` |
| 214 | `toast:error` | Please enter a valid administrator email | `systemAdmin.onboardInstituteModal.pleaseEnterValidAdministratorError` |
| 218 | `toast:error` | Password must be at least 6 characters | `systemAdmin.onboardInstituteModal.passwordMustBeLeastError` |
| 275 | `toast:success` | Institute successfully onboarded! | `systemAdmin.onboardInstituteModal.instituteSuccessfullyOnboardedSuccess` |
| 294 | `prop:title` | Onboard New Educational Institute | `systemAdmin.onboardInstituteModal.onboardNewEducationalInstituteTitle` |
| 295 | `prop:subtitle` | SaaS Multi-Tenant Provisioning | `systemAdmin.onboardInstituteModal.saasMultiTenantProvisioningSubtitle` |
| 296 | `prop:description` | Register, configure regional localization, initialize academic periods, … | `systemAdmin.onboardInstituteModal.registerConfigureRegionalLocalizationIniDescription` |
| 304 | `obj:label` | Institute Profile | `systemAdmin.onboardInstituteModal.instituteProfileLabel` |
| 305 | `obj:label` | Region & Currency | `systemAdmin.onboardInstituteModal.regionCurrencyLabel` |
| 306 | `obj:label` | Academic System | `systemAdmin.onboardInstituteModal.academicSystemLabel` |
| 307 | `obj:label` | Admin Credentials | `systemAdmin.onboardInstituteModal.adminCredentialsLabel` |
| 308 | `obj:label` | Review & Provision | `systemAdmin.onboardInstituteModal.reviewProvisionLabel` |
| 350 | `jsx-text` | Institute Full Name | `systemAdmin.onboardInstituteModal.instituteFullNameText` |
| 354 | `prop:placeholder` | e.g. Beaconhouse International Academy | `systemAdmin.onboardInstituteModal.eGBeaconhouseInternationalAcademyPlaceholder` |
| 363 | `jsx-text` | Tenant Slug / Subdomain | `systemAdmin.onboardInstituteModal.tenantSlugSubdomainText` |
| 368 | `prop:placeholder` | e.g. beaconhouse-intl | `systemAdmin.onboardInstituteModal.eGBeaconhouseIntlPlaceholder` |
| 374 | `jsx-text` | Unique identifier used for multi-tenant isolation. | `systemAdmin.onboardInstituteModal.uniqueIdentifierUsedMultiText` |
| 379 | `jsx-text` | School Registration / Code | `systemAdmin.onboardInstituteModal.schoolRegistrationCodeText` |
| 383 | `prop:placeholder` | e.g. SCH-2026-01 | `systemAdmin.onboardInstituteModal.eGSch202601Placeholder` |
| 392 | `jsx-text` | Campus Address | `systemAdmin.onboardInstituteModal.campusAddressText` |
| 396 | `prop:placeholder` | Street address, City, District, Postal Code | `systemAdmin.onboardInstituteModal.streetAddressCityDistrictPostalPlaceholder` |
| 406 | `jsx-text` | Official Phone Number | `systemAdmin.onboardInstituteModal.officialPhoneNumberText` |
| 410 | `prop:placeholder` | e.g. +92 51 1234567 | `systemAdmin.onboardInstituteModal.eG92511234567Placeholder` |
| 419 | `jsx-text` | Official School Email | `systemAdmin.onboardInstituteModal.officialSchoolEmailText` |
| 424 | `prop:placeholder` | e.g. info@beaconhouse.edu | `systemAdmin.onboardInstituteModal.eGInfoBeaconhouseEduPlaceholder` |
| 433 | `jsx-text` | Motto / Slogan | `systemAdmin.onboardInstituteModal.mottoSloganText` |
| 437 | `prop:placeholder` | e.g. Excellence in Education | `systemAdmin.onboardInstituteModal.eGExcellenceEducationPlaceholder` |
| 446 | `jsx-text` | Established Year | `systemAdmin.onboardInstituteModal.establishedYearText` |
| 466 | `jsx-text` | Default Currency | `systemAdmin.onboardInstituteModal.defaultCurrencyText` |
| 484 | `jsx-text` | Currency Symbol | `systemAdmin.onboardInstituteModal.currencySymbolText` |
| 496 | `jsx-text` | Timezone | `systemAdmin.onboardInstituteModal.timezoneText` |
| 504 | `jsx-text` | Asia/Karachi (Pakistan Standard Time UTC+5) | `systemAdmin.onboardInstituteModal.asiaKarachiPakistanStandardTimeText` |
| 505 | `jsx-text` | Asia/Dhaka (Bangladesh Standard Time UTC+6) | `systemAdmin.onboardInstituteModal.asiaDhakaBangladeshStandardTimeText` |
| 506 | `jsx-text` | Asia/Kolkata (Indian Standard Time UTC+5:30) | `systemAdmin.onboardInstituteModal.asiaKolkataIndianStandardTimeText` |
| 507 | `jsx-text` | Asia/Dubai (Gulf Standard Time UTC+4) | `systemAdmin.onboardInstituteModal.asiaDubaiGulfStandardTimeText` |
| 508 | `jsx-text` | Asia/Riyadh (Arabia Standard Time UTC+3) | `systemAdmin.onboardInstituteModal.asiaRiyadhArabiaStandardTimeText` |
| 509 | `jsx-text` | Europe/London (GMT / BST) | `systemAdmin.onboardInstituteModal.europeLondonGmtBstText` |
| 510 | `jsx-text` | America/New_York (EST / EDT) | `systemAdmin.onboardInstituteModal.americaNewYorkEstEdtText` |
| 511 | `jsx-text` | UTC (Universal Time Coordinated) | `systemAdmin.onboardInstituteModal.utcUniversalTimeCoordinatedText` |
| 517 | `jsx-text` | Date Format | `systemAdmin.onboardInstituteModal.dateFormatText` |
| 525 | `jsx-text` | DD/MM/YYYY (e.g. 25/08/2026) | `systemAdmin.onboardInstituteModal.ddMmYyyyEGText` |
| 526 | `jsx-text` | MM/DD/YYYY (e.g. 08/25/2026) | `systemAdmin.onboardInstituteModal.mmDdYyyyEGText` |
| 527 | `jsx-text` | YYYY-MM-DD (e.g. 2026-08-25) | `systemAdmin.onboardInstituteModal.yyyyMmDdEGText` |
| 528 | `jsx-text` | DD-MMM-YYYY (e.g. 25-Aug-2026) | `systemAdmin.onboardInstituteModal.ddMmmYyyyEGText` |
| 534 | `jsx-text` | Time Format | `systemAdmin.onboardInstituteModal.timeFormatText` |
| 542 | `jsx-text` | 12-hour format (e.g. 02:30 PM) | `systemAdmin.onboardInstituteModal.12HourFormatEGText` |
| 543 | `jsx-text` | 24-hour military format (e.g. 14:30) | `systemAdmin.onboardInstituteModal.24HourMilitaryFormatEText` |
| 549 | `jsx-text` | Grading System | `systemAdmin.onboardInstituteModal.gradingSystemText` |
| 557 | `jsx-text` | GPA 4.0 / 5.0 System | `systemAdmin.onboardInstituteModal.gpa4050Text` |
| 558 | `jsx-text` | Percentage (%) Scale | `systemAdmin.onboardInstituteModal.percentageScaleText` |
| 559 | `jsx-text` | Letter Grade (A+, A, B, C, D, F) | `systemAdmin.onboardInstituteModal.letterGradeBText` |
| 572 | `jsx-text` | Initial Academic Session | `systemAdmin.onboardInstituteModal.initialAcademicSessionText` |
| 578 | `prop:placeholder` | e.g. 2026-2027 | `systemAdmin.onboardInstituteModal.eG20262027Placeholder` |
| 585 | `jsx-text` | Session Start Date | `systemAdmin.onboardInstituteModal.sessionStartDateText` |
| 598 | `jsx-text` | Session End Date | `systemAdmin.onboardInstituteModal.sessionEndDateText` |
| 612 | `jsx-text` | Select Initial Grade Structure Template | `systemAdmin.onboardInstituteModal.selectInitialGradeStructureTemplateText` |
| 615 | `jsx-text` | Automatically seeds standard classes, sections, and foundational subject… | `systemAdmin.onboardInstituteModal.automaticallySeedsStandardClassesSectionText` |
| 661 | `jsx-text` | Institute Super Admin Account | `systemAdmin.onboardInstituteModal.instituteSuperAdminAccountText` |
| 663 | `jsx-text` | This account will have master administrative privileges over school conf… | `systemAdmin.onboardInstituteModal.thisAccountWillHaveMasterText` |
| 671 | `jsx-text` | Principal / Admin Name | `systemAdmin.onboardInstituteModal.principalAdminNameText` |
| 675 | `prop:placeholder` | e.g. Dr. Tariq Mahmood | `systemAdmin.onboardInstituteModal.eGDrTariqMahmoodPlaceholder` |
| 684 | `jsx-text` | Official Login Email | `systemAdmin.onboardInstituteModal.officialLoginEmailText` |
| 689 | `prop:placeholder` | e.g. principal@beaconhouse.edu | `systemAdmin.onboardInstituteModal.eGPrincipalBeaconhouseEduPlaceholder` |
| 699 | `jsx-text` | Secure Password | `systemAdmin.onboardInstituteModal.securePasswordText` |
| 706 | `jsx-text` | Auto-generate | `systemAdmin.onboardInstituteModal.autoGenerateText` |
| 712 | `prop:placeholder` | Enter password or auto-generate | `systemAdmin.onboardInstituteModal.enterPasswordAutoGeneratePlaceholder` |
| 721 | `jsx-text` | Subscription Status | `systemAdmin.onboardInstituteModal.subscriptionStatusText` |
| 729 | `jsx-text` | 30-Day Free Trial | `systemAdmin.onboardInstituteModal.30DayFreeTrialText` |
| 730 | `jsx-text` | Active (Paid Enterprise SaaS) | `systemAdmin.onboardInstituteModal.activePaidEnterpriseSaasText` |
| 744 | `jsx-text` | Institute Details | `systemAdmin.onboardInstituteModal.instituteDetailsText` |
| 748 | `jsx-text` | Tenant ID: | `systemAdmin.onboardInstituteModal.tenantIdText` |
| 758 | `jsx-text` | Regional & Financial | `systemAdmin.onboardInstituteModal.regionalFinancialText` |
| 762 | `jsx-text` | Currency: | `systemAdmin.onboardInstituteModal.currencyText` |
| 764 | `jsx-text` | Timezone: | `systemAdmin.onboardInstituteModal.timezoneText2` |
| 765 | `jsx-text` | Date Format: | `systemAdmin.onboardInstituteModal.dateFormatText2` |
| 766 | `jsx-text` | Grading: | `systemAdmin.onboardInstituteModal.gradingText` |
| 774 | `jsx-text` | Academic Setup | `systemAdmin.onboardInstituteModal.academicSetupText` |
| 777 | `jsx-text` | Session: | `systemAdmin.onboardInstituteModal.sessionText` |
| 779 | `jsx-text` | Template: | `systemAdmin.onboardInstituteModal.templateText` |
| 782 | `jsx-text` | Dates: | `systemAdmin.onboardInstituteModal.datesText` |
| 791 | `jsx-text` | Super Administrator | `systemAdmin.onboardInstituteModal.superAdministratorText` |
| 795 | `jsx-text` | Email: | `systemAdmin.onboardInstituteModal.emailText` |
| 796 | `jsx-text` | Password: •••••••• | `systemAdmin.onboardInstituteModal.passwordText` |
| 812 | `jsx-text` | is Ready! | `systemAdmin.onboardInstituteModal.isReadyText` |
| 814 | `jsx-text` | The school instance has been provisioned with database isolation, academ… | `systemAdmin.onboardInstituteModal.theSchoolInstanceHasBeenText` |
| 815 | `jsx-text` | , and seeded structure. | `systemAdmin.onboardInstituteModal.andSeededStructureText` |
| 822 | `jsx-text` | Tenant Slug / ID: | `systemAdmin.onboardInstituteModal.tenantSlugIdText` |
| 826 | `jsx-text` | Admin Login: | `systemAdmin.onboardInstituteModal.adminLoginText` |
| 830 | `jsx-text` | Classes Initialized: | `systemAdmin.onboardInstituteModal.classesInitializedText` |
| 831 | `jsx-text` | Classes | `systemAdmin.onboardInstituteModal.classesText` |
| 834 | `jsx-text` | Subscription: | `systemAdmin.onboardInstituteModal.subscriptionText` |
| 849 | `toast:success` | Credentials copied to clipboard | `systemAdmin.onboardInstituteModal.credentialsCopiedClipboardSuccess` |
| 853 | `jsx-text` | Copy Details | `systemAdmin.onboardInstituteModal.copyDetailsText` |
| 859 | `jsx-text` | Finish & Return | `systemAdmin.onboardInstituteModal.finishReturnText` |
| 870 | `jsx-text` | Previous | `systemAdmin.onboardInstituteModal.previousText` |
| 874 | `jsx-text` | Cancel | `systemAdmin.onboardInstituteModal.cancelText` |
| 880 | `jsx-text` | Next | `systemAdmin.onboardInstituteModal.nextText` |
| 889 | `jsx-text` | Provisioning Infrastructure... | `systemAdmin.onboardInstituteModal.provisioningInfrastructureText` |
| 892 | `jsx-text` | Provision Institute Now | `systemAdmin.onboardInstituteModal.provisionInstituteNowText` |

### `/system-admin/notices`

**Tier:** P4 - Platform ops · **Findings:** 38 · **Files:** 1 · **Namespace:** `systemAdmin`

**`components/system-admin/create-broadcast-modal.tsx`** — 38

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 33 | `obj:label` | Scheduled Maintenance / Downtime | `systemAdmin.createBroadcastModal.scheduledMaintenanceDowntimeLabel` |
| 34 | `obj:label` | New Feature / Platform Update | `systemAdmin.createBroadcastModal.newFeaturePlatformUpdateLabel` |
| 35 | `obj:label` | Billing & Subscription Policy | `systemAdmin.createBroadcastModal.billingSubscriptionPolicyLabel` |
| 36 | `obj:label` | Critical System / Security Notice | `systemAdmin.createBroadcastModal.criticalSystemSecurityNoticeLabel` |
| 37 | `obj:label` | General SaaS Announcement | `systemAdmin.createBroadcastModal.generalSaasAnnouncementLabel` |
| 120 | `toast:error` | Please provide broadcast title and body | `systemAdmin.createBroadcastModal.pleaseProvideBroadcastTitleError` |
| 125 | `toast:error` | Please select at least one school tenant to target | `systemAdmin.createBroadcastModal.pleaseSelectLeastOneError` |
| 145 | `toast:success` | Broadcast updated | `systemAdmin.createBroadcastModal.broadcastUpdatedSuccess` |
| 145 | `toast:success` | Global broadcast sent across all targeted school instances | `systemAdmin.createBroadcastModal.globalBroadcastSentAcrossAllSuccess` |
| 153 | `toast:error` | Network error sending broadcast | `systemAdmin.createBroadcastModal.networkErrorSendingBroadcastError` |
| 163 | `prop:title` | Update Platform Broadcast | `systemAdmin.createBroadcastModal.updatePlatformBroadcastTitle` |
| 163 | `prop:title` | Broadcast Platform Announcement | `systemAdmin.createBroadcastModal.broadcastPlatformAnnouncementTitle` |
| 164 | `prop:subtitle` | SuperAdmin Global Command | `systemAdmin.createBroadcastModal.superadminGlobalCommandSubtitle` |
| 165 | `prop:description` | Send emergency alerts, maintenance countdowns, or product updates across… | `systemAdmin.createBroadcastModal.sendEmergencyAlertsMaintenanceCountdownsDescription` |
| 173 | `jsx-text` | Broadcast Title | `systemAdmin.createBroadcastModal.broadcastTitleText` |
| 177 | `prop:placeholder` | e.g. Scheduled Cloud Database Upgrade - Sunday 02:00 UTC | `systemAdmin.createBroadcastModal.eGScheduledCloudDatabasePlaceholder` |
| 187 | `jsx-text` | Broadcast Type | `systemAdmin.createBroadcastModal.broadcastTypeText` |
| 207 | `jsx-text` | Alert Severity | `systemAdmin.createBroadcastModal.alertSeverityText` |
| 210 | `obj:label` | Normal Info | `systemAdmin.createBroadcastModal.normalInfoLabel` |
| 211 | `obj:label` | High Priority | `systemAdmin.createBroadcastModal.highPriorityLabel` |
| 212 | `obj:label` | Urgent Banner | `systemAdmin.createBroadcastModal.urgentBannerLabel` |
| 231 | `jsx-text` | Target School Scope | `systemAdmin.createBroadcastModal.targetSchoolScopeText` |
| 243 | `jsx-text` | All Schools Globally | `systemAdmin.createBroadcastModal.allSchoolsGloballyText` |
| 246 | `jsx-text` | Broadcasts to every tenant instance on the platform | `systemAdmin.createBroadcastModal.broadcastsEveryTenantInstanceText` |
| 260 | `jsx-text` | Specific School Tenants | `systemAdmin.createBroadcastModal.specificSchoolTenantsText` |
| 263 | `jsx-text` | Target selected schools only | `systemAdmin.createBroadcastModal.targetSelectedSchoolsOnlyText` |
| 274 | `jsx-text` | Select Schools to Receive Broadcast ( | `systemAdmin.createBroadcastModal.selectSchoolsReceiveBroadcastText` |
| 274 | `jsx-text` | selected) | `systemAdmin.createBroadcastModal.selectedText` |
| 290 | `jsx-child` | Deselect All | `systemAdmin.createBroadcastModal.deselectAllText` |
| 290 | `jsx-child` | Select All | `systemAdmin.createBroadcastModal.selectAllText` |
| 322 | `jsx-text` | Broadcast Announcement Message | `systemAdmin.createBroadcastModal.broadcastAnnouncementMessageText` |
| 327 | `prop:placeholder` | Type comprehensive platform announcement details, maintenance schedules,… | `systemAdmin.createBroadcastModal.typeComprehensivePlatformAnnouncementDetPlaceholder` |
| 339 | `jsx-text` | Live School Dashboard Banner Preview | `systemAdmin.createBroadcastModal.liveSchoolDashboardBannerPreviewText` |
| 367 | `jsx-text` | Auto-Expire & Remove Banner | `systemAdmin.createBroadcastModal.autoExpireRemoveBannerText` |
| 385 | `jsx-text` | Activate and broadcast immediately | `systemAdmin.createBroadcastModal.activateBroadcastImmediatelyText` |
| 398 | `jsx-text` | Cancel | `systemAdmin.createBroadcastModal.cancelText` |
| 410 | `jsx-child` | Save Broadcast | `systemAdmin.createBroadcastModal.saveBroadcastText` |
| 410 | `jsx-child` | Transmit Global Broadcast | `systemAdmin.createBroadcastModal.transmitGlobalBroadcastText` |

### `/system-admin/tenants/[id]`

**Tier:** P4 - Platform ops · **Findings:** 33 · **Files:** 1 · **Namespace:** `systemAdmin`

**`app/system-admin/tenants/[id]/page.tsx`** — 33

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 52 | `toast:error` | Network error loading school telemetry | `systemAdmin.page.networkErrorLoadingSchoolTelemetryError` |
| 73 | `toast:success` | Logged in as ${…} | `systemAdmin.page.loggedAsSuccess` |
| 77 | `toast:error` | Failed to impersonate tenant | `systemAdmin.page.failedImpersonateTenantError` |
| 81 | `toast:error` | Error initiating support session | `systemAdmin.page.errorInitiatingSupportSessionError` |
| 97 | `toast:success` | Status updated to ${…} | `systemAdmin.page.statusUpdatedSuccess` |
| 100 | `toast:error` | Failed to update status | `systemAdmin.page.failedUpdateStatusError` |
| 103 | `toast:error` | Network error | `systemAdmin.page.networkErrorError2` |
| 112 | `jsx-text` | Loading school 360° telemetry... | `systemAdmin.page.loadingSchool360TelemetryText` |
| 121 | `jsx-text` | School Not Found | `systemAdmin.page.schoolNotFoundText` |
| 123 | `jsx-text` | Back to Tenants Directory | `systemAdmin.page.backTenantsDirectoryText` |
| 163 | `jsx-text` | Tenant ID: | `systemAdmin.page.tenantIdText2` |
| 163 | `jsx-text` | • Created: | `systemAdmin.page.createdText` |
| 174 | `jsx-text` | Edit Configuration | `systemAdmin.page.editConfigurationText` |
| 186 | `jsx-text` | Login As School Admin | `systemAdmin.page.loginAsSchoolAdminText` |
| 197 | `jsx-text` | Enrolled Students | `systemAdmin.page.enrolledStudentsText` |
| 206 | `jsx-text` | Active pupil profiles | `systemAdmin.page.activePupilProfilesText` |
| 214 | `jsx-text` | Faculty & Staff | `systemAdmin.page.facultyStaffText` |
| 223 | `jsx-text` | Teaching & operations staff | `systemAdmin.page.teachingOperationsStaffText` |
| 231 | `jsx-text` | Fee Throughput | `systemAdmin.page.feeThroughputText` |
| 243 | `jsx-text` | Across | `systemAdmin.page.acrossText` |
| 243 | `jsx-text` | generated vouchers | `systemAdmin.page.generatedVouchersText` |
| 252 | `jsx-text` | System Users | `systemAdmin.page.systemUsersText` |
| 261 | `jsx-text` | Principals, Clerks & Admins | `systemAdmin.page.principalsClerksAdminsText` |
| 274 | `jsx-text` | SaaS Subscription & Plan Controls | `systemAdmin.page.saasSubscriptionPlanControlsText` |
| 280 | `jsx-text` | Current Status | `systemAdmin.page.currentStatusText` |
| 282 | `jsx-text` | Subscription lifecycle state for this school | `systemAdmin.page.subscriptionLifecycleStateText` |
| 304 | `jsx-text` | Operating Currency | `systemAdmin.page.operatingCurrencyText` |
| 312 | `jsx-text` | Timezone & Region | `systemAdmin.page.timezoneRegionText` |
| 318 | `jsx-text` | Grading Scale | `systemAdmin.page.gradingScaleText` |
| 324 | `jsx-text` | Standard Date Format | `systemAdmin.page.standardDateFormatText` |
| 340 | `jsx-text` | School Administrators & Staff Accounts | `systemAdmin.page.schoolAdministratorsStaffAccountsText` |
| 343 | `jsx-text` | Accounts | `systemAdmin.page.accountsText` |
| 360 | `jsx-child` | Never logged in | `systemAdmin.page.neverLoggedText` |

### `/system-admin/tenants`

**Tier:** P4 - Platform ops · **Findings:** 21 · **Files:** 2 · **Namespace:** `systemAdmin`

**`app/system-admin/tenants/page.tsx`** — 13

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 88 | `jsx-text` | Active | `systemAdmin.page.activeText` |
| 97 | `jsx-text` | Suspended | `systemAdmin.page.suspendedText` |
| 106 | `jsx-text` | Trial | `systemAdmin.page.trialText` |
| 120 | `jsx-text` | Overview and 360° telemetry of all software school instances. | `systemAdmin.page.overview360TelemetryText` |
| 128 | `jsx-text` | Onboard New School | `systemAdmin.page.onboardNewSchoolText2` |
| 151 | `jsx-text` | School Name | `systemAdmin.page.schoolNameText` |
| 152 | `jsx-text` | Tenant ID | `systemAdmin.page.tenantIdText` |
| 153 | `jsx-text` | Subscription | `systemAdmin.page.subscriptionText` |
| 154 | `jsx-text` | User Count | `systemAdmin.page.userCountText` |
| 155 | `jsx-text` | Student Count | `systemAdmin.page.studentCountText` |
| 156 | `jsx-text` | Actions | `systemAdmin.page.actionsText` |
| 163 | `jsx-text` | Loading platform data... | `systemAdmin.page.loadingPlatformDataText` |
| 169 | `jsx-text` | No schools found matching your search. | `systemAdmin.page.noSchoolsFoundMatchingText` |

**`components/layout/tenant-actions-dropdown.tsx`** — 8

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 53 | `toast:success` | Logged in as ${…} | `systemAdmin.tenantActionsDropdown.loggedAsSuccess` |
| 62 | `toast:error` | Network error during impersonation | `systemAdmin.tenantActionsDropdown.networkErrorDuringImpersonationError` |
| 96 | `jsx-text` | Login as School Admin | `systemAdmin.tenantActionsDropdown.loginAsSchoolAdminText` |
| 109 | `jsx-text` | View 360° Telemetry | `systemAdmin.tenantActionsDropdown.view360TelemetryText` |
| 120 | `jsx-text` | Edit Configuration | `systemAdmin.tenantActionsDropdown.editConfigurationText` |
| 131 | `jsx-text` | Extend Billing / Trial | `systemAdmin.tenantActionsDropdown.extendBillingTrialText` |
| 146 | `jsx-child` | Suspending... | `systemAdmin.tenantActionsDropdown.suspendingText` |
| 146 | `jsx-child` | Suspend School | `systemAdmin.tenantActionsDropdown.suspendSchoolText` |

### `/system-admin/billing`

**Tier:** P4 - Platform ops · **Findings:** 18 · **Files:** 1 · **Namespace:** `systemAdmin`

**`app/system-admin/billing/page.tsx`** — 18

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 97 | `toast:success` | Billing updated | `systemAdmin.page.billingUpdatedSuccess` |
| 101 | `toast:error` | Network error | `systemAdmin.page.networkErrorError` |
| 199 | `jsx-text` | Edit | `systemAdmin.page.editText` |
| 314 | `jsx-text` | Export CSV | `systemAdmin.page.exportCsvText` |
| 333 | `prop:title` | Edit Billing — ${…} | `systemAdmin.page.editBillingTitle` |
| 334 | `prop:description` | Tenant ${…} | `systemAdmin.page.tenantDescription` |
| 338 | `jsx-text` | Cancel | `systemAdmin.page.cancelText` |
| 339 | `jsx-text` | Save Plan | `systemAdmin.page.savePlanText` |
| 343 | `prop:title` | Plan & Status | `systemAdmin.page.planStatusTitle` |
| 345 | `prop:label` | Subscription Status | `systemAdmin.page.subscriptionStatusLabel` |
| 346 | `obj:label` | ACTIVE | `systemAdmin.page.activeLabel` |
| 346 | `obj:label` | TRIAL | `systemAdmin.page.trialLabel` |
| 346 | `obj:label` | SUSPENDED | `systemAdmin.page.suspendedLabel` |
| 346 | `obj:label` | EXPIRED | `systemAdmin.page.expiredLabel` |
| 348 | `prop:label` | Plan Tier | `systemAdmin.page.planTierLabel` |
| 349 | `obj:label` | STARTER 149 | `systemAdmin.page.starter149Label` |
| 349 | `obj:label` | PRO 299 | `systemAdmin.page.pro299Label` |
| 349 | `obj:label` | ENTERPRISE 599 | `systemAdmin.page.enterprise599Label` |

### `/system-admin/audit-logs`

**Tier:** P4 - Platform ops · **Findings:** 10 · **Files:** 1 · **Namespace:** `systemAdmin`

**`app/system-admin/audit-logs/page.tsx`** — 10

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 96 | `jsx-text` | ID: | `systemAdmin.page.idText` |
| 142 | `jsx-text` | Refresh Stream | `systemAdmin.page.refreshStreamText` |
| 152 | `jsx-text` | Total Events | `systemAdmin.page.totalEventsText` |
| 169 | `jsx-text` | Deletions & Purges | `systemAdmin.page.deletionsPurgesText` |
| 188 | `jsx-text` | Creation Mutations | `systemAdmin.page.creationMutationsText` |
| 207 | `jsx-text` | Audit Integrity | `systemAdmin.page.auditIntegrityText` |
| 242 | `jsx-text` | CREATE | `systemAdmin.page.createText` |
| 243 | `jsx-text` | UPDATE | `systemAdmin.page.updateText` |
| 245 | `jsx-text` | LOGIN | `systemAdmin.page.loginText` |
| 258 | `jsx-text` | Clear Filters | `systemAdmin.page.clearFiltersText` |

### `/system-admin/users`

**Tier:** P4 - Platform ops · **Findings:** 10 · **Files:** 1 · **Namespace:** `systemAdmin`

**`app/system-admin/users/page.tsx`** — 10

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 77 | `native:confirm` | Impersonate ${…} (${…})? | `systemAdmin.page.impersonateConfirm` |
| 192 | `prop:title` | Edit ${…} | `systemAdmin.page.editTitle` |
| 217 | `obj:label` | SUPER_ADMIN (L1) | `systemAdmin.page.superAdminL1Label` |
| 218 | `obj:label` | SYSTEM_ADMIN | `systemAdmin.page.systemAdminLabel` |
| 219 | `obj:label` | ADMIN (L1) | `systemAdmin.page.adminL1Label` |
| 220 | `obj:label` | MANAGER (L2) | `systemAdmin.page.managerL2Label` |
| 221 | `obj:label` | ACCOUNTANT (L3) | `systemAdmin.page.accountantL3Label` |
| 222 | `obj:label` | TEACHER (L5) | `systemAdmin.page.teacherL5Label` |
| 223 | `obj:label` | PARENT (L6) | `systemAdmin.page.parentL6Label` |
| 224 | `obj:label` | STUDENT (L7) | `systemAdmin.page.studentL7Label` |

### `/system-admin/settings`

**Tier:** P4 - Platform ops · **Findings:** 6 · **Files:** 1 · **Namespace:** `systemAdmin`

**`app/system-admin/settings/page.tsx`** — 6

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 168 | `jsx-text` | Bangladesh NCTB | `systemAdmin.page.bangladeshNctbText` |
| 169 | `jsx-text` | India CBSE | `systemAdmin.page.indiaCbseText` |
| 170 | `jsx-text` | Pakistan FBISE | `systemAdmin.page.pakistanFbiseText` |
| 176 | `jsx-text` | GPA 5.0 | `systemAdmin.page.gpa50Text` |
| 177 | `jsx-text` | Percentage | `systemAdmin.page.percentageText` |
| 239 | `jsx-text` | v15.4 (App Router) | `systemAdmin.page.v154AppRouterText` |

### `/system-admin/feature-flags`

**Tier:** P4 - Platform ops · **Findings:** 1 · **Files:** 1 · **Namespace:** `systemAdmin`

**`app/system-admin/feature-flags/page.tsx`** — 1

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 90 | `jsx-text` | Save | `systemAdmin.page.saveText` |

---

## Appendix — Document templates (PDF / Excel)

**476 findings across 19 files.** These are printed artefacts rather than screens, 
but they are end-user visible and are commonly handed to parents, so they are listed for completeness.
They need locale resolution **at generation time** (the tenant's locale), not from the viewer's session.

**`lib/excel-exporter.ts`** — 77

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 36 | `obj:text` | 1E293B | `documents.excelExporter.1e293bText` |
| 45 | `obj:header` | Segoe UI Semibold | `documents.excelExporter.segoeUiSemiboldColumnHeader` |
| 47 | `obj:body` | Segoe UI | `documents.excelExporter.segoeUiBody` |
| 48 | `obj:title` | Segoe UI Semibold | `documents.excelExporter.segoeUiSemiboldTitle` |
| 411 | `obj:title` | Fee Collection Report | `documents.excelExporter.feeCollectionReportTitle` |
| 414 | `obj:header` | Voucher No. | `documents.excelExporter.voucherNoColumnHeader` |
| 415 | `obj:header` | Student Name | `documents.excelExporter.studentNameColumnHeader` |
| 416 | `obj:header` | Class | `documents.excelExporter.classColumnHeader` |
| 417 | `obj:header` | Section | `documents.excelExporter.sectionColumnHeader` |
| 418 | `obj:header` | Total Amount | `documents.excelExporter.totalAmountColumnHeader` |
| 419 | `obj:header` | Paid Amount | `documents.excelExporter.paidAmountColumnHeader` |
| 420 | `obj:header` | Due Amount | `documents.excelExporter.dueAmountColumnHeader` |
| 421 | `obj:header` | Status | `documents.excelExporter.statusColumnHeader` |
| 422 | `obj:header` | Payment Method | `documents.excelExporter.paymentMethodColumnHeader` |
| 423 | `obj:header` | Date | `documents.excelExporter.dateColumnHeader` |
| 435 | `obj:title` | Attendance Analysis Report | `documents.excelExporter.attendanceAnalysisReportTitle` |
| 438 | `obj:header` | Roll No. | `documents.excelExporter.rollNoColumnHeader` |
| 439 | `obj:header` | Student Name | `documents.excelExporter.studentNameColumnHeader2` |
| 440 | `obj:header` | Class | `documents.excelExporter.classColumnHeader2` |
| 441 | `obj:header` | Section | `documents.excelExporter.sectionColumnHeader2` |
| 442 | `obj:header` | Present Days | `documents.excelExporter.presentDaysColumnHeader` |
| 443 | `obj:header` | Absent Days | `documents.excelExporter.absentDaysColumnHeader` |
| 444 | `obj:header` | Total Days | `documents.excelExporter.totalDaysColumnHeader` |
| 445 | `obj:header` | Attendance % | `documents.excelExporter.attendanceColumnHeader` |
| 446 | `obj:header` | Status | `documents.excelExporter.statusColumnHeader2` |
| 458 | `obj:title` | Student Enrollment Report | `documents.excelExporter.studentEnrollmentReportTitle` |
| 461 | `obj:header` | Admission No. | `documents.excelExporter.admissionNoColumnHeader` |
| 462 | `obj:header` | Student Name | `documents.excelExporter.studentNameColumnHeader3` |
| 463 | `obj:header` | Class | `documents.excelExporter.classColumnHeader3` |
| 464 | `obj:header` | Section | `documents.excelExporter.sectionColumnHeader3` |
| 465 | `obj:header` | Roll No. | `documents.excelExporter.rollNoColumnHeader2` |
| 466 | `obj:header` | Gender | `documents.excelExporter.genderColumnHeader` |
| 467 | `obj:header` | Status | `documents.excelExporter.statusColumnHeader3` |
| 468 | `obj:header` | Admission Date | `documents.excelExporter.admissionDateColumnHeader` |
| 469 | `obj:header` | Guardian Name | `documents.excelExporter.guardianNameColumnHeader` |
| 470 | `obj:header` | Contact | `documents.excelExporter.contactColumnHeader` |
| 482 | `obj:title` | Exam Performance Report | `documents.excelExporter.examPerformanceReportTitle` |
| 485 | `obj:header` | Roll No. | `documents.excelExporter.rollNoColumnHeader3` |
| 486 | `obj:header` | Student Name | `documents.excelExporter.studentNameColumnHeader4` |
| 487 | `obj:header` | Class | `documents.excelExporter.classColumnHeader4` |
| 488 | `obj:header` | Section | `documents.excelExporter.sectionColumnHeader4` |
| 489 | `obj:header` | Exam | `documents.excelExporter.examColumnHeader` |
| 490 | `obj:header` | Subject | `documents.excelExporter.subjectColumnHeader` |
| 491 | `obj:header` | Marks | `documents.excelExporter.marksColumnHeader` |
| 493 | `obj:header` | Grade | `documents.excelExporter.gradeColumnHeader` |
| 494 | `obj:header` | Status | `documents.excelExporter.statusColumnHeader4` |
| 506 | `obj:title` | Staff Payroll & Salary Disbursement Report | `documents.excelExporter.staffPayrollSalaryDisbursementReportTitle` |
| 509 | `obj:header` | Staff ID | `documents.excelExporter.staffIdColumnHeader` |
| 510 | `obj:header` | Staff Name | `documents.excelExporter.staffNameColumnHeader` |
| 511 | `obj:header` | Department | `documents.excelExporter.departmentColumnHeader` |
| 512 | `obj:header` | Designation | `documents.excelExporter.designationColumnHeader` |
| 513 | `obj:header` | Period | `documents.excelExporter.periodColumnHeader` |
| 514 | `obj:header` | Gross Salary | `documents.excelExporter.grossSalaryColumnHeader` |
| 515 | `obj:header` | Deductions | `documents.excelExporter.deductionsColumnHeader` |
| 516 | `obj:header` | Net Payable | `documents.excelExporter.netPayableColumnHeader` |
| 517 | `obj:header` | Paid Amount | `documents.excelExporter.paidAmountColumnHeader2` |
| 518 | `obj:header` | Pending Due | `documents.excelExporter.pendingDueColumnHeader` |
| 519 | `obj:header` | Status | `documents.excelExporter.statusColumnHeader5` |
| 531 | `obj:title` | Financial Expenses & Cash Flow Audit Report | `documents.excelExporter.financialExpensesCashFlowAuditTitle` |
| 534 | `obj:header` | Voucher # | `documents.excelExporter.voucherColumnHeader` |
| 535 | `obj:header` | Title / Description | `documents.excelExporter.titleDescriptionColumnHeader` |
| 536 | `obj:header` | Category | `documents.excelExporter.categoryColumnHeader` |
| 537 | `obj:header` | Amount | `documents.excelExporter.amountColumnHeader` |
| 538 | `obj:header` | Method | `documents.excelExporter.methodColumnHeader` |
| 539 | `obj:header` | Payee | `documents.excelExporter.payeeColumnHeader` |
| 540 | `obj:header` | Receipt # | `documents.excelExporter.receiptColumnHeader` |
| 541 | `obj:header` | Date | `documents.excelExporter.dateColumnHeader2` |
| 542 | `obj:header` | Recorded By | `documents.excelExporter.recordedColumnHeader` |
| 554 | `obj:title` | Admissions Pipeline & Enquiry Conversion Report | `documents.excelExporter.admissionsPipelineEnquiryConversionReporTitle` |
| 557 | `obj:header` | Applicant / Student | `documents.excelExporter.applicantStudentColumnHeader` |
| 558 | `obj:header` | Guardian Name | `documents.excelExporter.guardianNameColumnHeader2` |
| 559 | `obj:header` | Phone | `documents.excelExporter.phoneColumnHeader` |
| 560 | `obj:header` | Target Grade | `documents.excelExporter.targetGradeColumnHeader` |
| 561 | `obj:header` | Lead Source | `documents.excelExporter.leadSourceColumnHeader` |
| 562 | `obj:header` | Status | `documents.excelExporter.statusColumnHeader6` |
| 563 | `obj:header` | Assigned To | `documents.excelExporter.assignedColumnHeader` |
| 564 | `obj:header` | Enquiry Date | `documents.excelExporter.enquiryDateColumnHeader` |

**`lib/pdf-templates/salary-payslip.tsx`** — 57

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 208 | `prop:title` | Payslip_${…}_${…}_${…} | `documents.salaryPayslip.payslipTitle` |
| 215 | `jsx-text` | • Ph: | `documents.salaryPayslip.phText` |
| 219 | `jsx-text` | Monthly Salary Payslip | `documents.salaryPayslip.monthlySalaryPayslipText` |
| 231 | `jsx-text` | Employee Name: | `documents.salaryPayslip.employeeNameText` |
| 235 | `jsx-text` | Staff ID: | `documents.salaryPayslip.staffIdText` |
| 239 | `jsx-text` | Designation: | `documents.salaryPayslip.designationText` |
| 243 | `jsx-text` | Department: | `documents.salaryPayslip.departmentText` |
| 250 | `jsx-text` | Payslip No: | `documents.salaryPayslip.payslipNoText` |
| 254 | `jsx-text` | Disbursement Date: | `documents.salaryPayslip.disbursementDateText` |
| 258 | `jsx-text` | Payment Mode: | `documents.salaryPayslip.paymentModeText` |
| 262 | `jsx-text` | Bank Account: | `documents.salaryPayslip.bankAccountText` |
| 264 | `jsx-child` | Direct Payment | `documents.salaryPayslip.directPaymentText` |
| 276 | `jsx-text` | EARNINGS & ALLOWANCES | `documents.salaryPayslip.earningsAllowancesText` |
| 277 | `jsx-text` | AMOUNT ( | `documents.salaryPayslip.amountText` |
| 281 | `jsx-text` | Base Basic Salary | `documents.salaryPayslip.baseBasicSalaryText` |
| 293 | `jsx-text` | GROSS EARNINGS | `documents.salaryPayslip.grossEarningsText` |
| 301 | `jsx-text` | DEDUCTIONS & ADVANCES | `documents.salaryPayslip.deductionsAdvancesText` |
| 302 | `jsx-text` | AMOUNT ( | `documents.salaryPayslip.amountText2` |
| 307 | `jsx-text` | Salary Advance Recovery | `documents.salaryPayslip.salaryAdvanceRecoveryText` |
| 321 | `jsx-text` | No Deductions | `documents.salaryPayslip.noDeductionsText` |
| 327 | `jsx-text` | TOTAL DEDUCTIONS | `documents.salaryPayslip.totalDeductionsText` |
| 336 | `jsx-text` | NET DISBURSED SALARY | `documents.salaryPayslip.netDisbursedSalaryText` |
| 337 | `jsx-text` | Status: | `documents.salaryPayslip.statusText` |
| 337 | `jsx-child` | DISBURSED / SETTLED | `documents.salaryPayslip.disbursedSettledText` |
| 337 | `jsx-child` | PAYMENT PENDING | `documents.salaryPayslip.paymentPendingText` |
| 347 | `jsx-text` | * This is a system-generated confidential payroll document. Any discrepa… | `documents.salaryPayslip.thisSystemGeneratedText` |
| 355 | `jsx-text` | Employee Signature | `documents.salaryPayslip.employeeSignatureText` |
| 359 | `jsx-text` | Accounts Officer | `documents.salaryPayslip.accountsOfficerText` |
| 363 | `jsx-text` | Principal / Director Stamp | `documents.salaryPayslip.principalDirectorStampText` |
| 373 | `prop:title` | Commercial Staff Salary Payslips Booklet | `documents.salaryPayslip.commercialStaffSalaryPayslipsBookletTitle` |
| 381 | `jsx-text` | • Ph: | `documents.salaryPayslip.phText2` |
| 385 | `jsx-text` | Monthly Salary Payslip | `documents.salaryPayslip.monthlySalaryPayslipText2` |
| 397 | `jsx-text` | Employee Name: | `documents.salaryPayslip.employeeNameText2` |
| 401 | `jsx-text` | Staff ID: | `documents.salaryPayslip.staffIdText2` |
| 405 | `jsx-text` | Designation: | `documents.salaryPayslip.designationText2` |
| 409 | `jsx-text` | Department: | `documents.salaryPayslip.departmentText2` |
| 416 | `jsx-text` | Payslip No: | `documents.salaryPayslip.payslipNoText2` |
| 420 | `jsx-text` | Disbursement Date: | `documents.salaryPayslip.disbursementDateText2` |
| 424 | `jsx-text` | Payment Mode: | `documents.salaryPayslip.paymentModeText2` |
| 428 | `jsx-text` | Bank Account: | `documents.salaryPayslip.bankAccountText2` |
| 430 | `jsx-child` | Direct Payment | `documents.salaryPayslip.directPaymentText2` |
| 441 | `jsx-text` | EARNINGS & ALLOWANCES | `documents.salaryPayslip.earningsAllowancesText2` |
| 442 | `jsx-text` | AMOUNT ( | `documents.salaryPayslip.amountText3` |
| 446 | `jsx-text` | Base Basic Salary | `documents.salaryPayslip.baseBasicSalaryText2` |
| 458 | `jsx-text` | GROSS EARNINGS | `documents.salaryPayslip.grossEarningsText2` |
| 465 | `jsx-text` | DEDUCTIONS & ADVANCES | `documents.salaryPayslip.deductionsAdvancesText2` |
| 466 | `jsx-text` | AMOUNT ( | `documents.salaryPayslip.amountText4` |
| 471 | `jsx-text` | Salary Advance Recovery | `documents.salaryPayslip.salaryAdvanceRecoveryText2` |
| 485 | `jsx-text` | No Deductions | `documents.salaryPayslip.noDeductionsText2` |
| 491 | `jsx-text` | TOTAL DEDUCTIONS | `documents.salaryPayslip.totalDeductionsText2` |
| 500 | `jsx-text` | NET DISBURSED SALARY | `documents.salaryPayslip.netDisbursedSalaryText2` |
| 501 | `jsx-text` | Status: | `documents.salaryPayslip.statusText2` |
| 501 | `jsx-child` | DISBURSED / SETTLED | `documents.salaryPayslip.disbursedSettledText2` |
| 501 | `jsx-child` | PAYMENT PENDING | `documents.salaryPayslip.paymentPendingText2` |
| 512 | `jsx-text` | Employee Signature | `documents.salaryPayslip.employeeSignatureText2` |
| 516 | `jsx-text` | Accounts Officer | `documents.salaryPayslip.accountsOfficerText2` |
| 520 | `jsx-text` | Principal / Director Stamp | `documents.salaryPayslip.principalDirectorStampText2` |

**`lib/pdf-templates/report-card.tsx`** — 35

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 394 | `jsx-text` | \| Email: | `documents.reportCard.emailText` |
| 399 | `jsx-text` | Progress Report Card | `documents.reportCard.progressReportCardText` |
| 400 | `jsx-text` | Academic Year: | `documents.reportCard.academicYearText` |
| 408 | `jsx-text` | Student Photo | `documents.reportCard.studentPhotoText` |
| 415 | `jsx-text` | Admission No. | `documents.reportCard.admissionNoText` |
| 419 | `jsx-text` | Roll Number | `documents.reportCard.rollNumberText` |
| 423 | `jsx-text` | Class & Section | `documents.reportCard.classSectionText` |
| 427 | `jsx-text` | Date of Birth | `documents.reportCard.dateBirthText` |
| 431 | `jsx-text` | Gender | `documents.reportCard.genderText` |
| 436 | `jsx-text` | Blood Group | `documents.reportCard.bloodGroupText` |
| 441 | `jsx-text` | Guardian | `documents.reportCard.guardianText` |
| 445 | `jsx-text` | Contact | `documents.reportCard.contactText` |
| 465 | `jsx-text` | Grade: | `documents.reportCard.gradeText` |
| 469 | `jsx-text` | Rank: | `documents.reportCard.rankText` |
| 477 | `jsx-text` | Code | `documents.reportCard.codeText` |
| 478 | `jsx-text` | Subject | `documents.reportCard.subjectText` |
| 479 | `jsx-text` | Max | `documents.reportCard.maxText` |
| 480 | `jsx-text` | Obt | `documents.reportCard.obtText` |
| 481 | `jsx-text` | Grade | `documents.reportCard.gradeText2` |
| 482 | `jsx-text` | GP | `documents.reportCard.gpText` |
| 483 | `jsx-text` | Remarks | `documents.reportCard.remarksText` |
| 507 | `jsx-text` | Total Marks | `documents.reportCard.totalMarksText` |
| 511 | `jsx-text` | Overall % | `documents.reportCard.overallText` |
| 515 | `jsx-text` | Final Result | `documents.reportCard.finalResultText` |
| 519 | `jsx-child` | PASS | `documents.reportCard.passText` |
| 519 | `jsx-child` | FAIL | `documents.reportCard.failText` |
| 526 | `jsx-text` | Attendance Record | `documents.reportCard.attendanceRecordText` |
| 545 | `jsx-text` | Co-Curricular Activities | `documents.reportCard.coCurricularActivitiesText` |
| 550 | `jsx-text` | Grade: | `documents.reportCard.gradeText3` |
| 562 | `jsx-text` | Class Teacher's Remarks | `documents.reportCard.classTeacherSRemarksText` |
| 568 | `jsx-text` | Principal's Remarks | `documents.reportCard.principalSRemarksText` |
| 578 | `jsx-text` | Class Teacher | `documents.reportCard.classTeacherText` |
| 582 | `jsx-text` | Examination In-charge | `documents.reportCard.examinationChargeText` |
| 586 | `jsx-text` | Principal | `documents.reportCard.principalText` |
| 592 | `jsx-text` | Grade Scale: A+ (90%+, GP 4.0), A (80-89%, GP 3.7), B (70-79%, GP 3.3), … | `documents.reportCard.gradeScale90GpText` |

**`lib/pdf-templates/batch-report-card.tsx`** — 32

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 254 | `prop:title` | Class Batch Report Cards | `documents.batchReportCard.classBatchReportCardsTitle` |
| 262 | `jsx-text` | • Phone: | `documents.batchReportCard.phoneText` |
| 262 | `jsx-text` | • Email: | `documents.batchReportCard.emailText` |
| 267 | `jsx-text` | Academic Session: | `documents.batchReportCard.academicSessionText` |
| 275 | `jsx-text` | Student Name: | `documents.batchReportCard.studentNameText` |
| 279 | `jsx-text` | Roll Number: | `documents.batchReportCard.rollNumberText` |
| 283 | `jsx-text` | Admission No: | `documents.batchReportCard.admissionNoText` |
| 290 | `jsx-text` | Class & Section: | `documents.batchReportCard.classSectionText` |
| 296 | `jsx-text` | Guardian: | `documents.batchReportCard.guardianText` |
| 300 | `jsx-text` | Attendance: | `documents.batchReportCard.attendanceText` |
| 302 | `jsx-child` | ${…}% (${…}/${…} Days) | `documents.batchReportCard.daysText` |
| 310 | `jsx-text` | Rank in Class ( | `documents.batchReportCard.rankClassText` |
| 310 | `jsx-text` | Pupils) | `documents.batchReportCard.pupilsText` |
| 318 | `jsx-text` | Subject | `documents.batchReportCard.subjectText` |
| 319 | `jsx-text` | Code | `documents.batchReportCard.codeText` |
| 320 | `jsx-text` | Max | `documents.batchReportCard.maxText` |
| 321 | `jsx-text` | Pass | `documents.batchReportCard.passText` |
| 322 | `jsx-text` | Obtained | `documents.batchReportCard.obtainedText` |
| 323 | `jsx-text` | Grade | `documents.batchReportCard.gradeText` |
| 324 | `jsx-text` | GP | `documents.batchReportCard.gpText` |
| 326 | `jsx-text` | Remarks | `documents.batchReportCard.remarksText` |
| 391 | `jsx-text` | Total Obtained | `documents.batchReportCard.totalObtainedText` |
| 397 | `jsx-text` | Overall Percentage | `documents.batchReportCard.overallPercentageText` |
| 408 | `jsx-text` | GPA / Point | `documents.batchReportCard.gpaPointText` |
| 412 | `jsx-text` | Final Result | `documents.batchReportCard.finalResultText` |
| 419 | `jsx-child` | PASSED | `documents.batchReportCard.passedText` |
| 419 | `jsx-child` | FAILED | `documents.batchReportCard.failedText` |
| 427 | `jsx-text` | Class Teacher Remarks | `documents.batchReportCard.classTeacherRemarksText` |
| 438 | `jsx-text` | Principal Observations | `documents.batchReportCard.principalObservationsText` |
| 452 | `jsx-text` | Class Teacher | `documents.batchReportCard.classTeacherText` |
| 456 | `jsx-text` | Controller of Examinations | `documents.batchReportCard.controllerExaminationsText` |
| 460 | `jsx-text` | Principal / Headmaster | `documents.batchReportCard.principalHeadmasterText` |

**`lib/pdf/marksheet-template.tsx`** — 31

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 211 | `prop:title` | Marksheet-${…}-${…} | `documents.marksheetTemplate.marksheetTitle` |
| 220 | `jsx-text` | Academic Progress Report ( | `documents.marksheetTemplate.academicProgressReportText` |
| 220 | `jsx-text` | Scale) — | `documents.marksheetTemplate.scaleText` |
| 228 | `jsx-text` | Student Name: | `documents.marksheetTemplate.studentNameText` |
| 232 | `jsx-text` | Student ID: | `documents.marksheetTemplate.studentIdText` |
| 236 | `jsx-text` | Class / Section: | `documents.marksheetTemplate.classSectionText` |
| 244 | `jsx-text` | Roll Number: | `documents.marksheetTemplate.rollNumberText` |
| 248 | `jsx-text` | Academic Year: | `documents.marksheetTemplate.academicYearText` |
| 252 | `jsx-text` | Date of Issue: | `documents.marksheetTemplate.dateIssueText` |
| 261 | `jsx-text` | Code | `documents.marksheetTemplate.codeText` |
| 262 | `jsx-text` | Subject Name | `documents.marksheetTemplate.subjectNameText` |
| 263 | `jsx-text` | Theory | `documents.marksheetTemplate.theoryText` |
| 264 | `jsx-text` | Prac/MCQ | `documents.marksheetTemplate.pracMcqText` |
| 265 | `jsx-text` | Internal | `documents.marksheetTemplate.internalText` |
| 266 | `jsx-text` | Board | `documents.marksheetTemplate.boardText` |
| 267 | `jsx-text` | Part-I | `documents.marksheetTemplate.partIText` |
| 268 | `jsx-text` | Part-II | `documents.marksheetTemplate.partIiText` |
| 269 | `jsx-text` | Obtained | `documents.marksheetTemplate.obtainedText` |
| 270 | `jsx-text` | Max | `documents.marksheetTemplate.maxText` |
| 271 | `jsx-text` | Grade | `documents.marksheetTemplate.gradeText` |
| 272 | `jsx-text` | Point | `documents.marksheetTemplate.pointText` |
| 286 | `jsx-child` | (4th Subject) | `documents.marksheetTemplate.4thSubjectText` |
| 318 | `jsx-text` | Total Marks: | `documents.marksheetTemplate.totalMarksText` |
| 325 | `jsx-text` | Grade Point Average (GPA): | `documents.marksheetTemplate.gradePointAverageGpaText` |
| 331 | `jsx-text` | 4th Subject Bonus Points: | `documents.marksheetTemplate.4thSubjectBonusPointsText` |
| 332 | `jsx-text` | GP | `documents.marksheetTemplate.gpText` |
| 337 | `jsx-text` | Merit Position: | `documents.marksheetTemplate.meritPositionText` |
| 357 | `jsx-child` | PASSED (${…}) | `documents.marksheetTemplate.passedText` |
| 367 | `jsx-text` | Class Teacher | `documents.marksheetTemplate.classTeacherText` |
| 371 | `jsx-text` | Controller of Examinations | `documents.marksheetTemplate.controllerExaminationsText` |
| 375 | `jsx-text` | Headmaster / Principal | `documents.marksheetTemplate.headmasterPrincipalText` |

**`lib/pdf-templates/library-slip.tsx`** — 25

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 171 | `jsx-text` | Official Library Circulation Slip | `documents.librarySlip.officialLibraryCirculationSlipText` |
| 187 | `jsx-text` | Slip # | `documents.librarySlip.slipText` |
| 194 | `jsx-text` | Borrower Profile | `documents.librarySlip.borrowerProfileText` |
| 197 | `jsx-text` | Borrower Name | `documents.librarySlip.borrowerNameText` |
| 202 | `jsx-child` | Roll / Student ID | `documents.librarySlip.rollStudentIdText` |
| 202 | `jsx-child` | Staff ID | `documents.librarySlip.staffIdText` |
| 207 | `jsx-text` | Borrower Type | `documents.librarySlip.borrowerTypeText` |
| 218 | `jsx-text` | Cataloged Item | `documents.librarySlip.catalogedItemText` |
| 221 | `jsx-text` | Book Title | `documents.librarySlip.bookTitleText` |
| 225 | `jsx-text` | Author | `documents.librarySlip.authorText` |
| 229 | `jsx-text` | Accession No | `documents.librarySlip.accessionNoText` |
| 233 | `jsx-text` | Shelf Location | `documents.librarySlip.shelfLocationText` |
| 237 | `jsx-text` | ISBN | `documents.librarySlip.isbnText` |
| 245 | `jsx-text` | Circulation Schedule | `documents.librarySlip.circulationScheduleText` |
| 248 | `jsx-text` | Issued Date | `documents.librarySlip.issuedDateText` |
| 252 | `jsx-text` | Due Date | `documents.librarySlip.dueDateText` |
| 259 | `jsx-child` | Returned Date | `documents.librarySlip.returnedDateText` |
| 259 | `jsx-child` | Accrued Overdue Fine | `documents.librarySlip.accruedOverdueFineText` |
| 271 | `jsx-child` | No Fines | `documents.librarySlip.noFinesText` |
| 280 | `jsx-text` | • Please return cataloged material on or before the due date to avoid re… | `documents.librarySlip.pleaseReturnCatalogedMaterialText` |
| 281 | `jsx-text` | • Lost or damaged books will be charged at the full replacement cost plu… | `documents.librarySlip.lostDamagedBooksWillText` |
| 289 | `jsx-text` | Borrower Signature | `documents.librarySlip.borrowerSignatureText` |
| 292 | `jsx-text` | Generated on | `documents.librarySlip.generatedText` |
| 292 | `jsx-text` | · Pathshala-Pro ERP | `documents.librarySlip.pathshalaProErpText` |
| 297 | `jsx-child` | Authorized Librarian | `documents.librarySlip.authorizedLibrarianText` |

**`lib/pdf-templates/hostel-manifest.tsx`** — 24

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 183 | `jsx-text` | Hostel Resident & Evacuation Manifest | `documents.hostelManifest.hostelResidentEvacuationManifestText` |
| 190 | `jsx-text` | Date: | `documents.hostelManifest.dateText` |
| 198 | `jsx-text` | Total Rooms | `documents.hostelManifest.totalRoomsText` |
| 199 | `jsx-text` | Rooms | `documents.hostelManifest.roomsText` |
| 202 | `jsx-text` | Total Beds | `documents.hostelManifest.totalBedsText` |
| 203 | `jsx-text` | Beds | `documents.hostelManifest.bedsText` |
| 206 | `jsx-text` | Allocated Residents | `documents.hostelManifest.allocatedResidentsText` |
| 207 | `jsx-text` | Students | `documents.hostelManifest.studentsText` |
| 210 | `jsx-text` | Occupancy Ratio | `documents.hostelManifest.occupancyRatioText` |
| 211 | `jsx-text` | % Occupied | `documents.hostelManifest.occupiedText` |
| 218 | `jsx-text` | Hostel Warden | `documents.hostelManifest.hostelWardenText` |
| 222 | `jsx-text` | Emergency Contact | `documents.hostelManifest.emergencyContactText` |
| 226 | `jsx-text` | Premises Address | `documents.hostelManifest.premisesAddressText` |
| 235 | `jsx-text` | Room / Bed | `documents.hostelManifest.roomBedText` |
| 236 | `jsx-text` | Roll No | `documents.hostelManifest.rollNoText` |
| 237 | `jsx-text` | Resident Name | `documents.hostelManifest.residentNameText` |
| 238 | `jsx-text` | Class & Section | `documents.hostelManifest.classSectionText` |
| 239 | `jsx-text` | Guardian Contact | `documents.hostelManifest.guardianContactText` |
| 240 | `jsx-text` | Roll Call | `documents.hostelManifest.rollCallText` |
| 246 | `jsx-text` | No students currently allocated to this hostel block. | `documents.hostelManifest.noStudentsCurrentlyAllocatedText` |
| 279 | `jsx-text` | Hostel Warden Signature | `documents.hostelManifest.hostelWardenSignatureText` |
| 282 | `jsx-text` | Generated on | `documents.hostelManifest.generatedText` |
| 282 | `jsx-text` | · Pathshala-Pro ERP | `documents.hostelManifest.pathshalaProErpText` |
| 286 | `jsx-text` | Principal / Campus Administrator | `documents.hostelManifest.principalCampusAdministratorText` |

**`lib/pdf-templates/mark-sheet.tsx`** — 24

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 256 | `jsx-text` | \| Email: | `documents.markSheet.emailText` |
| 260 | `jsx-text` | Mark Sheet | `documents.markSheet.markSheetText` |
| 270 | `jsx-text` | Student Name | `documents.markSheet.studentNameText` |
| 274 | `jsx-text` | Admission Number | `documents.markSheet.admissionNumberText` |
| 278 | `jsx-text` | Roll Number | `documents.markSheet.rollNumberText` |
| 282 | `jsx-text` | Class | `documents.markSheet.classText` |
| 286 | `jsx-text` | Date of Birth | `documents.markSheet.dateBirthText` |
| 290 | `jsx-text` | Guardian | `documents.markSheet.guardianText` |
| 300 | `jsx-text` | Code | `documents.markSheet.codeText` |
| 301 | `jsx-text` | Subject | `documents.markSheet.subjectText` |
| 302 | `jsx-text` | Max | `documents.markSheet.maxText` |
| 303 | `jsx-text` | Obt | `documents.markSheet.obtText` |
| 304 | `jsx-text` | Pass | `documents.markSheet.passText` |
| 305 | `jsx-text` | Grade | `documents.markSheet.gradeText` |
| 306 | `jsx-text` | Remarks | `documents.markSheet.remarksText` |
| 328 | `jsx-text` | TOTAL | `documents.markSheet.totalText` |
| 341 | `jsx-text` | Total Marks | `documents.markSheet.totalMarksText` |
| 345 | `jsx-text` | Percentage | `documents.markSheet.percentageText` |
| 349 | `jsx-text` | Result | `documents.markSheet.resultText` |
| 363 | `jsx-text` | Class Teacher | `documents.markSheet.classTeacherText` |
| 367 | `jsx-text` | Examination Controller | `documents.markSheet.examinationControllerText` |
| 371 | `jsx-text` | Principal | `documents.markSheet.principalText` |
| 377 | `jsx-text` | This is a computer-generated document. No signature is required for vali… | `documents.markSheet.thisComputerGeneratedText` |
| 382 | `jsx-text` | Grade Scale: A+ (90%+), A (80-89%), B (70-79%), C (60-69%), D (40-59%), … | `documents.markSheet.gradeScale90Text` |

**`lib/pdf-templates/transport-manifest.tsx`** — 21

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 191 | `prop:title` | Transport_Manifest_${…} | `documents.transportManifest.transportManifestTitle` |
| 198 | `jsx-text` | • Ph: | `documents.transportManifest.phText` |
| 202 | `jsx-text` | Driver Passenger Manifest | `documents.transportManifest.driverPassengerManifestText` |
| 203 | `jsx-text` | Date: | `documents.transportManifest.dateText` |
| 210 | `jsx-text` | Route Name | `documents.transportManifest.routeNameText` |
| 214 | `jsx-text` | Vehicle # | `documents.transportManifest.vehicleText` |
| 220 | `jsx-text` | Driver / Contact | `documents.transportManifest.driverContactText` |
| 226 | `jsx-text` | Occupancy | `documents.transportManifest.occupancyText` |
| 228 | `jsx-text` | Seats ( | `documents.transportManifest.seatsText` |
| 236 | `jsx-text` | Route Stops: | `documents.transportManifest.routeStopsText` |
| 248 | `jsx-text` | AM | `documents.transportManifest.amText` |
| 249 | `jsx-text` | PM | `documents.transportManifest.pmText` |
| 250 | `jsx-text` | Roll # | `documents.transportManifest.rollText` |
| 251 | `jsx-text` | Student Name | `documents.transportManifest.studentNameText` |
| 252 | `jsx-text` | Class | `documents.transportManifest.classText` |
| 253 | `jsx-text` | Designated Stop | `documents.transportManifest.designatedStopText` |
| 254 | `jsx-text` | Guardian / Emergency Contact | `documents.transportManifest.guardianEmergencyContactText` |
| 259 | `jsx-text` | No students currently allocated to this route | `documents.transportManifest.noStudentsCurrentlyAllocatedText` |
| 285 | `jsx-text` | Driver / Conductor Signature | `documents.transportManifest.driverConductorSignatureText` |
| 289 | `jsx-text` | Transport Manager | `documents.transportManifest.transportManagerText` |
| 293 | `jsx-text` | School Principal Stamp | `documents.transportManifest.schoolPrincipalStampText` |

**`lib/pdf/payslip-template.tsx`** — 19

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 185 | `prop:title` | Payslip-${…}-${…} | `documents.payslipTemplate.payslipTitle` |
| 194 | `jsx-text` | Salary Payslip for the Month of | `documents.payslipTemplate.salaryPayslipMonthText` |
| 202 | `jsx-text` | Employee Name: | `documents.payslipTemplate.employeeNameText` |
| 206 | `jsx-text` | Payslip No: | `documents.payslipTemplate.payslipNoText` |
| 212 | `jsx-text` | Employee ID: | `documents.payslipTemplate.employeeIdText` |
| 216 | `jsx-text` | Department: | `documents.payslipTemplate.departmentText` |
| 222 | `jsx-text` | Designation: | `documents.payslipTemplate.designationText` |
| 226 | `jsx-text` | Payable / Working Days: | `documents.payslipTemplate.payableWorkingDaysText` |
| 228 | `jsx-text` | Days | `documents.payslipTemplate.daysText` |
| 239 | `jsx-text` | Earnings | `documents.payslipTemplate.earningsText` |
| 240 | `jsx-text` | Amount ( | `documents.payslipTemplate.amountText` |
| 249 | `jsx-text` | Gross Earnings: | `documents.payslipTemplate.grossEarningsText` |
| 257 | `jsx-text` | Deductions | `documents.payslipTemplate.deductionsText` |
| 258 | `jsx-text` | Amount ( | `documents.payslipTemplate.amountText2` |
| 267 | `jsx-text` | Total Deductions: | `documents.payslipTemplate.totalDeductionsText` |
| 276 | `jsx-text` | Net Salary Disbursed: | `documents.payslipTemplate.netSalaryDisbursedText` |
| 282 | `jsx-text` | In Words: | `documents.payslipTemplate.inWordsText` |
| 290 | `jsx-text` | Employee Signature | `documents.payslipTemplate.employeeSignatureText` |
| 294 | `jsx-text` | Finance & Accounts / HR | `documents.payslipTemplate.financeAccountsHrText` |

**`lib/pdf-templates/fee-voucher.tsx`** — 18

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 197 | `jsx-text` | Voucher # | `documents.feeVoucher.voucherText` |
| 201 | `jsx-text` | Due Date | `documents.feeVoucher.dueDateText` |
| 209 | `jsx-text` | Student Name: | `documents.feeVoucher.studentNameText` |
| 213 | `jsx-text` | Student ID / Roll: | `documents.feeVoucher.studentIdRollText` |
| 215 | `jsx-text` | (Roll # | `documents.feeVoucher.rollText` |
| 219 | `jsx-text` | Class & Section: | `documents.feeVoucher.classSectionText` |
| 225 | `jsx-text` | Session / Period: | `documents.feeVoucher.sessionPeriodText` |
| 233 | `jsx-text` | Fee Particulars | `documents.feeVoucher.feeParticularsText` |
| 234 | `jsx-text` | Amount ( | `documents.feeVoucher.amountText` |
| 238 | `jsx-text` | Fee | `documents.feeVoucher.feeText` |
| 244 | `jsx-text` | Previous Unpaid Arrears | `documents.feeVoucher.previousUnpaidArrearsText` |
| 251 | `jsx-text` | Concession / Scholarship | `documents.feeVoucher.concessionScholarshipText` |
| 259 | `jsx-text` | NET PAYABLE: | `documents.feeVoucher.netPayableText` |
| 267 | `jsx-text` | * Payable at any authorized bank branch or digital payment portal before… | `documents.feeVoucher.payableAnyAuthorizedBankText` |
| 268 | `jsx-text` | * Surcharge applies after the due date. Fee once paid is non-refundable. | `documents.feeVoucher.surchargeAppliesAfterDueText` |
| 276 | `jsx-text` | Cashier / Bank Stamp | `documents.feeVoucher.cashierBankStampText` |
| 280 | `jsx-text` | Accounts Officer | `documents.feeVoucher.accountsOfficerText` |
| 289 | `prop:title` | Commercial 3-Part Fee Vouchers | `documents.feeVoucher.commercial3PartFeeVouchersTitle` |

**`lib/pdf/fee-challan-template.tsx`** — 16

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 195 | `jsx-text` | \| A/C: | `documents.feeChallanTemplate.aCText` |
| 202 | `jsx-text` | Challan No: | `documents.feeChallanTemplate.challanNoText` |
| 206 | `jsx-text` | Student: | `documents.feeChallanTemplate.studentText` |
| 210 | `jsx-text` | ID / Roll: | `documents.feeChallanTemplate.idRollText` |
| 216 | `jsx-text` | Class: | `documents.feeChallanTemplate.classText` |
| 222 | `jsx-text` | Period: | `documents.feeChallanTemplate.periodText` |
| 226 | `jsx-text` | Due Date: | `documents.feeChallanTemplate.dueDateText` |
| 236 | `jsx-text` | Fee Particulars | `documents.feeChallanTemplate.feeParticularsText` |
| 237 | `jsx-text` | Amount | `documents.feeChallanTemplate.amountText` |
| 250 | `jsx-text` | Subtotal: | `documents.feeChallanTemplate.subtotalText` |
| 255 | `jsx-text` | Concession / Waiver: | `documents.feeChallanTemplate.concessionWaiverText` |
| 263 | `jsx-text` | Late Surcharge: | `documents.feeChallanTemplate.lateSurchargeText` |
| 270 | `jsx-text` | Net Payable: | `documents.feeChallanTemplate.netPayableText` |
| 283 | `jsx-text` | Bank Officer | `documents.feeChallanTemplate.bankOfficerText` |
| 287 | `jsx-text` | Authorized Signatory | `documents.feeChallanTemplate.authorizedSignatoryText` |
| 296 | `prop:title` | Challan-${…}-${…} | `documents.feeChallanTemplate.challanTitle` |

**`lib/pdf-templates/fee-report.tsx`** — 16

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 46 | `prop:title` | Fee Collection Report | `documents.feeReport.feeCollectionReportTitle` |
| 47 | `prop:subtitle` | Collection, pending balance, and overdue analysis | `documents.feeReport.collectionPendingBalanceOverdueSubtitle` |
| 53 | `obj:label` | Total collected | `documents.feeReport.totalCollectedLabel` |
| 54 | `obj:label` | Pending | `documents.feeReport.pendingLabel` |
| 55 | `obj:label` | Overdue | `documents.feeReport.overdueLabel` |
| 56 | `obj:label` | Collection rate | `documents.feeReport.collectionRateLabel` |
| 59 | `obj:label` | Voucher No. | `documents.feeReport.voucherNoLabel` |
| 60 | `obj:label` | Student | `documents.feeReport.studentLabel` |
| 61 | `obj:label` | Class | `documents.feeReport.classLabel` |
| 62 | `obj:label` | Section | `documents.feeReport.sectionLabel` |
| 63 | `obj:label` | Total | `documents.feeReport.totalLabel` |
| 64 | `obj:label` | Paid | `documents.feeReport.paidLabel` |
| 65 | `obj:label` | Due | `documents.feeReport.dueLabel` |
| 66 | `obj:label` | Status | `documents.feeReport.statusLabel` |
| 67 | `obj:label` | Method | `documents.feeReport.methodLabel` |
| 68 | `obj:label` | Date | `documents.feeReport.dateLabel` |

**`lib/pdf-templates/student-report.tsx`** — 16

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 47 | `prop:title` | Student Enrollment Report | `documents.studentReport.studentEnrollmentReportTitle` |
| 48 | `prop:subtitle` | Student enrollment and demographic overview | `documents.studentReport.studentEnrollmentDemographicOverviewSubtitle` |
| 54 | `obj:label` | Total students | `documents.studentReport.totalStudentsLabel` |
| 55 | `obj:label` | Active students | `documents.studentReport.activeStudentsLabel` |
| 56 | `obj:label` | New admissions | `documents.studentReport.newAdmissionsLabel` |
| 58 | `obj:label` | Transferred / graduated | `documents.studentReport.transferredGraduatedLabel` |
| 64 | `obj:label` | Admission No. | `documents.studentReport.admissionNoLabel` |
| 65 | `obj:label` | Student | `documents.studentReport.studentLabel` |
| 66 | `obj:label` | Class | `documents.studentReport.classLabel` |
| 67 | `obj:label` | Section | `documents.studentReport.sectionLabel` |
| 68 | `obj:label` | Roll No. | `documents.studentReport.rollNoLabel` |
| 69 | `obj:label` | Gender | `documents.studentReport.genderLabel` |
| 70 | `obj:label` | Status | `documents.studentReport.statusLabel` |
| 71 | `obj:label` | Admission Date | `documents.studentReport.admissionDateLabel` |
| 72 | `obj:label` | Guardian | `documents.studentReport.guardianLabel` |
| 73 | `obj:label` | Contact | `documents.studentReport.contactLabel` |

**`lib/pdf-templates/attendance-report.tsx`** — 15

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 45 | `prop:title` | Attendance Analysis Report | `documents.attendanceReport.attendanceAnalysisReportTitle` |
| 46 | `prop:subtitle` | Attendance patterns and defaulter analysis | `documents.attendanceReport.attendancePatternsDefaulterAnalysisSubtitle` |
| 52 | `obj:label` | Average attendance | `documents.attendanceReport.averageAttendanceLabel` |
| 53 | `obj:label` | Present days | `documents.attendanceReport.presentDaysLabel` |
| 54 | `obj:label` | Absent days | `documents.attendanceReport.absentDaysLabel` |
| 55 | `obj:label` | Defaulters | `documents.attendanceReport.defaultersLabel` |
| 58 | `obj:label` | Roll No. | `documents.attendanceReport.rollNoLabel` |
| 59 | `obj:label` | Student | `documents.attendanceReport.studentLabel` |
| 60 | `obj:label` | Class | `documents.attendanceReport.classLabel` |
| 61 | `obj:label` | Section | `documents.attendanceReport.sectionLabel` |
| 62 | `obj:label` | Present | `documents.attendanceReport.presentLabel` |
| 63 | `obj:label` | Absent | `documents.attendanceReport.absentLabel` |
| 64 | `obj:label` | Total | `documents.attendanceReport.totalLabel` |
| 65 | `obj:label` | Attendance % | `documents.attendanceReport.attendanceLabel` |
| 66 | `obj:label` | Status | `documents.attendanceReport.statusLabel` |

**`lib/pdf-templates/exam-report.tsx`** — 15

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 46 | `prop:title` | Exam Performance Report | `documents.examReport.examPerformanceReportTitle` |
| 47 | `prop:subtitle` | Exam results and subject performance analysis | `documents.examReport.examResultsSubjectPerformanceSubtitle` |
| 53 | `obj:label` | Total exams | `documents.examReport.totalExamsLabel` |
| 54 | `obj:label` | Pass percentage | `documents.examReport.passPercentageLabel` |
| 55 | `obj:label` | Average marks | `documents.examReport.averageMarksLabel` |
| 56 | `obj:label` | Top performers | `documents.examReport.topPerformersLabel` |
| 59 | `obj:label` | Roll No. | `documents.examReport.rollNoLabel` |
| 60 | `obj:label` | Student | `documents.examReport.studentLabel` |
| 61 | `obj:label` | Class | `documents.examReport.classLabel` |
| 62 | `obj:label` | Section | `documents.examReport.sectionLabel` |
| 63 | `obj:label` | Exam | `documents.examReport.examLabel` |
| 64 | `obj:label` | Subject | `documents.examReport.subjectLabel` |
| 65 | `obj:label` | Marks | `documents.examReport.marksLabel` |
| 67 | `obj:label` | Grade | `documents.examReport.gradeLabel` |
| 68 | `obj:label` | Status | `documents.examReport.statusLabel` |

**`lib/pdf-templates/report-base.tsx`** — 13

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 271 | `jsx-text` | Period: | `documents.reportBase.periodText` |
| 272 | `jsx-text` | Generated: | `documents.reportBase.generatedText` |
| 277 | `jsx-text` | Report Summary | `documents.reportBase.reportSummaryText` |
| 280 | `jsx-text` | Report period | `documents.reportBase.reportPeriodText` |
| 284 | `jsx-text` | Generated at | `documents.reportBase.generatedText2` |
| 288 | `jsx-text` | Records | `documents.reportBase.recordsText` |
| 295 | `jsx-text` | Applied Filters | `documents.reportBase.appliedFiltersText` |
| 297 | `obj:label` | Filters | `documents.reportBase.filtersLabel` |
| 310 | `jsx-text` | Key Metrics | `documents.reportBase.keyMetricsText` |
| 329 | `jsx-text` | Detailed Records | `documents.reportBase.detailedRecordsText` |
| 368 | `jsx-text` | No data available for the selected filters. | `documents.reportBase.noDataAvailableText` |
| 376 | `jsx-text` | Notes | `documents.reportBase.notesText` |
| 387 | `jsx-text` | Computer-generated report | `documents.reportBase.computerGeneratedReportText` |

**`lib/pdf-templates/student-id-card.tsx`** — 12

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 352 | `jsx-text` | ID CARD | `documents.studentIdCard.idCardText` |
| 362 | `jsx-text` | Photo | `documents.studentIdCard.photoText` |
| 369 | `jsx-text` | Admission No: | `documents.studentIdCard.admissionNoText` |
| 374 | `jsx-text` | Roll Number: | `documents.studentIdCard.rollNumberText` |
| 379 | `jsx-text` | Class: | `documents.studentIdCard.classText` |
| 384 | `jsx-text` | Date of Birth: | `documents.studentIdCard.dateBirthText` |
| 390 | `jsx-text` | Blood Group: | `documents.studentIdCard.bloodGroupText` |
| 400 | `jsx-text` | Guardian: | `documents.studentIdCard.guardianText` |
| 404 | `jsx-text` | Contact: | `documents.studentIdCard.contactText` |
| 408 | `jsx-text` | Academic Year: | `documents.studentIdCard.academicYearText` |
| 415 | `jsx-text` | Principal Signature | `documents.studentIdCard.principalSignatureText` |
| 417 | `jsx-text` | QR | `documents.studentIdCard.qrText` |

**`lib/pdf/student-id-card-template.tsx`** — 10

| Line | Kind | Hardcoded string | Suggested key |
|---:|---|---|---|
| 160 | `jsx-text` | PHOTO | `documents.studentIdCardTemplate.photoText` |
| 168 | `jsx-text` | Student ID: | `documents.studentIdCardTemplate.studentIdText` |
| 174 | `jsx-text` | Class / Roll: | `documents.studentIdCardTemplate.classRollText` |
| 176 | `jsx-text` | \| Roll: | `documents.studentIdCardTemplate.rollText` |
| 181 | `jsx-text` | Blood Group: | `documents.studentIdCardTemplate.bloodGroupText` |
| 188 | `jsx-text` | Guardian: | `documents.studentIdCardTemplate.guardianText` |
| 192 | `jsx-text` | Contact: | `documents.studentIdCardTemplate.contactText` |
| 200 | `jsx-text` | Valid Until: | `documents.studentIdCardTemplate.validUntilText` |
| 202 | `jsx-text` | Principal Signature | `documents.studentIdCardTemplate.principalSignatureText` |
| 210 | `prop:title` | Student-ID-Cards | `documents.studentIdCardTemplate.studentIdCardsTitle` |

---

## Methodology & caveats

**Detected as violations**
- JSX text nodes rendered to the screen
- String literals passed to user-facing props: `alt`, `aria-label`, `ariaLabel`, `body`, `cancelText`, `caption`, `columnLabel`, `confirmText`, `content`, `description`, `displayName`, `emptyMessage`, `emptyTitle`, `errorMessage`, `footer`, `header`, `heading`, `helperText`, `hint`, `info`, `label`, `legend`, `message`, `note`, `placeholder`, `prompt`, `subtitle`, `successMessage`, `summary`, `text`, `title`, `tooltip`, `tooltipText`
- Template literals used for display (interpolations shown as `${…}`)
- Notification text (`toast.success/error/...`) and native `alert` / `confirm` / `prompt`
- Object literals feeding tables and dropdowns (`header:`, `label:`, `title:`, …)

**Deliberately excluded**
- Translation keys and any argument to `t()` / `useTranslations()`
- CSS classes, Tailwind tokens, `<style>` / `<script>` block contents, colour values
- Routes, URLs, API endpoints, import specifiers, IDs, enum values, technical identifiers
- Operands of comparisons and switch cases (e.g. `status === "ACTIVE"`)
- Console/log messages, `new Error(...)` messages, Zod schema messages under `src/lib`
- Test fixtures and `*.test.*` / `*.spec.*` files
- Non-UI modules under `src/lib` (except PDF/Excel templates, reported separately)

**Known limitations**
- Screen attribution is derived from the static import graph. A component used by exactly one page is listed under that page. Where a component is used by several pages, it falls back to its domain folder (`components/students/*` → `/students`); only genuinely generic components stay in *cross-screen*.
- Components reached only via dynamic `import()` or string-based references are grouped as *cross-screen*. Each is reported once (no double-counting) with its consumer screens listed.
- Suggested keys are deterministic and de-duplicated, but a translator should still review naming against the existing 54 namespaces in `src/messages/en.json`.
- Some rendered values are enum-like but still visible (e.g. `<option value="LOGIN">LOGIN</option>`); these are reported — they are genuine user-facing text even though the underlying value is an enum.
