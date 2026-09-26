// Core entity interfaces for the Pathshala Pro School Management ERP.
// All entities include tenantId for multi-tenant data isolation.

import type { UserRole } from "@/lib/permissions";
export type { UserRole };

export type PaymentMethod = "CASH" | "DIGITAL";

export type VoucherStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";

export type StudentStatus = "ACTIVE" | "INACTIVE" | "GRADUATED" | "TRANSFERRED";

export type SubscriptionStatus = "ACTIVE" | "TRIAL" | "SUSPENDED" | "EXPIRED";

export interface Tenant {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  subscriptionStatus: SubscriptionStatus;
  fiscalYearStart: number;
  logoUrl?: string;
  phone?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  hash: string;
  isActive: boolean;
  staffProfileId?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentProfile {
  id: string;
  tenantId: string;
  studentId: string;
  rollNumber: string;
  firstName: string;
  lastName: string;
  firstNameBn?: string;
  lastNameBn?: string;
  guardianName: string;
  guardianContact: string;
  guardianEmail?: string;
  dateOfBirth?: Date;
  gender?: string;
  address?: string;
  classId?: string;
  groupId?: string;
  sectionId?: string;
  status: StudentStatus;
  admissionDate: Date;
  profilePictureUrl?: string;
  driveFileId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AcademicYear {
  id: string;
  tenantId: string;
  yearId: string;
  label: string;
  startDate: Date;
  endDate: Date;
  isClosed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeeVoucher {
  id: string;
  tenantId: string;
  voucherId: string;
  studentProfileId: string;
  academicYearId: string;
  feeType: string;
  baseAmount: number;
  discountAmount: number;
  arrears: number;
  totalDue: number;
  amountPaid: number;
  balance: number;
  dueDate: Date;
  status: VoucherStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  tenantId: string;
  transactionId: string;
  feeVoucherId: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  receiptNumber: string;
  collectedById: string;
  note?: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StaffProfile {
  id: string;
  tenantId: string;
  staffId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  firstNameBn?: string;
  lastNameBn?: string;
  department: string;
  designation: string;
  baseSalary: number;
  hireDate: Date;
  joiningDate?: Date;
  phone?: string;
  email?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  dateOfBirth?: Date;
  qualification?: string;
  profilePictureUrl?: string;
  driveFileId?: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Related data (from includes)
  class?: { id: string; name: string } | null;
  group?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
}

export type SalaryStatus = "PENDING" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "PARTIAL" | "PAID";

export interface StaffProfileWithDetails extends StaffProfile {
  salaryLedgers?: Array<{
    id: string;
    month: number;
    year: number;
    baseSalary: number;
    deductions: number;
    advances: number;
    netPayable: number;
    paidAmount: number;
    status: SalaryStatus;
  }>;
  attendances?: Array<{
    id: string;
    date: Date;
    status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE";
    note?: string;
  }>;
}

export interface SalaryLedger {
  id: string;
  tenantId: string;
  staffProfileId: string;
  academicYearId: string;
  month: number;
  year: number;
  baseSalary: number;
  deductions: number;
  advances: number;
  netPayable: number;
  paidAmount: number;
  status: SalaryStatus;
  paidAt?: Date;
  approvedById?: string | null;
  approvedAt?: Date | null;
  rejectionReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Related data (from includes)
  staffProfile?: {
    staffId: string;
    firstName: string;
    lastName: string;
    designation: string;
    department: string;
    baseSalary?: number;
  };
  academicYear?: {
    yearId: string;
    label: string;
  };
  approvedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface SalaryLedgerWithDetails extends SalaryLedger {
  staffProfile: {
    staffId: string;
    firstName: string;
    lastName: string;
    designation: string;
    department: string;
    baseSalary: number;
  };
  academicYear: {
    yearId: string;
    label: string;
    startDate: Date;
    endDate: Date;
  };
  approvedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

// DTO types for salary ledger creation and updates
export interface CreateSalaryLedgerDTO {
  staffProfileId: string;
  academicYearId: string;
  month: number;
  year: number;
  baseSalary: number;
  deductions?: number;
  advances?: number;
  status?: SalaryStatus;
  paidAmount?: number;
  paidAt?: string;
  rejectionReason?: string;
}

export interface UpdateSalaryLedgerDTO extends Partial<CreateSalaryLedgerDTO> {
  id: string;
}

export interface BulkPayrollEntry {
  staffProfileId: string;
  baseSalary: number;
  deductions?: number;
  advances?: number;
  note?: string;
}

export interface BulkPayrollDTO {
  academicYearId: string;
  month: number;
  year: number;
  entries: BulkPayrollEntry[];
}

export interface PaymentDTO {
  paidAmount: number;
  paymentMethod: "CASH" | "DIGITAL" | "BANK_TRANSFER";
  paymentDate?: string;
  note?: string;
}

// DTO types for staff creation and updates
export interface CreateStaffDTO {
  staffId?: string;
  firstName: string;
  lastName: string;
  firstNameBn?: string;
  lastNameBn?: string;
  department: string;
  designation: string;
  baseSalary: number;
  hireDate: string;
  joiningDate?: string;
  phone?: string;
  email?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  dateOfBirth?: string;
  qualification?: string;
  profilePictureUrl?: string;
  driveFileId?: string;
  address?: string;
  isActive?: boolean;
  userId?: string;
}

export interface UpdateStaffDTO extends Partial<CreateStaffDTO> {
  id: string;
}

export interface Attendance {
  id: string;
  tenantId: string;
  studentProfileId?: string;
  staffProfileId?: string;
  date: Date;
  status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE";
  note?: string;
  markedById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExamResult {
  id: string;
  tenantId: string;
  studentProfileId: string;
  academicYearId: string;
  examName: string;
  subject: string;
  maxMarks: number;
  obtainedMarks: number;
  grade?: string;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}
