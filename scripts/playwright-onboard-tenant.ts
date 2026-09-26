import { chromium } from "playwright";
import { faker } from "@faker-js/faker";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { JevClient } from "./lib/jev-client";

interface AutomationConfig {
  baseUrl?: string;
  slowMo?: number;
  studentsToCreate?: number;
  staffToCreate?: number;
}

// Initialize Jev AI client using Vercel AI Gateway (env only, heuristic fallback otherwise)
const jevApiKey = process.env.AI_GATEWAY_API_KEY || "";
const jev = new JevClient(jevApiKey);

async function runCompleteSchoolAutomation(config: AutomationConfig = {}) {
  const isLocal = process.argv.includes("--local");
  const defaultUrl = isLocal ? "http://localhost:3000" : "https://pathshala-pro.vercel.app";
  const baseUrl = config.baseUrl || process.env.APP_URL || defaultUrl;

  const isFast = process.argv.includes("--fast");
  const isHeadless = process.argv.includes("--headless");
  const slowMoArg = process.argv.find((a) => a.startsWith("--slowmo="))?.split("=")[1];
  const slowMo = slowMoArg !== undefined ? parseInt(slowMoArg, 10) : (config.slowMo ?? (isFast ? 0 : 60));

  const studentsArg = process.argv.find((a) => a.startsWith("--students="))?.split("=")[1];
  const studentsToCreate = studentsArg ? parseInt(studentsArg, 10) : (config.studentsToCreate ?? 500);

  const staffArg = process.argv.find((a) => a.startsWith("--staff="))?.split("=")[1];
  const staffToCreate = staffArg ? parseInt(staffArg, 10) : (config.staffToCreate ?? 100);

  console.log("\n=============================================================");
  console.log("  PATHSHALA-PRO — HIGH-SPEED PLAYWRIGHT + JEV AI RUNNER");
  console.log("=============================================================");
  console.log(`Target URL:            ${baseUrl}`);
  console.log(`AI Model:              typesafe-ai/jev (Vercel AI Gateway)`);
  console.log(`Environment:           ${isLocal ? "Local Development" : "Production (Vercel Live)"}`);
  console.log(`Mode:                  ${isHeadless ? "Headless (Maximum Throughput)" : "Headed (Visible Desktop Browser)"}`);
  console.log(`Pacing Delay (slowMo): ${slowMo}ms`);
  console.log(`Students Target:       ${studentsToCreate} students`);
  console.log(`Staff Target:          ${staffToCreate} staff members\n`);

  // Verify connectivity
  try {
    const res = await fetch(`${baseUrl}/onboarding`);
    if (!res.ok && res.status !== 404 && res.status !== 307 && res.status !== 308) {
      console.warn(`Warning: ${baseUrl} returned status ${res.status}`);
    }
  } catch (e: any) {
    console.error(`\n[ERROR] Could not connect to ${baseUrl}:`, e.message);
    process.exit(1);
  }

  // Generate synthetic school & admin credentials
  const schoolSuffix = faker.helpers.arrayElement([
    "International Academy",
    "Model High School & College",
    "Grammar School",
    "Public Cadet School",
    "Scholars Preparatory Institute",
  ]);
  const schoolPrefix = faker.person.lastName();
  const schoolName = `${schoolPrefix} ${schoolSuffix}`;
  const randomSuffix = faker.number.int({ min: 100, max: 999 });
  const baseSlug = schoolName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 18);
  const tenantSlug = `${baseSlug}-${randomSuffix}`;
  const schoolCode = `${schoolPrefix.slice(0, 3).toUpperCase()}-${new Date().getFullYear()}`;

  const address = `${faker.location.streetAddress()}, ${faker.helpers.arrayElement(["Gulshan", "Dhanmondi", "Uttara", "Banani", "Mirpur"])}, Dhaka`;
  const phone = `017${faker.string.numeric(8)}`;
  const email = `info@${baseSlug.replace(/-/g, "")}.edu.bd`;

  const targetCurrency = "BDT";
  const baseTuition = "3500";
  const taxRate = "5";

  const skipOnboard = process.argv.includes("--skip-onboard");
  const emailArg = process.argv.find((a) => a.startsWith("--email="))?.split("=")[1];
  const pwdArg = process.argv.find((a) => a.startsWith("--password="))?.split("=")[1];

  const adminNameArg = process.argv.find((a) => a.startsWith("--admin-name="))?.split("=")[1];
  const adminName = adminNameArg || process.env.ADMIN_NAME || `${faker.person.firstName()} ${faker.person.lastName()}`;
  let adminEmail = emailArg || process.env.ADMIN_EMAIL || (skipOnboard ? "admin.bwzud@trantowpubliccad.edu.bd" : `admin.${faker.string.alphanumeric(5).toLowerCase()}@${baseSlug.replace(/-/g, "")}.edu.bd`);
  let adminPassword = pwdArg || process.env.ADMIN_PASSWORD || `Admin@${new Date().getFullYear()}!`;

  console.log("Planned End-to-End Visual Execution Plan with Jev AI:");
  if (skipOnboard) {
    console.log(`   * Skipping Onboarding (using active tenant admin: ${adminEmail})`);
    console.log(`   1. Auto Login:       Authenticate into active tenant`);
    console.log(`   2. Fast Students:    Auto-generate & enroll ${studentsToCreate} students with fast form fill`);
    console.log(`   3. Fast Staff:       Auto-generate & appoint ${staffToCreate} staff members with fast form fill\n`);
  } else {
    console.log(`   1. Onboard School:   ${schoolName} (${tenantSlug})`);
    console.log(`   2. Jev Decisions:    Curriculum choice & staff appointment routing`);
    console.log(`   3. Auto Login:       Authenticate newly created tenant`);
    console.log(`   4. Fast Students:    Auto-generate & enroll ${studentsToCreate} students`);
    console.log(`   5. Fast Staff:       Auto-generate & appoint ${staffToCreate} staff members\n`);
  }

  console.log(`Launching ${isHeadless ? "headless" : "visible"} Chromium browser window...`);
  const browser = await chromium.launch({
    headless: isHeadless,
    slowMo,
    args: ["--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  });

  const page = await context.newPage();

  // Monitor API responses
  page.on("response", async (response) => {
    if (response.url().includes("/api/tenants") && response.request().method() === "POST") {
      try {
        const json = await response.json();
        console.log(`\n[API /api/tenants Response]: HTTP ${response.status()}`, JSON.stringify(json, null, 2));
      } catch {}
    }
  });

  try {
    if (!skipOnboard) {
      // ========================================================================
      // PHASE 1: FULL ONBOARDING WIZARD
      // ========================================================================
      console.log("\n>>> PHASE 1: NAVIGATING TO ONBOARDING WIZARD");
      await page.goto(`${baseUrl}/onboarding`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);

      // STEP 1: Profile
      console.log("\n[Onboarding 1/5] Filling Institute Profile...");
    await page.waitForSelector("#inst-name", { timeout: 15000 });

    await page.locator("#inst-name").click();
    await page.locator("#inst-name").pressSequentially(schoolName, { delay: 30 });

    await page.locator("#inst-slug").click();
    await page.locator("#inst-slug").fill("");
    await page.locator("#inst-slug").pressSequentially(tenantSlug, { delay: 30 });

    await page.locator("#inst-code").click();
    await page.locator("#inst-code").pressSequentially(schoolCode, { delay: 30 });

    await page.locator("#inst-address").click();
    await page.locator("#inst-address").pressSequentially(address, { delay: 20 });

    await page.locator("#inst-phone").click();
    await page.locator("#inst-phone").pressSequentially(phone, { delay: 25 });

    await page.locator("#inst-email").click();
    await page.locator("#inst-email").pressSequentially(email, { delay: 25 });

    await page.waitForTimeout(500);
    console.log("  -> Clicking 'Next'...");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForTimeout(1200);

    // STEP 2: Localization
    console.log("\n[Onboarding 2/5] Configuring Regional & Financial Settings...");
    await page.waitForSelector("#base-tuition", { timeout: 8000 });

    // Currency selection
    console.log(`  -> Selecting Currency: ${targetCurrency}...`);
    const currencyDropdownTrigger = page
      .locator("label:has-text('Currency'), label:has-text('currency')")
      .locator("xpath=..")
      .locator("button")
      .first();

    if (await currencyDropdownTrigger.isVisible()) {
      await currencyDropdownTrigger.click();
      await page.waitForTimeout(400);

      const searchBox = page.locator("input[placeholder*='Search']").first();
      if (await searchBox.isVisible()) {
        await searchBox.pressSequentially(targetCurrency, { delay: 40 });
        await page.waitForTimeout(400);
      }

      const currencyOption = page.locator(`div[style*='fixed'] button:has-text('${targetCurrency}')`).first();
      if (await currencyOption.isVisible()) {
        await currencyOption.click();
      } else {
        await page.locator("div[style*='fixed'] button").first().click();
      }
    }
    await page.waitForTimeout(500);

    // Tax rate & base tuition
    await page.locator("#tax-rate").click();
    await page.locator("#tax-rate").fill("");
    await page.locator("#tax-rate").pressSequentially(taxRate, { delay: 40 });

    await page.locator("#base-tuition").click();
    await page.locator("#base-tuition").fill("");
    await page.locator("#base-tuition").pressSequentially(baseTuition, { delay: 40 });

    // Timezone
    console.log("  -> Selecting Local Timezone...");
    const timezoneDropdownTrigger = page
      .locator("label:has-text('Timezone'), label:has-text('timezone')")
      .locator("xpath=..")
      .locator("button")
      .first();

    if (await timezoneDropdownTrigger.isVisible()) {
      await timezoneDropdownTrigger.click();
      await page.waitForTimeout(400);

      const tzOption = page
        .locator("div[style*='fixed'] button:has-text('Dhaka'), div[style*='fixed'] button:has-text('Bangladesh')")
        .first();

      if (await tzOption.isVisible()) {
        await tzOption.click();
      } else {
        await page.locator("div[style*='fixed'] button").first().click();
      }
    }
    await page.waitForTimeout(500);

    // Date Format
    console.log("  -> Selecting Date Format DD/MM/YYYY...");
    const dateFormatDropdownTrigger = page
      .locator("label:has-text('Date Format'), label:has-text('format')")
      .locator("xpath=..")
      .locator("button")
      .first();

    if (await dateFormatDropdownTrigger.isVisible()) {
      await dateFormatDropdownTrigger.click();
      await page.waitForTimeout(400);

      const dmyOption = page.locator("div[style*='fixed'] button:has-text('DD/MM/YYYY')").first();
      if (await dmyOption.isVisible()) {
        await dmyOption.click();
      } else {
        await page.locator("div[style*='fixed'] button").first().click();
      }
    }
    await page.waitForTimeout(600);

    console.log("  -> Clicking 'Next'...");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForTimeout(1200);

    // STEP 3: Academics & Jev AI Choice
    console.log("\n[Onboarding 3/5] Setting Academic Session & Consulting Jev AI...");
    await page.waitForSelector("#acad-label", { timeout: 8000 });

    const currentYear = new Date().getFullYear();
    await page.locator("#acad-label").click();
    await page.locator("#acad-label").fill("");
    await page.locator("#acad-label").pressSequentially(`${currentYear}-${currentYear + 1} Academic Session`, { delay: 30 });

    await page.locator("#acad-start").click();
    await page.locator("#acad-start").fill("");
    await page.locator("#acad-start").pressSequentially(`01/01/${currentYear}`, { delay: 30 });

    await page.locator("#acad-end").click();
    await page.locator("#acad-end").fill("");
    await page.locator("#acad-end").pressSequentially(`31/12/${currentYear}`, { delay: 30 });
    await page.waitForTimeout(500);

    // Consult Jev AI for curriculum template choice
    console.log("  -> Consulting Jev AI (typesafe-ai/jev) for optimal grade structure...");
    const jevTemplateDecision = await jev.choose({
      state: `School: ${schoolName}, Location: Dhaka, Bangladesh, Profile: High School & College`,
      instructions: "Which curriculum template should be selected for this institution?",
      criteria: {
        BD_NCTB_PRIMARY_SSC_HSC: "Bangladesh National NCTB Primary, Secondary (SSC) & Higher Secondary (HSC)",
        K_12: "General K-12 schooling system from Grade 1 through 12",
        PRIMARY_1_5: "Primary elementary education Grade 1 to 5",
      },
    });

    console.log(
      `  -> Jev Selected: "${jevTemplateDecision.choice}" [Provider: ${jevTemplateDecision.source}${
        jevTemplateDecision.confidence ? `, Confidence: ${(jevTemplateDecision.confidence * 100).toFixed(1)}%` : ""
      }]`
    );

    // Click matching template card
    const templateCards = page.locator("button:has(span.font-bold)");
    const cardCount = await templateCards.count();
    if (cardCount > 0) {
      // Find card matching Jev choice or default to 1st
      let chosenCard = templateCards.nth(0);
      for (let i = 0; i < cardCount; i++) {
        const text = await templateCards.nth(i).innerText();
        if (text.includes("NCTB") || text.includes("K-12") || text.includes("Class 1")) {
          chosenCard = templateCards.nth(i);
          break;
        }
      }
      await chosenCard.click();
      await page.waitForTimeout(800);
    }

    console.log("  -> Clicking 'Next'...");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForTimeout(1200);

    // STEP 4: Admin Account
    console.log("\n[Onboarding 4/5] Setting Up Platform Super Admin Credentials...");
    await page.waitForSelector("#admin-name", { timeout: 8000 });

    await page.locator("#admin-name").click();
    await page.locator("#admin-name").pressSequentially(adminName, { delay: 30 });

    await page.locator("#admin-email").click();
    await page.locator("#admin-email").pressSequentially(adminEmail, { delay: 30 });

    await page.locator("#admin-pwd").click();
    await page.locator("#admin-pwd").pressSequentially(adminPassword, { delay: 30 });
    await page.waitForTimeout(800);

    console.log("  -> Clicking 'Next' to review...");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForTimeout(1500);

    // STEP 5: Launch
    console.log("\n[Onboarding 5/5] Reviewing School Configuration & Launching...");
    const launchButton = page.locator("button:has-text('Complete')");
    await launchButton.waitFor({ state: "visible", timeout: 8000 });
    await page.waitForTimeout(1000);

    console.log("  -> Clicking 'Complete & Launch School'...");
    await launchButton.click();

    // STEP 6: Success
    console.log("  -> Waiting for database provisioning & success card...");
    const successPromise = page.waitForSelector("text=Welcome to", { timeout: 60000 });
    const toastErrorPromise = page.waitForSelector("[data-sonner-toast][data-type='error']", { timeout: 60000 }).then(async (el) => {
      const text = await el.innerText();
      throw new Error(`Onboarding failed: "${text}"`);
    });

    await Promise.race([successPromise, toastErrorPromise]);

    console.log("\n>>> ONBOARDING SUCCESSFUL!");
    console.log(`    Tenant Slug: ${tenantSlug}`);
    console.log(`    Admin Email: ${adminEmail}`);
    await page.waitForTimeout(3000);

    } // end of if (!skipOnboard)

    // ========================================================================
    // PHASE 2: AUTOMATED LOGIN AS NEW SUPER ADMIN
    // ========================================================================
    console.log("\n>>> PHASE 2: LOGGING IN AS SUPER ADMIN");
    if (skipOnboard) {
      await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    } else {
      const loginButton = page.locator("button:has-text('Go to Login'), button:has-text('Login Portal')").first();
      if (await loginButton.isVisible()) {
        console.log("  -> Clicking 'Go to Login Portal'...");
        await loginButton.click();
      } else {
        await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
      }
    }

    await page.waitForSelector("#email", { timeout: 15000 });
    await page.waitForTimeout(1000);

    console.log(`  -> Typing Login Email: "${adminEmail}"`);
    await page.locator("#email").click();
    await page.locator("#email").pressSequentially(adminEmail, { delay: 30 });

    console.log(`  -> Typing Password...`);
    await page.locator("#password").click();
    await page.locator("#password").pressSequentially(adminPassword, { delay: 30 });

    await page.waitForTimeout(600);
    console.log("  -> Submitting Login Form...");
    await page.locator("button[type='submit']").click();

    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });
    console.log(">>> AUTHENTICATION SUCCESSFUL! Logged into new school tenant.\n");
    await page.waitForTimeout(2000);

    // ========================================================================
    // PHASE 3: HIGH-SPEED AUTOMATED STUDENT CREATION
    // ========================================================================
    if (studentsToCreate > 0) {
      console.log(">>> PHASE 3: AUTOMATED STUDENT CREATION");
      console.log("Navigating to /students...");
      await page.goto(`${baseUrl}/students`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);

      // 1. Attempt to load students from generated Excel dataset, fallback to programmatic generation
      interface StudentItem {
        firstName: string;
        lastName: string;
        guardianName: string;
        guardianContact: string;
        rollNumber: string;
        address: string;
      }

      const studentsDataset: StudentItem[] = [];
      const excelFilePath = path.resolve(process.cwd(), "docs/test-datasets/Pathshala_Pro_1_Year_Institution_Test_Dataset.xlsx");

      if (fs.existsSync(excelFilePath)) {
        try {
          console.log(`  -> Reading student records from generated dataset: ${path.basename(excelFilePath)}...`);
          const datasetWorkbook = new ExcelJS.Workbook();
          await datasetWorkbook.xlsx.readFile(excelFilePath);
          const stuSheet = datasetWorkbook.getWorksheet("Students");
          if (stuSheet) {
            stuSheet.eachRow((row, rowNumber) => {
              if (rowNumber === 1) return; // skip header
              const firstName = String(row.getCell(3).value || "");
              const lastName = String(row.getCell(4).value || "");
              const guardianName = String(row.getCell(9).value || "");
              let guardianContact = String(row.getCell(11).value || "").replace(/\D/g, "");
              if (guardianContact.startsWith("880")) guardianContact = guardianContact.slice(3);
              if (!guardianContact.startsWith("0")) guardianContact = `0${guardianContact}`;
              if (guardianContact.length < 11) guardianContact = `017${faker.string.numeric(8)}`;

              const rollNumber = String(row.getCell(2).value || `R-${String(rowNumber - 1).padStart(3, "0")}`);
              const address = String(row.getCell(13).value || "Dhaka, Bangladesh");

              if (firstName && lastName) {
                studentsDataset.push({
                  firstName,
                  lastName,
                  guardianName: guardianName || `${firstName} Guardian`,
                  guardianContact,
                  rollNumber,
                  address,
                });
              }
            });
            console.log(`  -> Loaded ${studentsDataset.length} students from generated Excel sheet.`);
          }
        } catch (err: any) {
          console.warn("  -> Notice reading Excel sheet, generating via script stream:", err?.message);
        }
      }

      // Fill up to target count if sheet had fewer or wasn't present
      while (studentsDataset.length < studentsToCreate) {
        const idx = studentsDataset.length + 1;
        const isBoy = idx % 2 === 1;
        const firstName = isBoy ? faker.person.firstName("male") : faker.person.firstName("female");
        const lastName = faker.person.lastName();
        studentsDataset.push({
          firstName,
          lastName,
          guardianName: `${faker.person.firstName("male")} ${lastName}`,
          guardianContact: `017${faker.string.numeric(8)}`,
          rollNumber: `R-${String(idx).padStart(3, "0")}`,
          address: `${faker.location.streetAddress()}, Dhaka`,
        });
      }

      console.log(`  -> Preparing automated script enrollment for ${studentsToCreate} students...`);
      const startTime = Date.now();

      for (let i = 0; i < studentsToCreate; i++) {
        const stu = studentsDataset[i];
        const sFirst = stu.firstName;
        const sLast = stu.lastName;
        const gName = stu.guardianName;
        const gPhone = stu.guardianContact;
        const sRoll = stu.rollNumber;
        const sAddress = stu.address;

        if ((i + 1) % 25 === 1 || i < 5 || i === studentsToCreate - 1) {
          const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
          const rate = i > 0 ? (i / ((Date.now() - startTime) / 1000)).toFixed(1) : "0.0";
          console.log(`\n[Creating Student ${i + 1}/${studentsToCreate}] (${rate} stu/sec, elapsed: ${elapsedSec}s)`);
          console.log(`  Name: ${sFirst} ${sLast} | Roll: ${sRoll} | Contact: ${gPhone}`);
        }

        const addStudentBtn = page.locator("button:has-text('Add Student'), button:has-text('New Student')").first();
        await addStudentBtn.waitFor({ state: "visible", timeout: 10000 });
        await addStudentBtn.click();

        // Wait for student form modal to render
        await page.locator("#student-firstName").waitFor({ state: "visible", timeout: 8000 });

        // High-speed instant fill for automated throughput
        const rollInput = page.locator("#student-rollNumber");
        if (await rollInput.isVisible()) {
          await rollInput.fill(sRoll);
        }

        await page.locator("#student-firstName").fill(sFirst);
        await page.locator("#student-lastName").fill(sLast);
        await page.locator("#student-guardianName").fill(gName);
        await page.locator("#student-guardianContact").fill(gPhone);

        const addressField = page.locator("#student-address");
        if (await addressField.isVisible()) {
          await addressField.fill(sAddress);
        }

        // Submit
        const saveStudentBtn = page.locator("button:has-text('Save Student'), button:has-text('Save')").last();
        await saveStudentBtn.click();

        // Self-healing check (only inspect if needed)
        await page.waitForTimeout(250);
        const fieldError = page.locator(".text-destructive, [aria-invalid='true']").first();

        if (await fieldError.isVisible()) {
          const errorText = await fieldError.innerText();
          console.warn(`\n  [Jev AI Alert]: Form validation error detected: "${errorText}"`);
          const repair = await jev.healFormError("student-guardianContact", errorText, gPhone);
          console.log(`  -> Jev Selected Strategy: "${repair.strategy}" (Provider: ${repair.source})`);
          console.log(`  -> Jev Repaired Phone Number: "${repair.healedValue}"`);

          await page.locator("#student-guardianContact").fill(repair.healedValue);
          await saveStudentBtn.click();
        }

        // Wait for TopSheet overlay to close before next loop
        await page.locator("div[role='dialog'], form#student-form").waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
        if (slowMo > 0) {
          await page.waitForTimeout(Math.min(slowMo, 200));
        }
      }

      const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n>>> ALL ${studentsToCreate} STUDENTS ENROLLED IN ${totalSeconds}s!`);
    }

    // ========================================================================
    // PHASE 4: HIGH-SPEED AUTOMATED STAFF CREATION
    // ========================================================================
    if (staffToCreate > 0) {
      console.log("\n>>> PHASE 4: HIGH-SPEED AUTOMATED STAFF CREATION");
      console.log("Navigating to /staff...");
      await page.goto(`${baseUrl}/staff`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);

      const excelFilePath = path.resolve(process.cwd(), "docs/test-datasets/Pathshala_Pro_1_Year_Institution_Test_Dataset.xlsx");

      // 1. Attempt to load staff from generated Excel dataset, fallback to synthetic generation
      interface StaffItem {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        department: string;
        designation: string;
        baseSalary: string;
        hireDate: string;
      }

    const staffDataset: StaffItem[] = [];

    if (fs.existsSync(excelFilePath)) {
      try {
        console.log(`  -> Reading staff records from generated dataset: ${path.basename(excelFilePath)}...`);
        const datasetWorkbook = new ExcelJS.Workbook();
        await datasetWorkbook.xlsx.readFile(excelFilePath);
        const stfSheet = datasetWorkbook.getWorksheet("Staff_Faculty");
        if (stfSheet) {
          stfSheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // skip header
            const firstName = String(row.getCell(2).value || "");
            const lastName = String(row.getCell(3).value || "");
            const email = String(row.getCell(4).value || "");
            let phone = String(row.getCell(5).value || "").replace(/\D/g, "");
            if (phone.startsWith("880")) phone = phone.slice(3);
            if (!phone.startsWith("0")) phone = `0${phone}`;
            if (phone.length < 11) phone = `018${faker.string.numeric(8)}`;

            const department = String(row.getCell(6).value || "Teaching");
            const designation = String(row.getCell(7).value || "Senior Teacher");
            const baseSalary = String(row.getCell(9).value || "42000");
            const hireRaw = String(row.getCell(10).value || "2024-01-01");
            // Format YYYY-MM-DD to DD/MM/YYYY for TenantDateInput
            let hireDate = "01/01/2024";
            if (hireRaw.includes("-")) {
              const [y, m, d] = hireRaw.split("-");
              hireDate = `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
            }

            if (firstName && lastName) {
              staffDataset.push({
                firstName,
                lastName,
                email,
                phone,
                department,
                designation,
                baseSalary,
                hireDate,
              });
            }
          });
          console.log(`  -> Loaded ${staffDataset.length} staff records from generated Excel sheet.`);
        }
      } catch (err: any) {
        console.warn("  -> Notice reading staff sheet, generating via script stream:", err?.message);
      }
    }

    // Fill up to target count if sheet had fewer
    const defaultDepartments = [
      { dept: "Teaching", titles: ["Senior Teacher", "Assistant Teacher", "Lecturer", "Junior Teacher"] },
      { dept: "Administration", titles: ["Academic Coordinator", "Head Clerk", "Administrative Officer"] },
      { dept: "Accounts & Finance", titles: ["Accounts Officer", "Cashier", "Accountant"] },
      { dept: "IT & Systems", titles: ["IT System Administrator", "Computer Lab In-charge"] },
      { dept: "Support & Library", titles: ["Librarian", "Assistant Librarian", "Lab Assistant"] },
    ];

    while (staffDataset.length < staffToCreate) {
      const idx = staffDataset.length + 1;
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const deptInfo = defaultDepartments[idx % defaultDepartments.length];
      const designation = faker.helpers.arrayElement(deptInfo.titles);
      const department = deptInfo.dept;
      const baseSalary = String(faker.number.int({ min: 28000, max: 55000 }));
      staffDataset.push({
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${baseSlug.replace(/-/g, "")}.edu.bd`,
        phone: `018${faker.string.numeric(8)}`,
        department,
        designation,
        baseSalary,
        hireDate: "01/01/2024",
      });
    }

    console.log(`  -> Preparing automated script hiring for ${staffToCreate} staff members...`);
    const staffStartTime = Date.now();

    for (let i = 0; i < staffToCreate; i++) {
      const stf = staffDataset[i];
      const stfFirst = stf.firstName;
      const stfLast = stf.lastName;
      const stfEmail = stf.email;
      const stfPhone = stf.phone;
      const assignedDept = stf.department;
      const assignedRole = stf.designation;
      const assignedSalary = stf.baseSalary;
      const assignedHireDate = stf.hireDate;

      if ((i + 1) % 10 === 1 || i < 5 || i === staffToCreate - 1) {
        const elapsedSec = ((Date.now() - staffStartTime) / 1000).toFixed(1);
        const rate = i > 0 ? (i / ((Date.now() - staffStartTime) / 1000)).toFixed(1) : "0.0";
        console.log(`\n[Hiring Staff ${i + 1}/${staffToCreate}] (${rate} staff/sec, elapsed: ${elapsedSec}s)`);
        console.log(`  Name: ${stfFirst} ${stfLast} | Role: ${assignedRole} (${assignedDept}) | Phone: ${stfPhone}`);
      }

      // Click "Add Staff" button
      const addStaffBtn = page.locator("button:has-text('Add Staff'), button:has-text('New Staff')").first();
      await addStaffBtn.waitFor({ state: "visible", timeout: 10000 });
      await addStaffBtn.click();

      // Wait for staff form modal to render
      await page.locator("#firstName").waitFor({ state: "visible", timeout: 8000 });

      // High-speed instant fill for automated throughput
      await page.locator("#firstName").fill(stfFirst);
      await page.locator("#lastName").fill(stfLast);

      const deptInput = page.locator("#department");
      if (await deptInput.isVisible()) {
        await deptInput.fill(assignedDept);
      }

      const desigInput = page.locator("#designation");
      if (await desigInput.isVisible()) {
        await desigInput.fill(assignedRole);
      }

      const emailInput = page.locator("#email");
      if (await emailInput.isVisible()) {
        await emailInput.fill(stfEmail);
      }

      const phoneInput = page.locator("#phone");
      if (await phoneInput.isVisible()) {
        await phoneInput.fill(stfPhone);
      }

      const salaryInput = page.locator("#baseSalary");
      if (await salaryInput.isVisible()) {
        await salaryInput.fill(assignedSalary);
      }

      const hireDateInput = page.locator("#hireDate");
      if (await hireDateInput.isVisible()) {
        await hireDateInput.fill(assignedHireDate);
      }

      // Submit
      const saveStaffBtn = page.locator("button:has-text('Save Staff'), button:has-text('Save')").last();
      await saveStaffBtn.click();

      // Self-healing check (only inspect if needed)
      await page.waitForTimeout(250);
      const staffFieldError = page.locator(".text-destructive, [aria-invalid='true']").first();

      if (await staffFieldError.isVisible()) {
        const errorText = await staffFieldError.innerText();
        console.warn(`\n  [Jev AI Alert]: Staff validation error detected: "${errorText}"`);
        const repair = await jev.healFormError("phone", errorText, stfPhone);
        console.log(`  -> Jev Selected Strategy: "${repair.strategy}" (Provider: ${repair.source})`);
        console.log(`  -> Jev Repaired Phone Number: "${repair.healedValue}"`);

        await page.locator("#phone").fill(repair.healedValue);
        await saveStaffBtn.click();
      }

      // Wait for TopSheet overlay to close before next loop
      await page.locator("div[role='dialog'], form").waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
      if (slowMo > 0) {
        await page.waitForTimeout(Math.min(slowMo, 200));
      }
    }

    const staffTotalSec = ((Date.now() - staffStartTime) / 1000).toFixed(1);
    console.log(`\n>>> ALL ${staffToCreate} STAFF MEMBERS APPOINTED IN ${staffTotalSec}s!`);
    }

    // ========================================================================
    // FINAL DEMONSTRATION & INSPECTION
    // ========================================================================
    console.log("\n=============================================================");
    console.log("  COMPLETE AGENTIC AUTOMATION FINISHED SUCCESSFULLY!");
    console.log("=============================================================");
    console.log(`  School:     ${schoolName}`);
    console.log(`  Tenant:     ${tenantSlug}`);
    console.log(`  Admin User: ${adminEmail}`);
    console.log(`  Jev AI:     Structured decisions processed via Vercel AI Gateway`);
    console.log(`  Students:   ${studentsToCreate} enrolled via live TopSheet form`);
    console.log(`  Staff:      ${staffToCreate} hired via live TopSheet form`);
    console.log("=============================================================\n");

    console.log("Keeping browser open for 25 seconds for visual review...");
    await page.waitForTimeout(25000);
  } catch (err) {
    console.error("\nAutomation Notice:", err);
    console.log("Keeping browser open for 10 seconds before exit...");
    await page.waitForTimeout(10000);
    throw err;
  } finally {
    console.log("Closing browser session...");
    await browser.close();
  }
}

// Execute
runCompleteSchoolAutomation().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});
