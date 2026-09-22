import ExcelJS from "exceljs";
import { faker } from "@faker-js/faker";
import path from "path";

// Seed faker for reproducibility if desired
faker.seed(2025);

// Configuration
const ACADEMIC_YEAR = 2025;
const SCHOOL_NAME = "Pathshala-Pro Model High School";
const SCHOOL_CODE = "PPRO-2025";
const CURRENCY = "BDT (৳)";

const CLASSES = [
  { name: "Class 1", id: "CLS-1", classNum: 1, sections: ["A", "B"], monthlyTuition: 1500 },
  { name: "Class 2", id: "CLS-2", classNum: 2, sections: ["A", "B"], monthlyTuition: 1600 },
  { name: "Class 3", id: "CLS-3", classNum: 3, sections: ["A", "B"], monthlyTuition: 1700 },
  { name: "Class 4", id: "CLS-4", classNum: 4, sections: ["A", "B"], monthlyTuition: 1800 },
  { name: "Class 5", id: "CLS-5", classNum: 5, sections: ["A", "B"], monthlyTuition: 2000 },
  { name: "Class 6", id: "CLS-6", classNum: 6, sections: ["A", "B"], monthlyTuition: 2200 },
  { name: "Class 7", id: "CLS-7", classNum: 7, sections: ["A", "B"], monthlyTuition: 2400 },
  { name: "Class 8", id: "CLS-8", classNum: 8, sections: ["A", "B"], monthlyTuition: 2600 },
  { name: "Class 9", id: "CLS-9", classNum: 9, sections: ["Science", "Commerce", "Arts"], monthlyTuition: 3000 },
  { name: "Class 10", id: "CLS-10", classNum: 10, sections: ["Science", "Commerce", "Arts"], monthlyTuition: 3200 },
];

const SUBJECTS = [
  { code: "BAN-101", name: "Bengali", maxMarks: 100, passMarks: 33 },
  { code: "ENG-102", name: "English", maxMarks: 100, passMarks: 33 },
  { code: "MAT-103", name: "General Mathematics", maxMarks: 100, passMarks: 33 },
  { code: "SCI-104", name: "General Science", maxMarks: 100, passMarks: 33 },
  { code: "SOC-105", name: "Social Studies & History", maxMarks: 100, passMarks: 33 },
  { code: "REL-106", name: "Religion & Moral Studies", maxMarks: 50, passMarks: 20 },
  { code: "ICT-107", name: "Information & Communication Tech", maxMarks: 50, passMarks: 20 },
];

const MONTHS = [
  { num: 1, name: "January 2025", dateStr: "2025-01-10" },
  { num: 2, name: "February 2025", dateStr: "2025-02-10" },
  { num: 3, name: "March 2025", dateStr: "2025-03-10" },
  { num: 4, name: "April 2025", dateStr: "2025-04-10" },
  { num: 5, name: "May 2025", dateStr: "2025-05-10" },
  { num: 6, name: "June 2025", dateStr: "2025-06-10" },
  { num: 7, name: "July 2025", dateStr: "2025-07-10" },
  { num: 8, name: "August 2025", dateStr: "2025-08-10" },
  { num: 9, name: "September 2025", dateStr: "2025-09-10" },
  { num: 10, name: "October 2025", dateStr: "2025-10-10" },
  { num: 11, name: "November 2025", dateStr: "2025-11-10" },
  { num: 12, name: "December 2025", dateStr: "2025-12-10" },
];

function calculateGradeAndGPA(marks: number, maxMarks: number) {
  const pct = (marks / maxMarks) * 100;
  if (pct >= 80) return { grade: "A+", gpa: 5.0, status: "PASS", remarks: "Outstanding" };
  if (pct >= 70) return { grade: "A", gpa: 4.0, status: "PASS", remarks: "Very Good" };
  if (pct >= 60) return { grade: "A-", gpa: 3.5, status: "PASS", remarks: "Good" };
  if (pct >= 50) return { grade: "B", gpa: 3.0, status: "PASS", remarks: "Above Average" };
  if (pct >= 40) return { grade: "C", gpa: 2.0, status: "PASS", remarks: "Satisfactory" };
  if (pct >= 33) return { grade: "D", gpa: 1.0, status: "PASS", remarks: "Needs Improvement" };
  return { grade: "F", gpa: 0.0, status: "FAIL", remarks: "Failed - Eligible for Re-exam" };
}

