import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getCertificate(id: string) {
  let cert = await prisma.certificate.findFirst({
    where: { id },
    include: {
      studentProfile: { select: { firstName: true, lastName: true, rollNumber: true, studentId: true, class: { select: { name: true } }, section: { select: { name: true } } } },
      tenant: { select: { name: true, address: true, phone: true, email: true, logoUrl: true } },
    },
  });
  if (!cert) {
    cert = await prisma.certificate.findFirst({
      where: { certificateNumber: id },
      include: {
        studentProfile: { select: { firstName: true, lastName: true, rollNumber: true, studentId: true, class: { select: { name: true } }, section: { select: { name: true } } } },
        tenant: { select: { name: true, address: true, phone: true, email: true, logoUrl: true } },
      },
    });
  }
  return cert;
}

export default async function VerifyCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cert = await getCertificate(decodeURIComponent(id));

  if (!cert) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-lg border border-slate-200 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-2xl">✕</div>
          <h1 className="text-xl font-bold text-slate-900">Certificate Not Found</h1>
          <p className="mt-2 text-sm text-slate-500">No certificate matches <span className="font-mono font-semibold">{id}</span>. Please check the QR code or certificate number.</p>
          <Link href="/login" className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">Go to Login</Link>
        </div>
      </div>
    );
  }

  const verified = cert.status === "ISSUED";
  const revoked = cert.status === "REVOKED";
  const studentName = cert.studentProfile ? `${cert.studentProfile.firstName} ${cert.studentProfile.lastName}` : "—";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {cert.tenant.logoUrl ? <img src={cert.tenant.logoUrl} alt="logo" className="h-9 w-9 rounded-lg object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 font-bold text-blue-700">{cert.tenant.name?.charAt(0) || "S"}</div>}
            <div>
              <p className="text-sm font-bold text-slate-900">{cert.tenant.name}</p>
              <p className="text-xs text-slate-500">{cert.tenant.address || ""}</p>
            </div>
          </div>
          <Link href="/login" className="text-xs font-semibold text-blue-600">Pathshala Pro</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className={`rounded-2xl border-2 bg-white p-6 shadow-sm ${verified ? "border-emerald-200" : revoked ? "border-rose-200" : "border-amber-200"}`}>
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold ${verified ? "bg-emerald-100 text-emerald-700" : revoked ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
              {verified ? "✓" : revoked ? "✕" : "!"}
            </div>
            <div className="flex-1">
              <h1 className={`text-lg font-bold ${verified ? "text-emerald-700" : revoked ? "text-rose-700" : "text-amber-700"}`}>
                {verified ? "Certificate Verified ✓" : revoked ? "Certificate Revoked" : `Status: ${cert.status}`}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {verified ? "This document is authentic and issued by the institution below." : revoked ? "This certificate has been revoked and is no longer valid." : "This certificate is not currently verified."}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${verified ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : revoked ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>{cert.status}</span>
          </div>

          <div className="mt-6 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
            <Field label="Certificate No." value={cert.certificateNumber} mono />
            <Field label="Certificate Type" value={cert.certificateType.replace("_", " ")} />
            <Field label="Student Name" value={studentName} />
            <Field label="Roll Number" value={cert.studentProfile?.rollNumber || "—"} mono />
            <Field label="Class" value={cert.studentProfile?.class?.name || "—"} />
            <Field label="Section" value={cert.studentProfile?.section?.name || "—"} />
            <Field label="Issue Date" value={new Date(cert.issueDate).toLocaleDateString()} />
            <Field label="Valid Until" value={cert.validUntil ? new Date(cert.validUntil).toLocaleDateString() : "No expiry"} />
            {cert.purpose ? <div className="sm:col-span-2"><Field label="Purpose" value={cert.purpose} /></div> : null}
          </div>

          <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-xs font-semibold text-blue-900">Issued By</p>
            <p className="text-sm font-bold text-slate-900">{cert.tenant.name}</p>
            <p className="text-xs text-slate-600">{[cert.tenant.phone, cert.tenant.email].filter(Boolean).join("  •  ")}</p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">This verification is public and does not require login. If details look incorrect, contact the issuing institution.</p>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">Verification ID: <span className="font-mono">{cert.id}</span> • {new Date().toLocaleDateString()}</p>
      </main>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold text-slate-900 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
