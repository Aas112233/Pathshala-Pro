import type { Page } from "playwright";
import { JevClient } from "./lib/jev-client";
import { ensureAuthed, launchAuthedPage, parseSharedArgs, requireCreds } from "./lib/playwright-shared";

// Year-long staff payroll automation: for each month of the payroll year,
// generate bulk payroll then (with --pay) disburse every PENDING ledger.
//
// Jev boundaries (never amounts — server owns all money math):
//   - academic year (from live open-year list), department scope, pay method.
// Months loop Jan-Dec deterministically; deductions/advances stay 0 so the
// server's LOP -> PF -> Tax -> Loan cascade (salary-payslip.ts) computes.
// Reruns are safe: months fully PAID are skipped via pre-check.
//
// Usage:
//   APP_URL=... ADMIN_PASSWORD=... TENANT_SLUG=... AI_GATEWAY_API_KEY=... \
//   npx tsx scripts/playwright-salary-automation.ts [--year=2026] [--months=1-12]
//     [--department=Teaching] [--pay] [--dry-run]
//
// Flags: --year (default current), --months "1-12" range or "3,4,5" list,
//   --department pin, --pay to disburse, --dry-run fills first month, no submit.

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SCREENSHOT = "C:\\Users\\mhass\\AppData\\Local\\Temp\\opencode\\salary-automation.png";

interface Option {
  value: string;
  label: string;
}

async function apiGet(page: Page, baseUrl: string, path: string): Promise<any[]> {
  let lastErr = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    let result: { status: number; text: string };
    try {
      result = await page.evaluate(async (url: string) => {
        try {
          const res = await fetch(url, { credentials: "include" });
          return { status: res.status, text: await res.text() };
        } catch (e: any) {
          return { status: 0, text: `fetch failed: ${e?.message ?? e}` };
        }
      }, `${baseUrl}${path}`);
    } catch (e: any) {
      lastErr = e?.message ?? String(e);
      await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1500);
      continue;
    }
    if (result.status >= 200 && result.status < 300) {
      try {
        const json = JSON.parse(result.text);
        const data = Array.isArray(json) ? json : (json as any).data;
        if (Array.isArray(data)) return data;
      } catch {
        // fall through
      }
    }
    throw new Error(`GET ${path} -> HTTP ${result.status}: ${result.text.slice(0, 200)}`);
  }
  throw new Error(`GET ${path} -> evaluate kept failing (last: ${lastErr.slice(0, 160)})`);
}

function toCriteria(options: Option[], cap = 12): { criteria: Record<string, string>; byKey: Map<string, Option> } {
  const criteria: Record<string, string> = {};
  const byKey = new Map<string, Option>();
  for (const opt of options.slice(0, cap)) {
    let key = opt.label;
    let n = 2;
    while (byKey.has(key)) key = `${opt.label} (${n++})`;
    criteria[key] = opt.label;
    byKey.set(key, opt);
  }
  return { criteria, byKey };
}

// AppDropdown inside the TopSheet dialog, trigger addressed by its id
// (#academicYearId, #month, #paymentMethod). Portal renders to body.
async function selectDialogDropdown(dialog: any, page: Page, triggerId: string, label: string) {
  const trigger = dialog.locator(`#${triggerId}`);
  await trigger.waitFor({ state: "visible", timeout: 15000 });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const optionsBox = page.locator("div.max-h-56");
  try {
    await optionsBox.waitFor({ state: "visible", timeout: 8000 });
  } catch {
    await page.screenshot({ path: SCREENSHOT });
    throw new Error(`Dropdown #${triggerId} portal did not open for "${label}" (screenshot saved)`);
  }
  const portal = optionsBox.locator("xpath=..");
  const searchBox = portal.locator("input").first();
  const option = optionsBox.locator("button", { hasText: label }).first();
  if (await searchBox.isVisible()) {
    const token = label.split(/\s+/).slice(0, 2).join(" ");
    await searchBox.fill(token);
    await page.waitForTimeout(500);
    if ((await option.count()) === 0) {
      await searchBox.fill("");
      await page.waitForTimeout(500);
    }
  }
  const visibleCount = await optionsBox.locator("button").count();
  console.log(`    -> #${triggerId}: ${visibleCount} option(s), picking "${label}"`);
  await option.waitFor({ state: "visible", timeout: 12000 });
  await option.click();
  await page.waitForTimeout(800);
}

