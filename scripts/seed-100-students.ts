import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const firstNamesEn = [
  "Aarav", "Rahim", "Tahmid", "Sami", "Anik", "Tanvir", "Farhan", "Nafis", "Riyad", "Sakib",
  "Ayesha", "Fatima", "Sumaiya", "Nusrat", "Sadia", "Jannat", "Tasnim", "Mim", "Tanjila", "Rabiya",
  "Hasan", "Hussein", "Imran", "Karim", "Mahmud", "Nasir", "Omar", "Parvez", "Quadir", "Rashid",
  "Shahid", "Tariq", "Usman", "Wasim", "Yasin", "Zubair", "Bilal", "Faisal", "Habib", "Jamil",
  "Afsana", "Bushra", "Farzana", "Ishrat", "Khadija", "Lubna", "Mahira", "Nahid", "Pari", "Rumana",
];

const lastNamesEn = [
  "Hossain", "Rahman", "Ahmed", "Islam", "Khan", "Chowdhury", "Akter", "Khatun", "Begum", "Sultana",
  "Ali", "Uddin", "Miah", "Hasan", "Sheikh", "Bhuiyan", "Sikder", "Mondal", "Das", "Roy",
];

const firstNamesBn = [
  "আরাভ", "রহিম", "তাহমিদ", "সামি", "অনিক", "তানভীর", "ফারহান", "নাফিস", "রিয়াদ", "সাকিব",
  "আয়েশা", "ফাতিমা", "সুমাইয়া", "নুসরাত", "সাদিয়া", "জান্নাত", "তাসনিম", "মিম", "তাঞ্জিলা", "রাবিয়া",
  "হাসান", "হোসাইন", "ইমরান", "করিম", "মাহমুদ", "নাসির", "ওমর", "পারভেজ", "কাদির", "রশিদ",
  "শহীদ", "তারিক", "উসমান", "ওয়াসিম", "ইয়াসিন", "জুবায়ের", "বিলাল", "ফয়সাল", "হাবিব", "জামিল",
  "আফসানা", "বুশরা", "ফারজানা", "ইশরাত", "খাদিজা", "লুবনা", "মাহিরা", "নাহিদ", "পরী", "রুমানা",
];

const lastNamesBn = [
  "হোসেন", "রহমান", "আহমেদ", "ইসলাম", "খান", "চৌধুরী", "আক্তার", "খাতুন", "বেগম", "সুলতানা",
  "আলী", "উদ্দিন", "মিয়া", "হাসান", "শেখ", "ভূঁইয়া", "সিকদার", "মণ্ডল", "দাস", "রায়",
];

const guardianPrefixes = ["Mohammad", "Abdul", "Abdur", "Kazi", "Syed", "Md."];
const bloodGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const genders = ["MALE", "FEMALE"];
const addresses = [
  "Mudafforgong, Laksam, Cumilla",
  "Baitul Aman, Cumilla",
  "Station Road, Laksam",
  "College Para, Mudafforgong",
  "North Bazar, Laksam, Cumilla",
  "South Para, Mudafforgong",
  "Hospital Road, Laksam",
  "School Road, Mudafforgong, Cumilla",
];

async function main() {
  const tenantId = "mhs";
  console.log(`Starting generation of 100 students for tenant: ${tenantId}...`);

  // Verify tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { tenantId },
  });

  if (!tenant) {
    throw new Error(`Tenant '${tenantId}' does not exist!`);
  }

  // Get max existing sequence
  const existingStudents = await prisma.studentProfile.findMany({
    where: { tenantId },
    select: { studentId: true, rollNumber: true },
  });

  const existingRolls = new Set(existingStudents.map((s) => s.rollNumber));
  const existingIds = new Set(existingStudents.map((s) => s.studentId));

  let createdCount = 0;
  let seq = 2;
  let rollSeq = 1001;

  const currentYear = new Date().getFullYear();

  for (let i = 0; i < 100; i++) {
    while (existingIds.has(`STU-${currentYear}-${seq.toString().padStart(5, "0")}`)) {
      seq++;
    }
    const studentId = `STU-${currentYear}-${seq.toString().padStart(5, "0")}`;
    seq++;

    while (existingRolls.has(rollSeq.toString())) {
      rollSeq++;
    }
    const rollNumber = rollSeq.toString();
    rollSeq++;

    const fnIdx = i % firstNamesEn.length;
    const lnIdx = i % lastNamesEn.length;
    const isFemale = fnIdx >= 10 && fnIdx < 20 || fnIdx >= 40;
    const gender = isFemale ? "FEMALE" : "MALE";
    const firstName = firstNamesEn[fnIdx];
    const lastName = lastNamesEn[lnIdx];
    const firstNameBn = firstNamesBn[fnIdx];
    const lastNameBn = lastNamesBn[lnIdx];

    const guardianName = `${guardianPrefixes[i % guardianPrefixes.length]} ${lastNamesEn[(lnIdx + 3) % lastNamesEn.length]}`;
    const guardianContact = `017${(10000000 + i * 7919).toString().slice(0, 8)}`;
    const guardianEmail = `guardian.${studentId.toLowerCase()}@gmail.com`;
    const fatherName = `${guardianPrefixes[(i + 1) % guardianPrefixes.length]} ${lastName}`;
    const motherName = `${firstNamesEn[(fnIdx + 5) % firstNamesEn.length]} Begum`;
    const bloodGroup = bloodGroups[i % bloodGroups.length];
    const address = addresses[i % addresses.length];

    // Birth dates between 2008 and 2016
    const birthYear = 2008 + (i % 9);
    const birthMonth = (i % 12);
    const birthDay = 1 + (i % 28);
    const dateOfBirth = new Date(birthYear, birthMonth, birthDay);

    await prisma.studentProfile.create({
      data: {
        tenantId,
        studentId,
        rollNumber,
        firstName,
        lastName,
        firstNameBn,
        lastNameBn,
        guardianName,
        guardianContact,
        guardianEmail,
        fatherName,
        motherName,
        emergencyContact: guardianContact,
        bloodGroup,
        gender,
        dateOfBirth,
        address,
        classId: null, // UNADMITTED
        groupId: null,
        sectionId: null,
        status: "ACTIVE",
      },
    });

    createdCount++;
  }

  console.log(`Successfully created ${createdCount} unadmitted students for tenant '${tenantId}' (${tenant.name})!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
