// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  ACTIVE_CERTIFICATE_STATUSES,
  CERTIFICATE_TYPES,
  SINGLE_ACTIVE_CERTIFICATE_TYPES,
  allocateCertificateNumbers,
  certificateNumberPrefix,
  formatCertificateNumber,
  isSingleActiveCertificateType,
  nextCertificateSequence,
} from "@/lib/certificate-numbering";

const PREFIX = certificateNumberPrefix("TRANSFER", 2026);

/** A stand-in for the slice of the Prisma client the allocator needs. */
function clientWith(existing: string[]) {
  return {
    certificate: {
      findMany: vi.fn().mockResolvedValue(
        existing.map((certificateNumber) => ({ certificateNumber }))
      ),
    },
  };
}

describe("certificate number prefix", () => {
  it("encodes the type and year", () => {
    expect(certificateNumberPrefix("BONAFIDE", 2027)).toBe("CERT-BONAFIDE-2027-");
  });
});

describe("nextCertificateSequence", () => {
  it("starts at 1 when there is no predecessor", () => {
    expect(nextCertificateSequence(null, PREFIX)).toBe(1);
    expect(nextCertificateSequence(undefined, PREFIX)).toBe(1);
    expect(nextCertificateSequence("", PREFIX)).toBe(1);
  });

  it("advances a legacy suffix-less number", () => {
    expect(nextCertificateSequence("CERT-TRANSFER-2026-00007", PREFIX)).toBe(8);
  });

  it("advances a current number carrying a hex capability suffix", () => {
    expect(nextCertificateSequence("CERT-TRANSFER-2026-00042-A1B2C3D4", PREFIX)).toBe(43);
  });

  it("advances correctly when the capability suffix happens to be all digits", () => {
    // The suffix is hex, so roughly 2% of the time it is entirely digits. Read
    // as "the last numeric segment" this number would report a sequence of
    // 12345679 and every subsequent certificate would jump a decade.
    expect(nextCertificateSequence("CERT-TRANSFER-2026-00042-12345678", PREFIX)).toBe(43);
  });

  it("does not carry a sequence across certificate types", () => {
    const bonafide = certificateNumberPrefix("BONAFIDE", 2026);
    expect(nextCertificateSequence("CERT-TRANSFER-2026-00042-A1B2C3D4", bonafide)).toBe(1);
  });

  it("does not carry a sequence across years", () => {
    const nextYear = certificateNumberPrefix("TRANSFER", 2027);
    expect(nextCertificateSequence("CERT-TRANSFER-2026-00042-A1B2C3D4", nextYear)).toBe(1);
  });

  it("still yields a usable sequence for a number that ignores the format", () => {
    // Never reached through the prefix-scoped query, but a reset to 1 here
    // would silently start reissuing numbers if it ever were.
    expect(nextCertificateSequence("CERT-TRANSFER-2026-00009", PREFIX)).toBe(10);
  });
});

describe("formatCertificateNumber", () => {
  it("zero-pads the sequence to five digits", () => {
    expect(formatCertificateNumber(PREFIX, 7)).toMatch(/^CERT-TRANSFER-2026-00007-[0-9A-F]{8}$/);
    expect(formatCertificateNumber(PREFIX, 12345)).toMatch(
      /^CERT-TRANSFER-2026-12345-[0-9A-F]{8}$/
    );
  });

  it("gives two certificates with the same sequence distinct numbers", () => {
    const first = formatCertificateNumber(PREFIX, 1);
    const second = formatCertificateNumber(PREFIX, 1);
    expect(first).not.toBe(second);
  });
});

describe("allocateCertificateNumbers", () => {
  it("starts at one for an empty table", async () => {
    const client = clientWith([]);
    const numbers = await allocateCertificateNumbers(client, "tenant-1", "TRANSFER", 3, new Date("2026-06-01"));

    expect(numbers.map((n) => n.split("-")[3])).toEqual(["00001", "00002", "00003"]);
    expect(client.certificate.findMany).toHaveBeenCalledTimes(1);
  });

  it("continues from the highest existing sequence", async () => {
    const client = clientWith([
      "CERT-TRANSFER-2026-00012-AAAA1111",
      "CERT-TRANSFER-2026-00009-BBBB2222",
      "CERT-TRANSFER-2026-00011-CCCC3333",
    ]);
    const numbers = await allocateCertificateNumbers(client, "tenant-1", "TRANSFER", 2, new Date("2026-06-01"));

    expect(numbers.map((n) => n.split("-")[3])).toEqual(["00013", "00014"]);
  });

  it("ignores a newer row whose suffix is all digits", async () => {
    // The highest sequence is 12, but the lexicographically newest number is
    // the one whose suffix is digits. Position-based parsing must still find 12.
    const client = clientWith([
      "CERT-TRANSFER-2026-00012-99999999",
      "CERT-TRANSFER-2026-00011-CCCC3333",
    ]);
    const numbers = await allocateCertificateNumbers(client, "tenant-1", "TRANSFER", 1, new Date("2026-06-01"));

    expect(numbers[0]).toMatch(/^CERT-TRANSFER-2026-00013-/);
  });

  it("scopes the probe to the tenant and the type/year prefix", async () => {
    const client = clientWith([]);
    await allocateCertificateNumbers(client, "tenant-9", "CHARACTER", 1, new Date("2026-06-01"));

    expect(client.certificate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-9", certificateNumber: { startsWith: "CERT-CHARACTER-2026-" } },
      })
    );
  });

  it("returns exactly the requested count", async () => {
    const client = clientWith(["CERT-TRANSFER-2026-00001-AAAA1111"]);
    const numbers = await allocateCertificateNumbers(client, "tenant-1", "TRANSFER", 5, new Date("2026-06-01"));
    expect(numbers).toHaveLength(5);
    expect(new Set(numbers).size).toBe(5);
  });
});

describe("single-active certificate types", () => {
  it("restricts only the transfer certificate", () => {
    expect(SINGLE_ACTIVE_CERTIFICATE_TYPES).toEqual(["TRANSFER"]);
    expect(isSingleActiveCertificateType("TRANSFER")).toBe(true);
    for (const type of CERTIFICATE_TYPES.filter((t) => t !== "TRANSFER")) {
      expect(isSingleActiveCertificateType(type)).toBe(false);
    }
  });

  it("treats a draft as occupying the slot", () => {
    // A draft is a certificate someone started; issuing a second would leave
    // two documents for one departure.
    expect([...ACTIVE_CERTIFICATE_STATUSES]).toEqual(["ISSUED", "DRAFT"]);
  });
});
