import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

// N+1 query detection: logs warnings when multiple similar queries fire in quick succession
const N1_THRESHOLD = 5;
const N1_WINDOW_MS = 1000;
const queryLog: Map<string, { count: number; firstSeen: number }> = new Map();

function createClient(): PrismaClient {
  const basePrisma = new PrismaClient({
    log:
      process.env.NODE_ENV === "development" && process.env.DEBUG_PRISMA === "true"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  // N+1 detection in development
  if (process.env.NODE_ENV === "development" && process.env.DETECT_N1 === "true") {
    basePrisma.$on("query", (e) => {
      const model = e.query.match(/(?:from|into|update|join)\s+"?(\w+)"?/i)?.[1] ?? "unknown";
      const key = `${model}:${e.query.substring(0, 80)}`;
      const now = Date.now();
      const entry = queryLog.get(key);
      if (!entry || now - entry.firstSeen > N1_WINDOW_MS) {
        queryLog.set(key, { count: 1, firstSeen: now });
      } else {
        entry.count++;
        if (entry.count === N1_THRESHOLD) {
          console.warn(`[N+1 Detected] ${entry.count}+ similar queries for "${model}" within ${N1_WINDOW_MS}ms`);
          console.warn(`  Query: ${e.query.substring(0, 120)}...`);
        }
      }
    });
  }

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

// Reuse one client per server instance in every env. On Vercel serverless the
// module cache survives warm invocations, so this avoids a fresh TLS +
// connection-pool handshake on every cold API call (direct Neon URL, no
// Accelerate/pgbouncer in this deployment).
globalForPrisma.prisma = prisma;

export default prisma;
