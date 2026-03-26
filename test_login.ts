import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function check() {
  const u = await prisma.user.findFirst({ where: { email: 'admin@demohighschool.edu' } });
  if (!u) {
    console.log("No user found");
    return;
  }
  console.log('DB hash:', u.hash);
  console.log('Match with password123:', bcrypt.compareSync('password123', u.hash));
}
check().finally(() => prisma.$disconnect());
