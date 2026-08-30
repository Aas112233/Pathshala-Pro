import { z } from "zod";
import { internalFileUrlSchema } from "@/lib/file-url";

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required"),
  role: z.enum([
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "MANAGER",
    "ACCOUNTANT",
    "ACADEMIC_COORDINATOR",
    "TEACHER",
    "CLERK",
    "PARENT",
    "STUDENT",
    "AUDITOR",
  ]),
  accessLevel: z.number().int().min(1).max(7).optional(),
  tenantId: z.string().optional(),
  staffProfileId: z.string().optional(),
  studentProfileId: z.string().optional(),
  isActive: z.boolean().optional(),
  permissions: z.any().optional(),
  parentStudentIds: z.array(z.string()).optional(), // for PARENT linking
});

export const updateUserSchema = createUserSchema.partial();

// Student schemas
export const createStudentSchema = z.object({
  studentId: z.string().optional(),
  profilePictureUrl: internalFileUrlSchema.optional().or(z.literal("")),
  driveFileId: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  firstNameBn: z.string().optional(),
  lastNameBn: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().or(z.literal("")),
  address: z.string().optional(),
  guardianName: z.string().min(1, "Guardian name is required"),
  guardianContact: z.string().min(1, "Guardian contact is required"),
  guardianEmail: z.string().email().optional().or(z.literal("")),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  emergencyContact: z.string().optional(),
  birthCertificateNo: z.string().optional(),
  classId: z.string().optional().nullable(),
  groupId: z.string().optional().nullable(),
  sectionId: z.string().optional().nullable(),
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

export const batchFeeInvoicingSchema = z.object({
  academicYearId: z.string().min(1, "Academic Year is required"),
  feeType: z.string().min(1, "Fee type is required").default("TUITION"),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  dueDate: z.string().min(1, "Due date is required"),
  baseAmount: z.number().min(0, "Base amount must be non-negative").default(0),
  useClassFeeStructure: z.boolean().default(true),
  target: z.enum(["ALL_STUDENTS", "CLASS", "SECTION"]).default("ALL_STUDENTS"),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  carryForwardArrears: z.boolean().default(true),
  note: z.string().optional(),
});

export type BatchFeeInvoicingInput = z.infer<typeof batchFeeInvoicingSchema>;

// Class Fee Structure schemas
export const createClassFeeStructureSchema = z.object({
  academicYearId: z.string().min(1, "Academic Year is required"),
  classId: z.string().min(1, "Class is required"),
  tuitionFee: z.number().min(0, "Tuition fee must be non-negative").default(0),
  labFee: z.number().min(0).default(0),
  computerFee: z.number().min(0).default(0),
  examFee: z.number().min(0).default(0),
  sportsFee: z.number().min(0).default(0),
  libraryFee: z.number().min(0).default(0),
  otherFee: z.number().min(0).default(0),
  billingCycle: z.enum(["MONTHLY", "QUARTERLY", "BI_ANNUAL", "ANNUAL"]).default("MONTHLY"),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateClassFeeStructureSchema = createClassFeeStructureSchema.partial();
export type CreateClassFeeStructureInput = z.infer<typeof createClassFeeStructureSchema>;
export type UpdateClassFeeStructureInput = z.infer<typeof updateClassFeeStructureSchema>;

// Student Fee Concession schemas — now supports stacking, tuition-only guard, validity window
export const createStudentFeeConcessionSchema = z.object({
  studentProfileId: z.string().min(1, "Student is required"),
  concessionType: z.enum(["SIBLING", "STAFF_CHILD", "MERIT", "NEED_BASED", "CUSTOM"]).default("CUSTOM"),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]).default("PERCENTAGE"),
  discountValue: z.number().min(0, "Discount value must be non-negative"),
  appliesToHead: z.enum(["TUITION", "ALL_HEADS"]).default("TUITION"),
  priority: z.number().int().min(1).max(100).default(10),
  validFrom: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  reason: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateStudentFeeConcessionSchema = createStudentFeeConcessionSchema.partial();
export type CreateStudentFeeConcessionInput = z.infer<typeof createStudentFeeConcessionSchema>;
export type UpdateStudentFeeConcessionInput = z.infer<typeof updateStudentFeeConcessionSchema>;

// Transaction schemas
export const paymentMethodSchema = z.enum([
  "CASH",
  "DIGITAL",
  "ONLINE",
  "BANK",
  "BANK_TRANSFER",
  "POS_CARD",
  "CARD",
  "CHEQUE",
  "EASYPAISA",
  "JAZZCASH",
  "BKASH",
  "NAGAD",
  "UPI",
  "OTHER",
]);

export const createTransactionSchema = z.object({
  transactionId: z.string().min(1, "Transaction ID is required"),
  feeVoucherId: z.string().min(1, "Fee voucher is required"),
  amountPaid: z.number().positive("Amount must be positive"),
  paymentMethod: paymentMethodSchema.or(z.string().min(1)),
  receiptNumber: z.string().min(1, "Receipt number is required"),
  note: z.string().optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

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
  profilePictureUrl: internalFileUrlSchema.optional(),
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
const createExamResultNewSchemaShape = z.object({
  studentProfileId: z.string().min(1, "Student is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  examId: z.string().min(1, "Exam is required"),
  subjectId: z.string().min(1, "Subject is required"),
  maxMarks: z.number().min(1),
  obtainedMarks: z.number().min(0),
  reExamAllowed: z.boolean().default(false),
});

// `obtainedMarks` can't be bounded above via a per-field validator since the
// bound (maxMarks) is a sibling field whose value varies per subject/exam —
// enforce it with an object-level refinement instead.
export const createExamResultNewSchema = createExamResultNewSchemaShape.refine(
  (data) => data.obtainedMarks <= data.maxMarks,
  { message: "obtainedMarks cannot exceed maxMarks", path: ["obtainedMarks"] }
);

export const updateExamResultNewSchema = createExamResultNewSchemaShape.partial();

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

// Institute Onboarding schemas
export const CLASS_TEMPLATE_PRESETS = [
  "K_12",
  "PRIMARY_1_5",
  "MIDDLE_6_8",
  "SECONDARY_9_10",
  "HIGHER_SEC_11_12",
  "PK_FBISE_MATRIC_INTER",
  "IN_CBSE_SECONDARY_SR_SEC",
  "BD_NCTB_PRIMARY_SSC_HSC",
  "O_A_LEVELS",
  "MADRASA",
  "CUSTOM",
] as const;

export type ClassTemplatePreset = (typeof CLASS_TEMPLATE_PRESETS)[number];

export const RESERVED_TENANT_SLUGS = [
  "system",
  "admin",
  "api",
  "www",
  "app",
  "platform",
  "root",
  "superuser",
  "superadmin",
  "null",
  "undefined",
  "dashboard",
  "auth",
  "login",
  "register",
  "support",
  "help",
  "public",
  "assets",
  "static",
] as const;

export const onboardInstituteSchema = z.object({
  name: z.string().min(2, "School name must be at least 2 characters"),
  tenantId: z
    .string()
    .min(3, "Subdomain/slug must be at least 3 characters")
    .max(30, "Subdomain/slug must be 30 characters or less")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .refine(
      (slug) => !RESERVED_TENANT_SLUGS.includes(slug.toLowerCase().trim() as any),
      {
        message: "This subdomain/slug is reserved by the platform. Please choose a different slug.",
      }
    )
    .optional(),
  schoolCode: z.string().optional(),
  address: z.string().min(5, "Address must be at least 5 characters"),
  phone: z.string().optional(),
  email: z.preprocess(
    (val) => (!val || (typeof val === "string" && !val.trim()) ? undefined : typeof val === "string" ? val.trim().toLowerCase() : val),
    z.string().email("Invalid email format").optional().nullable()
  ),
  website: z.preprocess(
    (val) => {
      if (!val || (typeof val === "string" && !val.trim())) return undefined;
      if (typeof val === "string") {
        const trimmed = val.trim();
        return trimmed.startsWith("http://") || trimmed.startsWith("https://")
          ? trimmed
          : `https://${trimmed}`;
      }
      return val;
    },
    z.string().url("Invalid website URL").optional().nullable()
  ),
  motto: z.string().optional(),
  establishedYear: z.number().int().min(1800).max(new Date().getFullYear()).optional(),

  currency: z.string().default("PKR"),
  currencySymbol: z.string().default("₨"),
  taxRate: z.number().min(0).max(100).default(0),
  dateFormat: z.string().default("DD/MM/YYYY"),
  timeFormat: z.enum(["12h", "24h"]).default("12h"),
  timezone: z.string().default("Asia/Karachi"),
  firstDayOfWeek: z.string().default("monday"),
  gradingSystem: z.enum(["GPA", "PERCENTAGE", "LETTER"]).default("GPA"),

  academicYearLabel: z.string().min(4, "Academic year label is required"),
  academicStartDate: z.string().min(1, "Academic start date is required"),
  academicEndDate: z.string().min(1, "Academic end date is required"),
  classTemplate: z.enum(CLASS_TEMPLATE_PRESETS).default("K_12"),

  adminName: z.string().min(2, "Admin name must be at least 2 characters"),
  adminEmail: z.preprocess(
    (val) => (typeof val === "string" ? val.trim().toLowerCase() : val),
    z.string().email("Valid admin email is required")
  ),
  adminPassword: z.string().min(6, "Password must be at least 6 characters"),
  adminPhone: z.string().optional(),

  subscriptionStatus: z.enum(["ACTIVE", "TRIAL", "SUSPENDED", "EXPIRED"]).default("TRIAL"),
});

export type OnboardInstituteInput = z.infer<typeof onboardInstituteSchema>;

// Expense Category schemas
export const createExpenseCategorySchema = z.object({
  name: z.string().min(2, "Category name is required"),
  code: z.string().min(2, "Code is required").toUpperCase(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateExpenseCategorySchema = createExpenseCategorySchema.partial();

// Expense schemas
export const createExpenseSchema = z.object({
  title: z.string().min(2, "Expense title is required"),
  categoryId: z.string().min(1, "Category is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  paymentMethod: z.enum(["CASH", "BANK", "CHEQUE", "DIGITAL"]).default("CASH"),
  expenseDate: z.string().min(1, "Expense date is required"),
  payeeName: z.string().optional(),
  receiptNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

// Bank Account schemas
export const createBankAccountSchema = z.object({
  accountName: z.string().min(2, "Account name is required"),
  accountNumber: z.string().min(2, "Account number is required"),
  bankName: z.string().min(2, "Bank name is required"),
  branchName: z.string().optional(),
  accountType: z.enum(["CHECKING", "SAVINGS", "PETTY_CASH"]).default("CHECKING"),
  openingBalance: z.number().min(0).default(0),
  currency: z.string().default("PKR"),
});

export const updateBankAccountSchema = createBankAccountSchema.partial();

// Fee head accounting mappings
export const updateFeeHeadMappingsSchema = z.object({
  mappings: z.array(
    z.object({
      code: z.string().min(1).max(50),
      accountCode: z.string().regex(/^[0-9]{3,10}$/, "A valid account code is required"),
    })
  ).min(1),
});

// Timetable schemas
export const DAYS_OF_WEEK = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;

const baseTimetableSchema = z.object({
  academicYearId: z.string().optional().nullable(),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().optional().nullable(),
  dayOfWeek: z.enum(DAYS_OF_WEEK),
  periodNumber: z.number().int().min(1).max(12),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Start time must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "End time must be HH:MM"),
  subjectId: z.string().optional().nullable(),
  staffProfileId: z.string().optional().nullable(),
  roomNumber: z.string().optional().nullable(),
  isBreak: z.boolean().default(false),
  breakLabel: z.string().optional().nullable(),
});

export const createTimetableSchema = baseTimetableSchema.refine(
  (d) => d.isBreak || !!d.subjectId,
  { message: "Subject is required for teaching periods", path: ["subjectId"] }
);

export const updateTimetableSchema = baseTimetableSchema.partial();

export const bulkTimetableSchema = z.object({
  entries: z.array(createTimetableSchema).min(1, "At least one entry required"),
});

// Enquiry schemas
export const ENQUIRY_STATUSES = ["NEW", "CONTACTED", "VISITED", "ADMITTED", "REJECTED"] as const;
export const ENQUIRY_SOURCES = ["WALK_IN", "PHONE", "WEBSITE", "REFERRAL", "SOCIAL", "OTHER"] as const;

export const createEnquirySchema = z.object({
  studentName: z.string().min(2, "Student name is required"),
  guardianName: z.string().min(2, "Guardian name is required"),
  phone: z.string().min(8, "Phone is required"),
  email: z.preprocess(
    (v) => (typeof v === "string" && !v.trim() ? undefined : v),
    z.string().email("Invalid email").optional().nullable()
  ),
  classAppliedId: z.string().optional().nullable(),
  source: z.enum(ENQUIRY_SOURCES).default("WALK_IN"),
  status: z.enum(ENQUIRY_STATUSES).default("NEW"),
  followUpDate: z.preprocess((v) => (v === "" ? null : v), z.string().optional().nullable()),
  notes: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
});

export const updateEnquirySchema = createEnquirySchema.partial();

// Library schemas
export const createBookSchema = z.object({
  title: z.string().min(2, "Title is required"),
  author: z.string().min(2, "Author is required"),
  isbn: z.string().optional().nullable(),
  publisher: z.string().optional().nullable(),
  category: z.enum(["GENERAL", "TEXTBOOK", "REFERENCE", "STORY", "SCIENCE", "HISTORY", "COMPUTER"]).default("GENERAL"),
  accessionNo: z.string().min(1, "Accession number is required"),
  copies: z.number().int().min(1).default(1),
  shelfLocation: z.string().optional().nullable(),
});

export const updateBookSchema = createBookSchema.partial();

export const createBookIssueSchema = z.object({
  bookId: z.string().min(1, "Book is required"),
  borrowerType: z.enum(["STUDENT", "STAFF"]).default("STUDENT"),
  studentProfileId: z.string().optional().nullable(),
  staffProfileId: z.string().optional().nullable(),
  borrowerName: z.string().min(1, "Borrower name is required"),
  borrowerIdNo: z.string().min(1, "Borrower ID is required"),
  dueDate: z.string().min(1, "Due date is required"),
  notes: z.string().optional().nullable(),
});

export const returnBookSchema = z.object({
  fineAmount: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
});

// Transport schemas
export const createVehicleSchema = z.object({
  vehicleNo: z.string().min(2, "Vehicle number is required"),
  type: z.enum(["BUS", "VAN", "MINI_BUS", "OTHER"]).default("BUS"),
  capacity: z.number().int().min(1),
  driverName: z.string().optional().nullable(),
  driverPhone: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateVehicleSchema = createVehicleSchema.partial();

export const createRouteSchema = z.object({
  name: z.string().min(2, "Route name is required"),
  stops: z.array(z.string().min(1)).min(1, "At least one stop required"),
  vehicleId: z.string().optional().nullable(),
  monthlyFee: z.number().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateRouteSchema = createRouteSchema.partial();

export const createAllocationSchema = z.object({
  studentProfileId: z.string().min(1, "Student is required"),
  routeId: z.string().min(1, "Route is required"),
  stopName: z.string().min(1, "Stop is required"),
  monthlyFee: z.number().min(0).default(0),
});

export const updateAllocationSchema = createAllocationSchema.partial();

// Homework schemas
export const createHomeworkSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().optional().nullable(),
  subjectId: z.string().optional().nullable(),
  title: z.string().min(2, "Title is required"),
  description: z.string().min(5, "Description is required"),
  attachmentUrl: internalFileUrlSchema.optional().nullable().or(z.literal("")),
  dueDate: z.string().min(1, "Due date is required"),
});

export const updateHomeworkSchema = createHomeworkSchema.partial();

export const createSubmissionSchema = z.object({
  homeworkId: z.string().min(1, "Homework is required"),
  studentProfileId: z.string().min(1, "Student is required"),
  attachmentUrl: internalFileUrlSchema.optional().nullable().or(z.literal("")),
  remarks: z.string().optional().nullable(),
});

export const gradeSubmissionSchema = z.object({
  grade: z.string().min(1, "Grade is required"),
  remarks: z.string().optional().nullable(),
  status: z.enum(["GRADED", "PENDING", "LATE"]).default("GRADED"),
});

// Leave schemas
export const createLeaveSchema = z.object({
  applicantType: z.enum(["STUDENT", "STAFF"]).default("STUDENT"),
  studentProfileId: z.string().optional().nullable(),
  staffProfileId: z.string().optional().nullable(),
  leaveType: z.enum(["SICK", "CASUAL", "EMERGENCY", "OTHER"]).default("SICK"),
  fromDate: z.string().min(1, "From date is required"),
  toDate: z.string().min(1, "To date is required"),
  reason: z.string().min(5, "Reason is required"),
}).refine((d) => (d.applicantType === "STUDENT" ? !!d.studentProfileId : !!d.staffProfileId), {
  message: "Applicant is required",
  path: ["studentProfileId"],
});

export const updateLeaveSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  leaveType: z.enum(["SICK", "CASUAL", "EMERGENCY", "OTHER"]).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  reason: z.string().optional(),
});

// Certificate schemas
export const createCertificateSchema = z.object({
  studentProfileId: z.string().min(1, "Student is required"),
  certificateType: z.enum(["TRANSFER", "CHARACTER", "BONAFIDE", "STUDY", "MARKSHEET", "OTHER"]).default("BONAFIDE"),
  certificateNumber: z.string().optional(),
  issueDate: z.string().optional(),
  validUntil: z.preprocess((v) => (v === "" ? null : v), z.string().optional().nullable()),
  purpose: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export const updateCertificateSchema = z.object({
  studentProfileId: z.string().optional(),
  certificateType: z.enum(["TRANSFER", "CHARACTER", "BONAFIDE", "STUDY", "MARKSHEET", "OTHER"]).optional(),
  certificateNumber: z.string().optional(),
  issueDate: z.string().optional(),
  validUntil: z.preprocess((v) => (v === "" ? null : v), z.string().optional().nullable()),
  purpose: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  status: z.enum(["ISSUED", "REVOKED", "DRAFT"]).optional(),
});

// Health schemas
export const createHealthRecordSchema = z.object({
  studentProfileId: z.string().min(1, "Student is required"),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]).optional().nullable(),
  allergies: z.string().optional().nullable(),
  chronicConditions: z.string().optional().nullable(),
  medications: z.string().optional().nullable(),
  vaccinationJson: z.any().optional().nullable(),
  heightCm: z.number().min(30).max(250).optional().nullable(),
  weightKg: z.number().min(5).max(300).optional().nullable(),
  visionLeft: z.string().optional().nullable(),
  visionRight: z.string().optional().nullable(),
  lastCheckupDate: z.preprocess((v) => (v === "" ? null : v), z.string().optional().nullable()),
  remarks: z.string().optional().nullable(),
});

export const updateHealthRecordSchema = createHealthRecordSchema.partial();

// Inventory schemas
export const createInventoryItemSchema = z.object({
  name: z.string().min(2, "Item name is required"),
  code: z.string().min(1, "Code is required"),
  category: z.enum(["GENERAL", "STATIONERY", "LAB", "SPORTS", "UNIFORM", "BOOKS", "FURNITURE", "ELECTRONICS"]).default("GENERAL"),
  unit: z.enum(["PCS", "BOX", "KG", "LTR", "SET", "DOZEN"]).default("PCS"),
  quantity: z.number().int().min(0).default(0),
  minStockLevel: z.number().int().min(0).default(10),
  location: z.string().optional().nullable(),
  costPrice: z.number().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateInventoryItemSchema = createInventoryItemSchema.partial();

export const createInventoryTransactionSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  transactionType: z.enum(["PURCHASE", "ISSUE", "ADJUSTMENT", "RETURN"]).default("PURCHASE"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitCost: z.number().min(0).optional().nullable(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Hostel schemas
export const createHostelSchema = z.object({
  name: z.string().min(2, "Hostel name is required"),
  type: z.enum(["BOYS", "GIRLS", "COMBINED"]).default("BOYS"),
  wardenName: z.string().optional().nullable(),
  wardenPhone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  capacity: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateHostelSchema = createHostelSchema.partial();

export const createHostelRoomSchema = z.object({
  hostelId: z.string().min(1, "Hostel is required"),
  roomNumber: z.string().min(1, "Room number is required"),
  floor: z.number().int().min(0).default(1),
  capacity: z.number().int().min(1).default(4),
  roomType: z.enum(["GENERAL", "DELUXE", "DORMITORY"]).default("GENERAL"),
  isActive: z.boolean().default(true),
});

export const updateHostelRoomSchema = createHostelRoomSchema.partial();

export const createHostelAllocationSchema = z.object({
  hostelId: z.string().min(1, "Hostel is required"),
  roomId: z.string().min(1, "Room is required"),
  studentProfileId: z.string().min(1, "Student is required"),
  bedNumber: z.string().optional().nullable(),
});

export const updateHostelAllocationSchema = createHostelAllocationSchema.partial();

// Notice schemas
export const createNoticeSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  content: z.string().min(5, "Content must be at least 5 characters"),
  category: z.enum([
    "GENERAL",
    "ACADEMIC",
    "EXAMINATION",
    "FEE_REMINDER",
    "HOLIDAY",
    "EVENT",
    "MAINTENANCE",
    "SYSTEM_UPDATE",
    "BILLING_ALERT",
    "URGENT_ALERT",
  ]).default("GENERAL"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  audience: z.enum([
    "ALL",
    "TEACHERS",
    "STUDENTS",
    "PARENTS",
    "SPECIFIC_CLASS",
    "ALL_SCHOOLS",
    "SPECIFIC_TENANTS",
    "SYSTEM_ADMINS",
  ]).default("ALL"),
  targetClassId: z.string().optional().nullable(),
  targetTenants: z.array(z.string()).optional().default([]),
  isPinned: z.boolean().optional().default(false),
  isPublished: z.boolean().optional().default(true),
  publishDate: z.string().optional(),
  expiresAt: z.preprocess((val) => (val === "" ? null : val), z.string().optional().nullable()),
  attachmentUrl: z.preprocess((val) => (val === "" ? null : val), internalFileUrlSchema.optional().nullable()),
});

export const updateNoticeSchema = createNoticeSchema.partial();

// Question Bank & Question Paper Schemas
export const QUESTION_TYPES = [
  "MCQ",
  "SHORT",
  "DESCRIPTIVE",
  "CREATIVE_NCTB",
  "TRUE_FALSE",
  "FILL_BLANK",
] as const;

export const QUESTION_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
export const BLOOM_LEVELS = ["KNOWLEDGE", "UNDERSTANDING", "APPLICATION", "ANALYSIS"] as const;

export const createQuestionSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  subjectId: z.string().min(1, "Subject is required"),
  chapter: z.string().optional().nullable(),
  topic: z.string().optional().nullable(),
  type: z.enum(QUESTION_TYPES).default("MCQ"),
  difficulty: z.enum(QUESTION_DIFFICULTIES).default("MEDIUM"),
  bloomLevel: z.enum(BLOOM_LEVELS).optional().nullable(),
  questionText: z.string().min(1, "Question text is required"),
  stimulus: z.string().optional().nullable(),
  options: z.array(z.object({
    id: z.string(),
    text: z.string(),
    isCorrect: z.boolean(),
  })).optional().nullable(),
  subQuestions: z.array(z.object({
    label: z.string(),
    text: z.string(),
    marks: z.number().min(0),
  })).optional().nullable(),
  correctAnswer: z.string().optional().nullable(),
  explanation: z.string().optional().nullable(),
  marks: z.number().min(0.5).default(1),
  isActive: z.boolean().optional().default(true),
});

export const updateQuestionSchema = createQuestionSchema.partial();

export const QUESTION_PAPER_STATUSES = ["DRAFT", "READY", "PUBLISHED", "ARCHIVED"] as const;

export const questionPaperSectionSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Section title is required"),
  instructions: z.string().optional().nullable(),
  totalMarks: z.number().min(0),
  questionIds: z.array(z.string()).default([]),
});

export const createQuestionPaperSchema = z.object({
  title: z.string().min(2, "Paper title is required"),
  code: z.string().optional().nullable(),
  academicYearId: z.string().min(1, "Academic year is required"),
  classId: z.string().min(1, "Class is required"),
  subjectId: z.string().min(1, "Subject is required"),
  examId: z.string().optional().nullable(),
  totalMarks: z.number().min(1).default(100),
  durationMinutes: z.number().int().min(10).default(180),
  instructions: z.string().optional().nullable(),
  sections: z.array(questionPaperSectionSchema).min(1, "At least one section is required"),
  status: z.enum(QUESTION_PAPER_STATUSES).default("DRAFT"),
});

export const updateQuestionPaperSchema = createQuestionPaperSchema.partial();

export const generateBlueprintSchema = z.object({
  title: z.string().min(2, "Paper title is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  classId: z.string().min(1, "Class is required"),
  subjectId: z.string().min(1, "Subject is required"),
  examId: z.string().optional().nullable(),
  totalMarks: z.number().min(1).default(100),
  durationMinutes: z.number().int().min(10).default(180),
  instructions: z.string().optional().nullable(),
  blueprint: z.object({
    mcqCount: z.number().int().min(0).default(20),
    mcqMarksEach: z.number().min(0.5).default(1),
    shortCount: z.number().int().min(0).default(5),
    shortMarksEach: z.number().min(1).default(4),
    descriptiveCount: z.number().int().min(0).default(5),
    descriptiveMarksEach: z.number().min(1).default(10),
    creativeCount: z.number().int().min(0).default(0),
    creativeMarksEach: z.number().min(1).default(10),
    difficultyRatio: z.object({
      easy: z.number().min(0).max(100).default(30),
      medium: z.number().min(0).max(100).default(50),
      hard: z.number().min(0).max(100).default(20),
    }).optional(),
  }),
});