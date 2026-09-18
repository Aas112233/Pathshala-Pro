/**
 * Idempotent seed for SaaS SubscriptionPlan catalog.
 *
 * The TenantSubscription model requires a valid SubscriptionPlan row via FK.
 * This script guarantees the standard plan tiers exist so the superadmin
 * subscription control panel can resolve plans by code.
 *
 * Run with: npx tsx src/prisma/seed-plans.ts
 */
import { prisma } from "../lib/prisma";

const PLANS = [
  {
    code: "STARTER",
    name: "Starter",
    description: "Entry tier for small schools.",
    monthlyPrice: 149,
    annualPrice: 1490,
    currency: "USD",
    maxStudents: 200,
    maxStaff: 20,
    maxStorageMb: 5120,
    maxSmsPerMonth: 500,
    features: {
      hostel: false,
      transport: false,
      payroll: false,
      customGrading: true,
    },
  },
  {
    code: "PRO",
    name: "Professional",
    description: "Scaled tier for growing schools.",
    monthlyPrice: 299,
    annualPrice: 2990,
    currency: "USD",
    maxStudents: 600,
    maxStaff: 60,
    maxStorageMb: 20480,
    maxSmsPerMonth: 2000,
    features: {
      hostel: true,
      transport: true,
      payroll: true,
      customGrading: true,
    },
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    description: "Full-featured tier for multi-campus institutions.",
    monthlyPrice: 599,
    annualPrice: 5990,
    currency: "USD",
    maxStudents: 5000,
    maxStaff: 500,
    maxStorageMb: 102400,
    maxSmsPerMonth: 10000,
    features: {
      hostel: true,
      transport: true,
      payroll: true,
      customGrading: true,
      biometric: true,
      onlinePay: true,
    },
  },
];

async function main() {
  let upserted = 0;
  for (const plan of PLANS) {
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { code: plan.code },
    });
    if (existing) {
      await prisma.subscriptionPlan.update({
        where: { code: plan.code },
        data: plan,
      });
    } else {
      await prisma.subscriptionPlan.create({ data: plan });
    }
    upserted += 1;
  }
  const count = await prisma.subscriptionPlan.count();
  console.log(`SubscriptionPlan seed complete. ${upserted} plans processed, ${count} total in DB.`);
}

main()
  .catch((e) => {
    console.error("Plan seed failed:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
