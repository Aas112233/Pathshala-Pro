# Enhance the Onboarding Wizard

## Objective

Expand the one-time tenant onboarding wizard so a school can, before launch:
1. Pick from more education-system templates (country-specific).
2. **Edit** the resulting academic structure — classes, sections, groups, subjects — instead of accepting a template verbatim.
3. See/confirm the **accounting & finance auto-setup** (chart of accounts, fee heads, fiscal calendar) and set default per-class fee structures.
4. Keep the wizard lean: structural + defaults only, no transactional data.

Current state (verified):
- Wizard is 5 steps: Profile → Localization → Academics (template picker only) → Admin → Review. Lives in `src/app/(auth)/onboarding/page.tsx`.
- Backend `POST /api/tenants` (`src/app/api/tenants/route.ts`) provisions everything in one atomic `$transaction`: tenant, admin user, academic year, classes/sections/subjects/class-subjects from `getClassTemplateDefinitions`, promotion rules, chart of accounts, fee heads, fiscal calendar, voucher sequences.
- Templates live in `src/lib/onboarding-templates.ts` (`TemplateClassDef`). The `Group` model exists in the schema (`src/prisma/schema.prisma:853`) but is **never seeded** during onboarding.
- `Class` has `@@unique([tenantId, classId])` and `@@unique([tenantId, classNumber])`; `Section` has `groupId?`; `Group.subjects` is `String[]`.
- Input schema is `onboardInstituteSchema` (`src/lib/schemas.ts:383`) — has no custom academic-structure fields.

## Design Principles

- **Templates are starting points, not final states.** After picking a template, the user can edit the generated structure in a designer step.
- **Server-authoritative provisioning.** The client only sends a normalized structure; the server validates and writes it inside the existing atomic transaction. No client-side reliance for integrity.
- **Reuse the existing provisioning layer** (`tenant-provisioning.ts`, `onboarding-templates.ts`). Do not build a parallel setup path.
- **Keep i18n parity** — all new wizard strings added to all 4 locale files.
- **Keep the double-entry + tenant-scoping invariants intact.** Any fee-structure defaults must flow through the existing fee/structure models with `tenantId` scoping.

---

## Task 1 — Extend the input schema (server contract)

**File:** `src/lib/schemas.ts`

Add an optional `academicStructure` field to `onboardInstituteSchema`:

```ts
academicStructure: z
  .array(
    z.object({
      name: z.string().min(1),
      code: z.string().min(1).max(16),       // must be unique within tenant
      sequence: z.number().int().positive(), // drives @@unique([tenantId, classNumber])
      sections: z.array(z.string().min(1)),
      groups: z
        .array(
          z.object({
            name: z.string().min(1),
            shortName: z.string().min(1),
            subjects: z.array(z.string().min(1)).default([]), // subject codes
          })
        )
        .default([]),
      subjects: z.array(
        z.object({
          name: z.string().min(1),
          code: z.string().min(1),
          type: z.enum(["THEORY", "PRACTICAL", "BOTH"]).default("THEORY"),
          totalMarks: z.number().int().positive().optional(),
          passMarks: z.number().int().nonnegative().optional(),
        })
      ),
    })
  )
  .optional(),
```

Also add optional finance-defaults fields:
```ts
fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
feeStructures: z
  .array(
    z.object({
      classCode: z.string().min(1),
      tuitionFee: z.number().nonnegative(),
      admissionFee: z.number().nonnegative().default(0),
      // other heads
    })
  )
  .optional(),
```

Server-side validation to add in the route (not the schema, or as refinements): enforce `@@unique([tenantId, classNumber])` — i.e. sequences must be unique — and `@@unique([tenantId, classId])` — codes must be unique. Return a clear 400 listing the offending class if violated.

---

## Task 2 — Provisioning helper: build structure from template + overrides

**File:** new `src/lib/onboarding-structure.ts` (or extend `tenant-provisioning.ts`)

Create a pure function:

```ts
export function resolveAcademicStructure(
  template: ClassTemplatePreset,
  override?: OnboardAcademicStructureInput[]
): TemplateClassDef[]
```

- If `override` is provided and non-empty → use it (normalize into `TemplateClassDef[]`).
- Else → return `getClassTemplateDefinitions(template)`.

Also add `seedTenantGroups(tx, tenantId, classes, groupsByClassCode)` in `tenant-provisioning.ts` to create `Group` rows and link sections to groups via `Section.groupId`. Map `Group.subjects` (String[] of subject codes) from the resolved subject rows.

This keeps the atomic transaction readable and testable in isolation (pure builder + seeder).

---

## Task 3 — Add more templates

**File:** `src/lib/onboarding-templates.ts` + `src/lib/schemas.ts` (`CLASS_TEMPLATE_PRESETS`) + locale files (`onboarding.templates.*`)

Add country/board-specific presets with accurate subject/section data:
- Existing: PK FBISE Matric/Inter, IN CBSE, BD NCTB, PRIMARY_1_5, MIDDLE_6_8, SECONDARY_9_10, HIGHER_SEC_11_12, O/A Levels, Madrasa, K_12, CUSTOM.
- New candidates (keep scope moderate, data-driven): **Cambridge (IGCSE)** as its own preset (distinct from generic O/A), **IB PYP/MYP/DP**, **PK Punjab Board (9-10)**, **UK Primary (EYFS–KS2)**.

