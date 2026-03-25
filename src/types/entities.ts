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
  department: string;
  designation: string;
  baseSalary: number;
  hireDate: Date;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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
