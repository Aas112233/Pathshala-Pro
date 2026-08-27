import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TENANT_ID = process.argv[2] || "demo-school-001";
const EMAIL = process.argv[3] || "admin@demohighschool.edu";
const PASSWORD = process.argv[4];
const NAME = process.argv[5] || "Admin User";

async function main() {
  if (!PASSWORD || PASSWORD.length < 8) {
    console.error("Usage: tsx src/prisma/create-admin.ts [tenantId] [email] <password> [name]");
    process.exit(1);
  }

  const tenant = await prisma.tenant.upsert({
    where: { tenantId: TENANT_ID },
    update: {},
    create: {
      tenantId: TENANT_ID,
      name: NAME === "Admin User" ? "Demo High School" : `${NAME}'s School`,
      address: "Not configured",
      subscriptionStatus: "TRIAL",
    },
  });

  const hash = bcrypt.hashSync(PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.tenantId, email: EMAIL } },
    update: { hash, isActive: true, role: "ADMIN" },
    create: {
      tenantId: tenant.tenantId,
      email: EMAIL,
      name: NAME,
      role: "ADMIN",
      hash,
      isActive: true,
    },
  });

  console.log("Tenant ready:", tenant.tenantId);
  console.log("Admin ready:", user.email, "| role:", user.role, "| active:", user.isActive);
}

main()
  .catch((e) => {
    console.error("Failed:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
