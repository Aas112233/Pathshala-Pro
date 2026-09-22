import type { Page } from "playwright";
import { JevClient } from "./lib/jev-client";
import { ensureAuthed, launchAuthedPage, parseSharedArgs, requireCreds } from "./lib/playwright-shared";

// Admission automation (batched): Jev drives the cascade — academic year,
// class, group, section — plus ONE batch-order strategy, all picked ONLY
// from real server-fetched option lists. IDs, cascade filtering, and the
// final PUT /api/students/:id stay server-authoritative; Jev never
// invents a label, an ID, or a student identity.
//
// Batching: the selector modal multi-selects, so each batch opens it once,
// queues ~55 students, confirms, and submits. Per-batch submit keeps the
// server's Promise.all fan-out small and each batch independently verified.
// Already-admitted students (classId set) are skipped up front AND never
// clicked in the modal (their row button is disabled — same rule as the UI).
//
// Usage:
//   APP_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... TENANT_SLUG=... \
//   npx tsx scripts/playwright-admission-automation.ts [--count=500] [--batch=55] [--dry-run]

interface Option {
  value: string;
  label: string;
}

async function apiList(page: Page, baseUrl: string, path: string): Promise<any[]> {
  // In-page fetch: identical cookie behavior to the app's own TanStack
  // queries. page.request (Node-side) can withhold the SameSite=Strict
  // auth_token cookie, surfacing as a spurious 401 even while logged in.
  // Retried: a post-login redirect can destroy the execution context mid-call.
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
        // fall through to error below
      }
    }
    throw new Error(`GET ${path} -> HTTP ${result.status}: ${result.text.slice(0, 200)}`);
  }
  throw new Error(`GET ${path} -> evaluate kept failing (last: ${lastErr.slice(0, 160)})`);
}

