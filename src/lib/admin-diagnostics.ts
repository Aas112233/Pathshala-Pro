import { prisma } from "@/lib/prisma";
import { toCents } from "@/lib/math-utils";
import { z } from "zod";

export const diagnosticsQuerySchema = z.object({
  tenantId: z.string().trim().min(1).max(100),
  check: z.enum(["placement", "fees"]),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().refine((n) => [10, 20, 50, 100].includes(n)).default(20),
  search: z.string().trim().max(100).default(""),
});
export type DiagnosticsQuery = z.infer<typeof diagnosticsQuerySchema>;
export type DiagnosticIssue = "classMissing" | "sectionMismatch" | "groupMismatch" | "feeBalance" | "invalidAmount";
export interface DiagnosticRow {
  id: string;
  reference: string;
  issues: DiagnosticIssue[];
}
export interface DiagnosticsResult {
  rows: DiagnosticRow[];
  totalCount: number;
  checkedAt: string;
}

/** Only tests stored balance arithmetic; does not reconcile payments or journals. */
export function checkFeeBalance(voucher: { totalDue: number | string | { toString(): string }; amountPaid: number | string | { toString(): string }; balance: number | string | { toString(): string } }): DiagnosticIssue[] {
  const values = [voucher.totalDue, voucher.amountPaid, voucher.balance].map((v) => Number(v?.toString?.() ?? v));
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return ["invalidAmount"];
  const [due, paid, balance] = values.map((value) => toCents(value));
  if (![due, paid, balance].every(Number.isSafeInteger)) return ["invalidAmount"];
  return due - paid === balance ? [] : ["feeBalance"];
}

/**
 * Bounded, read-only checks. Each response checks one page, not the whole tenant.
 * Related entities are fetched with tenant predicates rather than unscoped includes.
 * Repeatable-read keeps the page and its dependencies in one consistent snapshot.
 * This intentionally does not compare current placement to historical sessions.
 */
export async function runAdminDiagnostics(input: DiagnosticsQuery): Promise<DiagnosticsResult> {
  const { tenantId, check, page, pageSize, search } = diagnosticsQuerySchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const paging = { skip: (page - 1) * pageSize, take: pageSize, orderBy: { id: "asc" as const } };
    if (check === "fees") {
      const where = { tenantId, voidedAt: null, status: { notIn: ["VOID", "VOIDED", "CANCELLED"] },
        ...(search ? { voucherId: { contains: search, mode: "insensitive" as const } } : {}) };
      const totalCount = await tx.feeVoucher.count({ where });
      const vouchers = await tx.feeVoucher.findMany({ where, ...paging,
        select: { id: true, voucherId: true, totalDue: true, amountPaid: true, balance: true } });
      return { totalCount, checkedAt: new Date().toISOString(), rows: vouchers.map((v) => ({
        id: v.id, reference: v.voucherId, issues: checkFeeBalance(v),
      })) };
    }
    const where = { tenantId, ...(search ? { studentId: { contains: search, mode: "insensitive" as const } } : {}) };
    const totalCount = await tx.studentProfile.count({ where });
    const students = await tx.studentProfile.findMany({ where, ...paging,
      select: { id: true, studentId: true, classId: true, sectionId: true, groupId: true } });
    const ids = (field: "classId" | "sectionId" | "groupId") =>
      [...new Set(students.flatMap((s) => s[field] ? [s[field]!] : []))];
    const classes = await tx.class.findMany({ where: { tenantId, id: { in: ids("classId") } }, select: { id: true } });
    const sections = await tx.section.findMany({ where: { tenantId, id: { in: ids("sectionId") } }, select: { id: true, classId: true, groupId: true } });
    const groups = await tx.group.findMany({ where: { tenantId, id: { in: ids("groupId") } }, select: { id: true, classId: true } });
    const classIds = new Set(classes.map((c) => c.id));
    const sectionMap = new Map(sections.map((s) => [s.id, s]));
    const groupMap = new Map(groups.map((g) => [g.id, g]));
    return { totalCount, checkedAt: new Date().toISOString(), rows: students.map((s) => {
      const issues: DiagnosticIssue[] = [];
      if (s.classId && !classIds.has(s.classId)) issues.push("classMissing");
      const section = s.sectionId ? sectionMap.get(s.sectionId) : undefined;
      if (s.sectionId && (!section || section.classId !== s.classId || (section.groupId && section.groupId !== s.groupId))) issues.push("sectionMismatch");
      const group = s.groupId ? groupMap.get(s.groupId) : undefined;
      if (s.groupId && (!group || group.classId !== s.classId)) issues.push("groupMismatch");
      return { id: s.id, reference: s.studentId, issues };
    }) };
  }, { isolationLevel: "RepeatableRead", timeout: 10000 });
}
