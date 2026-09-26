import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";

/**
 * Resolve a tenant-owned academic year and enforce that it is writable.
 * Keep this check close to every write boundary; UI-selected years are not
 * trusted and a fiscal-year lock does not imply an academic-year lock.
 */
export async function assertAcademicYearOpen(
  tenantId: string,
  academicYearId: string,
  label = "Academic year"
) {
  const academicYear = await prisma.academicYear.findFirst({
    where: { id: academicYearId, tenantId },
    select: { id: true, tenantId: true, yearId: true, label: true, isClosed: true },
  });

  if (!academicYear) {
    throw ApiError.notFound(`${label} not found`);
  }

  if (academicYear.isClosed) {
    throw ApiError.conflict(`${label} '${academicYear.label}' is closed and read-only`, [
      { field: "academicYearId", code: "ACADEMIC_YEAR_CLOSED", message: "Mutations are not allowed for a closed academic year." },
    ]);
  }

  return academicYear;
}

export async function assertAcademicYearsOpen(
  tenantId: string,
  academicYearIds: string[]
) {
  const uniqueIds = [...new Set(academicYearIds)];
  const years = await prisma.academicYear.findMany({
    where: { tenantId, id: { in: uniqueIds } },
    select: { id: true, label: true, isClosed: true },
  });

  if (years.length !== uniqueIds.length) {
    throw ApiError.notFound("One or more academic years were not found");
  }

  const closed = years.find((year) => year.isClosed);
  if (closed) {
    throw ApiError.conflict(`Academic year '${closed.label}' is closed and read-only`, [
      { field: "academicYearId", code: "ACADEMIC_YEAR_CLOSED", message: "Mutations are not allowed for a closed academic year." },
    ]);
  }

  return years;
}

/**
 * Why an academic year was chosen. Callers that need to explain the selection
 * to an operator (or to distinguish "the institute said so" from "we guessed")
 * read this rather than re-deriving it.
 */
export type ActiveAcademicYearSource =
  | "isCurrent"
  | "dateRange"
  | "latestOpen"
  | "latestAny"
  | "none";

export interface ActiveAcademicYearResolution {
  id: string;
  source: ActiveAcademicYearSource;
}

/**
 * The slice of the Prisma client this module needs. Both the full client and a
 * transaction client satisfy it, so the resolver can run inside a transaction.
 */
export type AcademicYearReader = Pick<Prisma.TransactionClient, "academicYear">;

/**
 * Resolve the year the institute is operating in, deterministically.
 *
 * The hierarchy is deliberate and the order matters:
 *  1. `isCurrent` — the year the institute stated. This is the only tier that
 *     is not an inference, and it exists because date ranges genuinely overlap:
 *     a school opens next year's records before closing the current one, so
 *     both cover today for a while.
 *  2. The open year whose date range covers today. Ordered by `startDate desc`,
 *     because two overlapping years matching is exactly the case that used to
 *     resolve arbitrarily — `findFirst` with no `orderBy` returns whatever the
 *     planner happens to hand back first, and the answer could differ between
 *     two identical requests.
 *  3. The latest open year.
 *  4. The latest year of any kind, closed included, so an institute that has
 *     closed everything can still read its own history.
 *  5. Nothing at all.
 */