Each template defines its `TemplateClassDef[]`; the wizard derives section/group/subject chips from it. Update the 4 locale message files for any new template label/description/count keys, and run the i18n parity test.

---

## Task 4 — Wizard UI: add an "Academic Structure" designer step

**File:** `src/app/(auth)/onboarding/page.tsx`

Insert a new step (between Academics and Admin) — "Academic Structure". Behavior:
- On entering, snapshot the resolved structure from the chosen template into local state (`structure: TemplateClassDef[]`).
- Per class card, allow:
  - Edit class name / code / sequence.
  - Add/remove **sections** (chips with inputs).
  - Add/remove **groups** (name, shortName, subjects selected from the class's subject list).
  - Add/remove **subjects** (name, code, type, marks).
- Validate unique codes and unique sequences client-side before allowing Next, mirroring server rules.
- A "Reset to template" action per step to undo edits.
- The "CUSTOM" template starts from an empty structure with an "Add class" affordance.

Keep the component modular: extract a `AcademicStructureDesigner` component (`src/components/onboarding/academic-structure-designer.tsx`) rather than bloating the page, but keep state lifted to the page so the Review step and the submit payload share it.

Update the wizard stepper header to show the new step; add its icon/label to the array.

---

## Task 5 — Wizard UI: accounting & finance confirm/setup step

**File:** `src/app/(auth)/onboarding/page.tsx` + `src/components/onboarding/accounting-setup.tsx`

Add an "Accounting & Finance" step that:
- Shows a read-only summary of what will be auto-provisioned: chart of accounts (5 tiers), fee heads, fiscal calendar, voucher sequences — with the confidence that these come from `tenant-provisioning.ts`.
- Lets the user set **fiscal year start month** and, optionally, default **per-class fee amounts** (tuition/admission/transport/etc.) which will seed `ClassFeeStructure` rows for each class.

Add the backend support (Task 1 fields + provisioning):
- Pass `fiscalYearStartMonth` through to the existing `seedTenantFiscalCalendar` call (currently hardcoded to 7 or 4 by currency).
- After class creation, seed `ClassFeeStructure` rows from `feeStructures` (only for provided class codes), still `tenantId`-scoped.

---

## Task 6 — Backend route wiring

**File:** `src/app/api/tenants/route.ts`

Inside the existing `$transaction`:
1. Replace `getClassTemplateDefinitions(data.classTemplate)` with `resolveAcademicStructure(data.classTemplate, data.academicStructure)`.
2. Keep subject-dedup logic, but subject rows now come from the resolved structure.
3. After creating classes/sections/subjects, call `seedTenantGroups(...)` and link `Section.groupId`.
4. Pass `data.fiscalYearStartMonth` to `seedTenantFiscalCalendar`.
5. After classes are created, seed `ClassFeeStructure` from `data.feeStructures` (skip codes not created).
6. Extend the success payload's `seededStats` to include `groups` and `feeStructures` counts.

All inside the same transaction — any invalid override rolls back atomically, preserving the current reliability model.

---

## Task 7 — i18n

**Files:** `src/messages/en.json`, `ur.json`, `hi.json`, `bn.json`

Add keys for: the new stepper step labels, the designer UI (add/edit/remove class/section/group/subject, validation messages), the accounting-setup summary labels, and any new template metadata. Match all `{variable}` interpolation placeholders across the 4 files. Run the i18n parity/interpolation test (part of `npm run test:all`).

---

## Task 8 — Tests

- **Unit (pure logic):** `src/lib/onboarding-structure.test.ts` — `resolveAcademicStructure` returns template when no override, and merges/normalizes an override (unique codes/sequences enforced).
- **Unit (provisioning):** extend `tenant-provisioning` tests to cover `seedTenantGroups` (creates groups, links sections, maps subject codes).
- **Schema:** add a test asserting `onboardInstituteSchema` accepts a valid `academicStructure` and rejects duplicate class codes/sequences.
- **i18n:** the existing parity test must pass with the new keys.

Run `npm run test:all` (strict `tsc` + full vitest suite) before declaring complete.

---

## Verification Path

1. `npx tsc --noEmit` — 100% type safety.
2. `npm run test:all` — all suites green, including i18n parity and the new structure/provisioning tests.
3. Manual smoke via the wizard:
   - Pick a template, edit sections/groups/subjects, launch → login as the created admin, confirm classes/sections/groups/subjects and fee structures exist and are `tenantId`-scoped.
   - Pick "CUSTOM", add classes from scratch, launch → structure created from scratch.
   - Confirm chart of accounts / fee heads / fiscal calendar are seeded for the new tenant (accounting modules usable immediately).
4. Confirm the double-entry + tenant-scoping invariants still hold (no balances created at onboarding; only structure + defaults).

## Scope Guardrails

- Do NOT add transactional data (students, staff, fee vouchers, payroll) to onboarding.
- Do NOT build a parallel provisioning path — extend `tenant-provisioning.ts`.
- Keep the wizard focused: structure + accounting defaults, not full CRUD.
- All strings localized in all 4 locales; no hardcoded UI text.
