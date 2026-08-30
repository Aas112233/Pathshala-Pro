import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