export async function resolveActiveAcademicYear(
  tenantId: string,
  client: AcademicYearReader = prisma
): Promise<ActiveAcademicYearResolution> {
  const flagged = await client.academicYear.findFirst({
    where: { tenantId, isCurrent: true, isClosed: false },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
  if (flagged) return { id: flagged.id, source: "isCurrent" };

  const now = new Date();
  const currentByDate = await client.academicYear.findFirst({
    where: { tenantId, isClosed: false, startDate: { lte: now }, endDate: { gte: now } },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
  if (currentByDate) return { id: currentByDate.id, source: "dateRange" };

  const latestOpen = await client.academicYear.findFirst({
    where: { tenantId, isClosed: false },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
  if (latestOpen) return { id: latestOpen.id, source: "latestOpen" };

  const latestAny = await client.academicYear.findFirst({
    where: { tenantId },
    orderBy: { startDate: "desc" },
    select: { id: true },
  });
  if (latestAny) return { id: latestAny.id, source: "latestAny" };

  return { id: "", source: "none" };
}

export async function resolveActiveAcademicYearId(
  tenantId: string,
  client: AcademicYearReader = prisma
): Promise<string> {
  return (await resolveActiveAcademicYear(tenantId, client)).id;
}

/**
 * Resolve the applicable academic year for a request.
 * Hierarchy:
 * 1. Explicit query parameter `academicYearId`
 * 2. Request header `x-academic-year-id`
 * 3. Cookie `pathshala_academic_year`
 * 4. The active year, via `resolveActiveAcademicYear`
 *
 * Tiers 1-3 are the operator's stated intent and are taken at face value — they
 * are validated downstream by `assertAcademicYearOpen` where it matters. Tier 4
 * is an inference, and it is now the same inference on the server and in the
 * client provider, so the two cannot disagree about which year is current.
 */
export const defaultAcademicYearCache = new Map<string, { yearId: string; expiresAt: number }>();

export function clearAcademicYearCache(): void {
  defaultAcademicYearCache.clear();
}

export async function resolveRequestAcademicYearId(
  request: NextRequest,
  tenantId: string
): Promise<string> {
  const paramYear = request.nextUrl.searchParams.get("academicYearId")?.trim();
  if (paramYear) return paramYear;

  const headerYear = request.headers.get("x-academic-year-id")?.trim();
  if (headerYear) return headerYear;

  const cookieYear = request.cookies.get("pathshala_academic_year")?.value?.trim();
  if (cookieYear) return cookieYear;

  const nowMs = Date.now();
  if (process.env.NODE_ENV !== "test") {
    const cached = defaultAcademicYearCache.get(tenantId);
    if (cached && cached.expiresAt > nowMs) {
      return cached.yearId;
    }
  }

  const { id } = await resolveActiveAcademicYear(tenantId);
  defaultAcademicYearCache.set(tenantId, { yearId: id, expiresAt: nowMs + 60000 });
  return id;
}

/**
 * Serialise year-lifecycle flag changes for one tenant.
 *
 * There is no database-level guarantee that at most one row per tenant holds
 * `isCurrent`: the constraint that would express it is a *partial* unique index
 * (`(tenantId) WHERE "isCurrent"`), which Prisma's schema language cannot
 * declare and which this project's `db push` workflow would not maintain (an
 * out-of-band index is dropped on the next push). So the invariant is upheld
 * in the application — and because two concurrent check-then-set transactions
 * under READ COMMITTED can both observe "no current year" and both set the
 * flag, the check-then-set is serialised with a transaction-scoped Postgres
 * advisory lock keyed by tenant. The lock releases at commit/rollback and is
 * safe under pgbouncer transaction pooling because it lives inside the
 * transaction's own server connection. `setCurrentAcademicYear` is the only
 * place that writes the flag to `true`.
 */
export async function lockAcademicYearSwitch(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`;
}

export async function setCurrentAcademicYear(
  tx: Prisma.TransactionClient,
  tenantId: string,
  academicYearId: string
): Promise<{ label: string }> {
  await lockAcademicYearSwitch(tx, tenantId);

  const target = await tx.academicYear.findFirst({
    where: { id: academicYearId, tenantId },
    select: { id: true, label: true, isClosed: true },
  });

  if (!target) throw ApiError.notFound("Academic year not found");

  if (target.isClosed) {
    throw ApiError.conflict(
      `Academic year '${target.label}' is closed and cannot be the current year`,
      [
        {
          field: "isCurrent",
          code: "ACADEMIC_YEAR_CLOSED",
          message: "A closed academic year cannot be current.",
        },
      ]
    );
  }

  // Clear first, then set: doing it in the other order would briefly leave two
  // current years, which is the state the flag exists to prevent.
  await tx.academicYear.updateMany({
    where: { tenantId, isCurrent: true, id: { not: academicYearId } },
    data: { isCurrent: false },
  });
  // The write itself is tenant-scoped (and refuses a year that closed while
  // this transaction was waiting on the lock), not just the read above.
  const written = await tx.academicYear.updateMany({
    where: { id: academicYearId, tenantId, isClosed: false },
    data: { isCurrent: true },
  });
  if (written.count === 0) {
    throw ApiError.notFound("Academic year not found");
  }

  return { label: target.label };
}

/**
 * Drop the current flag from a year. Used when closing it — a closed year
 * cannot be the year the institute is operating in, and leaving the flag set
 * would make `resolveActiveAcademicYear` skip past it to a weaker tier.
 */
export async function clearCurrentAcademicYear(
  tx: Prisma.TransactionClient,
  tenantId: string,
  academicYearId: string
): Promise<void> {
  await tx.academicYear.updateMany({
    where: { tenantId, id: academicYearId, isCurrent: true },
    data: { isCurrent: false },
  });
}

/**
 * Atomically ensure that a StudentAcademicSession exists for a student in the given academic year.
 * If already present, updates the active enrollment fields (class, section, group, rollNumber).
 */
export async function ensureStudentAcademicSession(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    studentProfileId: string;
    academicYearId: string;
    classId: string;
    sectionId?: string | null;
    groupId?: string | null;
    rollNumber: string;
    classNumber?: number;
  }
) {
  const {
    tenantId,
    studentProfileId,
    academicYearId,
    classId,
    sectionId,
    groupId,
    rollNumber,
    classNumber = 0,
  } = params;

  if (!academicYearId || !classId) return null;

  const existing = await tx.studentAcademicSession.findUnique({
    where: {
      tenantId_studentProfileId_academicYearId: {
        tenantId,
        studentProfileId,
        academicYearId,
      },
    },
  });

  if (existing) {
    return tx.studentAcademicSession.update({
      where: { id: existing.id },
      data: {
        classId,
        sectionId: sectionId ?? null,
        groupId: groupId ?? null,
        rollNumber,
        classNumber,
      },
    });
  }

  return tx.studentAcademicSession.create({
    data: {
      tenantId,
      studentProfileId,
      academicYearId,
      classId,
      sectionId: sectionId ?? null,
      groupId: groupId ?? null,
      rollNumber,
      classNumber,
      totalMarks: 0,
      obtainedMarks: 0,
      promotionStatus: "ENROLLED",
    },
  });
}

