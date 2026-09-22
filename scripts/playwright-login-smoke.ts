import { chromium } from "playwright";

// Minimal login smoke — mirrors Phase 2 of playwright-onboard-tenant.ts.
// Uses existing `playwright` dep only (no @playwright/test needed).
// Usage: npx tsx scripts/playwright-login-smoke.ts --local --email=... --password=...
const isLocal = process.argv.includes("--local");
const baseUrl =
  process.env.APP_URL || (isLocal ? "http://localhost:3000" : "http://localhost:3000");
const email =
  process.argv.find((a) => a.startsWith("--email="))?.split("=")[1] ||
  process.env.ADMIN_EMAIL ||
  "admin.bwzud@trantowpubliccad.edu.bd";
const password =
  process.argv.find((a) => a.startsWith("--password="))?.split("=")[1] ||
  process.env.ADMIN_PASSWORD ||
  "";

if (!password) {
  console.error("Missing password. Pass --password= or set ADMIN_PASSWORD.");
  process.exit(1);
}

async function main() {
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();
try {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.waitForSelector("#email", { timeout: 15000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("button[type='submit']").click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });
  console.log("Login smoke: PASS");
} catch (e: any) {
  console.error("Login smoke: FAIL —", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
}

main().catch((e) => {
  console.error("Login smoke: FAIL —", e?.message);
  process.exit(1);
});
