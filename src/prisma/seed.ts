import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Grading scale configuration
const GRADING_SCALE = [
  { minMarks: 80, grade: "A+", point: 5.0, remark: "Excellent" },
  { minMarks: 70, grade: "A", point: 4.5, remark: "Very Good" },
  { minMarks: 60, grade: "A-", point: 4.0, remark: "Good" },
  { minMarks: 50, grade: "B", point: 3.5, remark: "Average" },
  { minMarks: 40, grade: "C", point: 3.0, remark: "Satisfactory" },
  { minMarks: 33, grade: "D", point: 2.0, remark: "Pass" },
  { minMarks: 0, grade: "F", point: 0.0, remark: "Fail" },
];

function calculateGrade(marks: number, maxMarks: number) {
  const percentage = (marks / maxMarks) * 100;
  const gradeInfo = GRADING_SCALE.find((g) => percentage >= g.minMarks) || GRADING_SCALE[GRADING_SCALE.length - 1];
  return {
    grade: gradeInfo.grade,
    gradePoint: gradeInfo.point,
    percentage,
    status: percentage >= 33 ? "PASS" : "FAIL",
  };
}

async function main() {
  console.log("🌱 Seeding database with Exam & Promotion System...\n");

  // ==================== TENANT ====================
  const tenant = await prisma.tenant.create({
    data: {
      tenantId: "demo-school-001",
      name: "Demo High School",
      address: "123 Education Street, Dhaka, Bangladesh",
      subscriptionStatus: "TRIAL",
      fiscalYearStart: 1,
      phone: "+880-1234-567890",
      email: "info@demohighschool.edu",

      // School Settings
      schoolCode: "DH-2024",
      establishedYear: 2020,
      motto: "Education for All",
      website: "www.demohighschool.edu",

      // Financial Settings
      currency: "BDT",
      currencySymbol: "৳",
      taxRate: 0,

      // Date & Time Settings
      dateFormat: "DD/MM/YYYY",
      timeFormat: "24h",
      timezone: "Asia/Dhaka",
      firstDayOfWeek: "sunday",

      // Academic Settings
      academicYearStart: "january",
      gradingSystem: "GPA",
    },
  });
  console.log(`✅ Created tenant: ${tenant.name}`);

  // ==================== USERS ====================
  const adminUser = await prisma.user.create({
    data: {
      tenantId: tenant.tenantId,
      email: "admin@demohighschool.edu",
      name: "Admin User",
      role: "ADMIN",
      hash: bcrypt.hashSync("password123", 10),
      isActive: true,
    },
  });
  console.log(`✅ Created admin: ${adminUser.email}`);

  const teacherUser = await prisma.user.create({
    data: {
      tenantId: tenant.tenantId,
      email: "teacher@demohighschool.edu",
      name: "Mohammad Rahman",
      role: "TEACHER",
      hash: bcrypt.hashSync("password123", 10),
      isActive: true,
    },
  });
  console.log(`✅ Created teacher: ${teacherUser.email}`);

  const clerkUser = await prisma.user.create({
    data: {
      tenantId: tenant.tenantId,
      email: "clerk@demohighschool.edu",
      name: "Fatima Khatun",
      role: "CLERK",
      hash: bcrypt.hashSync("password123", 10),
      isActive: true,
    },
  });
  console.log(`✅ Created clerk: ${clerkUser.email}`);

  // ==================== ACADEMIC YEARS ====================
  const currentYear = new Date().getFullYear();
  const academicYear2025 = await prisma.academicYear.create({
    data: {
      tenantId: tenant.tenantId,
      yearId: `ay-${currentYear}`,
      label: `${currentYear}-${currentYear + 1} Academic Year`,
      startDate: new Date(currentYear, 0, 1),
      endDate: new Date(currentYear + 1, 0, 1),
      isClosed: false,
    },
  });
  console.log(`✅ Created academic year: ${academicYear2025.label}`);

  // ==================== CLASSES ====================
  const classes = await Promise.all([
    prisma.class.create({
      data: { tenantId: tenant.tenantId, classId: "CLS-6", name: "Class 6", classNumber: 6 },
    }),
    prisma.class.create({
      data: { tenantId: tenant.tenantId, classId: "CLS-7", name: "Class 7", classNumber: 7 },
    }),
    prisma.class.create({
      data: { tenantId: tenant.tenantId, classId: "CLS-8", name: "Class 8", classNumber: 8 },
    }),
    prisma.class.create({
      data: { tenantId: tenant.tenantId, classId: "CLS-9", name: "Class 9", classNumber: 9 },
    }),
    prisma.class.create({
      data: { tenantId: tenant.tenantId, classId: "CLS-10", name: "Class 10", classNumber: 10 },
    }),
  ]);
  console.log(`✅ Created ${classes.length} classes`);

  // ==================== SECTIONS ====================
  const sections = await Promise.all([
    prisma.section.create({
      data: { tenantId: tenant.tenantId, sectionId: "SEC-A", classId: classes[0].id, name: "Section A", shortName: "A" },
    }),
    prisma.section.create({
      data: { tenantId: tenant.tenantId, sectionId: "SEC-B", classId: classes[0].id, name: "Section B", shortName: "B" },
    }),
    prisma.section.create({
      data: { tenantId: tenant.tenantId, sectionId: "SEC-A-7", classId: classes[1].id, name: "Section A", shortName: "A" },
    }),
  ]);
  console.log(`✅ Created ${sections.length} sections`);

  // ==================== SUBJECTS ====================
  const subjects = await Promise.all([
    prisma.subject.create({
      data: {
        tenantId: tenant.tenantId,
        subjectId: "SUB-BAN",
        name: "Bengali",
        code: "BAN",
        category: "COMPULSORY",
        maxMarks: 100,
        passMarks: 33,
      },
    }),
    prisma.subject.create({
      data: {
        tenantId: tenant.tenantId,
        subjectId: "SUB-ENG",
        name: "English",
        code: "ENG",
        category: "COMPULSORY",
        maxMarks: 100,
        passMarks: 33,
      },
    }),
    prisma.subject.create({
      data: {
        tenantId: tenant.tenantId,
        subjectId: "SUB-MAT",
        name: "Mathematics",
        code: "MAT",
        category: "COMPULSORY",
        maxMarks: 100,
        passMarks: 33,
      },
    }),
    prisma.subject.create({
      data: {
        tenantId: tenant.tenantId,
        subjectId: "SUB-SCI",
        name: "General Science",
        code: "SCI",
        category: "COMPULSORY",
        maxMarks: 100,
        passMarks: 33,
      },
    }),
    prisma.subject.create({
      data: {
        tenantId: tenant.tenantId,
        subjectId: "SUB-SOC",
        name: "Social Science",
        code: "SOC",
        category: "COMPULSORY",
        maxMarks: 100,
        passMarks: 33,
      },
    }),
    prisma.subject.create({
      data: {
        tenantId: tenant.tenantId,
        subjectId: "SUB-REL",
        name: "Religion (Islam/Hinduism)",
        code: "REL",
        category: "COMPULSORY",
        maxMarks: 50,
        passMarks: 20,
      },
    }),
    prisma.subject.create({
      data: {
        tenantId: tenant.tenantId,
        subjectId: "SUB-ICT",
        name: "ICT",
        code: "ICT",
        category: "ELECTIVE",
        maxMarks: 50,
        passMarks: 20,
      },
    }),
    prisma.subject.create({
      data: {
        tenantId: tenant.tenantId,
        subjectId: "SUB-AGR",
        name: "Agriculture",
        code: "AGR",
        category: "OPTIONAL",
        maxMarks: 50,
        passMarks: 20,
      },
    }),
    prisma.subject.create({
      data: {
        tenantId: tenant.tenantId,
        subjectId: "SUB-HOM",
        name: "Home Economics",
        code: "HOM",
        category: "OPTIONAL",
        maxMarks: 50,
        passMarks: 20,
      },
    }),
    prisma.subject.create({
      data: {
        tenantId: tenant.tenantId,
        subjectId: "SUB-PHY",
        name: "Physical Education",
        code: "PHY",
        category: "OPTIONAL",
        maxMarks: 50,
        passMarks: 20,
      },
    }),
  ]);
  console.log(`✅ Created ${subjects.length} subjects`);

  // ==================== EXAMS ====================
  const midTermExam = await prisma.exam.create({
    data: {
      tenantId: tenant.tenantId,
      examId: "EXAM-MID-2025",
      academicYearId: academicYear2025.id,
      name: "Mid-Term Examination",
      type: "MID_TERM",
      startDate: new Date(currentYear, 6, 1), // July 1
      endDate: new Date(currentYear, 6, 15), // July 15
      isPublished: true,
      totalMarks: 100,
      passPercentage: 33,
    },
  });
  console.log(`✅ Created exam: ${midTermExam.name}`);

  const finalExam = await prisma.exam.create({
    data: {
      tenantId: tenant.tenantId,
      examId: "EXAM-FINAL-2025",
      academicYearId: academicYear2025.id,
      name: "Annual Final Examination",
      type: "FINAL",
      startDate: new Date(currentYear, 10, 1), // November 1
      endDate: new Date(currentYear, 10, 30), // November 30
      isPublished: false,
      totalMarks: 100,
      passPercentage: 33,
    },
  });
  console.log(`✅ Created exam: ${finalExam.name}`);

  // ==================== EXAM SUBJECTS (for Mid-Term) ====================
  const examSubjects = await Promise.all([
    prisma.examSubject.create({
      data: { tenantId: tenant.tenantId, examId: midTermExam.id, subjectId: subjects[0].id, maxMarks: 100, passMarks: 33 },
    }),
    prisma.examSubject.create({
      data: { tenantId: tenant.tenantId, examId: midTermExam.id, subjectId: subjects[1].id, maxMarks: 100, passMarks: 33 },
    }),
    prisma.examSubject.create({
      data: { tenantId: tenant.tenantId, examId: midTermExam.id, subjectId: subjects[2].id, maxMarks: 100, passMarks: 33 },
    }),
    prisma.examSubject.create({
      data: { tenantId: tenant.tenantId, examId: midTermExam.id, subjectId: subjects[3].id, maxMarks: 100, passMarks: 33 },
    }),
    prisma.examSubject.create({
      data: { tenantId: tenant.tenantId, examId: midTermExam.id, subjectId: subjects[4].id, maxMarks: 100, passMarks: 33 },
    }),
    prisma.examSubject.create({
      data: { tenantId: tenant.tenantId, examId: midTermExam.id, subjectId: subjects[5].id, maxMarks: 50, passMarks: 20 },
    }),
  ]);
  console.log(`✅ Created ${examSubjects.length} exam-subject mappings`);

  // ==================== STUDENTS ====================
  const student1 = await prisma.studentProfile.create({
    data: {
      tenantId: tenant.tenantId,
      studentId: "STU-2025-001",
      rollNumber: "2025001",
      firstName: "Rahim",
      lastName: "Ahmed",
      guardianName: "Karim Ahmed",
      guardianContact: "+880-1711-223344",
      guardianEmail: "karim.ahmed@email.com",
      dateOfBirth: new Date("2010-05-15"),
      gender: "MALE",
      classId: classes[0].id, // Class 6
      sectionId: sections[0].id, // Section A
      status: "ACTIVE",
      admissionDate: new Date(),
    },
  });
  console.log(`✅ Created student: ${student1.firstName} ${student1.lastName} (Class 6)`);

  const student2 = await prisma.studentProfile.create({
    data: {
      tenantId: tenant.tenantId,
      studentId: "STU-2025-002",
      rollNumber: "2025002",
      firstName: "Fatima",
      lastName: "Begum",
      guardianName: "Rahim Begum",
      guardianContact: "+880-1811-556677",
      guardianEmail: "rahim.begum@email.com",
      dateOfBirth: new Date("2010-08-22"),
      gender: "FEMALE",
      classId: classes[0].id, // Class 6
      sectionId: sections[0].id,
      status: "ACTIVE",
      admissionDate: new Date(),
    },
  });
  console.log(`✅ Created student: ${student2.firstName} ${student2.lastName} (Class 6)`);

  const student3 = await prisma.studentProfile.create({
    data: {
      tenantId: tenant.tenantId,
      studentId: "STU-2025-003",
      rollNumber: "2025003",
      firstName: "Arjun",
      lastName: "Das",
      guardianName: "Sunil Das",
      guardianContact: "+880-1911-889900",
      dateOfBirth: new Date("2011-02-10"),
      gender: "MALE",
      classId: classes[0].id, // Class 6
      sectionId: sections[1].id, // Section B
      status: "ACTIVE",
      admissionDate: new Date(),
    },
  });
  console.log(`✅ Created student: ${student3.firstName} ${student3.lastName} (Class 6)`);

  const student4 = await prisma.studentProfile.create({
    data: {
      tenantId: tenant.tenantId,
      studentId: "STU-2025-004",
      rollNumber: "2025004",
      firstName: "Amina",
      lastName: "Khatun",
      guardianName: "Yusuf Khatun",
      guardianContact: "+880-1511-223344",
      dateOfBirth: new Date("2010-03-20"),
      gender: "FEMALE",
      classId: classes[1].id, // Class 7
      sectionId: sections[2].id,
      status: "ACTIVE",
      admissionDate: new Date(),
    },
  });
  console.log(`✅ Created student: ${student4.firstName} ${student4.lastName} (Class 7)`);

  // ==================== EXAM RESULTS ====================
  console.log("\n📝 Creating exam results...\n");

  // Student 1 - Rahim Ahmed - EXCELLENT STUDENT (All Pass)
  const rahimResults = await Promise.all([
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student1.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[0].id, // Bengali
        maxMarks: 100,
        obtainedMarks: 85,
        ...calculateGrade(85, 100),
        remarks: "Excellent performance",
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student1.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[1].id, // English
        maxMarks: 100,
        obtainedMarks: 78,
        ...calculateGrade(78, 100),
        remarks: "Very good",
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student1.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[2].id, // Mathematics
        maxMarks: 100,
        obtainedMarks: 92,
        ...calculateGrade(92, 100),
        remarks: "Outstanding",
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student1.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[3].id, // Science
        maxMarks: 100,
        obtainedMarks: 88,
        ...calculateGrade(88, 100),
        remarks: "Excellent",
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student1.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[4].id, // Social Science
        maxMarks: 100,
        obtainedMarks: 82,
        ...calculateGrade(82, 100),
        remarks: "Very good",
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student1.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[5].id, // Religion
        maxMarks: 50,
        obtainedMarks: 45,
        ...calculateGrade(45, 50),
        remarks: "Excellent",
      },
    }),
  ]);
  console.log(`✅ Created ${rahimResults.length} results for Rahim Ahmed (ALL PASS - Average: ${(85+78+92+88+82+90)/6}% - PROMOTED)`);

  // Student 2 - Fatima Begum - AVERAGE STUDENT (All Pass)
  const fatimaResults = await Promise.all([
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student2.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[0].id,
        maxMarks: 100,
        obtainedMarks: 65,
        ...calculateGrade(65, 100),
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student2.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[1].id,
        maxMarks: 100,
        obtainedMarks: 70,
        ...calculateGrade(70, 100),
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student2.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[2].id,
        maxMarks: 100,
        obtainedMarks: 55,
        ...calculateGrade(55, 100),
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student2.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[3].id,
        maxMarks: 100,
        obtainedMarks: 60,
        ...calculateGrade(60, 100),
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student2.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[4].id,
        maxMarks: 100,
        obtainedMarks: 58,
        ...calculateGrade(58, 100),
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student2.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[5].id,
        maxMarks: 50,
        obtainedMarks: 35,
        ...calculateGrade(35, 50),
      },
    }),
  ]);
  console.log(`✅ Created ${fatimaResults.length} results for Fatima Begum (ALL PASS - Average: ~64% - PROMOTED)`);

  // Student 3 - Arjun Das - FAILING STUDENT (Multiple Fails)
  const arjunResults = await Promise.all([
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student3.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[0].id,
        maxMarks: 100,
        obtainedMarks: 45,
        ...calculateGrade(45, 100),
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student3.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[1].id,
        maxMarks: 100,
        obtainedMarks: 28, // FAIL
        ...calculateGrade(28, 100),
        reExamAllowed: true,
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student3.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[2].id,
        maxMarks: 100,
        obtainedMarks: 25, // FAIL
        ...calculateGrade(25, 100),
        reExamAllowed: true,
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student3.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[3].id,
        maxMarks: 100,
        obtainedMarks: 50,
        ...calculateGrade(50, 100),
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student3.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[4].id,
        maxMarks: 100,
        obtainedMarks: 40,
        ...calculateGrade(40, 100),
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student3.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[5].id,
        maxMarks: 50,
        obtainedMarks: 30,
        ...calculateGrade(30, 50),
      },
    }),
  ]);
  console.log(`✅ Created ${arjunResults.length} results for Arjun Das (FAILED in 2 subjects - English, Math - NEEDS RE-EXAM)`);

  // Student 4 - Amina Khatun (Class 7) - Good Student
  const aminaResults = await Promise.all([
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student4.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[0].id,
        maxMarks: 100,
        obtainedMarks: 75,
        ...calculateGrade(75, 100),
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student4.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[1].id,
        maxMarks: 100,
        obtainedMarks: 80,
        ...calculateGrade(80, 100),
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student4.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[2].id,
        maxMarks: 100,
        obtainedMarks: 85,
        ...calculateGrade(85, 100),
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student4.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[3].id,
        maxMarks: 100,
        obtainedMarks: 78,
        ...calculateGrade(78, 100),
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student4.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[4].id,
        maxMarks: 100,
        obtainedMarks: 72,
        ...calculateGrade(72, 100),
      },
    }),
    prisma.examResult.create({
      data: {
        tenantId: tenant.tenantId,
        studentProfileId: student4.id,
        academicYearId: academicYear2025.id,
        examId: midTermExam.id,
        subjectId: subjects[5].id,
        maxMarks: 50,
        obtainedMarks: 40,
        ...calculateGrade(40, 50),
      },
    }),
  ]);
  console.log(`✅ Created ${aminaResults.length} results for Amina Khatun (ALL PASS - Average: ~77% - PROMOTED)`);

  // ==================== PROMOTION RULES ====================
  console.log("\n📋 Creating promotion rules...\n");

  const promotionRules = await Promise.all([
    prisma.promotionRule.create({
      data: {
        tenantId: tenant.tenantId,
        academicYearId: academicYear2025.id,
        classId: classes[0].id, // Class 6
        minimumAttendance: 75,
        minimumOverallPercentage: 40,
        minimumPerSubject: 33,
        maxFailedSubjects: 0,
        allowConditionalPromotion: true,
        autoPromote: true,
        nextClassId: classes[1].id, // Promote to Class 7
      },
    }),
    prisma.promotionRule.create({
      data: {
        tenantId: tenant.tenantId,
        academicYearId: academicYear2025.id,
        classId: classes[1].id, // Class 7
        minimumAttendance: 75,
        minimumOverallPercentage: 40,
        minimumPerSubject: 33,
        maxFailedSubjects: 0,
        allowConditionalPromotion: true,
        autoPromote: true,
        nextClassId: classes[2].id, // Promote to Class 8
      },
    }),
    prisma.promotionRule.create({
      data: {
        tenantId: tenant.tenantId,
        academicYearId: academicYear2025.id,
        classId: classes[2].id, // Class 8
        minimumAttendance: 75,
        minimumOverallPercentage: 40,
        minimumPerSubject: 33,
        maxFailedSubjects: 0,
        allowConditionalPromotion: true,
        autoPromote: true,
        nextClassId: classes[3].id, // Promote to Class 9
      },
    }),
    prisma.promotionRule.create({
      data: {
        tenantId: tenant.tenantId,
        academicYearId: academicYear2025.id,
        classId: classes[3].id, // Class 9
        minimumAttendance: 75,
        minimumOverallPercentage: 40,
        minimumPerSubject: 33,
        maxFailedSubjects: 0,
        allowConditionalPromotion: false,
        autoPromote: true,
        nextClassId: classes[4].id, // Promote to Class 10
      },
    }),
    prisma.promotionRule.create({
      data: {
        tenantId: tenant.tenantId,
        academicYearId: academicYear2025.id,
        classId: classes[4].id, // Class 10 (SSC - Final class)
        minimumAttendance: 75,
        minimumOverallPercentage: 40,
        minimumPerSubject: 33,
        maxFailedSubjects: 0,
        allowConditionalPromotion: false,
        autoPromote: false, // No auto-promote from SSC
        nextClassId: null, // No next class (final)
      },
    }),
  ]);
  console.log(`✅ Created ${promotionRules.length} promotion rules`);

  // ==================== CLASS PROMOTIONS ====================
  console.log("\n🎓 Creating class promotions...\n");

  // Promote Rahim Ahmed (Excellent student)
  const rahimPromotion = await prisma.classPromotion.create({
    data: {
      tenantId: tenant.tenantId,
      studentProfileId: student1.id,
      fromAcademicYearId: academicYear2025.id,
      toAcademicYearId: academicYear2025.id, // Same year for demo
      fromClassId: classes[0].id,
      toClassId: classes[1].id,
      status: "PROMOTED",
      reason: "Passed all subjects with excellent grades (Average: 84.17%)",
      decidedBy: adminUser.id,
      decidedAt: new Date(),
    },
  });
  console.log(`✅ Promoted: Rahim Ahmed (Class 6 → Class 7)`);

  // Promote Fatima Begum (Average student)
  const fatimaPromotion = await prisma.classPromotion.create({
    data: {
      tenantId: tenant.tenantId,
      studentProfileId: student2.id,
      fromAcademicYearId: academicYear2025.id,
      toAcademicYearId: academicYear2025.id,
      fromClassId: classes[0].id,
      toClassId: classes[1].id,
      status: "PROMOTED",
      reason: "Passed all subjects (Average: 63.83%)",
      decidedBy: adminUser.id,
      decidedAt: new Date(),
    },
  });
  console.log(`✅ Promoted: Fatima Begum (Class 6 → Class 7)`);

  // Arjun Das - RETAINED (Failed in 2 subjects)
  const arjunPromotion = await prisma.classPromotion.create({
    data: {
      tenantId: tenant.tenantId,
      studentProfileId: student3.id,
      fromAcademicYearId: academicYear2025.id,
      toAcademicYearId: academicYear2025.id,
      fromClassId: classes[0].id,
      toClassId: classes[0].id, // Same class (retained)
      status: "RETAINED",
      reason: "Failed in 2 subjects (English: 28%, Math: 25%). Re-exam allowed.",
      reExamRequired: true,
      decidedBy: adminUser.id,
      decidedAt: new Date(),
    },
  });
  console.log(`⚠️  RETAINED: Arjun Das (Class 6 → Class 6) - Failed in 2 subjects`);

  // Promote Amina Khatun (Good student from Class 7)
  const aminaPromotion = await prisma.classPromotion.create({
    data: {
      tenantId: tenant.tenantId,
      studentProfileId: student4.id,
      fromAcademicYearId: academicYear2025.id,
      toAcademicYearId: academicYear2025.id,
      fromClassId: classes[1].id,
      toClassId: classes[2].id,
      status: "PROMOTED",
      reason: "Passed all subjects with good grades (Average: 76.67%)",
      decidedBy: adminUser.id,
      decidedAt: new Date(),
    },
  });
  console.log(`✅ Promoted: Amina Khatun (Class 7 → Class 8)`);

  // ==================== STAFF ====================
  const staff = await prisma.staffProfile.create({
    data: {
      tenantId: tenant.tenantId,
      staffId: "STF-2025-001",
      firstName: "Nasrin",
      lastName: "Akter",
      department: "Administration",
      designation: "School Administrator",
      baseSalary: 45000,
      hireDate: new Date("2024-01-15"),
      phone: "+880-1611-223344",
      email: "nasrin.akter@demohighschool.edu",
      isActive: true,
    },
  });
  console.log(`✅ Created staff: ${staff.firstName} ${staff.lastName}`);

  // Create teacher staff
  const teacherStaff = await prisma.staffProfile.create({
    data: {
      tenantId: tenant.tenantId,
      staffId: "STF-2025-002",
      firstName: "Abdul",
      lastName: "Karim",
      department: "Teaching",
      designation: "Senior Teacher",
      baseSalary: 35000,
      hireDate: new Date("2023-01-10"),
      phone: "+880-1711-998877",
      email: "abdul.karim@demohighschool.edu",
      isActive: true,
    },
  });
  console.log(`✅ Created teacher staff: ${teacherStaff.firstName} ${teacherStaff.lastName}`);

  // ==================== SUMMARY ====================
  console.log("\n✨═══════════════════════════════════════════════════════════✨");
  console.log("✨          DATABASE SEEDING COMPLETED SUCCESSFULLY!          ✨");
  console.log("✨═══════════════════════════════════════════════════════════✨\n");

  console.log("📊 SEEDING SUMMARY:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`   🏫  Tenants:        1 (Demo High School)`);
  console.log(`   👤  Users:          3 (Admin, Teacher, Clerk)`);
  console.log(`   📅  Academic Year:  1 (${academicYear2025.label})`);
  console.log(`   🏛️  Classes:        5 (Class 6-10)`);
  console.log(`   📚  Sections:       3`);
  console.log(`   📖  Subjects:       10`);
  console.log(`   📝  Exams:          2 (Mid-Term, Final)`);
  console.log(`   🎓  Students:       4`);
  console.log(`   📊  Exam Results:   24 (6 per student)`);
  console.log(`   📋  Promotion Rules: 5`);
  console.log(`   🎓  Promotions:     4 (3 Promoted, 1 Retained)`);
  console.log(`   👨‍🏫  Staff:           2`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("📈 EXAM RESULTS SUMMARY:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   ✅ Rahim Ahmed:   ALL PASS  → PROMOTED to Class 7");
  console.log("   ✅ Fatima Begum:  ALL PASS  → PROMOTED to Class 7");
  console.log("   ⚠️  Arjun Das:     FAILED    → RETAINED in Class 6");
  console.log("      └─ Failed: English (28%), Mathematics (25%)");
  console.log("      └─ Re-exam allowed for both subjects");
  console.log("   ✅ Amina Khatun:  ALL PASS  → PROMOTED to Class 8");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🔐 LOGIN CREDENTIALS:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   Admin:   admin@demohighschool.edu  /  password123");
  console.log("   Teacher: teacher@demohighschool.edu /  password123");
  console.log("   Clerk:   clerk@demohighschool.edu  /  password123");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🎯 FEATURES READY TO USE:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   ✓ Create and manage subjects");
  console.log("   ✓ Create and manage exams (Mid-Term, Final, etc.)");
  console.log("   ✓ Enter exam results for students");
  console.log("   ✓ Auto-calculate grades and percentages");
  console.log("   ✓ Configure promotion rules per class");
  console.log("   ✓ Calculate promotion eligibility");
  console.log("   ✓ Process student promotions/retentions");
  console.log("   ✓ Track promotion history");
  console.log("   ✓ Handle re-exam cases");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
