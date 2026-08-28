import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

// High-performance pooled client with Accelerate extension
function createClient(): PrismaClient {
  const basePrisma = new PrismaClient({
    log:
      process.env.NODE_ENV === "development" && process.env.DEBUG_PRISMA === "true"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  const url = process.env.DATABASE_URL || "";
  if (url.startsWith("prisma://") || url.startsWith("prisma+postgres://")) {
    return basePrisma.$extends(withAccelerate()) as unknown as PrismaClient;
  }

  return basePrisma;
}

export type AcceleratePrismaClient = PrismaClient;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
