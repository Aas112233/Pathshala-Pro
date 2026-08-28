import { Prisma } from "@prisma/client";
import { generateFeeInvoice } from "@/lib/fee-service";

export type ApplicationStatusType =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "ENROLLED"
  | "REJECTED"
  | "WITHDRAWN";

export type DocumentTypeEnum =
  | "BIRTH_CERTIFICATE"
  | "TRANSFER_CERTIFICATE"
  | "PREVIOUS_MARKSHEET"
  | "GUARDIAN_NID"
  | "MEDICAL_RECORD"
  | "OTHER";

export interface CreateAdmissionApplicationDTO {
  tenantId: string;
  academicYearId: string;
  targetClassId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: string;
  bloodGroup?: string;
  birthCertificateNo?: string;
  nationality?: string;
  religion?: string;
  fatherName?: string;
  motherName?: string;
  guardianName: string;
  guardianContact: string;
  guardianEmail?: string;
  emergencyContact: string;
  presentAddress: string;
  permanentAddress?: string;
  documents?: {
    documentType: DocumentTypeEnum;
    fileUrl: string;
    fileName: string;
  }[];
}

export interface EnrollApplicantDTO {
  tenantId: string;
  applicationId: string;
  enrolledById: string;
  sectionId?: string;
  admissionFeeAmount?: number;
  tuitionFeeAmount?: number;
  dueDate?: Date;
}

export interface EnrollmentResult {
  studentProfileId: string;
  studentId: string;
  rollNumber: string;
  applicationId: string;
  feeVoucherId?: string;
  voucherNumber?: string;
  totalInvoiceAmount?: number;
}

/**
 * 1. Create New Admission Application
 */
