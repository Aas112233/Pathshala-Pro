import { z } from "zod";
import {
  ROLES,
  PAYMENT_METHODS,
  VOUCHER_STATUSES,
  STUDENT_STATUSES,
} from "@/lib/constants";

// Common schemas
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const dateSchema = z.string().transform((val) => new Date(val));

// Tenant schemas
export const createTenantSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email format").optional(),
  subscriptionStatus: z.enum(["ACTIVE", "TRIAL", "SUSPENDED", "EXPIRED"]).default("TRIAL"),
  fiscalYearStart: z.number().min(1).max(12).default(1),
});

export const updateTenantSchema = createTenantSchema.partial();

// User schemas
export const createUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  role: z.enum(Object.keys(ROLES) as [string, ...string[]]).default("CLERK"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  staffProfileId: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateUserSchema = createUserSchema.partial();

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

// StudentProfile schemas
export const createStudentSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  rollNumber: z.string().min(1, "Roll number is required"),
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(1, "Last name is required"),
  firstNameBn: z.string().optional(),
  lastNameBn: z.string().optional(),
  guardianName: z.string().min(2, "Guardian name is required"),
  guardianContact: z.string().min(10, "Valid contact number is required"),
  guardianEmail: z.string().email().optional(),
  dateOfBirth: dateSchema.optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "GRADUATED", "TRANSFERRED"]).default("ACTIVE"),
  admissionDate: dateSchema.optional(),
});

export const updateStudentSchema = createStudentSchema.omit({ admissionDate: true }).partial();

// AcademicYear schemas
export const createAcademicYearSchema = z.object({
  yearId: z.string().min(1, "Year ID is required"),
  label: z.string().min(2, "Label is required"),
  startDate: dateSchema,
  endDate: dateSchema,
  isClosed: z.boolean().default(false),
}).refine((data) => data.startDate < data.endDate, {
  message: "Start date must be before end date",
  path: ["startDate"],
});

export const updateAcademicYearSchema = z.object({
  yearId: z.string().min(1).optional(),
  label: z.string().min(2).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  isClosed: z.boolean().optional(),
}).refine((data) => !data.startDate || !data.endDate || data.startDate < data.endDate, {
  message: "Start date must be before end date",
  path: ["startDate"],
});

// FeeVoucher schemas
export const createFeeVoucherSchema = z.object({
  voucherId: z.string().min(1, "Voucher ID is required"),
  studentProfileId: z.string().min(1, "Student is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  feeType: z.string().min(2, "Fee type is required"),
  baseAmount: z.number().positive("Base amount must be positive"),
  discountAmount: z.number().min(0).default(0),
  arrears: z.number().min(0).default(0),
  dueDate: dateSchema,
  status: z.enum(["PENDING", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"]).default("PENDING"),
});

export const updateFeeVoucherSchema = createFeeVoucherSchema.partial();

// Transaction schemas
export const createTransactionSchema = z.object({
  transactionId: z.string().min(1, "Transaction ID is required"),
  feeVoucherId: z.string().min(1, "Fee voucher is required"),
  amountPaid: z.number().positive("Amount must be positive"),
  paymentMethod: z.enum(["CASH", "DIGITAL"]),
  receiptNumber: z.string().min(1, "Receipt number is required"),
  collectedById: z.string().min(1, "Collector is required"),
  note: z.string().optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

// StaffProfile schemas
export const createStaffSchema = z.object({
  staffId: z.string().min(1, "Staff ID is required"),
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  department: z.string().min(2, "Department is required"),
  designation: z.string().min(2, "Designation is required"),
  baseSalary: z.number().positive("Base salary must be positive"),
  hireDate: dateSchema,
  phone: z.string().optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().default(true),
});

export const updateStaffSchema = createStaffSchema.partial();

// SalaryLedger schemas
export const createSalaryLedgerSchema = z.object({
  staffProfileId: z.string().min(1, "Staff is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2100),
  baseSalary: z.number().positive(),
  deductions: z.number().min(0).default(0),
  advances: z.number().min(0).default(0),
  paidAmount: z.number().min(0).default(0),
  status: z.enum(["PENDING", "PAID", "PARTIAL"]).default("PENDING"),
});

export const updateSalaryLedgerSchema = createSalaryLedgerSchema.partial();

// Attendance schemas
export const createAttendanceSchema = z.object({
  studentProfileId: z.string().optional(),
  staffProfileId: z.string().optional(),
  date: dateSchema,
  status: z.enum(["PRESENT", "ABSENT", "LATE", "LEAVE"]),
  note: z.string().optional(),
  markedById: z.string().min(1, "Marker is required"),
}).refine((data) => data.studentProfileId || data.staffProfileId, {
  message: "Either student or staff profile must be provided",
  path: ["studentProfileId"],
});

export const updateAttendanceSchema = z.object({
  studentProfileId: z.string().optional(),
  staffProfileId: z.string().optional(),
  date: dateSchema.optional(),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "LEAVE"]).optional(),
  note: z.string().optional(),
  markedById: z.string().min(1).optional(),
});

// ExamResult schemas
export const createExamResultSchema = z.object({
  studentProfileId: z.string().min(1, "Student is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  examName: z.string().min(2, "Exam name is required"),
  subject: z.string().min(2, "Subject is required"),
  maxMarks: z.number().positive(),
  obtainedMarks: z.number().min(0),
  grade: z.string().optional(),
  remarks: z.string().optional(),
}).refine((data) => data.obtainedMarks <= data.maxMarks, {
  message: "Obtained marks cannot exceed max marks",
  path: ["obtainedMarks"],
});

export const updateExamResultSchema = z.object({
  studentProfileId: z.string().min(1).optional(),
  academicYearId: z.string().min(1).optional(),
  examName: z.string().min(2).optional(),
  subject: z.string().min(2).optional(),
  maxMarks: z.number().positive().optional(),
  obtainedMarks: z.number().min(0).optional(),
  grade: z.string().optional(),
  remarks: z.string().optional(),
});

// Type exports
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;
export type UpdateAcademicYearInput = z.infer<typeof updateAcademicYearSchema>;
export type CreateFeeVoucherInput = z.infer<typeof createFeeVoucherSchema>;
export type UpdateFeeVoucherInput = z.infer<typeof updateFeeVoucherSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type CreateSalaryLedgerInput = z.infer<typeof createSalaryLedgerSchema>;
export type UpdateSalaryLedgerInput = z.infer<typeof updateSalaryLedgerSchema>;
export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type CreateExamResultInput = z.infer<typeof createExamResultSchema>;
export type UpdateExamResultInput = z.infer<typeof updateExamResultSchema>;
