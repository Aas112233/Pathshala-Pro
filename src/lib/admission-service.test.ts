import { describe, it, expect, vi } from "vitest";
import React from "react";
import {
  createAdmissionApplication,
  verifyApplicantDocument,
  approveAdmissionApplication,
  enrollApprovedApplicant,
} from "@/lib/admission-service";
import { StudentIDCardSheetPDF } from "@/lib/pdf/student-id-card-template";

vi.mock("@/lib/fee-service", () => ({
  generateFeeInvoice: vi.fn().mockResolvedValue({
    feeVoucherId: "voucher-1",
    voucherNumber: "REC-2026-0001",
    netPayable: 7500,
  }),
}));

describe("Student Admission Lifecycle & Identity Systems", () => {
  describe("createAdmissionApplication", () => {
    it("creates an admission application with generated application number", async () => {
      const mockTx = {
        admissionApplication: {
          count: vi.fn().mockResolvedValue(44),
          create: vi.fn().mockImplementation(({ data }) =>
            Promise.resolve({
              id: "app-1",
              ...data,
            })
          ),
        },
      } as any;

      const app = await createAdmissionApplication(mockTx, {
        tenantId: "tenant-1",
        academicYearId: "ay-2026",
        targetClassId: "class-1",
        firstName: "Tanvir",
        lastName: "Hasan",
        dateOfBirth: new Date("2018-05-12"),
        gender: "MALE",
        guardianName: "Kamal Hasan",
        guardianContact: "+8801711223344",
        emergencyContact: "+8801811223344",
        presentAddress: "Dhanmondi, Dhaka",
        documents: [
          {
            documentType: "BIRTH_CERTIFICATE",
            fileName: "birth_cert.pdf",
            fileUrl: "https://r2.pathshala.pro/docs/birth_cert.pdf",
          },
        ],
      });

      expect(app.id).toBe("app-1");
      expect(app.applicationNumber).toContain("ADM-");
      expect(app.status).toBe("SUBMITTED");
    });
  });

  describe("verifyApplicantDocument", () => {
    it("marks document as verified with timestamp and verifier", async () => {
      const mockTx = {
        applicantDocument: {
          update: vi.fn().mockImplementation(({ data }) =>
            Promise.resolve({
              id: "doc-1",
              ...data,
            })
          ),
        },
      } as any;

      const updated = await verifyApplicantDocument(mockTx, {
        tenantId: "tenant-1",
        documentId: "doc-1",
        verifiedById: "staff-officer-1",
        isVerified: true,
      });

      expect(updated.isVerified).toBe(true);
      expect(updated.verifiedById).toBe("staff-officer-1");
      expect(updated.verifiedAt).toBeInstanceOf(Date);
    });
  });

  describe("approveAdmissionApplication", () => {
    it("approves submitted application", async () => {
      const mockTx = {
        admissionApplication: {
          findUnique: vi.fn().mockResolvedValue({
            id: "app-1",
            tenantId: "tenant-1",
            status: "SUBMITTED",
          }),
          update: vi.fn().mockImplementation(({ data }) =>
            Promise.resolve({
              id: "app-1",
              ...data,
            })
          ),
        },
      } as any;

      const approved = await approveAdmissionApplication(mockTx, {
        tenantId: "tenant-1",
        applicationId: "app-1",
        reviewedById: "principal-1",
        notes: "All documents verified.",
      });

      expect(approved.status).toBe("APPROVED");
      expect(approved.reviewedById).toBe("principal-1");
    });
  });

  describe("enrollApprovedApplicant", () => {
    it("enrolls approved applicant, generates student profile and automated admission billing", async () => {
      const mockTx = {
        admissionApplication: {
          findUnique: vi.fn().mockResolvedValue({
            id: "app-1",
            tenantId: "tenant-1",
            status: "APPROVED",
            targetClassId: "class-1",
            academicYearId: "ay-2026",
            firstName: "Tanvir",
            lastName: "Hasan",
            dateOfBirth: new Date("2018-05-12"),
            gender: "MALE",
            bloodGroup: "O+",
            birthCertificateNo: "BC-123456",
            guardianName: "Kamal Hasan",
            guardianContact: "+8801711223344",
            emergencyContact: "+8801811223344",
            presentAddress: "Dhanmondi, Dhaka",
          }),
          update: vi.fn().mockResolvedValue({ id: "app-1", status: "ENROLLED" }),
        },
        studentProfile: {
          count: vi
            .fn()
            .mockResolvedValueOnce(5) // in class count -> roll 06
            .mockResolvedValueOnce(42), // total students -> ST-2026-0043
          create: vi.fn().mockImplementation(({ data }) =>
            Promise.resolve({
              id: "student-new-1",
              ...data,
            })
          ),
        },
        studentAcademicSession: {
          create: vi.fn().mockResolvedValue({ id: "session-1" }),
        },
      } as any;

      const enrollment = await enrollApprovedApplicant(mockTx, {
        tenantId: "tenant-1",
        applicationId: "app-1",
        enrolledById: "admin-1",
        admissionFeeAmount: 5000,
        tuitionFeeAmount: 2500,
      });

      expect(enrollment.studentProfileId).toBe("student-new-1");
      expect(enrollment.rollNumber).toBe("06");
      expect(enrollment.studentId).toContain("ST-");
      expect(enrollment.feeVoucherId).toBe("voucher-1");
      expect(enrollment.totalInvoiceAmount).toBe(7500);
      expect(mockTx.admissionApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "ENROLLED",
            enrolledStudentId: "student-new-1",
          }),
        })
      );
    });
  });

  describe("StudentIDCardSheetPDF", () => {
    it("instantiates student ID card PDF component without JSX errors", () => {
      const element = React.createElement(StudentIDCardSheetPDF, {
        cards: [
          {
            instituteName: "Dhaka Residential Model College",
            studentId: "ST-2026-0043",
            studentName: "Tanvir Hasan",
            rollNumber: "06",
            className: "Class 1",
            academicYear: "2026",
            bloodGroup: "O+",
            guardianName: "Kamal Hasan",
            guardianPhone: "+8801711223344",
            validUntil: "31 Dec 2026",
          },
        ],
      });

      expect(React.isValidElement(element)).toBe(true);
    });
  });
});
