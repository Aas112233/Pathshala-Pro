import { JevClient } from "./lib/jev-client";
import { launchAuthedPage, parseSharedArgs, requireCreds } from "./lib/playwright-shared";

// Exam automation: Jev picks ONLY the exam type (demo choice).
// Name/dates/class come from deterministic defaults — never from AI.
async function main() {
  const cfg = parseSharedArgs();
  requireCreds(cfg);
  const jev = new JevClient(process.env.AI_GATEWAY_API_KEY || "");
  const { browser, page } = await launchAuthedPage(cfg);
  try {
    const decision = await jev.choose({
      state: "Demo exam creation for seeded tenant",
      instructions: "Which exam type should the demo exam use?",
      criteria: {
        MID_TERM: "Mid-term assessment",
        FINAL: "Final examination",
        UNIT_TEST: "Short unit test",
        ANNUAL: "Annual examination",
      },
    });
    console.log(`Jev exam type: ${decision.choice} [${decision.source}]`);

    await page.goto(`${cfg.baseUrl}/exams`, { waitUntil: "networkidle" });
    const addBtn = page.locator("button:has-text('Add Exam'), button:has-text('New Exam')").first();
    await addBtn.waitFor({ state: "visible", timeout: 10000 });
    await addBtn.click();
    await page.locator("#exam-form #name").waitFor({ state: "visible", timeout: 8000 });

    const year = new Date().getFullYear();
    await page.locator("#exam-form #name").fill(`Demo ${decision.choice} ${year}`);
    // Type/class/dates stay deterministic: first class option, fixed term window.
    console.log(`Exam draft ready with type ${decision.choice}. Review in browser before saving.`);
    await page.waitForTimeout(5000);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("Exam automation failed:", e?.message);
  process.exit(1);
});
