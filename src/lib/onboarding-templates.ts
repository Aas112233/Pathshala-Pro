import type { ClassTemplatePreset } from "@/lib/schemas";

export interface TemplateSubjectDef {
  name: string;
  nameI18n?: {
    en: string;
    ur?: string;
    hi?: string;
    bn?: string;
  };
  code: string;
  type: "THEORY" | "PRACTICAL" | "BOTH";
  totalMarks?: number;
  passMarks?: number;
  category?: "COMPULSORY" | "ELECTIVE" | "STREAM";
}

export interface TemplateClassDef {
  name: string;
  code: string;
  sequence: number;
  sections: string[];
  ageGroup?: string;
  subjects: TemplateSubjectDef[];
}

export interface CountryEducationSystemMeta {
  countryCode: "PK" | "IN" | "BD";
  countryName: { en: string; ur?: string; hi?: string; bn?: string };
  board: { en: string; ur?: string; hi?: string; bn?: string };
  defaultCurrency: string;
  defaultCurrencySymbol: string;
  defaultTimezone: string;
  gradingScaleName: string;
  passingPercentage: number;
}

export const COUNTRY_EDUCATION_SYSTEMS: Record<"PK" | "IN" | "BD", CountryEducationSystemMeta> = {
  PK: {
    countryCode: "PK",
    countryName: { en: "Pakistan", ur: "پاکستان" },
    board: {
      en: "Federal Board of Intermediate and Secondary Education (FBISE)",
      ur: "وفاقی بورڈ آف انٹرمیڈیٹ اینڈ سیکنڈری ایجوکیشن (FBISE)",
    },
    defaultCurrency: "PKR",
    defaultCurrencySymbol: "₨",
    defaultTimezone: "Asia/Karachi",
    gradingScaleName: "FBISE Matriculation & Intermediate Scale",
    passingPercentage: 33,
  },
  IN: {
    countryCode: "IN",
    countryName: { en: "India", hi: "भारत" },
    board: {
      en: "Central Board of Secondary Education (CBSE)",
      hi: "केंद्रीय माध्यमिक शिक्षा बोर्ड (CBSE)",
    },
    defaultCurrency: "INR",
    defaultCurrencySymbol: "₹",
    defaultTimezone: "Asia/Kolkata",
    gradingScaleName: "CBSE 9-Point Absolute Grading Scale",
    passingPercentage: 33,
  },
  BD: {
    countryCode: "BD",
    countryName: { en: "Bangladesh", bn: "বাংলাদেশ" },
    board: {
      en: "National Curriculum and Textbook Board (NCTB)",
      bn: "জাতীয় শিক্ষাক্রম ও পাঠ্যপুস্তক বোর্ড (এনসিটিবি)",
    },
    defaultCurrency: "BDT",
    defaultCurrencySymbol: "৳",
    defaultTimezone: "Asia/Dhaka",
    gradingScaleName: "NCTB GPA 5.0 Scale",
    passingPercentage: 33,
  },
};