// Styling helper
function styleHeaderRow(row: ExcelJS.Row, bgHex = "1E293B") {
  row.height = 28;
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: bgHex },
    };
    cell.font = {
      name: "Segoe UI",
      size: 11,
      bold: true,
      color: { argb: "FFFFFF" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "94A3B8" } },
      bottom: { style: "medium", color: { argb: "0F172A" } },
      left: { style: "thin", color: { argb: "334155" } },
      right: { style: "thin", color: { argb: "334155" } },
    };
  });
}

function styleDataRows(sheet: ExcelJS.Worksheet) {
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 20;
    const isAlt = rowNumber % 2 === 0;
    row.eachCell((cell) => {
      cell.font = { name: "Segoe UI", size: 10 };
      cell.alignment = { vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "E2E8F0" } },
        bottom: { style: "thin", color: { argb: "E2E8F0" } },
        left: { style: "thin", color: { argb: "E2E8F0" } },
        right: { style: "thin", color: { argb: "E2E8F0" } },
      };
      if (isAlt) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F8FAFC" },
        };
      }
    });
  });
}

function autoFitColumns(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellVal = cell.value ? cell.value.toString() : "";
      if (cellVal.length > maxLength) {
        maxLength = Math.min(cellVal.length + 3, 40);
      }
    });
    column.width = maxLength;
  });
}

