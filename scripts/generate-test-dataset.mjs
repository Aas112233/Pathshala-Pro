/**
 * Generate a school test dataset as an Excel workbook.
 *
 * Run:  node scripts/generate-test-dataset.mjs
 *
 * Produces `docs/test-datasets/Pathshala_Pro_Test_Dataset_2026-2028.xlsx`.
 *
 * The dataset spans TWO academic years on purpose: with a single year you can
 * test admission, fees and exams, but you cannot test the thing that breaks —
 * promoting students into a year and rolling the setup forward into it. Year 1
 * is fully populated; year 2 holds the students after a promotion has run, so
 * the academic-year surfaces have something real to work against.
 *
 * Values follow the app's own vocabulary — the status strings, the weekday
 * numbering and the id prefixes are the ones the code reads — so a row can be
 * imported without a translation step. The Overview sheet lists them.
 */

import ExcelJS from "exceljs";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";

// Deterministic output: the same seed produces the same workbook, so a bug
// report about "row 143" means the same row tomorrow.
faker.seed(2026);

const TENANT_ID = "tenant_test_school";
const OUTPUT_FILE = "docs/test-datasets/Pathshala_Pro_Test_Dataset_2026-2028.xlsx";

const STAFF_COUNT = 50;
const STUDENT_COUNT = 200;
const CLASS_COUNT = 10;
const MONTHS = 12;

// ---------------------------------------------------------------------------
// The academic years. Two, deliberately.
// ---------------------------------------------------------------------------

const YEARS = [
  {
    id: "ay-2026-27",
    yearId: "AY2026",
    label: "2026-2027",
    startDate: "2026-04-01",
    endDate: "2027-03-31",
    isClosed: false,
    isCurrent: true,
    nonWorkingWeekdays: "5,6",
    feeBalancePolicy: "CARRY_UNPAID",
  },
  {
    id: "ay-2027-28",
    yearId: "AY2027",
    label: "2027-2028",
    startDate: "2027-04-01",
    endDate: "2028-03-31",
    isClosed: false,
    isCurrent: false,
    nonWorkingWeekdays: "5,6",
    feeBalancePolicy: "CARRY_UNPAID",
  },
];

const [YEAR_1, YEAR_2] = YEARS;

// ---------------------------------------------------------------------------
// The class ladder and the rest of the reference data.
// ---------------------------------------------------------------------------

const CLASSES = Array.from({ length: CLASS_COUNT }, (_, index) => ({
  id: `cls-${String(index + 1).padStart(2, "0")}`,
  classId: `C${index + 1}`,
  name: `Class ${index + 1}`,
  classNumber: index + 1,
}));

// The chain: every class knows its next one, and the top of the school ends it.
const NEXT_CLASS = new Map(
  CLASSES.map((cls, index) => [cls.id, CLASSES[index + 1]?.id ?? null])
);

const SECTIONS = CLASSES.flatMap((cls) =>
  ["A", "B"].map((name) => ({
    id: `${cls.id}-sec-${name}`,
    sectionId: `${cls.classId}-${name}`,
    classId: cls.id,
    name,
    shortName: name,
    capacity: 40,
    roomNumber: `${cls.classNumber}0${name === "A" ? 1 : 2}`,
  }))
);

const SUBJECTS = [
  { id: "sub-math", subjectId: "MATH", name: "Mathematics", code: "MATH", category: "COMPULSORY", maxMarks: 100, passMarks: 33 },
  { id: "sub-eng", subjectId: "ENG", name: "English", code: "ENG", category: "COMPULSORY", maxMarks: 100, passMarks: 33 },
  { id: "sub-sci", subjectId: "SCI", name: "Science", code: "SCI", category: "COMPULSORY", maxMarks: 100, passMarks: 33 },
  { id: "sub-bgs", subjectId: "BGS", name: "Bangladesh & Global Studies", code: "BGS", category: "COMPULSORY", maxMarks: 100, passMarks: 33 },
  { id: "sub-ict", subjectId: "ICT", name: "ICT", code: "ICT", category: "COMPULSORY", maxMarks: 50, passMarks: 17 },
  { id: "sub-rel", subjectId: "REL", name: "Religion & Moral Education", code: "REL", category: "COMPULSORY", maxMarks: 100, passMarks: 33 },
].map((subject) => ({ ...subject }));

// Core exam subjects: the six every student sits. Keeps the results sheet at a
// size that opens quickly while still exercising every subject's pass mark.
const EXAM_SUBJECTS = SUBJECTS.filter((subject) => subject.id !== "sub-rel");

const EXAM_TYPES = [
  { name: "First Terminal", type: "MID_TERM" },
  { name: "Annual Examination", type: "ANNUAL" },
];