export function getClassTemplateDefinitions(template: ClassTemplatePreset): TemplateClassDef[] {
  const commonSubjects: TemplateSubjectDef[] = [
    { name: "English Language", code: "ENG", type: "THEORY" },
    { name: "Mathematics", code: "MATH", type: "THEORY" },
    { name: "Science", code: "SCI", type: "BOTH" },
    { name: "Social Studies & History", code: "SST", type: "THEORY" },
    { name: "Computer Studies", code: "CS", type: "BOTH" },
    { name: "Islamic Studies / Ethics", code: "ISL", type: "THEORY" },
  ];

  const primarySubjects: TemplateSubjectDef[] = [
    { name: "English", code: "ENG", type: "THEORY" },
    { name: "Mathematics", code: "MATH", type: "THEORY" },
    { name: "General Science", code: "GSCI", type: "THEORY" },
    { name: "Social Studies", code: "SST", type: "THEORY" },
    { name: "Urdu / National Language", code: "LANG", type: "THEORY" },
  ];

  const earlyYearsSubjects: TemplateSubjectDef[] = [
    { name: "English Phonics & Literacy", code: "ENG", type: "THEORY" },
    { name: "Basic Numeracy", code: "MATH", type: "THEORY" },
    { name: "General Knowledge & Art", code: "GK", type: "PRACTICAL" },
  ];

  switch (template) {
    // -------------------------------------------------------------
    // Pakistan (FBISE) National System Dataset
    // -------------------------------------------------------------
    case "PK_FBISE_MATRIC_INTER":
      return [
        {
          name: "Class 9 (SSC-I / Matric)",
          code: "PK-SSC-9",
          sequence: 1,
          sections: ["Science Group", "Computer Group", "General Arts Group"],
          ageGroup: "14-15 years",
          subjects: [
            { name: "English", nameI18n: { en: "English", ur: "انگریزی" }, code: "ENG-9", type: "THEORY", totalMarks: 150, passMarks: 50 },
            { name: "Urdu", nameI18n: { en: "Urdu", ur: "اردو" }, code: "URD-9", type: "THEORY", totalMarks: 150, passMarks: 50 },
            { name: "Islamiat (Islamic Studies)", nameI18n: { en: "Islamiat (Islamic Studies)", ur: "اسلامیات" }, code: "ISL-9", type: "THEORY", totalMarks: 75, passMarks: 25 },
            { name: "Mathematics", nameI18n: { en: "Mathematics", ur: "ریاضی" }, code: "MTH-9", type: "THEORY", totalMarks: 150, passMarks: 50 },
            { name: "Physics", nameI18n: { en: "Physics", ur: "طبیعیات" }, code: "PHY-9", type: "BOTH", totalMarks: 150, passMarks: 50 },
            { name: "Chemistry", nameI18n: { en: "Chemistry", ur: "کیمسٹری" }, code: "CHE-9", type: "BOTH", totalMarks: 150, passMarks: 50 },
            { name: "Biology", nameI18n: { en: "Biology", ur: "بائیالوجی" }, code: "BIO-9", type: "BOTH", totalMarks: 150, passMarks: 50 },
            { name: "Computer Science", nameI18n: { en: "Computer Science", ur: "کمپیوٹر سائنس" }, code: "CSC-9", type: "BOTH", totalMarks: 150, passMarks: 50 },
          ],
        },
        {
          name: "Class 10 (SSC-II / Matric)",
          code: "PK-SSC-10",
          sequence: 2,
          sections: ["Science Group", "Computer Group", "General Arts Group"],
          ageGroup: "15-16 years",
          subjects: [
            { name: "English", nameI18n: { en: "English", ur: "انگریزی" }, code: "ENG-10", type: "THEORY", totalMarks: 150, passMarks: 50 },
            { name: "Urdu", nameI18n: { en: "Urdu", ur: "اردو" }, code: "URD-10", type: "THEORY", totalMarks: 150, passMarks: 50 },
            { name: "Pakistan Studies", nameI18n: { en: "Pakistan Studies", ur: "پاکستان اسٹڈیز" }, code: "PAK-10", type: "THEORY", totalMarks: 75, passMarks: 25 },
            { name: "Mathematics", nameI18n: { en: "Mathematics", ur: "ریاضی" }, code: "MTH-10", type: "THEORY", totalMarks: 150, passMarks: 50 },
            { name: "Physics", nameI18n: { en: "Physics", ur: "طبیعیات" }, code: "PHY-10", type: "BOTH", totalMarks: 150, passMarks: 50 },
            { name: "Chemistry", nameI18n: { en: "Chemistry", ur: "کیمسٹری" }, code: "CHE-10", type: "BOTH", totalMarks: 150, passMarks: 50 },
            { name: "Biology", nameI18n: { en: "Biology", ur: "بائیالوجی" }, code: "BIO-10", type: "BOTH", totalMarks: 150, passMarks: 50 },
            { name: "Computer Science", nameI18n: { en: "Computer Science", ur: "کمپیوٹر سائنس" }, code: "CSC-10", type: "BOTH", totalMarks: 150, passMarks: 50 },
          ],
        },
        {
          name: "Class 11 (HSSC-I / Intermediate)",
          code: "PK-HSSC-11",
          sequence: 3,
          sections: ["Pre-Medical", "Pre-Engineering", "ICS Computer Science", "I.Com (Commerce)"],
          ageGroup: "16-17 years",
          subjects: [
            { name: "English Compulsory", nameI18n: { en: "English Compulsory", ur: "انگریزی لازمی" }, code: "ENG-11", type: "THEORY", totalMarks: 200, passMarks: 66 },
            { name: "Urdu Compulsory", nameI18n: { en: "Urdu Compulsory", ur: "اردو لازمی" }, code: "URD-11", type: "THEORY", totalMarks: 200, passMarks: 66 },
            { name: "Physics", nameI18n: { en: "Physics", ur: "طبیعیات" }, code: "PHY-11", type: "BOTH", totalMarks: 200, passMarks: 66 },
            { name: "Chemistry", nameI18n: { en: "Chemistry", ur: "کیمسٹری" }, code: "CHE-11", type: "BOTH", totalMarks: 200, passMarks: 66 },
            { name: "Biology", nameI18n: { en: "Biology", ur: "بائیالوجی" }, code: "BIO-11", type: "BOTH", totalMarks: 200, passMarks: 66 },
            { name: "Mathematics", nameI18n: { en: "Mathematics", ur: "ریاضی" }, code: "MTH-11", type: "THEORY", totalMarks: 200, passMarks: 66 },
            { name: "Principles of Accounting", nameI18n: { en: "Principles of Accounting", ur: "اصولِ اکاؤنٹنگ" }, code: "ACC-11", type: "THEORY", totalMarks: 200, passMarks: 66 },
          ],
        },
        {
          name: "Class 12 (HSSC-II / Intermediate)",
          code: "PK-HSSC-12",
          sequence: 4,
          sections: ["Pre-Medical", "Pre-Engineering", "ICS Computer Science", "I.Com (Commerce)"],
          ageGroup: "17-18 years",
          subjects: [
            { name: "English Compulsory", nameI18n: { en: "English Compulsory", ur: "انگریزی لازمی" }, code: "ENG-12", type: "THEORY", totalMarks: 200, passMarks: 66 },
            { name: "Urdu Compulsory", nameI18n: { en: "Urdu Compulsory", ur: "اردو لازمی" }, code: "URD-12", type: "THEORY", totalMarks: 200, passMarks: 66 },
            { name: "Physics", nameI18n: { en: "Physics", ur: "طبیعیات" }, code: "PHY-12", type: "BOTH", totalMarks: 200, passMarks: 66 },
            { name: "Chemistry", nameI18n: { en: "Chemistry", ur: "کیمسٹری" }, code: "CHE-12", type: "BOTH", totalMarks: 200, passMarks: 66 },
            { name: "Biology", nameI18n: { en: "Biology", ur: "بائیالوجی" }, code: "BIO-12", type: "BOTH", totalMarks: 200, passMarks: 66 },
            { name: "Mathematics", nameI18n: { en: "Mathematics", ur: "ریاضی" }, code: "MTH-12", type: "THEORY", totalMarks: 200, passMarks: 66 },
            { name: "Principles of Accounting", nameI18n: { en: "Principles of Accounting", ur: "اصولِ اکاؤنٹنگ" }, code: "ACC-12", type: "THEORY", totalMarks: 200, passMarks: 66 },
          ],
        },
      ];

    // -------------------------------------------------------------
    // India (CBSE) National System Dataset
    // -------------------------------------------------------------
    case "IN_CBSE_SECONDARY_SR_SEC":
      return [
        {
          name: "Class 9 (CBSE Secondary)",
          code: "IN-CBSE-9",
          sequence: 1,
          sections: ["Section A", "Section B"],
          ageGroup: "14-15 years",
          subjects: [
            { name: "English Language and Literature", nameI18n: { en: "English Language and Literature", hi: "अंग्रेज़ी भाषा और साहित्य" }, code: "CBSE-184", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Hindi Course-A", nameI18n: { en: "Hindi Course-A", hi: "हिंदी कोर्स-ए" }, code: "CBSE-002", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Mathematics Standard", nameI18n: { en: "Mathematics Standard", hi: "गणित (मानक)" }, code: "CBSE-041", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Mathematics Basic", nameI18n: { en: "Mathematics Basic", hi: "गणित (बेसिक)" }, code: "CBSE-241", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Science", nameI18n: { en: "Science", hi: "विज्ञान" }, code: "CBSE-086", type: "BOTH", totalMarks: 100, passMarks: 33 },
            { name: "Social Science", nameI18n: { en: "Social Science", hi: "सामाजिक विज्ञान" }, code: "CBSE-087", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Computer Applications", nameI18n: { en: "Computer Applications", hi: "कंप्यूटर अनुप्रयोग" }, code: "CBSE-165", type: "BOTH", totalMarks: 100, passMarks: 33 },
          ],
        },
        {
          name: "Class 10 (CBSE Secondary)",
          code: "IN-CBSE-10",
          sequence: 2,
          sections: ["Section A", "Section B"],
          ageGroup: "15-16 years",
          subjects: [
            { name: "English Language and Literature", nameI18n: { en: "English Language and Literature", hi: "अंग्रेज़ी भाषा और साहित्य" }, code: "CBSE-184", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Hindi Course-A", nameI18n: { en: "Hindi Course-A", hi: "हिंदी कोर्स-ए" }, code: "CBSE-002", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Mathematics Standard", nameI18n: { en: "Mathematics Standard", hi: "गणित (मानक)" }, code: "CBSE-041", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Mathematics Basic", nameI18n: { en: "Mathematics Basic", hi: "गणित (बेसिक)" }, code: "CBSE-241", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Science", nameI18n: { en: "Science", hi: "विज्ञान" }, code: "CBSE-086", type: "BOTH", totalMarks: 100, passMarks: 33 },
            { name: "Social Science", nameI18n: { en: "Social Science", hi: "सामाजिक विज्ञान" }, code: "CBSE-087", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Computer Applications", nameI18n: { en: "Computer Applications", hi: "कंप्यूटर अनुप्रयोग" }, code: "CBSE-165", type: "BOTH", totalMarks: 100, passMarks: 33 },
          ],
        },
        {
          name: "Class 11 (CBSE Senior Secondary)",
          code: "IN-CBSE-11",
          sequence: 3,
          sections: ["Science Stream (PCM/PCB)", "Commerce Stream", "Humanities / Arts"],
          ageGroup: "16-17 years",
          subjects: [
            { name: "English Core", nameI18n: { en: "English Core", hi: "अंग्रेज़ी कोर" }, code: "CBSE-301", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Physics", nameI18n: { en: "Physics", hi: "भौतिकी" }, code: "CBSE-042", type: "BOTH", totalMarks: 100, passMarks: 33 },
            { name: "Chemistry", nameI18n: { en: "Chemistry", hi: "रसायन विज्ञान" }, code: "CBSE-043", type: "BOTH", totalMarks: 100, passMarks: 33 },
            { name: "Biology", nameI18n: { en: "Biology", hi: "जीव विज्ञान" }, code: "CBSE-044", type: "BOTH", totalMarks: 100, passMarks: 33 },
            { name: "Mathematics", nameI18n: { en: "Mathematics", hi: "गणित" }, code: "CBSE-041-SR", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Accountancy", nameI18n: { en: "Accountancy", hi: "लेखाकर्म" }, code: "CBSE-055", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Business Studies", nameI18n: { en: "Business Studies", hi: "व्यापार अध्ययन" }, code: "CBSE-054", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Economics", nameI18n: { en: "Economics", hi: "अर्थशास्त्र" }, code: "CBSE-030", type: "THEORY", totalMarks: 100, passMarks: 33 },
          ],
        },
        {
          name: "Class 12 (CBSE Senior Secondary)",
          code: "IN-CBSE-12",
          sequence: 4,
          sections: ["Science Stream (PCM/PCB)", "Commerce Stream", "Humanities / Arts"],
          ageGroup: "17-18 years",
          subjects: [
            { name: "English Core", nameI18n: { en: "English Core", hi: "अंग्रेज़ी कोर" }, code: "CBSE-301", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Physics", nameI18n: { en: "Physics", hi: "भौतिकी" }, code: "CBSE-042", type: "BOTH", totalMarks: 100, passMarks: 33 },
            { name: "Chemistry", nameI18n: { en: "Chemistry", hi: "रसायन विज्ञान" }, code: "CBSE-043", type: "BOTH", totalMarks: 100, passMarks: 33 },
            { name: "Biology", nameI18n: { en: "Biology", hi: "जीव विज्ञान" }, code: "CBSE-044", type: "BOTH", totalMarks: 100, passMarks: 33 },
            { name: "Mathematics", nameI18n: { en: "Mathematics", hi: "गणित" }, code: "CBSE-041-SR", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Accountancy", nameI18n: { en: "Accountancy", hi: "लेखाकर्म" }, code: "CBSE-055", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Business Studies", nameI18n: { en: "Business Studies", hi: "व्यापार अध्ययन" }, code: "CBSE-054", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Economics", nameI18n: { en: "Economics", hi: "अर्थशास्त्र" }, code: "CBSE-030", type: "THEORY", totalMarks: 100, passMarks: 33 },
          ],
        },
      ];

    // -------------------------------------------------------------
    // Bangladesh (NCTB) National System Dataset
    // -------------------------------------------------------------
    case "BD_NCTB_PRIMARY_SSC_HSC":
      return [
        // Primary 1-5
        ...[1, 2, 3, 4, 5].map((g, idx) => ({
          name: `Class ${g} (প্রাথমিক স্তর)`,
          code: `BD-PRI-${g}`,
          sequence: idx + 1,
          sections: ["Section A", "Section B"],
          ageGroup: `${5 + g}-${6 + g} years`,
          subjects: [
            { name: "Bangla", nameI18n: { en: "Bangla", bn: "বাংলা" }, code: "BD-101-P", type: "THEORY" as const, totalMarks: 100, passMarks: 33 },
            { name: "English", nameI18n: { en: "English", bn: "ইংরেজি" }, code: "BD-107-P", type: "THEORY" as const, totalMarks: 100, passMarks: 33 },
            { name: "Mathematics", nameI18n: { en: "Mathematics", bn: "গণিত" }, code: "BD-109-P", type: "THEORY" as const, totalMarks: 100, passMarks: 33 },
            { name: "Bangladesh and Global Studies", nameI18n: { en: "Bangladesh and Global Studies", bn: "বাংলাদেশ ও বিশ্বপরিচয়" }, code: "BD-150-P", type: "THEORY" as const, totalMarks: 100, passMarks: 33 },
            { name: "Primary Science", nameI18n: { en: "Primary Science", bn: "প্রাথমিক বিজ্ঞান" }, code: "BD-127-P", type: "THEORY" as const, totalMarks: 100, passMarks: 33 },
            { name: "Religion and Moral Education", nameI18n: { en: "Religion and Moral Education", bn: "ধর্ম ও নৈতিক শিক্ষা" }, code: "BD-111-P", type: "THEORY" as const, totalMarks: 100, passMarks: 33 },
          ],
        })),
        // Junior Secondary 6-8
        ...[6, 7, 8].map((g, idx) => ({
          name: `Class ${g} (নিম্ন মাধ্যমিক স্তর)`,
          code: `BD-JSC-${g}`,
          sequence: 5 + idx + 1,
          sections: ["Section A", "Section B"],
          ageGroup: `${10 + (g - 5)}-${11 + (g - 5)} years`,
          subjects: [
            { name: "Bangla", nameI18n: { en: "Bangla", bn: "বাংলা" }, code: "BD-101-J", type: "THEORY" as const, totalMarks: 100, passMarks: 33 },
            { name: "English", nameI18n: { en: "English", bn: "ইংরেজি" }, code: "BD-107-J", type: "THEORY" as const, totalMarks: 100, passMarks: 33 },
            { name: "Mathematics", nameI18n: { en: "Mathematics", bn: "গণিত" }, code: "BD-109-J", type: "THEORY" as const, totalMarks: 100, passMarks: 33 },
            { name: "Information & Communication Technology (ICT)", nameI18n: { en: "Information & Communication Technology (ICT)", bn: "তথ্য ও যোগাযোগ প্রযুক্তি (আইসিটি)" }, code: "BD-154-J", type: "BOTH" as const, totalMarks: 50, passMarks: 17 },
            { name: "Bangladesh and Global Studies", nameI18n: { en: "Bangladesh and Global Studies", bn: "বাংলাদেশ ও বিশ্বপরিচয়" }, code: "BD-150-J", type: "THEORY" as const, totalMarks: 100, passMarks: 33 },
          ],
        })),
        // Secondary / SSC 9-10
        {
          name: "Class 9 (SSC - ৯ম শ্রেণি)",
          code: "BD-SSC-9",
          sequence: 9,
          sections: ["Science Stream (বিজ্ঞান)", "Business Studies (ব্যবসায় শিক্ষা)", "Humanities (মানবিক)"],
          ageGroup: "14-15 years",
          subjects: [
            { name: "Bangla (Paper I & II)", nameI18n: { en: "Bangla (Paper I & II)", bn: "বাংলা (প্রথম ও দ্বিতীয় পত্র)" }, code: "BD-101-SSC", type: "THEORY", totalMarks: 200, passMarks: 66 },
            { name: "English (Paper I & II)", nameI18n: { en: "English (Paper I & II)", bn: "ইংরেজি (প্রথম ও দ্বিতীয় পত্র)" }, code: "BD-107-SSC", type: "THEORY", totalMarks: 200, passMarks: 66 },
            { name: "Mathematics", nameI18n: { en: "Mathematics", bn: "গণিত" }, code: "BD-109-SSC", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Physics", nameI18n: { en: "Physics", bn: "পদার্থবিজ্ঞান" }, code: "BD-136-SSC", type: "BOTH", totalMarks: 100, passMarks: 33 },
            { name: "Chemistry", nameI18n: { en: "Chemistry", bn: "রসায়ন" }, code: "BD-137-SSC", type: "BOTH", totalMarks: 100, passMarks: 33 },
            { name: "Biology", nameI18n: { en: "Biology", bn: "জীববিজ্ঞান" }, code: "BD-138-SSC", type: "BOTH", totalMarks: 100, passMarks: 33 },
            { name: "Higher Mathematics", nameI18n: { en: "Higher Mathematics", bn: "উচ্চতর গণিত" }, code: "BD-126-SSC", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Accounting", nameI18n: { en: "Accounting", bn: "হিসাববিজ্ঞান" }, code: "BD-146-SSC", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Finance and Banking", nameI18n: { en: "Finance and Banking", bn: "ফিন্যান্স ও ব্যাংকিং" }, code: "BD-152-SSC", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Business Entrepreneurship", nameI18n: { en: "Business Entrepreneurship", bn: "ব্যবসায় উদ্যোগ" }, code: "BD-143-SSC", type: "THEORY", totalMarks: 100, passMarks: 33 },
          ],
        },
        {
          name: "Class 10 (SSC - ১০ম শ্রেণি)",
          code: "BD-SSC-10",
          sequence: 10,
          sections: ["Science Stream (বিজ্ঞান)", "Business Studies (ব্যবসায় শিক্ষা)", "Humanities (মানবিক)"],
          ageGroup: "15-16 years",
          subjects: [
            { name: "Bangla (Paper I & II)", nameI18n: { en: "Bangla (Paper I & II)", bn: "বাংলা (প্রথম ও দ্বিতীয় পত্র)" }, code: "BD-101-SSC", type: "THEORY", totalMarks: 200, passMarks: 66 },
            { name: "English (Paper I & II)", nameI18n: { en: "English (Paper I & II)", bn: "ইংরেজি (প্রথম ও দ্বিতীয় পত্র)" }, code: "BD-107-SSC", type: "THEORY", totalMarks: 200, passMarks: 66 },
            { name: "Mathematics", nameI18n: { en: "Mathematics", bn: "গণিত" }, code: "BD-109-SSC", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Physics", nameI18n: { en: "Physics", bn: "পদার্থবিজ্ঞান" }, code: "BD-136-SSC", type: "BOTH", totalMarks: 100, passMarks: 33 },
            { name: "Chemistry", nameI18n: { en: "Chemistry", bn: "রসায়ন" }, code: "BD-137-SSC", type: "BOTH", totalMarks: 100, passMarks: 33 },
            { name: "Biology", nameI18n: { en: "Biology", bn: "জীববিজ্ঞান" }, code: "BD-138-SSC", type: "BOTH", totalMarks: 100, passMarks: 33 },
            { name: "Higher Mathematics", nameI18n: { en: "Higher Mathematics", bn: "উচ্চতর গণিত" }, code: "BD-126-SSC", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Accounting", nameI18n: { en: "Accounting", bn: "হিসাববিজ্ঞান" }, code: "BD-146-SSC", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Finance and Banking", nameI18n: { en: "Finance and Banking", bn: "ফিন্যান্স ও ব্যাংকিং" }, code: "BD-152-SSC", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Business Entrepreneurship", nameI18n: { en: "Business Entrepreneurship", bn: "ব্যবসায় উদ্যোগ" }, code: "BD-143-SSC", type: "THEORY", totalMarks: 100, passMarks: 33 },
          ],
        },
        // Higher Secondary / HSC 11-12
        {
          name: "Class 11 (HSC - ১ম বর্ষ)",
          code: "BD-HSC-11",
          sequence: 11,
          sections: ["Science Stream (বিজ্ঞান)", "Business Studies (ব্যবসায় শিক্ষা)", "Humanities (মানবিক)"],
          ageGroup: "16-17 years",
          subjects: [
            { name: "Bangla 1st Paper", nameI18n: { en: "Bangla 1st Paper", bn: "বাংলা ১ম পত্র" }, code: "BD-101-HSC", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Bangla 2nd Paper", nameI18n: { en: "Bangla 2nd Paper", bn: "বাংলা ২য় পত্র" }, code: "BD-202-HSC", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "English 1st Paper", nameI18n: { en: "English 1st Paper", bn: "ইংরেজি ১ম পত্র" }, code: "BD-107-HSC", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "English 2nd Paper", nameI18n: { en: "English 2nd Paper", bn: "ইংরেজি ২য় পত্র" }, code: "BD-108-HSC", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Information & Communication Technology", nameI18n: { en: "Information & Communication Technology", bn: "তথ্য ও যোগাযোগ প্রযুক্তি" }, code: "BD-275-HSC", type: "BOTH", totalMarks: 100, passMarks: 33 },
            { name: "Physics 1st Paper", nameI18n: { en: "Physics 1st Paper", bn: "পদার্থবিজ্ঞান ১ম পত্র" }, code: "BD-178-HSC", type: "BOTH", totalMarks: 100, passMarks: 33 },
            { name: "Chemistry 1st Paper", nameI18n: { en: "Chemistry 1st Paper", bn: "রসায়ন ১ম পত্র" }, code: "BD-176-HSC", type: "BOTH", totalMarks: 100, passMarks: 33 },
          ],
        },
        {
          name: "Class 12 (HSC - ২য় বর্ষ)",
          code: "BD-HSC-12",
          sequence: 12,
          sections: ["Science Stream (বিজ্ঞান)", "Business Studies (ব্যবসায় শিক্ষা)", "Humanities (মানবিক)"],
          ageGroup: "17-18 years",
          subjects: [
            { name: "Bangla 1st Paper", nameI18n: { en: "Bangla 1st Paper", bn: "বাংলা ১ম পত্র" }, code: "BD-101-HSC", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Bangla 2nd Paper", nameI18n: { en: "Bangla 2nd Paper", bn: "বাংলা ২য় পত্র" }, code: "BD-202-HSC", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "English 1st Paper", nameI18n: { en: "English 1st Paper", bn: "ইংরেজি ১ম পত্র" }, code: "BD-107-HSC", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "English 2nd Paper", nameI18n: { en: "English 2nd Paper", bn: "ইংরেজি ২য় পত্র" }, code: "BD-108-HSC", type: "THEORY", totalMarks: 100, passMarks: 33 },
            { name: "Information & Communication Technology", nameI18n: { en: "Information & Communication Technology", bn: "তথ্য ও যোগাযোগ প্রযুক্তি" }, code: "BD-275-HSC", type: "BOTH", totalMarks: 100, passMarks: 33 },
            { name: "Physics 1st Paper", nameI18n: { en: "Physics 1st Paper", bn: "পদার্থবিজ্ঞান ১ম পত্র" }, code: "BD-178-HSC", type: "BOTH", totalMarks: 100, passMarks: 33 },
            { name: "Chemistry 1st Paper", nameI18n: { en: "Chemistry 1st Paper", bn: "রসায়ন ১ম পত্র" }, code: "BD-176-HSC", type: "BOTH", totalMarks: 100, passMarks: 33 },
          ],
        },
      ];

    case "PRIMARY_1_5":
      return [1, 2, 3, 4, 5].map((grade, idx) => ({
        name: `Class ${grade}`,
        code: `CLS-${grade}`,
        sequence: idx + 1,
        sections: ["Section A", "Section B"],
        subjects: primarySubjects,
      }));

    case "MIDDLE_6_8":
      return [6, 7, 8].map((grade, idx) => ({
        name: `Class ${grade}`,
        code: `CLS-${grade}`,
        sequence: idx + 1,
        sections: ["Section A", "Section B"],
        subjects: commonSubjects,
      }));

    case "SECONDARY_9_10":
      return [
        {
          name: "Class 9 (Matric Part 1)",
          code: "CLS-9",
          sequence: 1,
          sections: ["Section A", "Section B"],
          subjects: [
            { name: "English Compulsory", code: "ENG-9", type: "THEORY" },
            { name: "Mathematics (Science)", code: "MATH-9", type: "THEORY" },
            { name: "Physics", code: "PHY-9", type: "BOTH" },
            { name: "Chemistry", code: "CHEM-9", type: "BOTH" },
            { name: "Biology / Computer Science", code: "BIO-CS-9", type: "BOTH" },
            { name: "Islamiat Compulsory", code: "ISL-9", type: "THEORY" },
          ],
        },
        {
          name: "Class 10 (Matric Part 2)",
          code: "CLS-10",
          sequence: 2,
          sections: ["Section A", "Section B"],
          subjects: [
            { name: "English Compulsory", code: "ENG-10", type: "THEORY" },
            { name: "Mathematics", code: "MATH-10", type: "THEORY" },
            { name: "Physics", code: "PHY-10", type: "BOTH" },
            { name: "Chemistry", code: "CHEM-10", type: "BOTH" },
            { name: "Biology / Computer Science", code: "BIO-CS-10", type: "BOTH" },
            { name: "Pakistan Studies", code: "PST-10", type: "THEORY" },
          ],
        },
      ];

    case "HIGHER_SEC_11_12":
      return [
        {
          name: "Grade 11 (HSSC-I / Intermediate)",
          code: "HSSC-1",
          sequence: 1,
          sections: ["FSc Pre-Medical", "FSc Pre-Engineering", "ICS Computer Science", "I.Com"],
          subjects: commonSubjects,
        },
        {
          name: "Grade 12 (HSSC-II / Intermediate)",
          code: "HSSC-2",
          sequence: 2,
          sections: ["FSc Pre-Medical", "FSc Pre-Engineering", "ICS Computer Science", "I.Com"],
          subjects: commonSubjects,
        },
      ];

    case "O_A_LEVELS":
      return [
        { name: "O-Level Year 1 (Grade 9)", code: "O1", sequence: 1, sections: ["Section A"], subjects: commonSubjects },
        { name: "O-Level Year 2 (Grade 10)", code: "O2", sequence: 2, sections: ["Section A"], subjects: commonSubjects },
        { name: "O-Level Year 3 (Grade 11)", code: "O3", sequence: 3, sections: ["Section A"], subjects: commonSubjects },
        { name: "A-Level Year 1 (AS)", code: "A1", sequence: 4, sections: ["Science", "Business"], subjects: commonSubjects },
        { name: "A-Level Year 2 (A2)", code: "A2", sequence: 5, sections: ["Science", "Business"], subjects: commonSubjects },
      ];

    case "MADRASA":
      return [
        { name: "Nazra Quran", code: "NZR", sequence: 1, sections: ["Morning", "Evening"], subjects: [{ name: "Quran Recitation & Tajweed", code: "TAJ", type: "THEORY" }] },
        { name: "Hifz-ul-Quran", code: "HFZ", sequence: 2, sections: ["Dormitory", "Day"], subjects: [{ name: "Hifz Revision & Sabaq", code: "HFZ-SAB", type: "THEORY" }] },
        { name: "Dars-e-Nizami (Awwal)", code: "DN-1", sequence: 3, sections: ["Darja Awwal"], subjects: [{ name: "Arabic Grammar & Fiqh", code: "AR-FQ", type: "THEORY" }] },
        { name: "Dars-e-Nizami (Saani)", code: "DN-2", sequence: 4, sections: ["Darja Saani"], subjects: [{ name: "Hadith & Fiqh Principles", code: "HD-USL", type: "THEORY" }] },
      ];

    case "CUSTOM":
      return [];

    case "K_12":
    default:
      return [
        { name: "Playgroup", code: "PG", sequence: 1, sections: ["Rose"], subjects: earlyYearsSubjects },
        { name: "Nursery", code: "NUR", sequence: 2, sections: ["Tulip"], subjects: earlyYearsSubjects },
        { name: "Kindergarten (KG)", code: "KG", sequence: 3, sections: ["Lotus"], subjects: earlyYearsSubjects },
        { name: "Grade 1", code: "GR-1", sequence: 4, sections: ["Section A", "Section B"], subjects: primarySubjects },
        { name: "Grade 2", code: "GR-2", sequence: 5, sections: ["Section A", "Section B"], subjects: primarySubjects },
        { name: "Grade 3", code: "GR-3", sequence: 6, sections: ["Section A", "Section B"], subjects: primarySubjects },
        { name: "Grade 4", code: "GR-4", sequence: 7, sections: ["Section A", "Section B"], subjects: primarySubjects },
        { name: "Grade 5", code: "GR-5", sequence: 8, sections: ["Section A", "Section B"], subjects: primarySubjects },
        { name: "Grade 6", code: "GR-6", sequence: 9, sections: ["Section A"], subjects: commonSubjects },
        { name: "Grade 7", code: "GR-7", sequence: 10, sections: ["Section A"], subjects: commonSubjects },
        { name: "Grade 8", code: "GR-8", sequence: 11, sections: ["Section A"], subjects: commonSubjects },
        { name: "Grade 9", code: "GR-9", sequence: 12, sections: ["Science", "Arts"], subjects: commonSubjects },
        { name: "Grade 10", code: "GR-10", sequence: 13, sections: ["Science", "Arts"], subjects: commonSubjects },
      ];
  }
}

/**
 * Generates a clean tenant identifier from a school name.
 * e.g. "Beaconhouse School System" -> "beaconhouse-school-system"
 */
export function generateTenantSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 24);
}
