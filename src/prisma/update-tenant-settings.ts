import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Updating tenant with settings...");

  // Update all tenants with default settings
  const updated = await prisma.tenant.updateMany({
    data: {
      schoolCode: "DH-2024",
      establishedYear: 2020,
      motto: "Education for All",
      website: "www.demohighschool.edu",
      currency: "BDT",
      currencySymbol: "৳",
      taxRate: 0,
      dateFormat: "DD/MM/YYYY",
      timeFormat: "24h",
      timezone: "Asia/Dhaka",
      firstDayOfWeek: "sunday",
      academicYearStart: "january",
      gradingSystem: "GPA",
    },
    where: {
      tenantId: "demo-school-001",
    },
  });

  console.log(`✅ Updated ${updated.count} tenant(s) with settings`);
}

main()
  .catch((e) => {
    console.error("❌ Update failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
