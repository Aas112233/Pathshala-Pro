import { randomBytes } from "crypto";

/**
 * Certificate numbering — the single source of truth.
 *
 * Both the single-issue route and the bulk route allocate numbers through this
 * module so the two paths cannot drift. That matters more here than usual: a
 * certificate number is printed on a document that leaves the building, and a
 * numbering scheme that resets or repeats silently is not auditable.
 *
 * Format: `CERT-<TYPE>-<YEAR>-<SEQ>-<RAND>`
 *   CERT-TRANSFER-2026-00042-A1B2C3D4
 *
 * Certificate numbers are verified through a PUBLIC, unauthenticated endpoint.
 * Purely sequential numbers (`...-00001`..`N`) were enumerable and leaked
 * student identities across every tenant, so every new number carries a random
 * capability suffix. Legacy suffix-less numbers remain verifiable and parseable.
 */

export type CertificateType =
  | "TRANSFER"
  | "CHARACTER"
  | "BONAFIDE"
  | "STUDY"
  | "MARKSHEET"
  | "OTHER";

export const CERTIFICATE_TYPES: CertificateType[] = [
  "TRANSFER",
  "CHARACTER",
  "BONAFIDE",
  "STUDY",
  "MARKSHEET",
  "OTHER",
];

/** Statuses that mean "a certificate of this type is already in force". */
export const ACTIVE_CERTIFICATE_STATUSES = ["ISSUED", "DRAFT"] as const;

/**
 * Certificate types where a student may hold at most one active document.
 *
 * A transfer certificate records a one-way event — a student leaving the
 * school. A second active TC is not a new event, it is a duplicate, and the
 * superseded one has to be revoked first. Bonafide, character, study and
 * marksheet certificates are purpose-bound and legitimately repeat, so they are
 * deliberately absent here.
 */
export const SINGLE_ACTIVE_CERTIFICATE_TYPES: CertificateType[] = ["TRANSFER"];

export function isSingleActiveCertificateType(certificateType: string): boolean {
  return SINGLE_ACTIVE_CERTIFICATE_TYPES.includes(certificateType as CertificateType);
}

export function certificateNumberPrefix(certificateType: string, year: number): string {
  return `CERT-${certificateType}-${year}-`;
}

/**
 * The next sequence for a number sharing `prefix`.
 *
 * The sequence sits directly after the prefix, so it is read by *position* —
 * the first segment past `CERT-<TYPE>-<YEAR>-`. Reading it as "the last numeric
 * segment" instead would be wrong: the capability suffix is hex, so it is
 * entirely digits about 2% of the time, and such a number would be read as a
 * sequence of tens of millions. Both the current format
 * (`CERT-TRANSFER-2026-00042-A1B2C3D4`) and the legacy suffix-less format
 * (`CERT-BONAFIDE-2026-00007`) put the sequence in the same position, so one
 * rule covers both.
 */
export function nextCertificateSequence(
  latestCertificateNumber: string | null | undefined,
  prefix: string
): number {
  if (!latestCertificateNumber) return 1;

  // A number outside this prefix belongs to another type or year and says
  // nothing about this sequence. Treating it as a predecessor would let one
  // type's volume leak into another's numbering.
  if (!latestCertificateNumber.startsWith(prefix)) return 1;

  const afterPrefix = latestCertificateNumber.slice(prefix.length);

  const firstSegment = afterPrefix.split("-")[0];
  if (/^\d+$/.test(firstSegment)) return parseInt(firstSegment, 10) + 1;

  // Defensive: a number inside the prefix but not following the format still
  // yields a usable sequence rather than silently resetting to 1.
  const segments = afterPrefix.split("-");
  for (let i = segments.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(segments[i])) return parseInt(segments[i], 10) + 1;
  }
  return 1;
}

/** Compose a number from a prefix and a sequence, adding a fresh capability suffix. */
export function formatCertificateNumber(prefix: string, sequence: number): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}${String(sequence).padStart(5, "0")}-${suffix}`;
}

/**
 * The slice of the Prisma client this module needs. Declared structurally so
 * the allocator works with `prisma` and with a transaction client alike.
 */
export type CertificateNumberClient = {
  certificate: {
    findMany: (args: {
      where: { tenantId: string; certificateNumber: { startsWith: string } };
      orderBy: { certificateNumber: "desc" };
      take: number;
      select: { certificateNumber: true };
    }) => Promise<Array<{ certificateNumber: string }>>;
  };
};

/** How many recent numbers to inspect when looking for the high-water mark. */
const SEQUENCE_PROBE_DEPTH = 100;

/**
 * Allocate `count` sequential numbers for one certificate type and year.
 *
 * One read, then sequential allocation, so a bulk issue produces a contiguous
 * run instead of N round-trips that would each re-observe the same "latest"
 * row. The probe reads the newest `SEQUENCE_PROBE_DEPTH` numbers for the prefix
 * and takes the highest sequence found, rather than trusting the first row:
 * zero-padded sequences sort correctly as strings up to 99,999, and taking the
 * maximum keeps the result right even if that ever stops holding.
 *
 * Two concurrent batches can still allocate overlapping sequence numbers. The
 * random suffix keeps the numbers unique (the unique index covers the full
 * string), and a gapless global sequence would need a database sequence object.
 */
export async function allocateCertificateNumbers(
  client: CertificateNumberClient,
  tenantId: string,
  certificateType: string,
  count: number,
  now: Date = new Date()
): Promise<string[]> {
  const prefix = certificateNumberPrefix(certificateType, now.getFullYear());

  const recent = await client.certificate.findMany({
    where: { tenantId, certificateNumber: { startsWith: prefix } },
    orderBy: { certificateNumber: "desc" },
    take: SEQUENCE_PROBE_DEPTH,
    select: { certificateNumber: true },
  });

  let sequence = 1;
  for (const row of recent) {
    const candidate = nextCertificateSequence(row.certificateNumber, prefix);
    if (candidate > sequence) sequence = candidate;
  }

  const numbers: string[] = [];
  for (let i = 0; i < count; i++) {
    numbers.push(formatCertificateNumber(prefix, sequence));
    sequence++;
  }
  return numbers;
}
