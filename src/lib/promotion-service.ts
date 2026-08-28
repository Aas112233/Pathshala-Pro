/**
 * Promotion Service — production transactional pipeline
 * `executePromotionBatch` validates, applies grace, evaluates board engine, snapshots, reallocates.
 * Timeout-configured $transaction ({ maxWait: 10000, timeout: 60000 }), tenant-scoped, idempotent.
 * 4-Tier Deterministic Merit Tie-Breaker for roll number allocations.
 */
import { prisma } from '@/lib/prisma';
import { Board, SubjectMark } from '@/lib/board-engines/types';
import { calculateNCTB } from '@/lib/board-engines/nctb-engine';
import { calculateCBSE } from '@/lib/board-engines/cbse-engine';
import { calculateFBISE } from '@/lib/board-engines/fbise-engine';
import { logAuditEvent } from '@/lib/audit-logger';

export interface ExecutePromotionBatchParams {
  tenantId: string;
  fromAcademicYearId: string;
  toAcademicYearId: string;
  fromClassId: string;
  toClassId: string;
  board?: Board; // default from Tenant.curriculum
  decidedBy: string; // userId for audit
  dryRun?: boolean;
  gracePolicy?: { maxPerSubject: number; maxPerStudent: number; autoApply: boolean };
}

export interface PromotionResultItem {
  studentProfileId: string;
  status: 'PROMOTED' | 'RETAINED' | 'CONDITIONAL_PROMOTED' | 'GRADUATED';
  finalGpa?: number | null;
  finalPercentage: number;
  totalObtainedMarks?: number;
  totalMaxMarks?: number;
  failedCount: number;
  attendancePct: number;
  admissionDate?: Date | null;
  reason?: string;
}

function boardEngineFor(board: Board) {
  switch (board) {
    case 'NCTB':
      return (m: SubjectMark[], scale: 'GPA' | 'PERCENTAGE') => calculateNCTB({ subjects: m, gradingScale: scale });
    case 'CBSE':
      return (m: SubjectMark[], scale: 'GPA' | 'PERCENTAGE') => calculateCBSE({ subjects: m, gradingScale: scale }, { bestOf5: true });
    case 'FBISE':
      return (m: SubjectMark[], scale: 'GPA' | 'PERCENTAGE') => {
        return calculateFBISE({ part1: { subjects: [], academicYearId: '' }, part2: { subjects: m, academicYearId: '' }, gradingScale: scale });
      };
    default:
      throw new Error(`Unsupported board ${board}`);
  }
}

