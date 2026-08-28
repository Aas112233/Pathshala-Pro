import { prisma } from "@/lib/prisma";

/**
 * Tenant isolation helpers & Prisma 6 Client Extension.
 */
export function tenantWhere<T extends Record<string, unknown>>(
  tenantId: string,
  where: T
): T & { tenantId: string } {
  return { ...where, tenantId };
}

export async function requireTenantRecord<T>(
  finder: Promise<T | null>,
  notFoundMessage = "Record not found"
): Promise<T> {
  const record = await finder;
  if (!record) throw new Error(notFoundMessage);
  return record;
}

/**
 * Multi-Tenant Prisma 6 Extension
 * Automatically injects `tenantId` into queries and mutations to prevent cross-tenant leakage.
 */
export function createTenantPrismaClient(tenantId: string) {
  if (!tenantId) {
    throw new Error("tenantId is required to instantiate a tenant-scoped Prisma client.");
  }

  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async count({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = {
            ...(args.data as Record<string, unknown>),
            tenantId,
          } as typeof args.data;
          return query(args);
        },
        async updateMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async deleteMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
      },
    },
  });
}

export type TenantPrismaClient = ReturnType<typeof createTenantPrismaClient>;