// Salary list filters bar: month(0), year(1) AppDropdowns in DOM order.
// Scopes the table BEFORE name-matching rows, so a matched row is
// guaranteed to be this month's ledger (never another month's same name).
async function setSalaryFilters(page: Page, monthName: string, yearStr: string) {
  const bar = page.locator("div.bg-card.p-4.shadow-sm", { has: page.locator("div.w-[120px]") }).first();
  await bar.waitFor({ state: "visible", timeout: 15000 });
  const triggers = bar.locator("div.relative > button.w-full");
  await triggers.nth(0).click();
  let box = page.locator("div.max-h-56");
  await box.waitFor({ state: "visible", timeout: 8000 });
  await box.locator("button", { hasText: monthName }).first().click();
  await page.waitForTimeout(1200); // table reload
  await triggers.nth(1).click();
  box = page.locator("div.max-h-56");
  await box.waitFor({ state: "visible", timeout: 8000 });
  const yearOpt = box.locator("button", { hasText: yearStr }).first();
  if ((await yearOpt.count()) > 0) {
    await yearOpt.click();
    await page.waitForTimeout(1500); // table reload
  } else {
    await page.keyboard.press("Escape");
    console.log(`    -> Year filter "${yearStr}" not listed, leaving year unfiltered`);
  }
  console.log(`    -> Table filtered: ${monthName} ${yearStr}`);
}

function parseMonths(arg: string | undefined): number[] {
  if (!arg || arg === "all") return Array.from({ length: 12 }, (_, i) => i + 1);
  const out = new Set<number>();
  for (const part of arg.split(",")) {
    const range = part.trim().split("-").map(Number);
    if (range.length === 2 && range.every((n) => n >= 1 && n <= 12)) {
      for (let m = range[0]; m <= range[1]; m++) out.add(m);
    } else if (range.length === 1 && range[0] >= 1 && range[0] <= 12) {
      out.add(range[0]);
    }
  }
  if (out.size === 0) throw new Error(`Bad --months="${arg}". Use 1-12, "1-6", or "1,3,6".`);
  return [...out].sort((a, b) => a - b);
}

