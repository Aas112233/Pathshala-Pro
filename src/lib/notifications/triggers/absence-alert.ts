import { prisma } from "@/lib/prisma";
import { dispatchToRecipients } from "../index";

export async function triggerAbsenceAlert(input: { tenantId: string; studentProfileId: string; date?: Date }) {
  try {
    const student = await prisma.studentProfile.findFirst({ where: { tenantId: input.tenantId, id: input.studentProfileId }, include: { class: true } });
    if (!student) return;
    await dispatchToRecipients({ tenantId: input.tenantId, event: "ABSENCE_ALERT", recipients: [{ phone: student.guardianContact, email: student.guardianEmail, name: student.guardianName }], variables: { studentName: `${student.firstName} ${student.lastName}`, className: student.class?.name || "", date: (input.date || new Date()).toISOString().slice(0, 10) } });
  } catch (error) { console.error("Absence notification failed", error); }
}
