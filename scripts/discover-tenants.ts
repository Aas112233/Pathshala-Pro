import { prisma } from "@/lib/prisma";

async function main() {
  console.log("Discovering tenant IDs for test users...");
  
  const users = [
    { email: 'superadmin@pathshalapro.net', name: 'Superadmin' },
    { email: 'principleamsc@pathshalapro.edu', name: 'SchoolAdmin' },
    { email: 'teacher@pathshalapro.com', name: 'Teacher' },
  ];
  
  for (const user of users) {
    try {
      const matchingUsers = await prisma.user.findMany({
        where: { email: user.email },
        include: { tenant: true },
        take: 5,
      });
      
      console.log(`\n${user.name} (${user.email}):`);
      if (matchingUsers.length === 0) {
        console.log('  No users found');
      } else if (matchingUsers.length === 1) {
        const u = matchingUsers[0];
        console.log(`  ID: ${u.id}`);
        console.log(`  Tenant ID: ${u.tenantId}`);
        console.log(`  Tenant Name: ${u.tenant?.name || 'N/A'}`);
        console.log(`  Role: ${u.role}`);
        console.log(`  UpdatedAt: ${u.updatedAt.toISOString()}`);
      } else {
        console.log(`  Found ${matchingUsers.length} users:`);
        matchingUsers.forEach((u, i) => {
          console.log(`    ${i+1}. Tenant ID: ${u.tenantId}, Name: ${u.tenant?.name || 'N/A'}, Role: ${u.role}`);
        });
      }
    } catch (error) {
      console.error(`${user.name} query failed:`, error);
    }
  }
}

main()
  .catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });