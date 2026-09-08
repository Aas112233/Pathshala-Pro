import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { smartRateLimitAsync, recordRateLimitFailureAsync } from "@/lib/rate-limit";

/** Client IP for rate-limit keys, behind common proxies. */
function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0]?.trim() || request.headers.get("real-ip") || "unknown").slice(0, 100);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Public, unauthenticated endpoint returning student identity — the
    // classic enumeration target. Cap per-IP lookups and escalate the
    // penalty on misses so scanners self-throttle.
    const limitKey = `CERT_VERIFY_IP_${clientIp(request)}`;
    const rl = await smartRateLimitAsync(limitKey, { preset: "public", limit: 20 });
    if (!rl.success) {
      return NextResponse.json(
        { success: false, message: "Too many verification attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
      );
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, message: "Certificate identifier required" }, { status: 400 });

    // Try by id first, then by certificateNumber
    let cert = await prisma.certificate.findFirst({
      where: { id },
      include: {
        studentProfile: { select: { firstName: true, lastName: true, rollNumber: true, studentId: true, class: { select: { name: true } }, section: { select: { name: true } } } },
        tenant: { select: { name: true, logoUrl: true } },
      },
    });

    if (!cert) {
      cert = await prisma.certificate.findFirst({
        where: { certificateNumber: id },
        include: {
          studentProfile: { select: { firstName: true, lastName: true, rollNumber: true, studentId: true, class: { select: { name: true } }, section: { select: { name: true } } } },
          tenant: { select: { name: true, logoUrl: true } },
        },
      });
    }

    if (!cert) {
      await recordRateLimitFailureAsync(limitKey, 8);
      return NextResponse.json({ success: false, message: "Certificate not found", verified: false }, { status: 404 });
    }

    const verified = cert.status === "ISSUED";
    return NextResponse.json({
      success: true,
      verified,
      data: {
        id: cert.id,
        certificateNumber: cert.certificateNumber,
        certificateType: cert.certificateType,
        status: cert.status,
        issueDate: cert.issueDate,
        validUntil: cert.validUntil,
        purpose: cert.purpose,
        studentName: cert.studentProfile ? `${cert.studentProfile.firstName} ${cert.studentProfile.lastName}` : null,
        rollNumber: cert.studentProfile?.rollNumber || null,
        className: cert.studentProfile?.class?.name || null,
        sectionName: cert.studentProfile?.section?.name || null,
        schoolName: cert.tenant?.name || null,
      },
    });
  } catch (e) {
    console.error("[verify/certificate] error", e);
    return NextResponse.json({ success: false, message: "Verification failed" }, { status: 500 });
  }
}