export async function executePromotionBatch(params: ExecutePromotionBatchParams): Promise<PromotionResultItem[]> {
  const {
    tenantId,
    fromAcademicYearId,
    toAcademicYearId,
    fromClassId,
    toClassId,
    decidedBy,
    dryRun = false,
  } = params;

  // Resolve board & grace from Tenant if not supplied
  const tenant = await prisma.tenant.findUnique({ where: { tenantId } });
  if (!tenant) throw new Error('Tenant not found');
  const board: Board = (params.board ?? (tenant.curriculum as Board) ?? 'NCTB') as Board;
  const gracePolicy = params.gracePolicy ?? {
    maxPerSubject: tenant.maxGracePerSubject ?? 5,
    maxPerStudent: tenant.maxGracePerStudent ?? 10,
    autoApply: false,
  };
  const gradingScale = tenant.gradingSystem === 'GPA' ? ('GPA' as const) : ('PERCENTAGE' as const);

  // Pre-checks outside transaction (fast fail)
  const [fromYear, toYear, fromClass, toClass, rule] = await Promise.all([
    prisma.academicYear.findFirst({ where: { id: fromAcademicYearId, tenantId } }),
    prisma.academicYear.findFirst({ where: { id: toAcademicYearId, tenantId } }),
    prisma.class.findFirst({ where: { id: fromClassId, tenantId } }),
    prisma.class.findFirst({ where: { id: toClassId, tenantId } }),
    prisma.promotionRule.findFirst({ where: { tenantId, academicYearId: fromAcademicYearId, classId: fromClassId } }),
  ]);
  if (!fromYear || !toYear) throw new Error('AcademicYear not found or tenant mismatch');
  if (fromYear.isClosed) throw new Error('Source AcademicYear is closed — read-only');
  if (!fromClass || !toClass) throw new Error('Class not found');
  if (!rule) throw new Error('No PromotionRule for fromClass+fromAcademicYear — misconfiguration');

  // Idempotency: if any ClassPromotion already exists for this batch, abort (unless dryRun)
  const already = await prisma.classPromotion.findFirst({
    where: { tenantId, fromAcademicYearId, fromClassId, toAcademicYearId },
  });
  if (already && !dryRun) throw new Error('Promotion already executed for this class/year — duplicate batch blocked');

  const engine = boardEngineFor(board);

  return prisma.$transaction(
    async (tx) => {
      const students = await tx.studentProfile.findMany({
        where: { tenantId, classId: fromClassId },
        include: { class: true, section: true },
      });
      if (!students.length) return [];

      const sections = await tx.section.findMany({ where: { tenantId, classId: toClassId }, orderBy: { capacity: 'asc' } });

      const results: PromotionResultItem[] = [];

      for (const student of students) {
        // 1. Attendance
        const totalDays = await tx.attendance.count({ where: { tenantId, studentProfileId: student.id } });
        const presentDays = await tx.attendance.count({ where: { tenantId, studentProfileId: student.id, status: 'PRESENT' } });
        const attendancePct = totalDays ? Math.round((presentDays / totalDays) * 10000) / 100 : 100;

        // 2. Load exam results + components + exam lock check
        const examResults = await tx.examResult.findMany({
          where: { tenantId, studentProfileId: student.id, academicYearId: fromAcademicYearId },
          include: {
            exam: true,
            subject: true,
            componentResults: { include: { component: true } },
          },
        });

        const unpublished = examResults.find((r) => !r.exam.isPublished);
        if (unpublished) {
          throw new Error(`Unpublished exam ${unpublished.examId} for student ${student.studentId} — publish exams before promotion`);
        }

        if (!examResults.length) {
          const item: PromotionResultItem = {
            studentProfileId: student.id,
            status: 'RETAINED',
            finalGpa: null,
            finalPercentage: 0,
            totalObtainedMarks: 0,
            totalMaxMarks: 0,
            failedCount: 999,
            attendancePct,
            admissionDate: student.admissionDate,
            reason: 'No exam results',
          };
          results.push(item);
          if (!dryRun) {
            await tx.classPromotion.create({
              data: {
                tenantId,
                studentProfileId: student.id,
                fromAcademicYearId,
                toAcademicYearId,
                fromClassId,
                toClassId: fromClassId,
                status: 'RETAINED',
                reason: 'No marks',
                decidedBy,
              },
            });
            await tx.studentAcademicSession.create({
              data: {
                tenantId,
                studentProfileId: student.id,
                academicYearId: fromAcademicYearId,
                classId: student.classId!,
                sectionId: student.sectionId,
                groupId: student.groupId,
                rollNumber: student.rollNumber,
                classNumber: student.class?.classNumber ?? 0,
                finalGpa: null,
                finalPercentage: 0,
                totalMarks: 0,
                obtainedMarks: 0,
                promotionStatus: 'RETAINED',
                snapshot: { reason: 'No marks', attendancePct },
              },
            });
            await logAuditEvent({
              tenantId,
              userId: decidedBy,
              action: 'CREATE',
              entity: 'Student',
              entityId: student.id,
              details: { promotion: 'RETAINED', reason: 'No marks' },
            });
          }
          continue;
        }

        // 3. Grace apply (auto, capped, audited)
        if (gracePolicy.autoApply) {
          let totalGraceForStudent = 0;
          for (const er of examResults) {
            for (const cr of er.componentResults) {
              const comp = cr.component;
              const need = Math.max(0, comp.passMarks - cr.obtainedMarks);
              if (need > 0 && need <= gracePolicy.maxPerSubject && totalGraceForStudent + need <= gracePolicy.maxPerStudent) {
                const newObtained = cr.obtainedMarks + need;
                await tx.examComponentResult.update({
                  where: { id: cr.id },
                  data: {
                    originalMarks: cr.obtainedMarks,
                    graceMarksGiven: need,
                    obtainedMarks: newObtained,
                    graceReason: 'Auto grace to pass (promotion batch)',
                    approvedById: decidedBy,
                  },
                });
                await tx.graceMarkLedger.create({
                  data: {
                    tenantId,
                    examComponentResultId: cr.id,
                    originalMarks: cr.obtainedMarks,
                    graceMarks: need,
                    reason: 'Auto grace',
                    approvedById: decidedBy,
                  },
                });
                cr.obtainedMarks = newObtained;
                totalGraceForStudent += need;
              }
            }

            if (!er.componentResults.length && er.obtainedMarks < er.subject.passMarks) {
              const need = er.subject.passMarks - er.obtainedMarks;
              if (need > 0 && need <= gracePolicy.maxPerSubject && totalGraceForStudent + need <= gracePolicy.maxPerStudent) {
                await tx.examResult.update({
                  where: { id: er.id },
                  data: {
                    originalObtained: er.obtainedMarks,
                    graceMarksGiven: need,
                    obtainedMarks: er.obtainedMarks + need,
                    graceReason: 'Auto grace to pass',
                    graceApprovedById: decidedBy,
                  },
                });
                await tx.graceMarkLedger.create({
                  data: {
                    tenantId,
                    examResultId: er.id,
                    originalMarks: er.obtainedMarks,
                    graceMarks: need,
                    reason: 'Auto grace',
                    approvedById: decidedBy,
                  },
                });
                (er as any).obtainedMarks += need;
              }
            }
          }
        }

        // 4. Build SubjectMark for board engine
        let subjectMarks: SubjectMark[] = examResults.map((er) => {
          const compMarks = er.componentResults.length
            ? er.componentResults.map((cr) => ({
                type: cr.component.componentType,
                obtained: cr.obtainedMarks,
                max: cr.component.maxMarks,
                weightage: cr.component.weightage,
                pass: cr.component.passMarks,
              }))
            : undefined;
          const obtained = compMarks ? compMarks.reduce((a, c) => a + c.obtained, 0) : er.obtainedMarks;
          const max = er.maxMarks;
          const pass = er.subject.passMarks;
          return {
            subjectId: er.subjectId,
            subjectCode: er.subject.code,
            subjectName: er.subject.name,
            category: (er.subject.category as any) || 'COMPULSORY',
            isFourth: (er.subject as any).category === 'OPTIONAL' || false,
            obtained,
            max,
            pass,
            components: compMarks as any,
          };
        });

        // FBISE multi-part composite integration
        if (board === 'FBISE') {
          const part1Results = await tx.examResult.findMany({
            where: { tenantId, studentProfileId: student.id, academicYearId: { not: fromAcademicYearId } },
            include: { subject: true, componentResults: { include: { component: true } } },
            take: 20,
          });
          if (part1Results.length) {
            const part1Marks: SubjectMark[] = part1Results.map((r) => ({
              subjectId: r.subjectId,
              subjectCode: r.subject.code,
              category: r.subject.category as any,
              obtained: r.componentResults.length ? r.componentResults.reduce((a, c) => a + c.obtainedMarks, 0) : r.obtainedMarks,
              max: r.maxMarks,
              pass: r.subject.passMarks,
            }));
            const { calculateFBISE } = await import('@/lib/board-engines/fbise-engine');
            const fbiseRes = calculateFBISE(
              {
                part1: { subjects: part1Marks, academicYearId: fromAcademicYearId },
                part2: { subjects: subjectMarks, academicYearId: fromAcademicYearId },
              },
              gradingScale as any
            );
            subjectMarks = fbiseRes.subjectResults.map((sr) => {
              const orig = subjectMarks.find((sm) => sm.subjectCode === sr.subjectCode) ?? {
                subjectId: sr.subjectId,
                subjectCode: sr.subjectCode,
                category: 'COMPULSORY' as const,
                obtained: sr.obtained,
                max: sr.max,
                pass: 33,
              };
              return { ...orig, obtained: sr.obtained, max: sr.max };
            });
          }
        }

        const boardRes = engine(subjectMarks as any, gradingScale);

        // 5. Attendance + rule evaluation
        let status: PromotionResultItem['status'] = 'RETAINED';
        let reason: string | undefined;
        if (attendancePct < rule.minimumAttendance) {
          status = 'RETAINED';
          reason = `Attendance ${attendancePct}% < ${rule.minimumAttendance}%`;
        } else if (boardRes.failedCount === 0 && boardRes.overallPercentage >= rule.minimumOverallPercentage) {
          status = 'PROMOTED';
        } else if (boardRes.failedCount <= rule.maxFailedSubjects && rule.allowConditionalPromotion) {
          status = 'CONDITIONAL_PROMOTED';
          reason = `Conditional: ${boardRes.failedCount} failed <= ${rule.maxFailedSubjects}`;
        } else {
          status = 'RETAINED';
          reason = `Failed ${boardRes.failedCount} subjects, overall ${boardRes.overallPercentage}%`;
        }

        if (status === 'PROMOTED' && !rule.nextClassId) {
          status = 'GRADUATED';
        }

        const resultItem: PromotionResultItem = {
          studentProfileId: student.id,
          status,
          finalGpa: (boardRes as any).overallGpa ?? null,
          finalPercentage: boardRes.overallPercentage,
          totalObtainedMarks: boardRes.totalObtained,
          totalMaxMarks: boardRes.totalMax,
          failedCount: boardRes.failedCount,
          attendancePct,
          admissionDate: student.admissionDate,
          reason,
        };
        results.push(resultItem);

        if (!dryRun) {
          await tx.classPromotion.create({
            data: {
              tenantId,
              studentProfileId: student.id,
              fromAcademicYearId,
              toAcademicYearId,
              fromClassId,
              toClassId: status === 'RETAINED' ? fromClassId : (rule.nextClassId ?? toClassId),
              status,
              reason,
              reExamRequired: status === 'CONDITIONAL_PROMOTED',
              decidedBy,
            },
          });

          await tx.studentAcademicSession.create({
            data: {
              tenantId,
              studentProfileId: student.id,
              academicYearId: fromAcademicYearId,
              classId: student.classId!,
              sectionId: student.sectionId,
              groupId: student.groupId,
              rollNumber: student.rollNumber,
              classNumber: student.class?.classNumber ?? 0,
              finalGpa: (boardRes as any).overallGpa ?? null,
              finalPercentage: boardRes.overallPercentage,
              totalMarks: boardRes.totalMax,
              obtainedMarks: boardRes.totalObtained,
              promotionStatus: status,
              snapshot: {
                board,
                gradingScale,
                subjectResults: boardRes.subjectResults,
                attendancePct,
                ruleId: rule.id,
                gracePolicy,
              } as any,
            },
          });

          if (status === 'PROMOTED' || status === 'CONDITIONAL_PROMOTED') {
            const targetId = rule.nextClassId ?? toClassId;
            await tx.studentProfile.update({ where: { id: student.id }, data: { classId: targetId } });
          }

          await logAuditEvent({
            tenantId,
            userId: decidedBy,
            action: 'CREATE',
            entity: 'Student',
            entityId: student.id,
            details: {
              promotion: status,
              fromClassId,
              toClassId,
              finalGpa: resultItem.finalGpa,
              finalPercentage: resultItem.finalPercentage,
            },
          });
        }
      }

      // 6. 4-Tier Deterministic Merit Tie-Breaker for Promoted Cohort
      if (!dryRun) {
        const promoted = results
          .filter((r) => r.status === 'PROMOTED' || r.status === 'CONDITIONAL_PROMOTED')
          .sort((a, b) => {
            // Tier 1: Final GPA or Final Percentage (Descending)
            const scoreA = a.finalGpa ?? a.finalPercentage;
            const scoreB = b.finalGpa ?? b.finalPercentage;
            if (scoreB !== scoreA) {
              return scoreB - scoreA;
            }

            // Tier 2: Total Obtained Marks (Descending)
            const marksA = a.totalObtainedMarks ?? 0;
            const marksB = b.totalObtainedMarks ?? 0;
            if (marksB !== marksA) {
              return marksB - marksA;
            }

            // Tier 3: Attendance Percentage (Descending)
            if (b.attendancePct !== a.attendancePct) {
              return b.attendancePct - a.attendancePct;
            }

            // Tier 4: Admission Date (Ascending) / StudentProfileId (Ascending)
            const dateA = a.admissionDate ? new Date(a.admissionDate).getTime() : 0;
            const dateB = b.admissionDate ? new Date(b.admissionDate).getTime() : 0;
            if (dateA !== dateB) {
              return dateA - dateB;
            }

            return a.studentProfileId.localeCompare(b.studentProfileId);
          });

        let rollCounter = 1;
        let sectionIdx = 0;
        const targetSections = sections.length ? sections : [{ id: null, capacity: 9999 } as any];

        for (const p of promoted) {
          const sec = targetSections[sectionIdx % targetSections.length];
          await tx.studentProfile.update({ where: { id: p.studentProfileId }, data: { sectionId: sec.id } });
          await tx.studentProfile.update({
            where: { id: p.studentProfileId },
            data: { rollNumber: String(rollCounter).padStart(4, '0') },
          });
          rollCounter++;
          sectionIdx++;
          if (
            sec.capacity &&
            promoted.filter((_, i) => i % targetSections.length === sectionIdx % targetSections.length).length >= sec.capacity
          ) {
            sectionIdx++;
          }
        }
      }

      return results;
    },
    { maxWait: 10000, timeout: 60000 }
  );
}