// ---------------------------------------------------------------------------
// people
// ---------------------------------------------------------------------------

faker.locale = "en";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const bangladeshPhone = () => `017${faker.string.numeric(8)}`;
const dhakaAddress = () =>
  `${faker.location.buildingNumber()} ${faker.location.street()}, ${faker.helpers.arrayElement([
    "Dhanmondi", "Mirpur", "Uttara", "Banani", "Bashundhara R/A", "Mohammadpur", "Gulshan",
  ])}, Dhaka`;

/** A student's ability level, so marks and promotion outcomes are consistent. */
function abilityFor(index) {
  // Four in five students are comfortable; the rest struggle, so the promotion
  // run produces a realistic mix of promoted and retained rather than all-one.
  return index % 5 === 0 ? faker.number.float({ min: 18, max: 38, fractionDigits: 1 }) : faker.number.float({ min: 45, max: 96, fractionDigits: 1 });
}

function markFor(ability, maxMarks) {
  const value = faker.number.float({ min: Math.max(0, ability - 12), max: Math.min(100, ability + 12), fractionDigits: 0 });
  return Math.round((value / 100) * maxMarks);
}

const USERS = [
  { id: "usr-admin", email: "admin@pathshala.test", name: "Nurul Amin", role: "SCHOOL_ADMIN", accessLevel: 1, staffRef: null },
  { id: "usr-accountant", email: "accounts@pathshala.test", name: "Rasheda Khatun", role: "ACCOUNTANT", accessLevel: 3, staffRef: "Accountant" },
  { id: "usr-teacher", email: "teacher@pathshala.test", name: "Kamal Hossain", role: "TEACHER", accessLevel: 4, staffRef: "Teacher" },
  { id: "usr-clerk", email: "clerk@pathshala.test", name: "Sabbir Ahmed", role: "CLERK", accessLevel: 5, staffRef: "Office Assistant" },
];

const DEPARTMENTS = [
  { department: "Academic", titles: ["Senior Teacher", "Teacher", "Assistant Teacher"] },
  { department: "Administration", titles: ["Principal", "Vice Principal", "Office Manager"] },
  { department: "Accounts", titles: ["Accountant", "Assistant Accountant"] },
  { department: "Support", titles: ["Office Assistant", "Librarian", "Lab Assistant", "Peon"] },
];

