import type { Page } from "playwright";
import { JevClient } from "./lib/jev-client";
import { ensureAuthed, launchAuthedPage, parseSharedArgs, requireCreds } from "./lib/playwright-shared";

// Bulk fee collection automation (/fees/bulk): per class x month,
// select class + target month + method, click Auto Fill Month, submit.
// Amounts are NEVER invented: auto-fill derives each row from the class fee
// structure + concessions + remainingDue, and already-paid rows self-exclude
// (isRowSelectable + toggle guards). Server POSTs to /api/fees/bulk-collect.
//
// Usage:
//   APP_URL=... ADMIN_PASSWORD=... TENANT_SLUG=... AI_GATEWAY_API_KEY=... \
//   npx tsx scripts/playwright-fees-bulk-automation.ts [--class="Class 1"]
//     [--months=1-12] [--method=CASH] [--random] [--dry-run]
//
// Flags: --class pin (else Jev rotation), --months "1-12" range or "1,3" list,
//   --method pin (else Jev picks once per run), --random varied partial
//   amounts within each row's remaining due, --dry-run fills, no submit.

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SCREENSHOT = "C:\\Users\\mhass\\AppData\\Local\\Temp\\opencode\\fees-bulk-automation.png";

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

async function apiList(page: Page, baseUrl: string, path: string): Promise<any[]> {
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

  // Filter-card scope: the grid with class/section/month/method dropdowns.
  // The header has no such grid, so its switchers are never touched.
const FILTER_SCOPE = "div.grid.gap-3";
const TRIGGER_SEL = `${FILTER_SCOPE} div.relative > button.w-full`;

async function selectFilterByOrder(page: Page, order: number, label: string) {
  const triggers = page.locator(TRIGGER_SEL);
  await triggers.nth(order).waitFor({ state: "visible", timeout: 15000 });
  await triggers.nth(order).scrollIntoViewIfNeeded();
  await triggers.nth(order).click();
  const optionsBox = page.locator("div.max-h-56");
  try {
    await optionsBox.waitFor({ state: "visible", timeout: 8000 });
  } catch {
    await page.screenshot({ path: SCREENSHOT });
    throw new Error(`Filter ${order} portal did not open for "${label}" (screenshot saved)`);
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
  await option.waitFor({ state: "visible", timeout: 12000 });
  await option.click();
  await page.waitForTimeout(1500); // roster queries reload
  console.log(`    -> Filter selected: ${label}`);
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
  const monthsArg = process.argv.find((a) => a.startsWith("--months="))?.split("=")[1];
  const months = parseMonths(monthsArg);
  const classArg = process.argv.find((a) => a.startsWith("--class="))?.split("=")[1];
  const methodArg = process.argv.find((a) => a.startsWith("--method="))?.split("=")[1];
  const dryRun = process.argv.includes("--dry-run");
  const jev = new JevClient(process.env.AI_GATEWAY_API_KEY || "");
  const tenantNote = cfg.tenantSlug ? `Tenant: ${cfg.tenantSlug}, ` : "";

  const { browser, page } = await launchAuthedPage(cfg);
  const failures: Array<{ scope: string; step: string; error: string }> = [];
  let collected = 0;
  let collectedCount = 0;
  try {
    // Ground data: active classes (fee scope), mapped by live API names
    const classes = (
      await apiGet(page, cfg.baseUrl, "/api/classes?limit=100&isActive=true")
    ).map((c: any) => ({ value: String(c.id), label: String(c.name ?? c.id) }));
    if (classes.length === 0) throw new Error("No active classes found");

    let orderedClasses = [...classes];
    if (classArg) {
      const pinned = classes.find((c) => c.label.toLowerCase().includes(classArg.toLowerCase()));
      if (!pinned) throw new Error(`No class matching "${classArg}". Available: ${classes.map((c) => c.label).join(", ")}`);
      orderedClasses = [pinned];
      console.log(`Pinned class: ${pinned.label} (--class flag)`);
    } else {
      const rotPick = await jev.choose({
        state: `${tenantNote}Bulk-collect fees across: ${classes.map((c) => c.label).join(", ")}`,
        instructions: "How should bulk fee collection cover classes?",
        criteria: {
          ROTATE_SEQUENTIAL: "Class by class in listed order",
          ROTATE_RANDOM: "Class by class in random order",
          SINGLE_CLASS: "One class only (pick it next)",
        },
      });
      console.log(`Jev class rotation: ${rotPick.choice} [${rotPick.source}]`);
      if (rotPick.choice === "ROTATE_RANDOM") {
        let h = (Date.now() % 100000) || 1;
        const rand = () => {
          h = (h * 1103515245 + 12345) % 2147483648;
          return h / 2147483648;
        };
        for (let i = orderedClasses.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [orderedClasses[i], orderedClasses[j]] = [orderedClasses[j], orderedClasses[i]];
        }
      } else if (rotPick.choice === "SINGLE_CLASS") {
        const classC = toCriteria(classes);
        const classPick = await jev.choose({
          state: `${tenantNote}Bulk-collect one class: ${classes.map((c) => c.label).join(", ")}`,
          instructions: "Which single class should be bulk-collected?",
          criteria: classC.criteria,
        });
        const only = classC.byKey.get(classPick.choice) ?? classes[0];
        orderedClasses = [only];
        console.log(`Jev single class: ${only.label} [${classPick.source}]`);
      }
    }

    // Upfront pre-check: keep only classes with a priced fee structure for
    // the active academic year (totalMonthlyFee/tuitionFee > 0). Others would
    // skip per-cell anyway — this reports them once, before any page opens.
    const allYears = await apiGet(page, cfg.baseUrl, "/api/academic-years?limit=100");
    const activeYear =
      allYears.find((y: any) => y.isActive && !y.isClosed) ??
      allYears.find((y: any) => !y.isClosed) ??
      allYears[0];
    if (!activeYear) throw new Error("No academic years found");
    console.log(`Active academic year: ${activeYear.label ?? activeYear.name ?? activeYear.id}`);
    const collectible: typeof orderedClasses = [];
    for (const cls of orderedClasses) {
      const structs = await apiGet(
        page, cfg.baseUrl,
        `/api/fees/structures?classId=${cls.value}&academicYearId=${activeYear.id}`
      );
      const s0: any = structs[0];
      const rate = Number(s0?.totalMonthlyFee ?? s0?.tuitionFee ?? 0);
      if (s0 && rate > 0) {
        collectible.push(cls);
      } else {
        console.log(`  -> SKIP class upfront: ${cls.label} — no priced fee structure`);
      }
    }
    if (collectible.length === 0) {
      throw new Error(
        "No collectible classes: none have a priced fee structure. Configure monthly rates at Fees → Structures, then re-run."
      );
    }
    orderedClasses = collectible;
    console.log(`Collectible classes: ${orderedClasses.map((c) => c.label).join(", ")}`);

    // Payment method: Jev picks once per run from the page's live options
    // (tenant-configured modes), unless pinned via --method.
    let payMethod = methodArg ?? "";
    if (!payMethod) {
      await page.goto(`${cfg.baseUrl}/fees/bulk`, { waitUntil: "networkidle" });
      await page.locator(TRIGGER_SEL).nth(3).waitFor({ state: "visible", timeout: 15000 });
      await page.locator(TRIGGER_SEL).nth(3).click();
      const methodBox = page.locator("div.max-h-56");
      await methodBox.waitFor({ state: "visible", timeout: 8000 });
      const methodLabels = (await methodBox.locator("button").allInnerTexts()).map((s) => s.trim()).filter(Boolean);
      await page.keyboard.press("Escape");
      if (methodLabels.length === 0) throw new Error("No payment methods listed on /fees/bulk");
      const methodC = toCriteria(methodLabels.map((l) => ({ value: l, label: l })));
      const methodPick = await jev.choose({
        state: `${tenantNote}Bulk-collect payment method. Options: ${methodLabels.join(", ")}`,
        instructions: "Which payment method should bulk collection use?",
        criteria: methodC.criteria,
      });
      payMethod = methodC.byKey.get(methodPick.choice)?.value ?? methodLabels[0];
      console.log(`Jev pay method: ${payMethod} [${methodPick.source}]`);
    } else {
      console.log(`Pinned pay method: ${payMethod} (--method flag)`);
    }

    const startTime = Date.now();
    for (const cls of orderedClasses) {
      for (const month of months) {
        const scope = `${cls.label} / ${MONTH_NAMES[month - 1]}`;
        await ensureAuthed(page, cfg, scope);
        try {
          console.log(`\n>>> ${scope}: opening bulk collector...`);
          await page.goto(`${cfg.baseUrl}/fees/bulk`, { waitUntil: "networkidle" });
          await page.locator(TRIGGER_SEL).first().waitFor({ state: "visible", timeout: 15000 });
          await selectFilterByOrder(page, 0, cls.label);
          // Target month option reads "Month N: <name>" — match on the name
          await selectFilterByOrder(page, 2, MONTH_NAMES[month - 1]);
          await selectFilterByOrder(page, 3, payMethod);

          // No-structure banner renders TRANSIENTLY while the structure +
          // roster queries are still in flight (page has no isLoading guard
          // on it), so only trust it after the network settles + rechecks.
          let noStructure = false;
          await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
          await page.waitForTimeout(2000);
          for (let i = 0; i < 5; i++) {
            noStructure = (await page.locator("a[href='/fees/structures']").count()) > 0;
            if (!noStructure) break;
            await page.waitForTimeout(3000);
          }
          if (noStructure) {
            console.log(`>>> ${scope}: SKIP — no fee structure configured for this class`);
            continue;
          }

          // Auto Fill Month: fills each unpaid row from structure+concessions,
          // already-paid rows stay unselected by page logic.
          const autoFillBtn = page.getByRole("button", { name: /^auto fill /i }).first();
          if ((await autoFillBtn.count()) === 0) {
            console.log(`>>> ${scope}: SKIP — roster empty (no students/fee setup)`);
            continue;
          }
          await autoFillBtn.click();
          await page.waitForTimeout(1200);

          // --random: replace each auto-filled due with a random whole-month
          // multiple inside that row's remaining due. Bounds come from the
          // page itself (input value = 1 month net, dues cell = remaining):
          // 0 < amount <= due always, paid/zero rows untouched, all pages.
          if (process.argv.includes("--random")) {
            let h = (Date.now() % 100000) || 1;
            const rand = () => {
              h = (h * 1103515245 + 12345) % 2147483648;
              return h / 2147483648;
            };
            let randomized = 0;
            for (let pg = 0; pg < 10; pg++) {
              const rows = page.locator("table tbody tr");
              const n = await rows.count();
              for (let i = 0; i < n; i++) {
                const row = rows.nth(i);
                const input = row.locator("input[type='number']");
                if ((await input.count()) === 0) continue;
                const base = Number(await input.inputValue().catch(() => "0"));
                if (!(base > 0)) continue; // paid/zero rows stay untouched
                const duesCell = input.locator("xpath=../preceding-sibling::td[1]");
                const duesText = await duesCell.innerText().catch(() => "");
                const due = Number((duesText.match(/[\d,]+\.?\d*/) || ["0"])[0].replace(/,/g, ""));
                if (!(due > 0)) continue;
                const maxK = Math.max(1, Math.round(due / base));
                const k = 1 + Math.floor(rand() * maxK);
                const amount = Math.round(Math.min(k * base, due) * 100) / 100;
                await input.fill(String(amount));
                randomized++;
              }
              const nextBtn = page.getByRole("button", { name: /^next$/i }).first();
              if ((await nextBtn.count()) === 0 || (await nextBtn.isDisabled().catch(() => true))) break;
              await nextBtn.click();
              await page.waitForTimeout(1000);
            }
            console.log(`    -> Randomized ${randomized} row amount(s) within remaining dues`);
            await page.waitForTimeout(800);
          }

          // Summary card "N students (amount)" — 0 means nothing due
          const summaryCard = page.locator("text=/\\d+\\s+[Ss]tudents?\\s*\\(/").first();
          const summaryText = (await summaryCard.count()) > 0 ? await summaryCard.innerText() : "";
          const dueCount = Number(summaryText.match(/(\d+)/)?.[1] ?? "0");
          if (dueCount === 0) {
            console.log(`>>> ${scope}: SKIP — nothing due (all paid or zero dues)`);
            continue;
          }
          console.log(`    -> ${dueCount} student(s) queued for ${MONTH_NAMES[month - 1]}`);

          if (dryRun) {
            console.log(`[dry-run] ${scope} filled, NOT submitting. Review in browser.`);
            await page.waitForTimeout(15000);
            return;
          }

          const collectBtn = page.locator("div.fixed.bottom-4").getByRole("button", { name: /collect/i }).first();
          await collectBtn.click();
          await page.waitForTimeout(4000);
          const errToast = page.locator("[data-sonner-toast][data-type='error']").first();
          if (await errToast.isVisible()) {
            throw new Error(`Bulk collect rejected: ${await errToast.innerText()}`);
          }
          collectedCount++;
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          console.log(`>>> ${scope}: COLLECTED for ${dueCount} student(s) (elapsed: ${elapsed}s)`);
          collected += dueCount;
        } catch (e: any) {
          failures.push({ scope, step: "bulk collect", error: e?.message ?? String(e) });
          console.warn(`>>> ${scope}: FAILED — ${e?.message}`);
          await page.screenshot({ path: SCREENSHOT }).catch(() => {});
        }
      }
    }

    const totalSec = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`\n>>> FEES BULK COMPLETE: ${collected} student-collection(s) across ${collectedCount} submission(s), ${failures.length} failure(s) in ${totalSec}s`);
    for (const f of failures) console.log(`  !! ${f.scope} [${f.step}]: ${f.error.slice(0, 160)}`);
    if (failures.length > 0) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("Fees bulk automation failed:", e?.message);
  process.exit(1);
});
