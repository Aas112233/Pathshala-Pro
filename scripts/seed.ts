import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@demohighschool.edu";
  const tenantId = "tenant-001";
  
  // Create Demo High School Tenant
  await prisma.tenant.upsert({
    where: { tenantId },
    update: {},
    create: {
      tenantId,
      name: "Demo High School",
      address: "123 School Ave",
    }
  });

  // Simple hash for password123 development (see lib/auth.ts)
  const encoder = new TextEncoder();
  const data = encoder.encode("password123" + "pathshala-pro-salt-2026");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // Create Admin User
  await prisma.user.upsert({
    where: { 
      tenantId_email: {
        tenantId,
        email: adminEmail
      }
    },
    update: {
      hash
    },
    create: {
      tenantId,
      email: adminEmail,
      name: "Admin User",
      role: "ADMIN",
      hash,
      isActive: true,
    }
  });

  console.log("Database seeded successfully with Demo High School and admin user.");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