const STAFF = [];
for (let i = 1; i <= STAFF_COUNT; i += 1) {
  const firstName = faker.person.firstName(i % 2 === 0 ? "male" : "female");
  const lastName = faker.person.lastName();
  const isLeadership = i === 1 || i === 2;
  const department =
    isLeadership
      ? DEPARTMENTS[1]
      : i <= STAFF_COUNT * 0.7
        ? DEPARTMENTS[0]
        : faker.helpers.arrayElement([DEPARTMENTS[2], DEPARTMENTS[3]]);
  const designation = isLeadership
    ? i === 1
      ? "Principal"
      : "Vice Principal"
    : faker.helpers.arrayElement(department.titles);
  const baseSalary =
    designation === "Principal"
      ? 75000
      : designation === "Vice Principal"
        ? 60000
        : designation === "Senior Teacher"
          ? faker.number.int({ min: 42000, max: 52000 })
          : faker.number.int({ min: 24000, max: 40000 });

  STAFF.push({
    id: `stf-${String(i).padStart(3, "0")}`,
    staffId: `EMP-${String(i).padStart(4, "0")}`,
    firstName,
    lastName,
    department: department.department,
    designation,
    baseSalary,
    hireDate: `${faker.number.int({ min: 2018, max: 2025 })}-${String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0")}-01`,
    phone: bangladeshPhone(),
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@pathshala.test`,
    gender: i % 2 === 0 ? "MALE" : "FEMALE",
    dateOfBirth: `${faker.number.int({ min: 1975, max: 1998 })}-${String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0")}-${String(faker.number.int({ min: 1, max: 28 })).padStart(2, "0")}`,
    qualification: faker.helpers.arrayElement([
      "B.Ed", "M.Ed", "B.Sc", "M.Sc", "M.A", "BBA", "MBA",
    ]),
    address: dhakaAddress(),
    isActive: true,
  });
}

// Teachers who can be put on a timetable: the academic staff.
const TEACHERS = STAFF.filter((member) => member.department === "Academic");

const STUDENTS = [];
const SESSIONS = [];

for (let i = 1; i <= STUDENT_COUNT; i += 1) {
  const gender = i % 2 === 0 ? "MALE" : "FEMALE";
  const firstName = faker.person.firstName(gender === "MALE" ? "male" : "female");
  const lastName = faker.person.lastName();
  const cls = CLASSES[i % CLASS_COUNT];
  const section = SECTIONS.find((entry) => entry.classId === cls.id && entry.name === (i % 4 < 2 ? "A" : "B"));
  const ability = abilityFor(i);
  const birthYear = 2026 - (cls.classNumber + 5);

  const student = {
    id: `stu-${String(i).padStart(4, "0")}`,
    studentId: `STU-${String(2026 + i).padStart(8, "0")}`,
    rollNumber: String(Math.floor(i / CLASS_COUNT) + 1).padStart(2, "0"),
    firstName,
    lastName,
    guardianName: `${faker.person.firstName("male")} ${lastName}`,
    guardianContact: `018${faker.string.numeric(8)}`,
    guardianEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@gmail.com`,
    fatherName: `${faker.person.firstName("male")} ${lastName}`,
    motherName: `${faker.person.firstName("female")} ${lastName}`,
    emergencyContact: bangladeshPhone(),
    bloodGroup: faker.helpers.arrayElement(BLOOD_GROUPS),
    birthCertificateNo: `${faker.number.int({ min: 1990, max: 2020 })}${faker.string.numeric(9)}`,
    dateOfBirth: `${birthYear}-${String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0")}-${String(faker.number.int({ min: 1, max: 28 })).padStart(2, "0")}`,
    gender,
    address: dhakaAddress(),
    classId: cls.id,
    sectionId: section.id,
    status: "ACTIVE",
    admissionDate: `${YEAR_1.startDate}`,
    exitDate: "",
    ability,
  };
  STUDENTS.push(student);

  // Year 1: every student is enrolled.
  SESSIONS.push({
    id: `ses-1-${String(i).padStart(4, "0")}`,
    tenantId: TENANT_ID,
    studentProfileId: student.id,
    academicYearId: YEAR_1.id,
    classId: cls.id,
    sectionId: section.id,
    rollNumber: student.rollNumber,
    classNumber: cls.classNumber,
    promotionStatus: "ENROLLED",
  });
}

// ---------------------------------------------------------------------------
// Promotion, already applied to year 2.
//
// The class-10 cohort has graduated and the rest have moved up one class. This
// is exactly what the promotion run does, so the academic-year surfaces have a
// realistic state to work against. Wipe the year-2 session rows and the year-2
// sheet if you would rather run the promotion yourself.
// ---------------------------------------------------------------------------

const promotedStudents = [];

for (const student of STUDENTS) {
  const isFinalClass = student.classId === CLASSES[CLASSES.length - 1].id;
  if (isFinalClass) {
    student.status = "GRADUATED";
    student.exitDate = YEAR_2.startDate;
    continue;
  }
  const nextClassId = NEXT_CLASS.get(student.classId);
  const nextClass = CLASSES.find((cls) => cls.id === nextClassId);
  const nextSection = SECTIONS.find(
    (entry) => entry.classId === nextClassId && entry.name === student.sectionId.slice(-1)
  );
  promotedStudents.push({ student, nextClass, nextSection });
  SESSIONS.push({
    id: `ses-2-${student.id}`,
    tenantId: TENANT_ID,
    studentProfileId: student.id,
    academicYearId: YEAR_2.id,
    classId: nextClassId,
    sectionId: nextSection.id,
    rollNumber: student.rollNumber,
    classNumber: nextClass.classNumber,
    promotionStatus: "PROMOTED",
  });
}

// ---------------------------------------------------------------------------
// fees
// ---------------------------------------------------------------------------

const FEE_HEADS = [
  { head: "TUITION", label: "Tuition", min: 800, max: 2200 },
  { head: "EXAM", label: "Exam fee", min: 150, max: 400 },
  { head: "TRANSPORT", label: "Transport", min: 400, max: 900 },
];

const FEE_STRUCTURES = [];
for (const year of YEARS) {
  for (const cls of CLASSES) {
    for (const feeHead of FEE_HEADS) {
      FEE_STRUCTURES.push({
        id: `cfs-${year.yearId}-${cls.classId}-${feeHead.head}`,
        academicYearId: year.id,
        classId: cls.id,
        feeHead: feeHead.head,
        amount: Math.round(faker.number.float({ min: feeHead.min, max: feeHead.max }) / 10) * 10,
        isActive: true,
        notes: "",
      });
    }
  }
}

const FEE_VOUCHERS = [];
const FEE_PAYMENTS = [];
let receiptCounter = 1;

for (const student of STUDENTS) {
  const tuition = FEE_STRUCTURES.find(
    (structure) =>
      structure.academicYearId === YEAR_1.id &&
      structure.classId === student.classId &&
      structure.feeHead === "TUITION"
  );
  // Payment behaviour follows the student's ability, loosely: weaker students
  // fall behind more, which is what makes the arrears sweep worth testing.
  const reliability = student.ability > 40 ? 0.92 : 0.72;

  for (let month = 1; month <= MONTHS; month += 1) {
    const billingMonth = month <= 9 ? month + 3 : month - 9; // April 2026 .. March 2027
    const billingYear = month <= 9 ? 2026 : 2027;
    const amount = tuition.amount;
    const roll = faker.number.float({ min: 0, max: 1, fractionDigits: 2 });
    const isPaid = roll < reliability;
    const isPartial = !isPaid && roll < reliability + 0.05;
    const amountPaid = isPaid ? amount : isPartial ? Math.round(amount * 0.5) : 0;
    const balance = amount - amountPaid;
    const status = balance === 0 ? "PAID" : amountPaid > 0 ? "PARTIAL" : "OVERDUE";

    FEE_VOUCHERS.push({
      id: `fv-${student.id}-${month}`,
      voucherId: `FV-${student.studentId}-${String(month).padStart(2, "0")}`,
      studentProfileId: student.id,
      academicYearId: YEAR_1.id,
      feeType: "TUITION",
      billingMonth,
      billingYear,
      baseAmount: amount,
      discountAmount: 0,
      arrears: 0,
      lateFine: status === "OVERDUE" && month < MONTHS ? 50 : 0,
      totalDue: amount + (status === "OVERDUE" && month < MONTHS ? 50 : 0),
      amountPaid,
      balance: balance + (status === "OVERDUE" && month < MONTHS ? 50 : 0),
      dueDate: `${billingYear}-${String(billingMonth).padStart(2, "0")}-10`,
      status,
    });

    if (amountPaid > 0) {
      FEE_PAYMENTS.push({
        transactionId: `TXN-${String(receiptCounter).padStart(6, "0")}`,
        receiptNumber: `RCPT-${String(receiptCounter).padStart(6, "0")}`,
        feeVoucherId: `FV-${student.studentId}-${String(month).padStart(2, "0")}`,
        studentProfileId: student.id,
        amountPaid,
        paymentMethod: faker.helpers.arrayElement(["CASH", "BKASH", "BANK", "CHEQUE"]),
        paidAt: `${billingYear}-${String(billingMonth).padStart(2, "0")}-${String(faker.number.int({ min: 1, max: 9 })).padStart(2, "0")}`,
        collectedBy: "usr-clerk",
      });
      receiptCounter += 1;
    }
  }
}

// ---------------------------------------------------------------------------
// exams, results, attendance, timetable
// ---------------------------------------------------------------------------

const EXAMS = [];
for (const year of YEARS) {
  EXAM_TYPES.forEach((examType, index) => {
    const startMonth = index === 0 ? "07" : "12";
    EXAMS.push({
      id: `exam-${year.yearId}-${index + 1}`,
      examId: `${year.yearId}-EX${index + 1}`,
      academicYearId: year.id,
      classId: "",
      name: `${examType.name} ${year.label}`,
      type: examType.type,
      startDate: `${year.startDate.slice(0, 4)}-${startMonth}-01`,
      endDate: `${year.startDate.slice(0, 4)}-${startMonth}-20`,
      isPublished: index === 0 || year.id === YEAR_1.id,
      totalMarks: 100,
      passPercentage: 33,
    });
  });
}

const EXAM_RESULTS = [];
function gradeFor(percentage, maxMarks) {
  const scaled = (percentage / maxMarks) * 100;
  if (scaled >= 80) return { grade: "A+", gradePoint: 5 };
  if (scaled >= 70) return { grade: "A", gradePoint: 4.5 };
  if (scaled >= 60) return { grade: "A-", gradePoint: 4 };
  if (scaled >= 50) return { grade: "B", gradePoint: 3.5 };
  if (scaled >= 40) return { grade: "C", gradePoint: 3 };
  if (scaled >= 33) return { grade: "D", gradePoint: 2 };
  return { grade: "F", gradePoint: 0 };
}

function writeResults(students, yearId, examIdFor) {
  for (const student of students) {
    for (const examId of examIdFor) {
      for (const subject of EXAM_SUBJECTS) {
        const maxMarks = subject.maxMarks;
        const obtained = markFor(student.ability, maxMarks);
        const percentage = Math.round((obtained / maxMarks) * 10000) / 100;
        const { grade, gradePoint } = gradeFor(percentage, maxMarks);
        EXAM_RESULTS.push({
          studentProfileId: student.id,
          academicYearId: yearId,
          examId,
          subjectId: subject.id,
          maxMarks,
          obtainedMarks: obtained,
          percentage,
          grade,
          gradePoint,
          status: percentage >= subject.passMarks ? "PASS" : "FAIL",
          remarks: "",
        });
      }
    }
  }
}

writeResults(STUDENTS, YEAR_1.id, EXAMS.filter((exam) => exam.academicYearId === YEAR_1.id).map((exam) => exam.id));
writeResults(
  promotedStudents.map((entry) => entry.student),
  YEAR_2.id,
  EXAMS.filter((exam) => exam.academicYearId === YEAR_2.id).map((exam) => exam.id)
);

// Attendance for one school term of year 1: 30 teaching days, weekday only,
// never on the declared non-working days.
const ATTENDANCE = [];
const attendanceStatuses = ["PRESENT", "PRESENT", "PRESENT", "PRESENT", "LATE", "ABSENT", "HALF_DAY"];
let attendanceDate = new Date("2026-07-01");
let daysWritten = 0;
while (daysWritten < 30) {
  const weekday = attendanceDate.getDay(); // 0 Sun .. 6 Sat
  if (weekday !== 5 && weekday !== 6) {
    daysWritten += 1;
    const iso = attendanceDate.toISOString().slice(0, 10);
    for (const student of STUDENTS) {
      const status = student.ability > 40
        ? faker.helpers.arrayElement(attendanceStatuses)
        : faker.helpers.arrayElement(["PRESENT", "PRESENT", "LATE", "ABSENT", "ABSENT"]);
      ATTENDANCE.push({
        studentProfileId: student.id,
        academicYearId: YEAR_1.id,
        date: iso,
        status,
        lateMinutes: status === "LATE" ? faker.number.int({ min: 5, max: 25 }) : 0,
        markedById: "usr-teacher",
      });
    }
  }
  attendanceDate.setDate(attendanceDate.getDate() + 1);
}

const TIMETABLE = [];
for (const cls of CLASSES) {
  for (const day of ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "SATURDAY"]) {
    for (let period = 1; period <= 4; period += 1) {
      const teacher = faker.helpers.arrayElement(TEACHERS);
      TIMETABLE.push({
        classId: cls.id,
        sectionId: SECTIONS.find((entry) => entry.classId === cls.id && entry.name === "A").id,
        dayOfWeek: day,
        periodNumber: period,
        startTime: `${String(7 + period).padStart(2, "0")}:00`,
        endTime: `${String(7 + period).padStart(2, "0")}:45`,
        subjectId: EXAM_SUBJECTS[(period + cls.classNumber) % EXAM_SUBJECTS.length].id,
        staffProfileId: teacher.id,
        roomNumber: `${cls.classNumber}01`,
        isBreak: false,
        needsReview: false,
      });
    }
  }
}

const PROMOTION_RULES = [];
for (const year of YEARS) {
  for (const cls of CLASSES) {
    PROMOTION_RULES.push({
      id: `pr-${year.yearId}-${cls.classId}`,
      academicYearId: year.id,
      classId: cls.id,
      nextClassId: NEXT_CLASS.get(cls.id) ?? "",
      minimumAttendance: 75,
      minimumOverallPercentage: 40,
      minimumPerSubject: 33,
      maxFailedSubjects: 0,
      allowConditionalPromotion: true,
      autoPromote: true,
      isActive: true,
    });
  }
}

// ---------------------------------------------------------------------------
// workbook
// ---------------------------------------------------------------------------

const passwordHash = bcrypt.hashSync("Password123!", 10);

function sheetFor(workbook, name, columns, rows, opts = {}) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
    ...(opts.properties ?? {}),
  });
  sheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width ?? Math.max(14, column.header.length + 4),
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2F7" } };
  for (const row of rows) {
    sheet.addRow(row);
  }
  if (opts.zebra) {
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      }
    });
  }
  if (opts.autoFilter) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return sheet;
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Pathshala Pro test dataset generator";
  workbook.created = new Date();

  // --- overview ------------------------------------------------------------
  const overview = workbook.addWorksheet("Overview_Guide", { views: [{ state: "frozen", ySplit: 1 }] });
  overview.columns = [
    { header: "Sheet", key: "sheet", width: 24 },
    { header: "Rows", key: "rows", width: 10 },
    { header: "What it is", key: "what", width: 96 },
  ];
  overview.getRow(1).font = { bold: true };

  const guide = [
    ["Purpose", "", "Test data for Pathshala Pro. Two academic years, so promotion and rollover can be exercised, not just read about."],
    ["Login", "", "Users below log in with email + password 'Password123!'. The hash column holds a real bcrypt hash."],
    ["Tenant", "", `Every row carries tenantId '${TENANT_ID}'. Import into a tenant with that id, or replace the value.`],
    ["Year 1 (2026-2027)", "", "Fully populated: 200 students, fees for 12 months, two exams with results, 30 days of attendance."],
    ["Year 2 (2027-2028)", "", "Already promoted: classes 1-9 moved up one class, class 10 graduated. Wipe Student_Sessions rows for this year if you would rather run the promotion yourself."],
    ["Test rollover", "", "Roll 2026-2027 into 2027-2028. Rules, fee structures and the timetable will be copied; the timetable arrives marked needsReview."],
    ["Test promotion", "", "Promotion rules already form the chain Class 1->2->...->10->none. Class 10 has no next class, so it graduates."],
    ["Non-working days", "", "Friday and Saturday (weekday numbers 5 and 6) are declared for both years. Attendance rows avoid them."],
    ["Academic_Years", "", "The two years, with isCurrent on 2026-2027."],
    ["Classes_Sections", "", "The class ladder Class 1..10 with two sections each."],
    ["Subjects", "", "Six subjects with pass marks the results sheet honours."],
    ["Users", "", "Login accounts and roles."],
    ["Staff_Faculty", "", `${STAFF_COUNT} members of staff.`],
    ["Students", "", `${STUDENT_COUNT} students. Class 10 students carry status GRADUATED with an exitDate.`],
    ["Student_Sessions", "", "The per-year enrollment rows. This is what promotion writes and what every year-scoped read resolves from."],
    ["Promotion_Rules", "", "One rule per class per year, forming the promotion chain."],
    ["Fee_Structures", "", "Per class per year, three fee heads."],
    ["Fee_Vouchers", "", "Twelve months of tuition vouchers per student, with statuses PAID / PARTIAL / OVERDUE."],
    ["Fee_Payments", "", "One receipt per paid or partly paid voucher."],
    ["Exams", "", "Two exams per year."],
    ["Exam_Results", "", "Marks per student per subject per exam."],
    ["Attendance", "", "30 teaching days of year-1 attendance."],
    ["Timetable", "", "Year-1 weekly grid, four periods a day."],
  ];
  for (const row of guide) overview.addRow({ sheet: row[0], rows: row[1], what: row[2] });
  overview.getColumn("what").alignment = { wrapText: true, vertical: "top" };

  // --- reference data ------------------------------------------------------
  sheetFor(
    workbook,
    "Academic_Years",
    [
      { header: "id", key: "id" }, { header: "yearId", key: "yearId" },
      { header: "label", key: "label" }, { header: "startDate", key: "startDate" },
      { header: "endDate", key: "endDate" }, { header: "isClosed", key: "isClosed" },
      { header: "isCurrent", key: "isCurrent" },
      { header: "nonWorkingWeekdays", key: "nonWorkingWeekdays" },
      { header: "feeBalancePolicy", key: "feeBalancePolicy" },
    ],
    YEARS
  );

  sheetFor(
    workbook,
    "Classes_Sections",
    [
      { header: "classId", key: "classId" }, { header: "className", key: "className" },
      { header: "classNumber", key: "classNumber" }, { header: "sectionId", key: "sectionId" },
      { header: "sectionName", key: "sectionName" }, { header: "capacity", key: "capacity" },
      { header: "roomNumber", key: "roomNumber" },
    ],
    SECTIONS.map((section) => {
      const cls = CLASSES.find((entry) => entry.id === section.classId);
      return {
        classId: cls.id,
        className: cls.name,
        classNumber: cls.classNumber,
        sectionId: section.id,
        sectionName: section.name,
        capacity: section.capacity,
        roomNumber: section.roomNumber,
      };
    })
  );

  sheetFor(
    workbook,
    "Subjects",
    [
      { header: "id", key: "id" }, { header: "subjectId", key: "subjectId" },
      { header: "name", key: "name" }, { header: "code", key: "code" },
      { header: "category", key: "category" }, { header: "maxMarks", key: "maxMarks" },
      { header: "passMarks", key: "passMarks" },
    ],
    SUBJECTS
  );

  sheetFor(
    workbook,
    "Users",
    [
      { header: "id", key: "id" }, { header: "email", key: "email" },
      { header: "name", key: "name" }, { header: "role", key: "role" },
      { header: "accessLevel", key: "accessLevel" }, { header: "passwordHash", key: "passwordHash" },
      { header: "passwordPlaintext", key: "passwordPlaintext" }, { header: "isActive", key: "isActive" },
    ],
    USERS.map((user) => ({
      ...user,
      passwordHash,
      passwordPlaintext: "Password123!",
      isActive: true,
    }))
  );

  sheetFor(
    workbook,
    "Staff_Faculty",
    [
      { header: "id", key: "id" }, { header: "staffId", key: "staffId" },
      { header: "firstName", key: "firstName" }, { header: "lastName", key: "lastName" },
      { header: "department", key: "department" }, { header: "designation", key: "designation" },
      { header: "baseSalary", key: "baseSalary" }, { header: "hireDate", key: "hireDate" },
      { header: "phone", key: "phone" }, { header: "email", key: "email" },
      { header: "gender", key: "gender" }, { header: "dateOfBirth", key: "dateOfBirth" },
      { header: "qualification", key: "qualification" }, { header: "address", key: "address" },
      { header: "isActive", key: "isActive" },
    ],
    STAFF,
    { autoFilter: true, zebra: true }
  );

  sheetFor(
    workbook,
    "Students",
    [
      { header: "id", key: "id" }, { header: "studentId", key: "studentId" },
      { header: "rollNumber", key: "rollNumber" }, { header: "firstName", key: "firstName" },
      { header: "lastName", key: "lastName" }, { header: "gender", key: "gender" },
      { header: "dateOfBirth", key: "dateOfBirth" }, { header: "bloodGroup", key: "bloodGroup" },
      { header: "birthCertificateNo", key: "birthCertificateNo" },
      { header: "guardianName", key: "guardianName" }, { header: "guardianContact", key: "guardianContact" },
      { header: "guardianEmail", key: "guardianEmail" }, { header: "fatherName", key: "fatherName" },
      { header: "motherName", key: "motherName" }, { header: "emergencyContact", key: "emergencyContact" },
      { header: "address", key: "address" }, { header: "classId", key: "classId" },
      { header: "sectionId", key: "sectionId" }, { header: "status", key: "status" },
      { header: "admissionDate", key: "admissionDate" }, { header: "exitDate", key: "exitDate" },
    ],
    STUDENTS.map(({ ability, ...student }) => student),
    { autoFilter: true, zebra: true }
  );

  sheetFor(
    workbook,
    "Student_Sessions",
    [
      { header: "id", key: "id" }, { header: "studentProfileId", key: "studentProfileId" },
      { header: "academicYearId", key: "academicYearId" }, { header: "classId", key: "classId" },
      { header: "sectionId", key: "sectionId" }, { header: "rollNumber", key: "rollNumber" },
      { header: "classNumber", key: "classNumber" }, { header: "promotionStatus", key: "promotionStatus" },
    ],
    SESSIONS,
    { autoFilter: true, zebra: true }
  );

  sheetFor(
    workbook,
    "Promotion_Rules",
    [
      { header: "id", key: "id" }, { header: "academicYearId", key: "academicYearId" },
      { header: "classId", key: "classId" }, { header: "nextClassId", key: "nextClassId" },
      { header: "minimumAttendance", key: "minimumAttendance" },
      { header: "minimumOverallPercentage", key: "minimumOverallPercentage" },
      { header: "minimumPerSubject", key: "minimumPerSubject" },
      { header: "maxFailedSubjects", key: "maxFailedSubjects" },
      { header: "allowConditionalPromotion", key: "allowConditionalPromotion" },
      { header: "autoPromote", key: "autoPromote" }, { header: "isActive", key: "isActive" },
    ],
    PROMOTION_RULES
  );

  sheetFor(
    workbook,
    "Fee_Structures",
    [
      { header: "id", key: "id" }, { header: "academicYearId", key: "academicYearId" },
      { header: "classId", key: "classId" }, { header: "feeHead", key: "feeHead" },
      { header: "amount", key: "amount" }, { header: "isActive", key: "isActive" },
    ],
    FEE_STRUCTURES
  );

  sheetFor(
    workbook,
    "Fee_Vouchers",
    [
      { header: "id", key: "id" }, { header: "voucherId", key: "voucherId" },
      { header: "studentProfileId", key: "studentProfileId" },
      { header: "academicYearId", key: "academicYearId" }, { header: "feeType", key: "feeType" },
      { header: "billingMonth", key: "billingMonth" }, { header: "billingYear", key: "billingYear" },
      { header: "baseAmount", key: "baseAmount" }, { header: "discountAmount", key: "discountAmount" },
      { header: "arrears", key: "arrears" }, { header: "lateFine", key: "lateFine" },
      { header: "totalDue", key: "totalDue" }, { header: "amountPaid", key: "amountPaid" },
      { header: "balance", key: "balance" }, { header: "dueDate", key: "dueDate" },
      { header: "status", key: "status" },
    ],
    FEE_VOUCHERS,
    { autoFilter: true, zebra: true }
  );

  sheetFor(
    workbook,
    "Fee_Payments",
    [
      { header: "transactionId", key: "transactionId" }, { header: "receiptNumber", key: "receiptNumber" },
      { header: "feeVoucherId", key: "feeVoucherId" }, { header: "studentProfileId", key: "studentProfileId" },
      { header: "amountPaid", key: "amountPaid" }, { header: "paymentMethod", key: "paymentMethod" },
      { header: "paidAt", key: "paidAt" }, { header: "collectedBy", key: "collectedBy" },
    ],
    FEE_PAYMENTS,
    { autoFilter: true }
  );

  sheetFor(
    workbook,
    "Exams",
    [
      { header: "id", key: "id" }, { header: "examId", key: "examId" },
      { header: "academicYearId", key: "academicYearId" }, { header: "name", key: "name" },
      { header: "type", key: "type" }, { header: "startDate", key: "startDate" },
      { header: "endDate", key: "endDate" }, { header: "isPublished", key: "isPublished" },
      { header: "totalMarks", key: "totalMarks" }, { header: "passPercentage", key: "passPercentage" },
    ],
    EXAMS
  );

  sheetFor(
    workbook,
    "Exam_Results",
    [
      { header: "studentProfileId", key: "studentProfileId" },
      { header: "academicYearId", key: "academicYearId" }, { header: "examId", key: "examId" },
      { header: "subjectId", key: "subjectId" }, { header: "maxMarks", key: "maxMarks" },
      { header: "obtainedMarks", key: "obtainedMarks" }, { header: "percentage", key: "percentage" },
      { header: "grade", key: "grade" }, { header: "gradePoint", key: "gradePoint" },
      { header: "status", key: "status" },
    ],
    EXAM_RESULTS,
    { autoFilter: true, zebra: true }
  );

  sheetFor(
    workbook,
    "Attendance",
    [
      { header: "studentProfileId", key: "studentProfileId" },
      { header: "academicYearId", key: "academicYearId" }, { header: "date", key: "date" },
      { header: "status", key: "status" }, { header: "lateMinutes", key: "lateMinutes" },
      { header: "markedById", key: "markedById" },
    ],
    ATTENDANCE,
    { autoFilter: true }
  );

  sheetFor(
    workbook,
    "Timetable",
    [
      { header: "classId", key: "classId" }, { header: "sectionId", key: "sectionId" },
      { header: "dayOfWeek", key: "dayOfWeek" }, { header: "periodNumber", key: "periodNumber" },
      { header: "startTime", key: "startTime" }, { header: "endTime", key: "endTime" },
      { header: "subjectId", key: "subjectId" }, { header: "staffProfileId", key: "staffProfileId" },
      { header: "roomNumber", key: "roomNumber" }, { header: "isBreak", key: "isBreak" },
      { header: "needsReview", key: "needsReview" },
    ],
    TIMETABLE
  );

  // Fill the Overview row counts from the data arrays rather than by reading
  // sheets back: the workbook's row model is lazily built and the counts are
  // already known here.
  const countsBySheet = {
    Classes_Sections: SECTIONS.length,
    Subjects: SUBJECTS.length,
    Users: USERS.length,
    Staff_Faculty: STAFF.length,
    Students: STUDENTS.length,
    Student_Sessions: SESSIONS.length,
    Promotion_Rules: PROMOTION_RULES.length,
    Fee_Structures: FEE_STRUCTURES.length,
    Fee_Vouchers: FEE_VOUCHERS.length,
    Fee_Payments: FEE_PAYMENTS.length,
    Exams: EXAMS.length,
    Exam_Results: EXAM_RESULTS.length,
    Attendance: ATTENDANCE.length,
    Timetable: TIMETABLE.length,
  };
  overview.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = row.getCell(1).value;
    const count = countsBySheet[name];
    if (count !== undefined) row.getCell(2).value = count;
  });

  const fs = await import("node:fs");
  const path = await import("node:path");
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  await workbook.xlsx.writeFile(OUTPUT_FILE);

  const bytes = fs.statSync(OUTPUT_FILE).size;
  console.log(`Written: ${OUTPUT_FILE} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`  students          ${STUDENTS.length}`);
  console.log(`  staff             ${STAFF.length}`);
  console.log(`  sessions          ${SESSIONS.length} (year 1: ${STUDENTS.length}, year 2: ${promotedStudents.length})`);
  console.log(`  vouchers          ${FEE_VOUCHERS.length}`);
  console.log(`  payments          ${FEE_PAYMENTS.length}`);
  console.log(`  exam results      ${EXAM_RESULTS.length}`);
  console.log(`  attendance rows   ${ATTENDANCE.length}`);
  console.log(`  timetable slots   ${TIMETABLE.length}`);
  console.log(`  promotion rules   ${PROMOTION_RULES.length}`);
  console.log(`  login             admin@pathshala.test / Password123!`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
