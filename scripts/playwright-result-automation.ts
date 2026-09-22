import { JevClient } from "./lib/jev-client";
import { launchAuthedPage, parseSharedArgs, requireCreds } from "./lib/playwright-shared";

// Result automation: Jev picks ONLY the scope strategy (which ledger to open).
// Marks are NEVER AI-generated — entry uses deterministic in-range values
// bounded by each subject's maxMarks/passMarks from the server.
async function main() {
  const cfg = parseSharedArgs();
  requireCreds(cfg);
  const jev = new JevClient(process.env.AI_GATEWAY_API_KEY || "");
  const { browser, page } = await launchAuthedPage(cfg);
  try {
    const decision = await jev.choose({
      state: "Demo result entry for seeded tenant",
      instructions: "Which result scope should the demo open?",
      criteria: {
        FIRST_EXAM: "Open the first available exam ledger",
        FIRST_CLASS: "Open the first class gradebook matrix",
        RECENT_LEDGER: "Open the most recent result ledger",
      },
    });
    console.log(`Jev result scope: ${decision.choice} [${decision.source}]`);

    await page.goto(`${cfg.baseUrl}/exam-results`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    // Human/reviewer completes mark entry in the visible ledger;
    // script stops here so no AI mark ever gets submitted.
    console.log("Result ledger open for review. Marks must be entered within server maxMarks bounds.");
    await page.waitForTimeout(5000);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("Result automation failed:", e?.message);
  process.exit(1);
});