// Build Jev criteria from real options (capped so the prompt stays small).
// Keys are unique labels; Jev picks a key, we map it back to the ID.
function toCriteria(options: Option[], cap = 10): { criteria: Record<string, string>; byKey: Map<string, Option> } {
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

// Academic card scope: the admission form grid (lg:grid-cols-5) holds the
// year/class/group/section AppDropdowns. Scoped so the app header's own
// academic-year switcher (earlier in the DOM) is never touched.
const FORM_SCOPE = "div[class*='lg:grid-cols-5']";
const TRIGGER_SEL = `${FORM_SCOPE} div.relative > button.w-full`;

// AppDropdown trigger = div.relative > button.w-full inside the form card.
// Group/section render as skeletons until their queries resolve, so wait
// for all four triggers before touching anything.
async function waitForCascade(page: Page, min = 4) {
  await page.waitForFunction(
    ([sel, n]: [string, number]) => document.querySelectorAll(sel).length >= n,
    [TRIGGER_SEL, min] as [string, number],
    { timeout: 25000 }
  );
  await page.waitForTimeout(600);
}

async function selectDropdownByOrder(page: Page, order: number, label: string) {
  const triggers = page.locator(TRIGGER_SEL);
  await triggers.nth(order).waitFor({ state: "visible", timeout: 15000 });
  await triggers.nth(order).scrollIntoViewIfNeeded();
  await triggers.nth(order).click();
  const optionsBox = page.locator("div.max-h-56");
  try {
    await optionsBox.waitFor({ state: "visible", timeout: 8000 });
  } catch {
    await page.screenshot({ path: "C:\\Users\\mhass\\AppData\\Local\\Temp\\opencode\\admission-dropdown.png" });
    throw new Error(`Dropdown ${order} portal did not open (screenshot saved to opencode temp dir)`);
  }
  const portal = optionsBox.locator("xpath=..");
  const searchBox = portal.locator("input").first();
  const option = optionsBox.locator("button", { hasText: label }).first();

  // Try short-token search first (avoids filter edge cases with parens/symbols),
  // fall back to the unfiltered list when the search hides the option.
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
  console.log(`  -> Dropdown ${order}: ${visibleCount} option(s) listed, picking "${label}"`);
  await option.waitFor({ state: "visible", timeout: 12000 });
  await option.click();
  await page.waitForTimeout(1200); // let dependent cascade queries (group/section) reload
  console.log(`  -> Selected: ${label}`);
}

async function main() {
  const cfg = parseSharedArgs();
  requireCreds(cfg);
  const countArg = process.argv.find((a) => a.startsWith("--count="))?.split("=")[1];
  const total = Math.max(1, countArg ? parseInt(countArg, 10) : 1);
  const batchArg = process.argv.find((a) => a.startsWith("--batch="))?.split("=")[1];
  const batchSize = Math.max(1, Math.min(batchArg ? parseInt(batchArg, 10) : 55, 60));
  const classArg = process.argv.find((a) => a.startsWith("--class="))?.split("=")[1];
  const dryRun = process.argv.includes("--dry-run");
  const jev = new JevClient(process.env.AI_GATEWAY_API_KEY || "");
  const tenantNote = cfg.tenantSlug ? `Tenant: ${cfg.tenantSlug}, ` : "";

  const { browser, page } = await launchAuthedPage(cfg);
  try {
    // 1-2. Year + class from live API data
    const years = (await apiList(page, cfg.baseUrl, "/api/academic-years?limit=100")).map((y: any) => ({
      value: String(y.id),
      label: String(y.label ?? y.name ?? y.id),
    }));
    if (years.length === 0) throw new Error("No academic years found for this tenant");
    const yearC = toCriteria(years);
    const yearPick = await jev.choose({
      state: `${tenantNote}Admit demo batch. Years: ${years.map((y) => y.label).join(", ")}`,
      instructions: "Which academic year should the demo admission use?",
      criteria: yearC.criteria,
    });
    const year = yearC.byKey.get(yearPick.choice) ?? years[0];
    console.log(`Jev year: ${year.label} [${yearPick.source}]`);

    const classes = (
      await apiList(page, cfg.baseUrl, "/api/classes?limit=100&isActive=true")
    ).map((c: any) => ({ value: String(c.id), label: String(c.name ?? c.id) }));
    if (classes.length === 0) throw new Error("No active classes found for this tenant");
    // --class="Class 2" pins one class (e.g. re-running just batch 2's class).
    // Otherwise batches rotate (batch 1 -> Class 1, batch 2 -> Class 2, ...).
    let orderedClasses = [...classes];
    const pinned = classArg
      ? classes.find((c) => c.label.toLowerCase().includes(classArg.toLowerCase()))
      : undefined;
    if (classArg && !pinned) {
      throw new Error(`No class matching "${classArg}". Available: ${classes.map((c) => c.label).join(", ")}`);
    }
    if (pinned) {
      orderedClasses = [pinned];
      console.log(`Pinned class: ${pinned.label} (--class flag, rotation skipped)`);
    } else {
    // Jev picks the rotation strategy once; batches cycle the ordered list.
    const classStrategyPick = await jev.choose({
      state: `${tenantNote}Year: ${year.label}. Admit across: ${classes.map((c) => c.label).join(", ")}`,
      instructions: "How should batches distribute across classes?",
      criteria: {
        ROTATE_SEQUENTIAL: "Batch 1 Class 1, batch 2 Class 2, in listed order",
        ROTATE_RANDOM: "Batches cycle classes in random order",
        SINGLE_CLASS: "Every batch into one class (pick it next)",
      },
    });
    console.log(`Jev rotation: ${classStrategyPick.choice} [${classStrategyPick.source}]`);
    let orderedClasses = [...classes];
    if (classStrategyPick.choice === "ROTATE_RANDOM") {
      let h = (Date.now() % 100000) || 1;
      const rand = () => {
        h = (h * 1103515245 + 12345) % 2147483648;
        return h / 2147483648;
      };
      for (let i = orderedClasses.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [orderedClasses[i], orderedClasses[j]] = [orderedClasses[j], orderedClasses[i]];
      }
    } else if (classStrategyPick.choice === "SINGLE_CLASS") {
      const classC = toCriteria(classes);
      const classPick = await jev.choose({
        state: `${tenantNote}Year: ${year.label}. Single class for all batches?`,
        instructions: "Which single class should take every batch?",
        criteria: classC.criteria,
      });
      const only = classC.byKey.get(classPick.choice) ?? classes[0];
      orderedClasses = [only];
      console.log(`Jev single class: ${only.label} [${classPick.source}]`);
    }
    }

    // 3-4. Group + section resolver, cascade-filtered per batch class (skipped when empty)
    async function resolveGroupSection(cls: Option): Promise<{ group: Option | null; section: Option | null }> {
      const groups = (
        await apiList(page, cfg.baseUrl, `/api/groups?limit=100&classId=${cls.value}`)
      ).map((g: any) => ({ value: String(g.id), label: String(g.name ?? g.id) }));
    let group: Option | null = null;
    if (groups.length > 0) {
      const groupC = toCriteria([{ value: "", label: "General (no group)" }, ...groups]);
      const groupPick = await jev.choose({
        state: `${tenantNote}Class: ${cls.label}. Groups: ${groups.map((g) => g.label).join(", ")}`,
        instructions: "Which group should the demo admission use (or General)?",
        criteria: groupC.criteria,
      });
      group = groupC.byKey.get(groupPick.choice) ?? null;
      console.log(`Jev group: ${group?.label ?? "General"} [${groupPick.source}]`);
    }

    const sectionParams = new URLSearchParams({ limit: "100", classId: cls.value });
    if (group?.value) sectionParams.set("groupId", group.value);
    const sections = (await apiList(page, cfg.baseUrl, `/api/sections?${sectionParams}`)).map(
      (s: any) => ({ value: String(s.id), label: String(s.name ?? s.id) })
    );
    let section: Option | null = null;
    if (sections.length > 0) {
      const sectionC = toCriteria([{ value: "", label: "Skip section" }, ...sections]);
      const sectionPick = await jev.choose({
        state: `${tenantNote}Class: ${cls.label}, Group: ${group?.label ?? "General"}. Sections: ${sections.map((s) => s.label).join(", ")}`,
        instructions: "Which section should the demo admission use (or skip)?",
        criteria: sectionC.criteria,
      });
      section = sectionC.byKey.get(sectionPick.choice) ?? null;
      console.log(`Jev section: ${section?.label ?? "skipped"} [${sectionPick.source}]`);
      }
      return { group, section };
    }

    // 5. Candidate pool: paginate the live roster (API caps limit at 100),
    // keep ONLY unadmitted students (no classId/class — the same rule the
    // modal uses to disable rows), then order per Jev's batch strategy.
    // One Jev call for the whole run: 500 per-student calls would be
    // hundreds of gateway round-trips in the hot loop.
    interface Candidate { value: string; label: string; roll: string; search: string }
    const unadmitted: Candidate[] = [];
    let admittedSkipped = 0;
    let apiPage = 1;
    for (;;) {
      const rows = await apiList(page, cfg.baseUrl, `/api/students?limit=100&page=${apiPage}`);
      if (rows.length === 0) break;
      for (const s of rows) {
        if (s.classId || s.class?.name) {
          admittedSkipped++;
          continue;
        }
        unadmitted.push({
          value: String(s.id),
          label: `${s.rollNumber ?? "?"} — ${s.firstName ?? ""} ${s.lastName ?? ""}`.trim(),
          roll: String(s.rollNumber ?? ""),
          search: `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim(),
        });
      }
      if (rows.length < 100 || unadmitted.length >= total) break;
      apiPage++;
      if (apiPage > 50) break; // safety cap: 5000 rows scanned
    }
    if (unadmitted.length === 0) {
      throw new Error("No unadmitted students found — seed students first (automate:students) or all are already admitted");
    }
    console.log(`Pool: ${unadmitted.length} unadmitted candidate(s), ${admittedSkipped} already-admitted skipped`);

    const strategyPick = await jev.choose({
      state: `${tenantNote}Admit ${Math.min(total, unadmitted.length)} of ${unadmitted.length} unadmitted students in batches of ~${batchSize}`,
      instructions: "Which batch ordering should the demo admission use?",
      criteria: {
        RANDOM_SHUFFLE: "Random shuffle — mixed 50-60 student batches",
        ROLL_ORDER: "Roll-number order, sequential batches",
        LIST_ORDER: "Roster listed order, sequential batches",
      },
    });
    console.log(`Jev batch strategy: ${strategyPick.choice} [${strategyPick.source}]`);
    const seed = (Date.now() % 100000).toString();
    if (strategyPick.choice === "RANDOM_SHUFFLE") {
      // Seeded Fisher-Yates so the run is reproducible from the log seed
      let h = parseInt(seed, 10) || 1;
      const rand = () => {
        h = (h * 1103515245 + 12345) % 2147483648;
        return h / 2147483648;
      };
      for (let i = unadmitted.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [unadmitted[i], unadmitted[j]] = [unadmitted[j], unadmitted[i]];
      }
      console.log(`  -> Shuffle seed: ${seed}`);
    } else if (strategyPick.choice === "ROLL_ORDER") {
      unadmitted.sort((a, b) => a.roll.localeCompare(b.roll));
    }
    const candidates = unadmitted.slice(0, total);
    console.log(`Admitting ${candidates.length} student(s) in batches of ${batchSize}`);

    // 6. Open the form per batch (list view -> Add Admission -> cascade)
    async function openFormWithCascade(cls: Option, group: Option | null, section: Option | null) {
      await page.goto(`${cfg.baseUrl}/admissions`, { waitUntil: "networkidle" });
      const addAdmissionBtn = page.getByRole("button", { name: /add admission/i }).first();
      await addAdmissionBtn.waitFor({ state: "visible", timeout: 15000 });
      await addAdmissionBtn.click();
      await waitForCascade(page, 4); // year/class/group/section triggers (skeletons first)
      await selectDropdownByOrder(page, 0, year.label);
      await selectDropdownByOrder(page, 1, cls.label);
      await waitForCascade(page, 4);
      if (group && group.value) await selectDropdownByOrder(page, 2, group.label);
      if (section && section.value) await selectDropdownByOrder(page, 3, section.label);
    }

    const startTime = Date.now();
    let admitted = 0;
    const usedClasses: string[] = [];

    for (let b = 0; b < candidates.length; b += batchSize) {
      const batch = candidates.slice(b, b + batchSize);
      const batchNo = Math.floor(b / batchSize) + 1;
      const batchCount = Math.ceil(candidates.length / batchSize);
      // Rotate: batch 1 -> first class, batch 2 -> second class, cycling
      const cls = orderedClasses[(batchNo - 1) % orderedClasses.length];
      const { group, section } = await resolveGroupSection(cls);
      console.log(
        `\n>>> BATCH ${batchNo}/${batchCount} -> ${cls.label}` +
          `${group?.value ? ` / ${group.label}` : ""}${section?.value ? ` / ${section.label}` : ""}: queuing ${batch.length} student(s)...`
      );
      if (!usedClasses.includes(cls.label)) usedClasses.push(cls.label);
      await ensureAuthed(page, cfg, `batch ${batchNo} start`);
      await openFormWithCascade(cls, group, section);

      // 7. One modal open per batch; picks accumulate across searches
      const addOldBtn = page.getByRole("button", { name: /old student/i }).first();
      await addOldBtn.waitFor({ state: "visible", timeout: 10000 });
      await addOldBtn.click();
      const dialog = page.locator("[role='dialog']");
      await dialog.waitFor({ state: "visible", timeout: 10000 });
      const searchInput = dialog.locator("input[placeholder]").first();
      let queued = 0;
      for (const stu of batch) {
        await searchInput.fill(stu.roll || stu.search);
        await page.waitForTimeout(700);
        const row = dialog.locator("div.divide-y > div", { hasText: stu.roll || stu.search }).first();
        await row.waitFor({ state: "visible", timeout: 8000 });
        // Disabled row button = already admitted (UI rule) — never force it
        const selectBtn = row.locator("button:not([disabled])");
        if ((await selectBtn.count()) === 0) {
          console.log(`  -> SKIP (already admitted): ${stu.label}`);
          continue;
        }
        await selectBtn.first().click();
        await page.waitForTimeout(250);
        queued++;
      }
      await searchInput.fill("");
      const confirmBtn = dialog.getByRole("button", { name: /add student/i }).last();
      await confirmBtn.click();
      await page.waitForTimeout(800);
      console.log(`  -> Batch ${batchNo} queued: ${queued}/${batch.length}`);

      if (dryRun) {
        console.log("\n[dry-run] Queue built, NOT submitting. Review in browser.");
        await page.waitForTimeout(15000);
        return;
      }

      // 8. Submit batch — small Promise.all fan-out, then back to list = proof
      await ensureAuthed(page, cfg, `batch ${batchNo} submit`);
      const submitBtn = page.getByRole("button", { name: /complete admission/i }).first();
      await submitBtn.waitFor({ state: "visible", timeout: 10000 });
      await submitBtn.click();
      await page.getByRole("button", { name: /add admission/i }).first().waitFor({ state: "visible", timeout: 60000 });
      admitted += queued;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`>>> BATCH ${batchNo}/${batchCount} SUBMITTED (total admitted: ${admitted}, elapsed: ${elapsed}s)`);
    }

    console.log(`\n>>> ADMISSION COMPLETE: ${admitted} student(s) across ${usedClasses.join(", ")} (${year.label})`);
    await page.waitForTimeout(3000);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("Admission automation failed:", e?.message);
  process.exit(1);
});