export async function createAdmissionApplication(
  tx: Prisma.TransactionClient,
  dto: CreateAdmissionApplicationDTO
) {
  const { tenantId, academicYearId, targetClassId, documents = [], ...applicantData } = dto;
  const year = dto.dateOfBirth.getFullYear();
  const count = await tx.admissionApplication.count({ where: { tenantId } });
  const applicationNumber = `ADM-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;

  const application = await tx.admissionApplication.create({
    data: {
      tenantId,
      academicYearId,
      targetClassId,
      applicationNumber,
      ...applicantData,
      status: "SUBMITTED",
      documents: {
        create: documents.map((doc) => ({
          tenantId,
          documentType: doc.documentType as any,
          fileUrl: doc.fileUrl,
          fileName: doc.fileName,
        })),
      },
    },
    include: {
      documents: true,
    },
  });

  return application;
}

/**
 * 2. Document Verification
 */
export async function verifyApplicantDocument(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    documentId: string;
    verifiedById: string;
    isVerified: boolean;
  }
) {
  const { tenantId, documentId, verifiedById, isVerified } = params;

  return tx.applicantDocument.update({
    where: { id: documentId },
    data: {
      isVerified,
      verifiedById: isVerified ? verifiedById : null,
      verifiedAt: isVerified ? new Date() : null,
    },
  });
}

/**
 * 3. Approve Admission Application
 */
export async function approveAdmissionApplication(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    applicationId: string;
    reviewedById: string;
    notes?: string;
  }
) {
  const { tenantId, applicationId, reviewedById, notes } = params;

  const app = await tx.admissionApplication.findUnique({
    where: { id: applicationId },
  });

  if (!app || app.tenantId !== tenantId) {
    throw new Error("Admission application not found or tenant mismatch.");
  }

  if (app.status === "ENROLLED") {
    throw new Error("Application is already enrolled.");
  }

  return tx.admissionApplication.update({
    where: { id: applicationId },
    data: {
      status: "APPROVED",
      reviewedById,
      notes: notes || app.notes,
    },
  });
}

/**
 * 4. Enroll Approved Applicant into Student & Generate Admission Billing
 */
export async function enrollApprovedApplicant(
  tx: Prisma.TransactionClient,
  dto: EnrollApplicantDTO
): Promise<EnrollmentResult> {
  const {
    tenantId,
    applicationId,
    enrolledById,
    sectionId,
    admissionFeeAmount = 5000,
    tuitionFeeAmount = 2500,
    dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
  } = dto;

  const app = await tx.admissionApplication.findUnique({
    where: { id: applicationId },
  });

  if (!app || app.tenantId !== tenantId) {
    throw new Error("Admission application not found.");
  }

  if (app.status !== "APPROVED") {
    throw new Error(`Application must be in APPROVED status to enroll. Current status: ${app.status}`);
  }

  // 1. Generate Next Roll Number in Target Class
  const currentCount = await tx.studentProfile.count({
    where: {
      tenantId,
      classId: app.targetClassId,
    },
  });
  const rollNumber = String(currentCount + 1).padStart(2, "0");

  // 2. Generate Student ID
  const totalStudents = await tx.studentProfile.count({ where: { tenantId } });
  const studentId = `ST-${new Date().getFullYear()}-${String(totalStudents + 1).padStart(4, "0")}`;

  // 3. Create StudentProfile
  const student = await tx.studentProfile.create({
    data: {
      tenantId,
      studentId,
      rollNumber,
      firstName: app.firstName,
      lastName: app.lastName,
      dateOfBirth: app.dateOfBirth,
      gender: app.gender,
      bloodGroup: app.bloodGroup,
      birthCertificateNo: app.birthCertificateNo,
      guardianName: app.guardianName,
      guardianContact: app.guardianContact,
      guardianEmail: app.guardianEmail,
      fatherName: app.fatherName,
      motherName: app.motherName,
      emergencyContact: app.emergencyContact,
      address: app.presentAddress,
      classId: app.targetClassId,
      sectionId: sectionId ?? null,
      status: "ACTIVE",
      admissionDate: new Date(),
    },
  });

  // 4. Create StudentAcademicSession
  await tx.studentAcademicSession.create({
    data: {
      tenantId,
      studentProfileId: student.id,
      academicYearId: app.academicYearId,
      classId: app.targetClassId,
      sectionId: sectionId ?? null,
      rollNumber,
      classNumber: 0,
      totalMarks: 0,
      obtainedMarks: 0,
      promotionStatus: "PROMOTED",
    },
  });

  // 5. Generate Automated Admission Billing (Tuition + Admission Fee)
  let feeVoucherId: string | undefined;
  let voucherNumber: string | undefined;
  let totalInvoiceAmount: number | undefined;

  try {
    const feeInvoice = await generateFeeInvoice(tx, {
      tenantId,
      studentProfileId: student.id,
      academicYearId: app.academicYearId,
      billingMonth: new Date().getMonth() + 1,
      billingYear: new Date().getFullYear(),
      feeType: "ADMISSION",
      classId: app.targetClassId,
      dueDate,
      executedById: enrolledById,
      items: [
        {
          feeHeadCode: "ADMISSION",
          title: "Admission & Registration Fee",
          amount: admissionFeeAmount,
          revenueAccountCode: "4010",
        },
        {
          feeHeadCode: "TUITION",
          title: "Initial Monthly Tuition Fee",
          amount: tuitionFeeAmount,
          revenueAccountCode: "4010",
        },
      ],
    });

    feeVoucherId = feeInvoice.feeVoucherId;
    voucherNumber = feeInvoice.voucherNumber;
    totalInvoiceAmount = Number(feeInvoice.netPayable);
  } catch {
    // If fee engine is bypassed or optional
  }

  // 6. Transition Admission Application to ENROLLED
  await tx.admissionApplication.update({
    where: { id: applicationId },
    data: {
      status: "ENROLLED",
      enrolledStudentId: student.id,
    },
  });

  return {
    studentProfileId: student.id,
    studentId: student.studentId,
    rollNumber: student.rollNumber,
    applicationId: app.id,
    feeVoucherId,
    voucherNumber,
    totalInvoiceAmount,
  };
}
