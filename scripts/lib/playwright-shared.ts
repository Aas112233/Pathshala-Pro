import { chromium, type Page } from "playwright";

export interface SharedConfig {
  baseUrl: string;
  email: string;
  password: string;
  tenantSlug: string;
  slowMo: number;
  headless: boolean;
  /** Max minutes to wait out a 429 lockout before aborting (default 6). */
  loginMaxWaitMin: number;
}

export function parseSharedArgs(): SharedConfig {
  const isLocal = process.argv.includes("--local");
  // APP_URL must be origin only, e.g. https://pathshala-pro.vercel.app (no /login suffix)
  const baseUrl =
    process.env.APP_URL || (isLocal ? "http://localhost:3000" : "https://pathshala-pro.vercel.app");
  const email =
    process.argv.find((a) => a.startsWith("--email="))?.split("=")[1] ||
    process.env.ADMIN_EMAIL ||
    "admin.bwzud@trantowpubliccad.edu.bd";
  const password =
    process.argv.find((a) => a.startsWith("--password="))?.split("=")[1] ||
    process.env.ADMIN_PASSWORD ||
    "";
  // Tenant slug is reference-only: login resolves tenant server-side from email.
  const tenantSlug =
    process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1] ||
    process.env.TENANT_SLUG ||
    "trantow-public-cad-877";
  const slowMoArg = process.argv.find((a) => a.startsWith("--slowmo="))?.split("=")[1];
  const slowMo = slowMoArg !== undefined ? parseInt(slowMoArg, 10) : 60;
  const headless = process.argv.includes("--headless");
  const loginWaitArg = process.argv.find((a) => a.startsWith("--login-wait-min="))?.split("=")[1];
  const loginMaxWaitMin = loginWaitArg !== undefined ? parseInt(loginWaitArg, 10) : 6;
  return { baseUrl, email, password, tenantSlug, slowMo, headless, loginMaxWaitMin };
}

export function requireCreds(cfg: SharedConfig) {
  if (!cfg.password) {
    console.error("Missing password. Pass --password= or set ADMIN_PASSWORD.");
    process.exit(1);
  }
}

async function readErrorToast(page: Page): Promise<string | null> {
  const toast = page.locator("[data-sonner-toast][data-type='error']").first();
  try {
    await toast.waitFor({ state: "visible", timeout: 4000 });
    return ((await toast.innerText()) || "").trim() || null;
  } catch {
    return null;
  }
}

// Login with dynamic 429 handling. The server allows 5 logins / 15 min per
// IP+email (auth preset) and rejects identical POSTs within 2s (dedupe 409),
// so repeated batch runs can hit "Too many login attempts". Blocked retries
// do NOT extend the lockout (no failure is recorded on the 429 path), so it
// is safe to wait out the window and retry — capped by loginMaxWaitMin.
export async function login(page: Page, cfg: SharedConfig) {
  const maxWaitMs = Math.max(0, cfg.loginMaxWaitMin) * 60_000;
  let waitedMs = 0;
  for (let attempt = 1; ; attempt++) {
    await page.goto(`${cfg.baseUrl}/login`, { waitUntil: "networkidle" });
    await page.waitForSelector("#email", { timeout: 15000 });
    await page.locator("#email").fill(cfg.email);
    await page.locator("#password").fill(cfg.password);
    await page.locator("button[type='submit']").click();
    const ok = await page
      .waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    if (ok) {
      if (attempt > 1) console.log(`  -> Login succeeded on attempt ${attempt}`);
      return;
    }
    const errText = await readErrorToast(page);
    const minutes = errText?.match(/(\d+)\s*minute/i)?.[1];
    if (errText?.toLowerCase().includes("too many login attempts") && minutes) {
      const waitMs = (parseInt(minutes, 10) * 60 + 15) * 1000;
      if (waitedMs + waitMs > maxWaitMs) {
        throw new Error(
          `Login rate-limited (${errText}). Wait budget exceeded (--login-wait-min=${cfg.loginMaxWaitMin}). ` +
            `Re-run later or raise the budget; each run costs 1 of 5 logins per 15 min.`
        );
      }
      waitedMs += waitMs;
      console.log(`  -> Login 429 (attempt ${attempt}): waiting ${(waitMs / 1000).toFixed(0)}s (${errText})`);
      await page.waitForTimeout(waitMs);
      continue;
    }
    throw new Error(
      `Login failed and left us on /login (attempt ${attempt}). Server said: ${errText ?? "no error toast (timeout)"}. ` +
        `Check ADMIN_EMAIL/ADMIN_PASSWORD; retries won't help bad credentials.`
    );
  }
}

// Mid-run guard: if the app bounced back to /login (expired/invalidated
// session), re-authenticate in place instead of crashing on the next step.
export async function ensureAuthed(page: Page, cfg: SharedConfig, where: string) {
  let onLogin = false;
  try {
    onLogin = new URL(page.url()).pathname.includes("/login");
  } catch {
    onLogin = false;
  }
  if (onLogin) {
    console.log(`  -> Session bounced to /login at ${where}; re-logging in...`);
    await login(page, cfg);
  }
}

export async function launchAuthedPage(cfg: SharedConfig) {
  const browser = await chromium.launch({ headless: cfg.headless, slowMo: cfg.slowMo });
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  await login(page, cfg);
  // Post-login redirect chain (dashboard/module gates) can navigate again
  // after /login is left; settle before any evaluate/API call.
  await page.waitForLoadState("networkidle", { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { browser, page };
}
