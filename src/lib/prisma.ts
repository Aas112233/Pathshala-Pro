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

  // Serverless warning: a direct (non-pooled, non-Accelerate) URL forces a
  // fresh TLS + pool handshake per cold invocation and risks exhausting the
  // Neon connection limit under burst load. Point DATABASE_URL at the pooled
  // endpoint (see .env.example) and keep DIRECT_URL direct for migrations.
  if (
    process.env.NODE_ENV === "production" &&
    !url.includes("pgbouncer=true") &&
    !url.includes("-pooler")
  ) {
    console.warn(
      "[prisma] DATABASE_URL looks non-pooled in production. Use the Neon pooled endpoint with pgbouncer=true for serverless."
    );
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
// connection-pool handshake on every warm API call. Pair with a pooled
// DATABASE_URL (pgbouncer) in production — see .env.example.
globalForPrisma.prisma = prisma;

// Transient connection/pool failures worth one retry cycle with backoff:
// unreachable host, auth/timeout at connect, engine timeouts, pool exhaustion,
// transaction API aborts. Everything else (constraints, validation) throws
// immediately — retrying those is never correct.
const TRANSIENT_DB_CODES = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2024",
  "P2028",
]);
const TRANSIENT_DB_NAMES = new Set([
  "PrismaClientInitializationError",
  "PrismaClientRustPanicError",
  "PrismaClientUnknownRequestError",
]);

export function isTransientDbError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, name } = error as { code?: unknown; name?: unknown };
  return (
    (typeof code === "string" && TRANSIENT_DB_CODES.has(code)) ||
    (typeof name === "string" && TRANSIENT_DB_NAMES.has(name))
  );
}

/** Run a DB operation with exponential-backoff retry on transient failures only. */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 200;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === maxAttempts) throw error;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

/** Cheap startup/warmup ping — fails fast through the same retry cycle. */
export async function ensureDbConnection(): Promise<void> {
  await withDbRetry(() => prisma.$queryRaw`SELECT 1`);
}

export default prisma;
