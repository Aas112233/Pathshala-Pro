// Core entity interfaces for the Pathshala Pro School Management ERP.
// All entities include tenantId for multi-tenant data isolation.

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "CLERK";

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
    status: "PENDING" | "PAID" | "PARTIAL";
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
  status: "PENDING" | "PAID" | "PARTIAL";
  paidAt?: Date;
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
  status?: "PENDING" | "PARTIAL" | "PAID";
  paidAmount?: number;
  paidAt?: string;
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
