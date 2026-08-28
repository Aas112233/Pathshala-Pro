import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const superAdminEmail = "superadmin@pathshalapro.com";
  const defaultPassword = "password123";

  // Check if system tenant exists
  let systemTenant = await prisma.tenant.findFirst({
    where: { tenantId: "system-platform" },
  });

  if (!systemTenant) {
    systemTenant = await prisma.tenant.create({
      data: {
        tenantId: "system-platform",
        name: "Pathshala-Pro Platform",
        address: "Global Headquarters",
        subscriptionStatus: "ACTIVE",
        fiscalYearStart: 1,
        currency: "USD",
        currencySymbol: "$",
        dateFormat: "DD/MM/YYYY",
        timeFormat: "24h",
        timezone: "UTC",
        firstDayOfWeek: "monday",
        gradingSystem: "GPA",
      },
    });
    console.log("Created system tenant:", systemTenant.id);
  }

  const existingSuperAdmin = await prisma.user.findFirst({
    where: { email: superAdminEmail },
  });

  if (existingSuperAdmin) {
    await prisma.user.update({
      where: { id: existingSuperAdmin.id },
      data: {
        role: "SYSTEM_ADMIN",
        hash: bcrypt.hashSync(defaultPassword, 10),
        isActive: true,
      },
    });
    console.log("Updated existing SuperAdmin user password and role to SYSTEM_ADMIN.");
  } else {
    await prisma.user.create({
      data: {
        tenantId: systemTenant.tenantId,
        email: superAdminEmail,
        name: "Platform SuperAdmin",
        role: "SYSTEM_ADMIN",
        hash: bcrypt.hashSync(defaultPassword, 10),
        isActive: true,
      },
    });
    console.log("Created new SuperAdmin user:", superAdminEmail);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
