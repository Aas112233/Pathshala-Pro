import { z } from "zod";

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "TEACHER", "CLERK"]),
  tenantId: z.string().optional(),
});

// Student schemas
export const createStudentSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  address: z.string().optional(),
  guardianName: z.string().optional(),
  guardianContact: z.string().optional(),
  rollNumber: z.string().optional(),
  bloodGroup: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "GRADUATED", "TRANSFERRED"]).default("ACTIVE"),
});

// Fee voucher schemas
export const createFeeVoucherSchema = z.object({
  studentProfileId: z.string().min(1, "Student is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  feeType: z.string().min(1, "Fee type is required"),
  totalDue: z.number().min(0, "Total due must be non-negative"),
  dueDate: z.string().min(1, "Due date is required"),
  discount: z.number().min(0).default(0),
  arrears: z.number().min(0).default(0),
});

// Transaction schemas
export const createTransactionSchema = z.object({
  feeVoucherId: z.string().min(1, "Fee voucher is required"),
  amountPaid: z.number().positive("Amount must be positive"),
  paymentMethod: z.enum(["CASH", "DIGITAL"]),
  receiptNumber: z.string().optional(),
  note: z.string().optional(),
});

// Staff schemas
export const createStaffSchema = z.object({
  staffId: z.string().min(1, "Staff ID is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  department: z.string().optional(),
  designation: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  salary: z.number().min(0).optional(),
  joiningDate: z.string().optional(),
  qualification: z.string().optional(),
});

// Academic Year schemas
export const createAcademicYearSchema = z.object({
  yearId: z.string().min(1, "Year ID is required"),
  label: z.string().min(1, "Label is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

// Attendance schemas
export const createAttendanceSchema = z.object({
  date: z.string().min(1, "Date is required"),
  studentProfileId: z.string().optional(),
  staffProfileId: z.string().optional(),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "LEAVE"]),
  note: z.string().optional(),
});

// Exam result schemas
export const createExamResultSchema = z.object({
  studentProfileId: z.string().min(1, "Student is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  examName: z.string().min(1, "Exam name is required"),
  subject: z.string().min(1, "Subject is required"),
  maxMarks: z.number().min(0, "Max marks must be non-negative"),
  obtainedMarks: z.number().min(0, "Obtained marks must be non-negative"),
  grade: z.string().optional(),
  remarks: z.string().optional(),
});

// Salary ledger schemas
export const createSalaryLedgerSchema = z.object({
  staffProfileId: z.string().min(1, "Staff is required"),
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2100),
  baseSalary: z.number().min(0),
  deductions: z.number().min(0).default(0),
  advances: z.number().min(0).default(0),
  status: z.enum(["PENDING", "PARTIAL", "PAID"]).default("PENDING"),
});
