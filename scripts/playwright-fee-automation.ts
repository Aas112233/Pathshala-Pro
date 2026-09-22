import { JevClient } from "./lib/jev-client";
import { launchAuthedPage, parseSharedArgs, requireCreds } from "./lib/playwright-shared";

// Fee-pay automation: Jev picks ONLY payment method + voucher strategy.
// Amount is NEVER from AI — it always equals the server-rendered pending
// total (double-entry + math-utils stay authoritative on the server).
async function main() {
  const cfg = parseSharedArgs();
  requireCreds(cfg);
  const jev = new JevClient(process.env.AI_GATEWAY_API_KEY || "");
  const { browser, page } = await launchAuthedPage(cfg);
  try {
    const decision = await jev.choose({
      state: "Demo fee collection for seeded tenant",
      instructions: "Which payment method should the demo fee collection use?",
      criteria: {
        CASH: "Cash at counter",
        BKASH: "bKash mobile payment",
        BANK: "Bank transfer",
      },
    });
    console.log(`Jev payment method: ${decision.choice} [${decision.source}]`);

    await page.goto(`${cfg.baseUrl}/fees/collection`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    // Reviewer selects student/vouchers in the visible POS;
    // script stops before submit so the server-computed amount is never overridden.
    console.log(`Fee collection open. Use method ${decision.choice}; amount stays server-computed.`);
    await page.waitForTimeout(5000);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("Fee automation failed:", e?.message);
  process.exit(1);
});