async function generateInstitutionDataset() {
  console.log("Generating 1-Year Comprehensive Institution Dataset with Faker.js...");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Pathshala-Pro ERP";
  workbook.lastModifiedBy = "Pathshala-Pro Synthetic Dataset Generator";
  workbook.created = new Date();
  workbook.modified = new Date();

  // ==========================================
  // SHEET 1: OVERVIEW
  // ==========================================
  const overviewSheet = workbook.addWorksheet("Overview_Guide", {
    views: [{ showGridLines: true }],
  });

  overviewSheet.columns = [
    { header: "Key Attribute", key: "key", width: 28 },
    { header: "Detail / Description", key: "value", width: 60 },
  ];

  styleHeaderRow(overviewSheet.getRow(1), "0F172A");

  overviewSheet.addRows([
    { key: "Institution Name", value: SCHOOL_NAME },
    { key: "School Code", value: SCHOOL_CODE },
    { key: "Academic Year Covered", value: `January 1, ${ACADEMIC_YEAR} - December 31, ${ACADEMIC_YEAR} (1 Full Year)` },
    { key: "Currency Standard", value: CURRENCY },
    { key: "Grading Scale", value: "GPA 5.0 Scale (A+: 80-100%, A: 70-79%, A-: 60-69%, B: 50-59%, C: 40-49%, D: 33-39%, F: <33%)" },
    { key: "Total Students", value: "500 Enrolled Students across Classes 1 to 10" },
    { key: "Total Admissions Logged", value: "600 Prospective Applicant Profiles (Admitted, Waitlisted, Rejected)" },
    { key: "Total Staff Members", value: "100 Teaching & Administrative Staff" },
    { key: "Staff Payroll Records", value: "1,200 Monthly Payroll Disbursement Records (12 Full Months x 100 Staff)" },
    { key: "Fee Invoices Logged", value: "6,000 Monthly & Term Fee Vouchers with Status Tracking (12 Months x 500 Students)" },
    { key: "Payment Transactions", value: "5,000+ Payment Receipts via bKash, Nagad, Bank Transfer, Card, Cash" },
    { key: "Exam Results Logged", value: "10,500 Subject-wise Result Records across 3 Major Exams" },
    { key: "Expense Records", value: "12 Months of Institution Operational & Maintenance Expenses" },
    { key: "Data Integrity Notice", value: "Relational IDs across Students, Vouchers, Payments, and Exams are fully cross-referenced." },
  ]);

  styleDataRows(overviewSheet);

  // ==========================================
  // SHEET 2: STAFF & FACULTY
  // ==========================================
  const staffSheet = workbook.addWorksheet("Staff_Faculty", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });

  staffSheet.columns = [
    { header: "Staff ID", key: "staffId", width: 15 },
    { header: "First Name", key: "firstName", width: 16 },
    { header: "Last Name", key: "lastName", width: 16 },
    { header: "Email Address", key: "email", width: 28 },
    { header: "Contact Number", key: "phone", width: 18 },
    { header: "Department", key: "department", width: 18 },
    { header: "Designation", key: "designation", width: 22 },
    { header: "Highest Qualification", key: "qualification", width: 24 },
    { header: "Base Salary (BDT)", key: "baseSalary", width: 18 },
    { header: "Hire Date", key: "hireDate", width: 15 },
    { header: "Status", key: "status", width: 12 },
  ];
  styleHeaderRow(staffSheet.getRow(1));

  const departments = [
    { dept: "Teaching", titles: ["Senior Teacher", "Assistant Teacher", "Lecturer", "Junior Teacher"] },
    { dept: "Administration", titles: ["Principal", "Vice Principal", "Academic Coordinator", "Head Clerk"] },
    { dept: "Accounts & Finance", titles: ["Chief Accountant", "Accounts Officer", "Cashier"] },
    { dept: "IT & Systems", titles: ["IT System Administrator", "Computer Lab In-charge"] },
    { dept: "Support & Library", titles: ["Head Librarian", "Assistant Librarian", "Lab Assistant"] },
  ];

  interface StaffMember {
    staffId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    department: string;
    designation: string;
    qualification: string;
    baseSalary: number;
    hireDate: string;
    status: string;
  }

  const staffList: StaffMember[] = [];
  const staffCount = 100;

  for (let i = 1; i <= staffCount; i++) {
    const staffId = `STF-${ACADEMIC_YEAR}-${String(i).padStart(4, "0")}`;
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const deptInfo = departments[i % departments.length];
    const designation = i === 1 ? "Principal" : i === 2 ? "Vice Principal" : faker.helpers.arrayElement(deptInfo.titles);
    const department = i === 1 || i === 2 ? "Administration" : deptInfo.dept;
    const baseSalary = designation === "Principal" ? 75000 : designation === "Vice Principal" ? 60000 : faker.number.int({ min: 28000, max: 52000 });
    const hireYear = faker.number.int({ min: 2018, max: 2024 });
    const hireDate = `${hireYear}-${String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0")}-01`;

    const staffMember: StaffMember = {
      staffId,
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@pathshalapro.edu`,
      phone: `018${faker.string.numeric(8)}`,
      department,
      designation,
      qualification: faker.helpers.arrayElement(["M.Sc in Mathematics", "M.A in English Literature", "M.Sc in Physics", "B.Ed & M.Ed", "MBA in Accounting", "B.Sc in Computer Science", "M.A in Bengali"]),
      baseSalary,
      hireDate,
      status: "ACTIVE",
    };
    staffList.push(staffMember);
    staffSheet.addRow(staffMember);
  }
  styleDataRows(staffSheet);
  autoFitColumns(staffSheet);

  // ==========================================
  // SHEET 3: 1-YEAR STAFF PAYROLL LEDGER
  // ==========================================
  const payrollSheet = workbook.addWorksheet("Staff_Payroll_1Year", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });

  payrollSheet.columns = [
    { header: "Payroll ID", key: "payrollId", width: 16 },
    { header: "Staff ID", key: "staffId", width: 15 },
    { header: "Staff Name", key: "staffName", width: 22 },
    { header: "Month", key: "month", width: 16 },
    { header: "Basic Salary", key: "basicSalary", width: 15 },
    { header: "House Rent & Medical", key: "allowances", width: 20 },
    { header: "Gross Headroom", key: "grossPay", width: 16 },
    { header: "PF Deduction (10%)", key: "pfDeduction", width: 18 },
    { header: "Tax Deduction", key: "taxDeduction", width: 16 },
    { header: "LOP / Other", key: "otherDeductions", width: 16 },
    { header: "Net Salary Paid", key: "netSalary", width: 16 },
    { header: "Payment Status", key: "status", width: 15 },
    { header: "Disbursement Date", key: "disbursementDate", width: 18 },
    { header: "Txn Reference", key: "txnRef", width: 20 },
  ];
  styleHeaderRow(payrollSheet.getRow(1));

  let payrollSeq = 1;
  for (const m of MONTHS) {
    for (const staff of staffList) {
      const basicSalary = staff.baseSalary;
      const allowances = Math.round(basicSalary * 0.35); // 35% allowances
      const grossPay = basicSalary + allowances;
      const pfDeduction = Math.round(basicSalary * 0.1); // 10% PF
      const taxDeduction = basicSalary > 40000 ? Math.round(basicSalary * 0.05) : 0;
      const otherDeductions = (payrollSeq % 17 === 0) ? 1000 : 0; // occasional leave without pay
      const netSalary = grossPay - pfDeduction - taxDeduction - otherDeductions;

      payrollSheet.addRow({
        payrollId: `PAY-${ACADEMIC_YEAR}-${String(payrollSeq++).padStart(5, "0")}`,
        staffId: staff.staffId,
        staffName: `${staff.firstName} ${staff.lastName}`,
        month: m.name,
        basicSalary,
        allowances,
        grossPay,
        pfDeduction,
        taxDeduction,
        otherDeductions,
        netSalary,
        status: "PAID",
        disbursementDate: m.dateStr,
        txnRef: `SAL-EFT-${ACADEMIC_YEAR}${String(m.num).padStart(2, "0")}-${staff.staffId.slice(-3)}`,
      });
    }
  }
  styleDataRows(payrollSheet);
  autoFitColumns(payrollSheet);

  // ==========================================
  // SHEET 4: STUDENTS ENROLLED
  // ==========================================
  const studentSheet = workbook.addWorksheet("Students", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });

  studentSheet.columns = [
    { header: "Student ID", key: "studentId", width: 16 },
    { header: "Roll Number", key: "rollNumber", width: 14 },
    { header: "First Name", key: "firstName", width: 16 },
    { header: "Last Name", key: "lastName", width: 16 },
    { header: "Gender", key: "gender", width: 10 },
    { header: "Class", key: "class", width: 12 },
    { header: "Section", key: "section", width: 12 },
    { header: "Date of Birth", key: "dob", width: 14 },
    { header: "Guardian Name", key: "guardianName", width: 22 },
    { header: "Guardian Relationship", key: "relationship", width: 18 },
    { header: "Guardian Contact", key: "guardianContact", width: 18 },
    { header: "Guardian Email", key: "guardianEmail", width: 26 },
    { header: "Residential Address", key: "address", width: 34 },
    { header: "Admission Date", key: "admissionDate", width: 15 },
    { header: "Status", key: "status", width: 12 },
  ];
  styleHeaderRow(studentSheet.getRow(1));

  interface StudentRecord {
    studentId: string;
    rollNumber: string;
    firstName: string;
    lastName: string;
    gender: string;
    class: string;
    section: string;
    classId: string;
    monthlyTuition: number;
    dob: string;
    guardianName: string;
    relationship: string;
    guardianContact: string;
    guardianEmail: string;
    address: string;
    admissionDate: string;
    status: string;
  }

  const studentList: StudentRecord[] = [];
  let studentCounter = 1;
  const TOTAL_TARGET_STUDENTS = 500;

  for (const cls of CLASSES) {
    for (const sec of cls.sections) {
      if (studentList.length >= TOTAL_TARGET_STUDENTS) break;
      // 22 sections total: 16 sections get 23 students (368), 6 sections get 22 students (132) = 500 total
      const countForSec = studentList.length + 23 <= TOTAL_TARGET_STUDENTS ? 23 : (TOTAL_TARGET_STUDENTS - studentList.length);
      for (let r = 1; r <= countForSec; r++) {
        const studentId = `STU-${ACADEMIC_YEAR}-${String(studentCounter).padStart(4, "0")}`;
        const rollNumber = `${cls.id.replace("CLS-", "")}${sec[0]}-${String(r).padStart(2, "0")}`;
        const gender = r % 2 === 0 ? "FEMALE" : "MALE";
        const firstName = gender === "MALE" ? faker.person.firstName("male") : faker.person.firstName("female");
        const lastName = faker.person.lastName();
        const guardianName = `${faker.person.firstName("male")} ${lastName}`;
        const birthYear = ACADEMIC_YEAR - (5 + (cls.classNum ?? 6));
        const dob = `${birthYear}-${String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0")}-${String(faker.number.int({ min: 1, max: 28 })).padStart(2, "0")}`;

        const stu: StudentRecord = {
          studentId,
          rollNumber,
          firstName,
          lastName,
          gender,
          class: cls.name,
          section: sec,
          classId: cls.id,
          monthlyTuition: cls.monthlyTuition,
          dob,
          guardianName,
          relationship: "Father",
          guardianContact: `017${faker.string.numeric(8)}`,
          guardianEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${faker.string.numeric(3)}@gmail.com`,
          address: `${faker.location.streetAddress()}, Dhaka, Bangladesh`,
          admissionDate: `${ACADEMIC_YEAR}-01-05`,
          status: "ACTIVE",
        };

        studentList.push(stu);
        studentSheet.addRow(stu);
        studentCounter++;
      }
    }
  }
  styleDataRows(studentSheet);
  autoFitColumns(studentSheet);

  // ==========================================
  // SHEET 5: ADMISSION APPLICATIONS LOG
  // ==========================================
  const admissionSheet = workbook.addWorksheet("Admissions", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });

  admissionSheet.columns = [
    { header: "Application No", key: "appNo", width: 18 },
    { header: "Applicant Name", key: "applicantName", width: 22 },
    { header: "Applied Class", key: "appliedClass", width: 14 },
    { header: "Gender", key: "gender", width: 10 },
    { header: "Date of Birth", key: "dob", width: 14 },
    { header: "Father's Name", key: "fatherName", width: 22 },
    { header: "Mother's Name", key: "motherName", width: 22 },
    { header: "Contact Number", key: "contact", width: 18 },
    { header: "Email Address", key: "email", width: 26 },
    { header: "Previous Institution", key: "previousSchool", width: 28 },
    { header: "Submission Date", key: "submissionDate", width: 16 },
    { header: "Written Test Score (100)", key: "testScore", width: 22 },
    { header: "Interview Remarks", key: "interviewNotes", width: 26 },
    { header: "Admission Status", key: "status", width: 18 },
    { header: "Assigned Student ID", key: "assignedStudentId", width: 20 },
  ];
  styleHeaderRow(admissionSheet.getRow(1));

  // Generate 600 admission applicants (first 500 are admitted and match enrolled students)
  for (let a = 1; a <= 600; a++) {
    const appNo = `ADM-${ACADEMIC_YEAR}-${String(a).padStart(4, "0")}`;
    const isEnrolled = a <= studentList.length;
    const enrolledMatch = isEnrolled ? studentList[a - 1] : null;

    const applicantName = enrolledMatch ? `${enrolledMatch.firstName} ${enrolledMatch.lastName}` : faker.person.fullName();
    const appliedClass = enrolledMatch ? enrolledMatch.class : faker.helpers.arrayElement(CLASSES).name;
    const gender = enrolledMatch ? enrolledMatch.gender : faker.helpers.arrayElement(["MALE", "FEMALE"]);
    const dob = enrolledMatch ? enrolledMatch.dob : "2012-05-14";
    const fatherName = enrolledMatch ? enrolledMatch.guardianName : `${faker.person.firstName("male")} ${faker.person.lastName()}`;
    const motherName = `${faker.person.firstName("female")} ${faker.person.lastName()}`;
    const contact = enrolledMatch ? enrolledMatch.guardianContact : `017${faker.string.numeric(8)}`;
    const email = enrolledMatch ? enrolledMatch.guardianEmail : faker.internet.email();
    const testScore = isEnrolled ? faker.number.int({ min: 65, max: 98 }) : a % 3 === 0 ? faker.number.int({ min: 30, max: 48 }) : faker.number.int({ min: 50, max: 64 });
    const status = isEnrolled ? "ADMITTED" : testScore < 50 ? "REJECTED" : "WAITLISTED";

    admissionSheet.addRow({
      appNo,
      applicantName,
      appliedClass,
      gender,
      dob,
      fatherName,
      motherName,
      contact,
      email,
      previousSchool: faker.helpers.arrayElement(["Dhaka Ideal Preparatory School", "Green Valley English School", "Cantonment Public Cadet School", "Mirpur Govt. Primary School", "St. Jude Grammar School"]),
      submissionDate: `${ACADEMIC_YEAR - 1}-12-${String(faker.number.int({ min: 1, max: 28 })).padStart(2, "0")}`,
      testScore,
      interviewNotes: isEnrolled ? "Strong academic fundamentals; Recommended for admission" : testScore < 50 ? "Below qualifying cut-off score" : "Placed on first waiting pool",
      status,
      assignedStudentId: isEnrolled ? enrolledMatch!.studentId : "N/A",
    });
  }
  styleDataRows(admissionSheet);
  autoFitColumns(admissionSheet);

  // ==========================================
  // SHEET 6: 1-YEAR FEE INVOICES & VOUCHERS
  // ==========================================
  const feeInvoiceSheet = workbook.addWorksheet("Fee_Invoices", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });

  feeInvoiceSheet.columns = [
    { header: "Voucher Number", key: "voucherNumber", width: 18 },
    { header: "Month / Billing Period", key: "period", width: 18 },
    { header: "Student ID", key: "studentId", width: 15 },
    { header: "Student Name", key: "studentName", width: 22 },
    { header: "Class", key: "class", width: 12 },
    { header: "Section", key: "section", width: 10 },
    { header: "Tuition Fee", key: "tuitionFee", width: 14 },
    { header: "ICT & Lab Fee", key: "labFee", width: 14 },
    { header: "Exam/Activity Fee", key: "examFee", width: 16 },
    { header: "Total Fee Billed", key: "totalAmount", width: 16 },
    { header: "Concession / Waiver", key: "discount", width: 18 },
    { header: "Net Payable", key: "netPayable", width: 15 },
    { header: "Paid Amount", key: "paidAmount", width: 15 },
    { header: "Due Balance", key: "balance", width: 14 },
    { header: "Due Date", key: "dueDate", width: 15 },
    { header: "Invoice Status", key: "status", width: 14 },
  ];
  styleHeaderRow(feeInvoiceSheet.getRow(1));

  interface InvoiceRecord {
    voucherNumber: string;
    studentId: string;
    studentName: string;
    period: string;
    class: string;
    section: string;
    tuitionFee: number;
    labFee: number;
    examFee: number;
    totalAmount: number;
    discount: number;
    netPayable: number;
    paidAmount: number;
    balance: number;
    dueDate: string;
    status: string;
  }

  const invoiceRecords: InvoiceRecord[] = [];
  let voucherCounter = 1;

  for (const m of MONTHS) {
    const isExamMonth = m.num === 4 || m.num === 8 || m.num === 12; // Exam fee billed in April, Aug, Dec

    for (const stu of studentList) {
      const voucherNumber = `VCH-${ACADEMIC_YEAR}-${String(voucherCounter++).padStart(5, "0")}`;
      const tuitionFee = stu.monthlyTuition;
      const labFee = 350;
      const examFee = isExamMonth ? 600 : 0;
      const totalAmount = tuitionFee + labFee + examFee;
      
      // Some students have 20% sibling or merit concession
      const hasConcession = parseInt(stu.studentId.replace(/\D/g, ""), 10) % 7 === 0;
      const discount = hasConcession ? Math.round(tuitionFee * 0.25) : 0;
      const netPayable = totalAmount - discount;

      // Payment probability: 88% fully paid, 8% partial, 4% unpaid overdue
      const randStatus = (voucherCounter + m.num) % 25;
      let paidAmount = netPayable;
      let status = "PAID";

      if (randStatus === 0) {
        paidAmount = 0;
        status = "OVERDUE";
      } else if (randStatus === 1) {
        paidAmount = Math.round(netPayable / 2);
        status = "PARTIAL";
      }

      const balance = netPayable - paidAmount;
      const dueDate = `${ACADEMIC_YEAR}-${String(m.num).padStart(2, "0")}-15`;

      const inv: InvoiceRecord = {
        voucherNumber,
        studentId: stu.studentId,
        studentName: `${stu.firstName} ${stu.lastName}`,
        period: m.name,
        class: stu.class,
        section: stu.section,
        tuitionFee,
        labFee,
        examFee,
        totalAmount,
        discount,
        netPayable,
        paidAmount,
        balance,
        dueDate,
        status,
      };
      invoiceRecords.push(inv);
      feeInvoiceSheet.addRow(inv);
    }
  }
  styleDataRows(feeInvoiceSheet);
  autoFitColumns(feeInvoiceSheet);

  // ==========================================
  // SHEET 7: 1-YEAR FEE PAYMENT RECEIPTS
  // ==========================================
  const feePaymentSheet = workbook.addWorksheet("Fee_Payments", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });

  feePaymentSheet.columns = [
    { header: "Payment Txn ID", key: "txnId", width: 18 },
    { header: "Voucher Number", key: "voucherNumber", width: 18 },
    { header: "Student ID", key: "studentId", width: 15 },
    { header: "Student Name", key: "studentName", width: 22 },
    { header: "Payment Date", key: "paymentDate", width: 15 },
    { header: "Amount Paid (BDT)", key: "amount", width: 18 },
    { header: "Payment Gateway / Method", key: "method", width: 22 },
    { header: "Receipt / Bank Ref", key: "receiptRef", width: 22 },
    { header: "Cashier / Staff Received", key: "receivedBy", width: 22 },
    { header: "Ledger Account", key: "account", width: 24 },
  ];
  styleHeaderRow(feePaymentSheet.getRow(1));

  let payTxnSeq = 1;
  const paymentMethods = ["bKash Merchant", "Nagad Direct", "Bank Transfer (Dutch-Bangla)", "Cash Counter", "Visa/MasterCard POS"];

  for (const inv of invoiceRecords) {
    if (inv.paidAmount > 0) {
      const monthNum = parseInt(inv.dueDate.split("-")[1], 10);
      const payDay = faker.number.int({ min: 5, max: 15 });
      const paymentDate = `${ACADEMIC_YEAR}-${String(monthNum).padStart(2, "0")}-${String(payDay).padStart(2, "0")}`;
      const method = faker.helpers.arrayElement(paymentMethods);
      const isOnline = method.includes("bKash") || method.includes("Nagad") || method.includes("Bank");

      feePaymentSheet.addRow({
        txnId: `TXN-${ACADEMIC_YEAR}-${String(payTxnSeq++).padStart(5, "0")}`,
        voucherNumber: inv.voucherNumber,
        studentId: inv.studentId,
        studentName: inv.studentName,
        paymentDate,
        amount: inv.paidAmount,
        method,
        receiptRef: isOnline ? `TRX${faker.string.alphanumeric(10).toUpperCase()}` : `MR-${ACADEMIC_YEAR}-${String(payTxnSeq).padStart(4, "0")}`,
        receivedBy: isOnline ? "Automated API Gateway" : "Nasrin Akter (Chief Cashier)",
        account: "1010 - School Operational Cash/Bank",
      });
    }
  }
  styleDataRows(feePaymentSheet);
  autoFitColumns(feePaymentSheet);

  // ==========================================
  // SHEET 8: 1-YEAR EXAM RESULTS (3 Major Exams)
  // ==========================================
  const examResultSheet = workbook.addWorksheet("Exam_Results", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });

  examResultSheet.columns = [
    { header: "Result ID", key: "resultId", width: 16 },
    { header: "Exam Name", key: "examName", width: 24 },
    { header: "Student ID", key: "studentId", width: 15 },
    { header: "Student Name", key: "studentName", width: 22 },
    { header: "Class", key: "class", width: 12 },
    { header: "Section", key: "section", width: 10 },
    { header: "Roll No", key: "rollNumber", width: 12 },
    { header: "Subject Name", key: "subject", width: 24 },
    { header: "Max Marks", key: "maxMarks", width: 12 },
    { header: "Marks Obtained", key: "marks", width: 15 },
    { header: "Percentage (%)", key: "pct", width: 15 },
    { header: "Letter Grade", key: "grade", width: 14 },
    { header: "Grade Point", key: "gpa", width: 14 },
    { header: "Result Status", key: "status", width: 14 },
    { header: "Evaluator Remarks", key: "remarks", width: 24 },
  ];
  styleHeaderRow(examResultSheet.getRow(1));

  const EXAMS = [
    { name: "First Term Examination 2025", date: "2025-04-20" },
    { name: "Mid-Term Examination 2025", date: "2025-08-18" },
    { name: "Annual Final Examination 2025", date: "2025-12-10" },
  ];

  let resultSeq = 1;
  for (const ex of EXAMS) {
    for (const stu of studentList) {
      // Determine student performance tier based on roll/ID
      const studentSkill = (parseInt(stu.studentId.replace(/\D/g, ""), 10) % 10); // 0 = failing, 8,9 = top
      
      for (const sub of SUBJECTS) {
        let obtainedMarks: number;
        if (studentSkill === 0) {
          // Weak student prone to fail 1-2 subjects
          obtainedMarks = sub.maxMarks === 100 ? faker.number.int({ min: 25, max: 45 }) : faker.number.int({ min: 14, max: 24 });
        } else if (studentSkill >= 7) {
          // Star student
          obtainedMarks = sub.maxMarks === 100 ? faker.number.int({ min: 78, max: 98 }) : faker.number.int({ min: 40, max: 50 });
        } else {
          // Average student
          obtainedMarks = sub.maxMarks === 100 ? faker.number.int({ min: 48, max: 76 }) : faker.number.int({ min: 24, max: 39 });
        }

        const gradeDetails = calculateGradeAndGPA(obtainedMarks, sub.maxMarks);

        examResultSheet.addRow({
          resultId: `RES-${ACADEMIC_YEAR}-${String(resultSeq++).padStart(5, "0")}`,
          examName: ex.name,
          studentId: stu.studentId,
          studentName: `${stu.firstName} ${stu.lastName}`,
          class: stu.class,
          section: stu.section,
          rollNumber: stu.rollNumber,
          subject: sub.name,
          maxMarks: sub.maxMarks,
          marks: obtainedMarks,
          pct: `${((obtainedMarks / sub.maxMarks) * 100).toFixed(1)}%`,
          grade: gradeDetails.grade,
          gpa: gradeDetails.gpa.toFixed(2),
          status: gradeDetails.status,
          remarks: gradeDetails.remarks,
        });
      }
    }
  }
  styleDataRows(examResultSheet);
  autoFitColumns(examResultSheet);

  // ==========================================
  // SHEET 9: 1-YEAR INSTITUTION OPERATING EXPENSES
  // ==========================================
  const expenseSheet = workbook.addWorksheet("Expenses_Log", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });

  expenseSheet.columns = [
    { header: "Expense ID", key: "expenseId", width: 16 },
    { header: "Date", key: "date", width: 14 },
    { header: "Category", key: "category", width: 22 },
    { header: "Particulars / Description", key: "description", width: 34 },
    { header: "Amount (BDT)", key: "amount", width: 16 },
    { header: "Payment Method", key: "method", width: 20 },
    { header: "Voucher / Bill Ref", key: "billRef", width: 22 },
    { header: "Approved By", key: "approvedBy", width: 22 },
  ];
  styleHeaderRow(expenseSheet.getRow(1));

  const EXPENSE_TEMPLATES = [
    { category: "Utilities (Electricity & Water)", desc: "Monthly DESCO Electricity Bill & WASA Water", min: 35000, max: 48000 },
    { category: "IT & Software Licenses", desc: "High-speed Fiber Internet & Cloud Infrastructure", min: 12000, max: 18000 },
    { category: "Science Lab Supplies", desc: "Chemical Reagents, Glassware & Microscope Slides", min: 15000, max: 32000 },
    { category: "Library & Periodicals", desc: "Academic Textbooks, Reference Books & Daily Newspapers", min: 8000, max: 16000 },
    { category: "Campus Repairs & Maintenance", desc: "Classroom Whiteboards, Desks, Plumbing & Electrical Maintenance", min: 22000, max: 45000 },
    { category: "Office Stationery & Printing", desc: "Exam Paper Sheets, Envelopes, Cartridges & Toner", min: 18000, max: 28000 },
    { category: "Sports & Annual Co-Curricular", desc: "Football, Cricket gear, Badminton nets & Tournament Trophies", min: 14000, max: 35000 },
    { category: "Cleaning & Sanitation", desc: "Floor Disinfectants, Handwash, Washroom Consumables", min: 7000, max: 11000 },
  ];

  let expCounter = 1;
  for (const m of MONTHS) {
    for (const tpl of EXPENSE_TEMPLATES) {
      const expAmount = faker.number.int({ min: tpl.min, max: tpl.max });
      const expDay = faker.number.int({ min: 2, max: 26 });
      const expDate = `${ACADEMIC_YEAR}-${String(m.num).padStart(2, "0")}-${String(expDay).padStart(2, "0")}`;

      expenseSheet.addRow({
        expenseId: `EXP-${ACADEMIC_YEAR}-${String(expCounter++).padStart(4, "0")}`,
        date: expDate,
        category: tpl.category,
        description: tpl.desc,
        amount: expAmount,
        method: "Bank Cheque / Corporate Account",
        billRef: `BILL-${ACADEMIC_YEAR}${String(m.num).padStart(2, "0")}-${faker.string.alphanumeric(6).toUpperCase()}`,
        approvedBy: "Principal - Pathshala Pro",
      });
    }
  }
  styleDataRows(expenseSheet);
  autoFitColumns(expenseSheet);

  // ==========================================
  // WRITE TO DISK
  // ==========================================
  const defaultPath = path.resolve(process.cwd(), "Pathshala_Pro_1_Year_Institution_Test_Dataset.xlsx");
  try {
    console.log(`Writing workbook to: ${defaultPath}...`);
    await workbook.xlsx.writeFile(defaultPath);
    console.log("Workbook generated successfully with 9 sheets!");
    console.log(`File saved at: ${defaultPath}`);
  } catch (err: any) {
    if (err?.code === "EBUSY") {
      const fallbackPath = path.resolve(process.cwd(), `Pathshala_Pro_1_Year_Institution_Test_Dataset_${Date.now()}.xlsx`);
      console.warn(`Primary file was locked (likely open in Excel). Writing to: ${fallbackPath}`);
      await workbook.xlsx.writeFile(fallbackPath);
      console.log(`File saved successfully at: ${fallbackPath}`);
    } else {
      throw err;
    }
  }
}

generateInstitutionDataset().catch((err) => {
  console.error("Dataset generation failed:", err);
  process.exit(1);
});