async function main() {
  const cfg = parseSharedArgs();
  requireCreds(cfg);
  const yearArg = process.argv.find((a) => a.startsWith("--year="))?.split("=")[1];
  const payrollYear = yearArg ? parseInt(yearArg, 10) : new Date().getFullYear();
  const monthsArg = process.argv.find((a) => a.startsWith("--months="))?.split("=")[1];
  const months = parseMonths(monthsArg);
  const deptArg = process.argv.find((a) => a.startsWith("--department="))?.split("=")[1];
  const doPay = process.argv.includes("--pay");
  const dryRun = process.argv.includes("--dry-run");
  const jev = new JevClient(process.env.AI_GATEWAY_API_KEY || "");
  const tenantNote = cfg.tenantSlug ? `Tenant: ${cfg.tenantSlug}, ` : "";

  const { browser, page } = await launchAuthedPage(cfg);
  const failures: Array<{ month: number; step: string; error: string }> = [];
  let generated = 0;
  let disbursed = 0;
  try {
    // Ground data: open academic years + active staff (departments derived)
    const years = (await apiGet(page, cfg.baseUrl, "/api/academic-years?limit=100"))
      .filter((y: any) => !y.isClosed)
      .map((y: any) => ({ value: String(y.id), label: String(y.label ?? y.name ?? y.id) }));
    if (years.length === 0) throw new Error("No open academic years found");
    const yearC = toCriteria(years);
    const yearPick = await jev.choose({
      state: `${tenantNote}Year-long payroll ${payrollYear}. Open years: ${years.map((y) => y.label).join(", ")}`,
      instructions: "Which academic year should the payroll run use?",
      criteria: yearC.criteria,
    });
    const acadYear = yearC.byKey.get(yearPick.choice) ?? years[0];
    console.log(`Jev academic year: ${acadYear.label} [${yearPick.source}]`);

    const staff = (await apiGet(page, cfg.baseUrl, "/api/staff?limit=100&isActive=true"))
      .filter((s: any) => s.isActive !== false)
      .map((s: any) => ({
        id: String(s.id ?? s.staffId ?? ""),
        name: `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim(),
        department: String(s.department ?? ""),
      }));
    const departments = [...new Set(staff.map((s) => s.department).filter(Boolean))];
    console.log(`Staff pool: ${staff.length} active (${departments.join(", ") || "no departments"})`);

    let scopeDept: string | null = null;
    if (deptArg) {
      const hit = departments.find((d) => d.toLowerCase().includes(deptArg.toLowerCase()));
      if (!hit) throw new Error(`No department matching "${deptArg}". Available: ${departments.join(", ")}`);
      scopeDept = hit;
      console.log(`Pinned department: ${scopeDept} (--department flag)`);
    } else if (departments.length > 1) {
      const scopeC = toCriteria([
        { value: "__ALL__", label: "All departments" },
        ...departments.map((d) => ({ value: d, label: d })),
      ]);
      const scopePick = await jev.choose({
        state: `${tenantNote}Payroll ${payrollYear} covers: ${departments.join(", ")}`,
        instructions: "Should payroll cover all departments or one?",
        criteria: scopeC.criteria,
      });
      const chosen = scopeC.byKey.get(scopePick.choice);
      scopeDept = chosen && chosen.value !== "__ALL__" ? chosen.value : null;
      console.log(`Jev staff scope: ${scopeDept ?? "All departments"} [${scopePick.source}]`);
    }

    let payMethod = "CASH";
    if (doPay) {
      const methodPick = await jev.choose({
        state: `${tenantNote}Disburse ${payrollYear} salary ledgers`,
        instructions: "Which payment method should disbursement use?",
        criteria: {
          CASH: "Cash at counter",
          DIGITAL: "Digital / mobile payment",
          BANK_TRANSFER: "Bank transfer",
        },
      });
      payMethod = methodPick.choice;
      console.log(`Jev pay method: ${payMethod} [${methodPick.source}]`);
    } else {
      console.log("Generate-only mode (no --pay): ledgers will stay PENDING");
    }

    const startTime = Date.now();
    for (const month of months) {
      const mLabel = `${MONTH_NAMES[month - 1]} ${payrollYear}`;
      await ensureAuthed(page, cfg, `${mLabel} start`);
      try {
        // Pre-check: skip months already fully PAID (rerun-safe)
        const existing = await apiGet(page, cfg.baseUrl, `/api/salary?month=${month}&year=${payrollYear}&limit=100`);
        const mine = existing.filter((r: any) => Number(r.month) === month && Number(r.year) === payrollYear);
        const unpaid = mine.filter((r: any) => String(r.status).toUpperCase() !== "PAID");
        if (mine.length > 0 && unpaid.length === 0) {
          console.log(`\n>>> ${mLabel}: SKIP — ${mine.length} ledger(s) already PAID`);
          continue;
        }
        console.log(`\n>>> ${mLabel}: ${mine.length > 0 ? `${unpaid.length} unpaid ledger(s) found, regenerating` : "fresh month"}`);

        // Open bulk payroll modal
        await page.goto(`${cfg.baseUrl}/salary`, { waitUntil: "networkidle" });
        const bulkBtn = page.getByRole("button", { name: /bulk payroll/i }).first();
        await bulkBtn.waitFor({ state: "visible", timeout: 15000 });
        await bulkBtn.click();
        const dialog = page.locator("[role='dialog']");
        await dialog.waitFor({ state: "visible", timeout: 10000 });

        await selectDialogDropdown(dialog, page, "academicYearId", acadYear.label);
        await selectDialogDropdown(dialog, page, "month", MONTH_NAMES[month - 1]);
        const yearInput = dialog.locator("#year");
        await yearInput.fill(String(payrollYear));

        // Staff scope: default all pre-selected; pin department via checkboxes
        if (scopeDept) {
          const selectAll = dialog.locator("thead").getByRole("checkbox");
          if ((await selectAll.count()) > 0) {
            const state = await selectAll.first().getAttribute("data-state");
            if (state === "checked") await selectAll.first().click();
          }
          const rows = dialog.locator("tbody tr");
          const rowCount = await rows.count();
          let checked = 0;
          for (let i = 0; i < rowCount; i++) {
            const deptCell = await rows.nth(i).locator("td").nth(3).innerText().catch(() => "");
            if (deptCell.trim().toLowerCase() === scopeDept.toLowerCase()) {
              await rows.nth(i).getByRole("checkbox").click();
              checked++;
            }
          }
          console.log(`    -> Department scope "${scopeDept}": ${checked}/${rowCount} rows checked`);
          if (checked === 0) throw new Error(`No rows matched department "${scopeDept}"`);
        }

        if (dryRun) {
          console.log(`[dry-run] ${mLabel} filled, NOT submitting. Review in browser.`);
          await page.waitForTimeout(15000);
          return;
        }

        // Skip staff that already have a ledger this month: the server
        // rejects the WHOLE batch on any duplicate, so uncheck those rows
        // and submit only the missing ones. Pre-existing PENDING ledgers
        // still get disbursed in the pay phase below.
        const existingIds = new Set(
          mine.map((r: any) => String(r.staffProfileId ?? r.staffProfile?.id ?? "")).filter(Boolean)
        );
        if (existingIds.size > 0) {
          const nameById = new Map(staff.map((s) => [s.id, s.name] as [string, string]));
          let unchecked = 0;
          for (const id of existingIds) {
            const nm = nameById.get(id);
            if (!nm) continue;
            const box = dialog.getByRole("checkbox", { name: `Select ${nm}` });
            if ((await box.count()) > 0) {
              const state = await box.first().getAttribute("data-state");
              if (state === "checked") {
                await box.first().click();
                unchecked++;
              }
            }
          }
          console.log(`    -> Unchecked ${unchecked} already-processed staff row(s)`);
        }

        // Submit bulk payroll (server computes LOP/PF/Tax/Loan; deductions left 0).
        // The footer button names the fresh count: "Process for (N)".
        const submitBtn = dialog.locator('button[form="bulk-payroll-form"]');
        const submitText = await submitBtn.innerText().catch(() => "");
        const freshCount = Number(submitText.match(/(\d+)/)?.[1] ?? "0");
        if (freshCount === 0) {
          console.log(`    -> Nothing new to generate (all ${mine.length} ledger(s) exist); closing modal`);
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "hidden", timeout: 15000 }).catch(() => {});
        } else {
          await submitBtn.click();
          await dialog.waitFor({ state: "hidden", timeout: 120000 });
          generated++;
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          console.log(`>>> ${mLabel}: payroll generated for ${freshCount} staff (elapsed: ${elapsed}s)`);
        }

        // Disburse PENDING ledgers of this month (amount prefilled = outstanding)
        if (doPay) {
          const ledgers = (await apiGet(page, cfg.baseUrl, `/api/salary?month=${month}&year=${payrollYear}&limit=100`))
            .filter((r: any) => Number(r.month) === month && Number(r.year) === payrollYear)
            .filter((r: any) => String(r.status).toUpperCase() !== "PAID");
          console.log(`    -> Disbursing ${ledgers.length} ledger(s) via ${payMethod}...`);
          await page.goto(`${cfg.baseUrl}/salary`, { waitUntil: "networkidle" });
          await setSalaryFilters(page, MONTH_NAMES[month - 1], String(payrollYear));
          for (const ledger of ledgers) {
            const staffName = `${ledger.staffProfile?.firstName ?? ""} ${ledger.staffProfile?.lastName ?? ""}`.trim();
            try {
              await ensureAuthed(page, cfg, `pay ${staffName}`);
              const searchBox = page.locator("main input[placeholder]").first();
              if ((await searchBox.count()) > 0 && staffName) {
                await searchBox.fill(staffName);
                await page.waitForTimeout(1200);
              }
              const row = staffName
                ? page.locator("main tbody tr", { hasText: staffName }).first()
                : page.locator("main tbody tr").first();
              await row.waitFor({ state: "visible", timeout: 10000 });
              await row.locator("button").last().click(); // row actions menu
              const payItem = page.locator("button.text-green-600").first();
              await payItem.waitFor({ state: "visible", timeout: 8000 });
              await payItem.click();
              const payDialog = page.locator("[role='dialog']");
              await payDialog.waitFor({ state: "visible", timeout: 10000 });
              const amountVal = await payDialog.locator("#paidAmount").inputValue().catch(() => "0");
              if (Number(amountVal) <= 0) {
                console.log(`    -> SKIP ${staffName}: outstanding is ${amountVal}`);
                await page.keyboard.press("Escape");
                continue;
              }
              await selectDialogDropdown(payDialog, page, "paymentMethod", payMethod);
              const paySubmit = payDialog.locator('button[form="payment-form"]');
              await paySubmit.click();
              await payDialog.waitFor({ state: "hidden", timeout: 60000 });
              disbursed++;
              console.log(`    -> Paid ${staffName}: ${amountVal} via ${payMethod}`);
            } catch (e: any) {
              failures.push({ month, step: `pay ${staffName || ledger.id}`, error: e?.message ?? String(e) });
              console.warn(`    -> PAY FAILED ${staffName}: ${e?.message}`);
              await page.screenshot({ path: SCREENSHOT }).catch(() => {});
            }
          }
        }
      } catch (e: any) {
        failures.push({ month, step: "bulk generate", error: e?.message ?? String(e) });
        console.warn(`>>> ${mLabel}: FAILED — ${e?.message}`);
        await page.screenshot({ path: SCREENSHOT }).catch(() => {});
      }
    }

    const totalSec = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`\n>>> PAYROLL YEAR COMPLETE: ${generated} month(s) generated, ${disbursed} ledger(s) disbursed, ${failures.length} failure(s) in ${totalSec}s`);
    for (const f of failures) console.log(`  !! month=${f.month} step=${f.step}: ${f.error.slice(0, 160)}`);
    if (failures.length > 0) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("Salary automation failed:", e?.message);
  process.exit(1);
});
