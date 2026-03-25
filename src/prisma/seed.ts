import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create a demo tenant (school)
  const tenant = await prisma.tenant.create({
    data: {
      tenantId: "demo-school-001",
      name: "Demo High School",
      address: "123 Education Street, Dhaka, Bangladesh",
      subscriptionStatus: "TRIAL",
      fiscalYearStart: 1,
      phone: "+880-1234-567890",
      email: "info@demohighschool.edu",
    },
  });

  console.log(`✅ Created tenant: ${tenant.name}`);

  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      tenantId: tenant.tenantId,
      email: "admin@demohighschool.edu",
      name: "Admin User",
      role: "ADMIN",
      hash: "4efca114c142a23cb56363fabb6994699080981b7b9385a86506b54d7f2d2d95", // Equivalent to password123 with our dev hash
      isActive: true,
    },
  });

  console.log(`✅ Created admin user: ${adminUser.email}`);

  // Create current academic year
  const currentDate = new Date();
  const academicYear = await prisma.academicYear.create({
    data: {
      tenantId: tenant.tenantId,
      yearId: `ay-${currentDate.getFullYear()}`,
      label: `${currentDate.getFullYear()}-${currentDate.getFullYear() + 1} Academic Year`,
      startDate: new Date(currentDate.getFullYear(), 0, 1), // Jan 1
      endDate: new Date(currentDate.getFullYear() + 1, 0, 1), // Dec 31
      isClosed: false,
    },
  });

  console.log(`✅ Created academic year: ${academicYear.label}`);

  // Create sample students
  const students = await Promise.all([
    prisma.studentProfile.create({
      data: {
        tenantId: tenant.tenantId,
        studentId: "STU-2026-001",
        rollNumber: "2026001",
        firstName: "Rahim",
        lastName: "Ahmed",
        guardianName: "Karim Ahmed",
        guardianContact: "+880-1711-223344",
        guardianEmail: "karim.ahmed@email.com",
        dateOfBirth: new Date("2010-05-15"),
        gender: "MALE",
        status: "ACTIVE",
        admissionDate: new Date(),
      },
    }),
    prisma.studentProfile.create({
      data: {
        tenantId: tenant.tenantId,
        studentId: "STU-2026-002",
        rollNumber: "2026002",
        firstName: "Fatima",
        lastName: "Begum",
        guardianName: "Rahim Begum",
        guardianContact: "+880-1811-556677",
        guardianEmail: "rahim.begum@email.com",
        dateOfBirth: new Date("2010-08-22"),
        gender: "FEMALE",
        status: "ACTIVE",
        admissionDate: new Date(),
      },
    }),
    prisma.studentProfile.create({
      data: {
        tenantId: tenant.tenantId,
        studentId: "STU-2026-003",
        rollNumber: "2026003",
        firstName: "Arjun",
        lastName: "Das",
        guardianName: "Sunil Das",
        guardianContact: "+880-1911-889900",
        dateOfBirth: new Date("2011-02-10"),
        gender: "MALE",
        status: "ACTIVE",
        admissionDate: new Date(),
      },
    }),
  ]);

  console.log(`✅ Created ${students.length} students`);

  // Create sample staff
  const staff = await prisma.staffProfile.create({
    data: {
      tenantId: tenant.tenantId,
      staffId: "STF-2026-001",
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

  console.log(`✅ Created staff member: ${staff.firstName} ${staff.lastName}`);

  // Create sample fee voucher
  const feeVoucher = await prisma.feeVoucher.create({
    data: {
      tenantId: tenant.tenantId,
      voucherId: "FV-2026-001",
      studentProfileId: students[0].id,
      academicYearId: academicYear.id,
      feeType: "TUITION_FEE",
      baseAmount: 5000,
      discountAmount: 500,
      arrears: 0,
      totalDue: 4500,
      amountPaid: 0,
      balance: 4500,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      status: "PENDING",
    },
  });

  console.log(`✅ Created fee voucher: ${feeVoucher.voucherId}`);

  console.log("\n✨ Database seeding completed successfully!");
  console.log("\n📊 Summary:");
  console.log(`   - 1 Tenant (School)`);
  console.log(`   - 1 Admin User`);
  console.log(`   - 1 Academic Year`);
  console.log(`   - 3 Students`);
  console.log(`   - 1 Staff Member`);
  console.log(`   - 1 Fee Voucher`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
