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
  role: z.enum(["SUPER_ADMIN", "ADMIN", "TEACHER", "CLERK", "STUDENT", "PRINCIPAL", "MANAGER", "AUDITOR"]),
  tenantId: z.string().optional(),
  staffProfileId: z.string().optional(),
  isActive: z.boolean().optional(),
  permissions: z.any().optional(),
});

export const updateUserSchema = createUserSchema.partial();

// Student schemas
export const createStudentSchema = z.object({
  studentId: z.string().optional(),
  profilePictureUrl: z.string().url().optional(),
  driveFileId: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  address: z.string().optional(),
  guardianName: z.string().min(1, "Guardian name is required"),
  guardianContact: z.string().min(1, "Guardian contact is required"),
  rollNumber: z.string().min(1, "Roll number is required"),
  bloodGroup: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "GRADUATED", "TRANSFERRED"]).default("ACTIVE"),
});

export const updateStudentSchema = createStudentSchema.partial();

// Fee voucher schemas
export const createFeeVoucherSchema = z.object({
  studentProfileId: z.string().min(1, "Student is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  feeType: z.string().min(1, "Fee type is required"),
  voucherId: z.string().min(1, "Voucher ID is required"),
  baseAmount: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  totalDue: z.number().min(0, "Total due must be non-negative"),
  dueDate: z.string().min(1, "Due date is required"),
  discount: z.number().min(0).default(0),
  arrears: z.number().min(0).default(0),
});

export const updateFeeVoucherSchema = createFeeVoucherSchema.partial();

// Transaction schemas
export const createTransactionSchema = z.object({
  transactionId: z.string().min(1, "Transaction ID is required"),
  feeVoucherId: z.string().min(1, "Fee voucher is required"),
  amountPaid: z.number().positive("Amount must be positive"),
  paymentMethod: z.enum(["CASH", "DIGITAL"]),
  receiptNumber: z.string().min(1, "Receipt number is required"),
  note: z.string().optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

// Staff schemas
export const createStaffSchema = z.object({
  staffId: z.string().min(1, "Staff ID is required").optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  firstNameBn: z.string().optional(),
  lastNameBn: z.string().optional(),
  department: z.string().min(1, "Department is required"),
  designation: z.string().min(1, "Designation is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  baseSalary: z.number().min(0).default(0),
  hireDate: z.string().min(1, "Hire date is required"),
  joiningDate: z.string().optional(),
  qualification: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  profilePictureUrl: z.string().url().optional(),
  driveFileId: z.string().optional(),
  isActive: z.boolean().default(true),
  userId: z.string().optional(),
});

export const updateStaffSchema = createStaffSchema.partial();

// Academic Year schemas
export const createAcademicYearSchema = z.object({
  yearId: z.string().min(1, "Year ID is required"),
  label: z.string().min(1, "Label is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

export const updateAcademicYearSchema = createAcademicYearSchema.partial();

// Attendance schemas
export const createAttendanceSchema = z.object({
  date: z.string().min(1, "Date is required"),
  studentProfileId: z.string().optional(),
  staffProfileId: z.string().optional(),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "LEAVE"]),
  note: z.string().optional(),
});

export const updateAttendanceSchema = createAttendanceSchema.partial();

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

export const updateExamResultSchema = createExamResultSchema.partial();

// Subject schemas
export const createSubjectSchema = z.object({
  subjectId: z.string().min(1, "Subject ID is required"),
  name: z.string().min(1, "Subject name is required"),
  code: z.string().min(1, "Subject code is required"),
  category: z.enum(["COMPULSORY", "ELECTIVE", "OPTIONAL"]).default("COMPULSORY"),
  maxMarks: z.number().min(1).default(100),
  passMarks: z.number().min(1).default(33),
});

export const updateSubjectSchema = createSubjectSchema.partial();

// Exam schemas
export const createExamSchema = z.object({
  examId: z.string().min(1, "Exam ID is required").optional(),
  academicYearId: z.string().min(1, "Academic year is required"),
  name: z.string().min(1, "Exam name is required"),
  type: z.enum(["MID_TERM", "FINAL", "UNIT_TEST", "ANNUAL"]).default("MID_TERM"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  totalMarks: z.number().min(1).default(100),
  passPercentage: z.number().min(1).max(100).default(33),
  isPublished: z.boolean().default(false),
  subjects: z.array(z.object({
    subjectId: z.string().min(1, "Subject is required"),
    maxMarks: z.number().min(1),
    passMarks: z.number().min(1),
  })).min(1, "At least one class subject is required"),
});

export const updateExamSchema = createExamSchema.partial();

// Exam Subject schemas
export const createExamSubjectSchema = z.object({
  examId: z.string().min(1, "Exam is required"),
  subjectId: z.string().min(1, "Subject is required"),
  maxMarks: z.number().min(1),
  passMarks: z.number().min(1),
});

export const updateExamSubjectSchema = createExamSubjectSchema.partial();

// Exam Result schemas (updated for new structure)
export const createExamResultNewSchema = z.object({
  studentProfileId: z.string().min(1, "Student is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  examId: z.string().min(1, "Exam is required"),
  subjectId: z.string().min(1, "Subject is required"),
  maxMarks: z.number().min(1),
  obtainedMarks: z.number().min(0),
  reExamAllowed: z.boolean().default(false),
});

export const updateExamResultNewSchema = createExamResultNewSchema.partial();

// Promotion Rule schemas
export const createPromotionRuleSchema = z.object({
  academicYearId: z.string().min(1, "Academic year is required"),
  classId: z.string().min(1, "Class is required"),
  minimumAttendance: z.number().min(0).max(100).default(75),
  minimumOverallPercentage: z.number().min(0).max(100).default(40),
  minimumPerSubject: z.number().min(0).max(100).default(33),
  maxFailedSubjects: z.number().min(0).default(0),
  allowConditionalPromotion: z.boolean().default(false),
  autoPromote: z.boolean().default(true),
  nextClassId: z.string().optional().nullable(),
});

export const updatePromotionRuleSchema = createPromotionRuleSchema.partial();

// Class Promotion schemas
export const createClassPromotionSchema = z.object({
  studentProfileId: z.string().min(1, "Student is required"),
  fromAcademicYearId: z.string().min(1, "From academic year is required"),
  toAcademicYearId: z.string().min(1, "To academic year is required"),
  fromClassId: z.string().min(1, "From class is required"),
  toClassId: z.string().min(1, "To class is required"),
  status: z.enum(["PROMOTED", "RETAINED", "CONDITIONAL_PROMOTED"]).default("PROMOTED"),
  reason: z.string().optional(),
  reExamRequired: z.boolean().default(false),
});

export const updateClassPromotionSchema = createClassPromotionSchema.partial();

// Salary ledger schemas
export const createSalaryLedgerSchema = z.object({
  staffProfileId: z.string().min(1, "Staff is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2100),
  baseSalary: z.number().min(0),
  deductions: z.number().min(0).default(0),
  advances: z.number().min(0).default(0),
  status: z.enum(["PENDING", "PARTIAL", "PAID"]).default("PENDING"),
  paidAmount: z.number().min(0).default(0),
  paidAt: z.string().optional(),
});

export const updateSalaryLedgerSchema = createSalaryLedgerSchema.partial();

// Bulk payroll schema
export const bulkPayrollEntrySchema = z.object({
  staffProfileId: z.string().min(1, "Staff is required"),
  baseSalary: z.number().min(0),
  deductions: z.number().min(0).default(0),
  advances: z.number().min(0).default(0),
});

export const bulkPayrollSchema = z.object({
  academicYearId: z.string().min(1, "Academic year is required"),
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2100),
  entries: z.array(bulkPayrollEntrySchema).min(1, "At least one entry is required"),
});
