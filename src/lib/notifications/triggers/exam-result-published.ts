import { prisma } from "@/lib/prisma";
import { dispatchToRecipients } from "../index";

export async function triggerExamResultPublished(input: { tenantId: string; examId: string }) {
  try {
    const exam = await prisma.exam.findFirst({ where: { tenantId: input.tenantId, id: input.examId, isPublished: true }, include: { results: { include: { studentProfile: true } } } });
    if (!exam) return 0;
    const students = new Map(exam.results.map((result) => [result.studentProfileId, result.studentProfile]));
    await Promise.all([...students.values()].map((student) => dispatchToRecipients({ tenantId: input.tenantId, event: "EXAM_RESULT_PUBLISHED", recipients: [{ phone: student.guardianContact, email: student.guardianEmail, name: student.guardianName }], variables: { studentName: `${student.firstName} ${student.lastName}`, examName: exam.name, examId: exam.examId } })));
    return students.size;
  } catch (error) { console.error("Exam result notification failed", error); return 0; }
}
