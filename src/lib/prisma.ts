import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

// High-performance pooled client with Accelerate extension
function createClient() {
  const basePrisma = new PrismaClient({
    log:
      process.env.NODE_ENV === "development" && process.env.DEBUG_PRISMA === "true"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  return basePrisma.$extends(withAccelerate());
}

export type AcceleratePrismaClient = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as {
  prisma?: AcceleratePrismaClient;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
