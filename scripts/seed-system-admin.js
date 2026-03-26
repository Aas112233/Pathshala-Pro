const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'system.admin@pathshalapro.com';
  const tenantId = 'SYSTEM';

  // 1. Ensure the SYSTEM tenant exists
  const systemTenant = await prisma.tenant.upsert({
    where: { tenantId },
    update: {},
    create: {
      tenantId,
      name: 'System Administration',
      address: 'Cloud Infrastructure',
      subscriptionStatus: 'ACTIVE',
    },
  });

  console.log('SYSTEM Tenant verified:', systemTenant.name);

  // 2. Create/Update the System Admin User
  // Note: Password will be 'admin123' (hashed via bcrypt manually below if creating new)
  // For simplicity, we just update the existing admin user if email matches, or create a new one.
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('admin123', 10);

  const user = await prisma.user.upsert({
    where: { 
      tenantId_email: {
        tenantId,
        email
      }
    },
    update: {
      role: 'SYSTEM_ADMIN',
      isActive: true,
    },
    create: {
      tenantId,
      email,
      name: 'Global System Admin',
      role: 'SYSTEM_ADMIN',
      hash,
      isActive: true,
    },
  });

  console.log('System Admin User ready:', user.email);
  console.log('Role:', user.role);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
