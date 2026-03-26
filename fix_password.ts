import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@demohighschool.edu';
  const password = 'password123';
  
  const user = await prisma.user.findFirst({
    where: { email }
  });

  if (!user) {
    console.log(`User not found: ${email}`);
    process.exit(1);
  }

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);

  await prisma.user.update({
    where: { id: user.id },
    data: { hash }
  });

  console.log(`Password updated successfully for: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
